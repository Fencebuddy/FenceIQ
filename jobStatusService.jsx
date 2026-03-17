import { base44 } from '@/api/base44Client';
import { emitEvent } from './crmService';

/**
 * Job Status Service
 * Single source of truth for sale status management
 */

/**
 * Get active signature for a job
 */
export async function getActiveSignatureForJob({ companyId, jobId }) {
    const signatures = await base44.entities.SignatureRecord.filter({
        companyId,
        jobId,
        status: 'active'
    });
    
    if (signatures.length === 0) return null;
    
    // Return most recent by signedAt
    signatures.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));
    return signatures[0];
}

/**
 * Invalidate all active signatures for a job
 */
export async function invalidateAllSignaturesForJob({ companyId, jobId, userId, reason }) {
    const signatures = await base44.entities.SignatureRecord.filter({
        companyId,
        jobId,
        status: 'active'
    });
    
    const now = new Date().toISOString();
    
    for (const sig of signatures) {
        await base44.entities.SignatureRecord.update(sig.id, {
            status: 'invalidated',
            invalidatedAt: now,
            invalidatedByUserId: userId,
            invalidationReason: reason
        });
    }
    
    return signatures.length;
}

/**
 * Mark job as sold (requires active signature)
 */
export async function markJobSold({ companyId, jobId, userId, reason }) {
    console.log('[jobStatusService] markJobSold START:', { companyId, jobId, userId, reason });
    
    // CRITICAL FIX: Call backend revenue lock function instead of direct update
    // This ensures SaleSnapshot creation and proper contractValueCents enforcement
    try {
        const lockResult = await base44.functions.invoke('sales/acceptProposalAndLockSale', {
            jobId,
            signaturePayload: null,
            invokedFrom: 'Jobs_MarkSold_Dropdown'
        });
        
        if (!lockResult?.data?.ok) {
            const errorMsg = lockResult?.data?.error || 'Sale lock failed';
            console.error('[jobStatusService] Revenue lock FAILED:', errorMsg);
            throw new Error(errorMsg);
        }
        
        console.log('[jobStatusService] ✅ Revenue lock SUCCESS via backend function');
        
        // Emit event
        await emitEvent(jobId, 'sale_marked_sold', userId, {
            jobId,
            reason,
            contractValueCents: lockResult.data.contractValueCents
        });
        
        return { 
            success: true, 
            updatedJob: null,
            contractValueCents: lockResult.data.contractValueCents,
            saleSnapshotId: lockResult.data.saleSnapshotId
        };
    } catch (error) {
        console.error('[jobStatusService] markJobSold FAILED:', error);
        throw error;
    }
}

/**
 * Mark job as unsold (invalidates all signatures)
 * BLOCKED if job is installed or payment received (reality cannot be undone)
 */
export async function markJobUnsold({ companyId, jobId, userId, reason, lossType }) {
    console.log('[jobStatusService] markJobUnsold START:', { companyId, jobId, userId, reason, lossType });
    
    // GUARD RAIL: Cannot mark installed/paid jobs unsold (reality override)
    const beforeJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const beforeJob = beforeJobs[0];
    
    if (!beforeJob) throw new Error('Job not found');
    
    if (beforeJob.installStatus === 'installed') {
        throw new Error('Cannot mark installed jobs unsold. Reality cannot be undone. Use Void Sale instead.');
    }
    
    if (beforeJob.paymentStatus === 'payment_received') {
        throw new Error('Cannot mark paid jobs unsold. Reality cannot be undone. Use Void Sale instead.');
    }
    
    const now = new Date().toISOString();
    
    // Invalidate all active signatures
    const invalidatedCount = await invalidateAllSignaturesForJob({
        companyId,
        jobId,
        userId,
        reason: reason || 'Marked unsold'
    });
    
    const updates = {
        saleStatus: 'unsold',
        contractStatus: 'invalidated',
        lossType: lossType || 'sale_lost',
        saleStatusUpdatedAt: now,
        saleStatusUpdatedByUserId: userId,
        saleStatusReason: reason || null
    };
    
    await base44.entities.CRMJob.update(jobId, updates);
    
    // Verify
    const afterJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const afterJob = afterJobs[0];
    
    if (afterJob.saleStatus !== 'unsold') {
        throw new Error(`PERSISTENCE FAILURE: saleStatus did not update to unsold (got: ${afterJob.saleStatus})`);
    }
    
    console.log('[jobStatusService] ✅ Job marked unsold, persistence verified');
    
    // Update latest ProposalSnapshot (if exists)
    if (beforeJob?.currentProposalSnapshotId) {
        try {
            await base44.entities.ProposalSnapshot.update(beforeJob.currentProposalSnapshotId, {
                requiresResign: true,
                resignReason: reason || 'Marked unsold'
            });
        } catch (e) {
            console.warn('[jobStatusService] Failed to update ProposalSnapshot:', e);
        }
    }
    
    // Emit events
    await emitEvent(jobId, 'sale_marked_unsold', userId, {
        jobId,
        reason,
        lossType
    });
    
    if (invalidatedCount > 0) {
        await emitEvent(jobId, 'signature_invalidated', userId, {
            jobId,
            reason,
            count: invalidatedCount
        });
    }
    
    return { success: true, invalidatedCount, updatedJob: afterJob };
}

/**
 * Set payment status
 * GUARD RAIL: Payment received forces saleStatus=sold (REALITY OVERRIDES MANUAL STATUS)
 */
export async function setPaymentStatus({ companyId, jobId, userId, paymentStatus }) {
    console.log('[jobStatusService] setPaymentStatus START:', { companyId, jobId, userId, paymentStatus });
    
    const now = new Date().toISOString();
    
    // PHASE 1: READ BEFORE STATE
    const beforeJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const beforeJob = beforeJobs[0];
    
    if (!beforeJob) throw new Error('Job not found');
    
    console.log('[jobStatusService] BEFORE state:', { 
        paymentStatus: beforeJob.paymentStatus,
        saleStatus: beforeJob.saleStatus,
        installStatus: beforeJob.installStatus
    });
    
    const updates = { paymentStatus };
    
    // GUARD RAIL: If marking as payment received, force saleStatus=sold
    if (paymentStatus === 'payment_received') {
        // CRITICAL FIX: Call backend revenue lock to create SaleSnapshot
        try {
            const lockResult = await base44.functions.invoke('sales/acceptProposalAndLockSale', {
                jobId: beforeJob.externalJobId,
                signaturePayload: null,
                invokedFrom: 'PaymentReceived_RealityOverride'
            });
            
            if (lockResult?.data?.ok) {
                console.log('[jobStatusService] ✅ Revenue lock SUCCESS on payment received');
            } else {
                console.warn('[jobStatusService] Revenue lock failed but continuing with payment update');
            }
        } catch (lockError) {
            console.warn('[jobStatusService] Revenue lock error (non-blocking):', lockError);
        }
        
        updates.saleStatus = 'sold';
        updates.contractStatus = 'signed';
        updates.lossType = 'na';
        updates.saleStatusUpdatedAt = now;
        updates.saleStatusUpdatedByUserId = userId;
        updates.saleStatusReason = 'Auto-marked sold due to payment received (reality override)';
        
        console.log('[jobStatusService] Payment guard rail: forcing saleStatus=sold (reality-based truth)');
    }
    
    // PHASE 2: WRITE
    console.log('[jobStatusService] Updating CRMJob with:', updates);
    await base44.entities.CRMJob.update(jobId, updates);
    
    // PHASE 3: VERIFY PERSISTENCE
    const afterJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const afterJob = afterJobs[0];
    
    console.log('[jobStatusService] AFTER state:', {
        paymentStatus: afterJob.paymentStatus,
        saleStatus: afterJob.saleStatus,
        installStatus: afterJob.installStatus
    });
    
    // ASSERT: Updates must persist
    if (afterJob.paymentStatus !== updates.paymentStatus) {
        const error = `PERSISTENCE FAILURE: paymentStatus did not persist (expected: ${updates.paymentStatus}, got: ${afterJob.paymentStatus})`;
        console.error('[jobStatusService]', error);
        throw new Error(error);
    }
    
    if (paymentStatus === 'payment_received' && afterJob.saleStatus !== 'sold') {
        const error = `GUARD RAIL FAILURE: paid job must be sold (got saleStatus: ${afterJob.saleStatus})`;
        console.error('[jobStatusService]', error);
        throw new Error(error);
    }
    
    console.log('[jobStatusService] ✅ PERSISTENCE VERIFIED');
    
    await emitEvent(jobId, 'payment_status_updated', userId, {
        paymentStatus,
        autoMarkedSold: paymentStatus === 'payment_received'
    });
    
    console.log('[jobStatusService] setPaymentStatus COMPLETE');
    
    return { success: true, updatedJob: afterJob };
}

/**
 * Set install status
 * GUARD RAIL: Installing a job forces saleStatus=sold (REALITY OVERRIDES MANUAL STATUS)
 */
export async function setInstallStatus({ companyId, jobId, userId, installStatus }) {
    console.log('[jobStatusService] setInstallStatus START:', { companyId, jobId, userId, installStatus });
    
    const now = new Date().toISOString();
    
    // PHASE 1: READ BEFORE STATE
    const beforeJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const beforeJob = beforeJobs[0];
    
    if (!beforeJob) throw new Error('Job not found');
    
    console.log('[jobStatusService] BEFORE state:', { 
        installStatus: beforeJob.installStatus,
        saleStatus: beforeJob.saleStatus,
        contractStatus: beforeJob.contractStatus,
        paymentStatus: beforeJob.paymentStatus
    });
    
    const updates = { installStatus };
    
    // GUARD RAIL: If marking as installed, ALWAYS force saleStatus=sold
    if (installStatus === 'installed') {
        // CRITICAL FIX: Call backend revenue lock to create SaleSnapshot
        try {
            const lockResult = await base44.functions.invoke('sales/acceptProposalAndLockSale', {
                jobId: beforeJob.externalJobId,
                signaturePayload: null,
                invokedFrom: 'InstallComplete_RealityOverride'
            });
            
            if (lockResult?.data?.ok) {
                console.log('[jobStatusService] ✅ Revenue lock SUCCESS on install complete');
            } else {
                console.warn('[jobStatusService] Revenue lock failed but continuing with install update');
            }
        } catch (lockError) {
            console.warn('[jobStatusService] Revenue lock error (non-blocking):', lockError);
        }
        
        updates.saleStatus = 'sold';
        updates.contractStatus = 'signed';
        updates.lossType = 'na';
        updates.saleStatusUpdatedAt = now;
        updates.saleStatusUpdatedByUserId = userId;
        updates.saleStatusReason = 'Auto-marked sold due to installation (reality override)';
        
        console.log('[jobStatusService] Install guard rail: forcing saleStatus=sold (reality-based truth)');
    }
    
    // PHASE 2: WRITE
    console.log('[jobStatusService] Updating CRMJob with:', updates);
    await base44.entities.CRMJob.update(jobId, updates);
    
    // PHASE 3: VERIFY PERSISTENCE
    const afterJobs = await base44.entities.CRMJob.filter({ id: jobId });
    const afterJob = afterJobs[0];
    
    console.log('[jobStatusService] AFTER state:', {
        installStatus: afterJob.installStatus,
        saleStatus: afterJob.saleStatus,
        contractStatus: afterJob.contractStatus,
        paymentStatus: afterJob.paymentStatus
    });
    
    // ASSERT: Updates must persist
    if (afterJob.installStatus !== updates.installStatus) {
        const error = `PERSISTENCE FAILURE: installStatus did not persist (expected: ${updates.installStatus}, got: ${afterJob.installStatus})`;
        console.error('[jobStatusService]', error);
        throw new Error(error);
    }
    
    if (installStatus === 'installed' && afterJob.saleStatus !== 'sold') {
        const error = `GUARD RAIL FAILURE: installed job must be sold (got saleStatus: ${afterJob.saleStatus})`;
        console.error('[jobStatusService]', error);
        throw new Error(error);
    }
    
    console.log('[jobStatusService] ✅ PERSISTENCE VERIFIED');
    
    // Emit event
    await emitEvent(jobId, 'install_status_updated', userId, {
        installStatus,
        autoMarkedSold: installStatus === 'installed'
    });
    
    console.log('[jobStatusService] setInstallStatus COMPLETE');
    
    return { success: true, updatedJob: afterJob };
}

/**
 * Set loss type
 */
export async function setLossType({ companyId, jobId, userId, lossType }) {
    await base44.entities.CRMJob.update(jobId, {
        lossType
    });
    
    await emitEvent(jobId, 'loss_type_set', userId, {
        lossType
    });
    
    return { success: true };
}

/**
 * Compute if job is sold for reporting purposes
 * PRECEDENCE: Reality > Manual Status
 * Returns true if job is installed, paid, signed, OR explicitly sold
 * Returns false ONLY if explicitly voided
 */
export function isSoldForReporting(job) {
    if (!job) return false;
    
    // PRECEDENCE 1: Explicit void overrides everything
    if (job.saleVoidedAt) {
        console.log('[isSoldForReporting] Job voided, returning false:', { jobId: job.id, voidedAt: job.saleVoidedAt });
        return false;
    }
    
    // PRECEDENCE 2: Explicitly unsold (must check before reality fields)
    if (job.saleStatus === 'unsold') {
        console.log('[isSoldForReporting] Job explicitly unsold, returning false:', { jobId: job.id, lossType: job.lossType });
        return false;
    }
    
    // PRECEDENCE 3: Installation is reality
    if (job.installStatus === 'installed') {
        console.log('[isSoldForReporting] Job installed, returning true:', { jobId: job.id });
        return true;
    }
    
    // PRECEDENCE 4: Payment is reality
    if (job.paymentStatus === 'payment_received') {
        console.log('[isSoldForReporting] Job paid, returning true:', { jobId: job.id });
        return true;
    }
    
    // PRECEDENCE 5: Signed is sold
    if (job.contractStatus === 'signed' || job.saleStatus === 'sold') {
        console.log('[isSoldForReporting] Job signed/sold, returning true:', { jobId: job.id, contractStatus: job.contractStatus, saleStatus: job.saleStatus });
        return true;
    }
    
    console.log('[isSoldForReporting] Job not sold, returning false:', { jobId: job.id, contractStatus: job.contractStatus, saleStatus: job.saleStatus });
    return false;
}

/**
 * Compute job list label and badge type
 */
export function computeJobListLabel(job) {
    // Priority order - check reality fields first
    if (job.installStatus === 'installed') {
        return { label: 'Installed', badgeType: 'success' };
    }
    
    if (job.paymentStatus === 'payment_received') {
        return { label: 'Payment Received', badgeType: 'success' };
    }
    
    if (job.contractStatus === 'signed') {
        return { label: 'Signed/Sold', badgeType: 'success' };
    }
    
    if (job.saleStatus === 'sold' && job.paymentStatus === 'payment_pending') {
        return { label: 'Payment Pending', badgeType: 'warning' };
    }
    
    if (job.saleStatus === 'unsold' && job.lossType === 'demo_no_sale') {
        return { label: 'Demo No-Sale', badgeType: 'neutral' };
    }
    
    if (job.saleStatus === 'unsold' && job.lossType === 'sale_lost') {
        return { label: 'Sale Lost', badgeType: 'danger' };
    }
    
    return { label: 'Open', badgeType: 'neutral' };
}