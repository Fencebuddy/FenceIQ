import { base44 } from '@/api/base44Client';
import { isSoldForReporting } from './jobStatusService';

/**
 * Data Quality Diagnostics Service
 * Permanent diagnostic queries to detect reporting inconsistencies
 */

/**
 * DIAGNOSTIC 1: Installed jobs not counting toward KPIs
 * Expected: 0 (all installed jobs should count as sold)
 */
export async function getInstalledButNotCounted(companyId) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    const suspects = allJobs.filter(job => {
        return job.installStatus === 'installed' 
            && !job.saleVoidedAt 
            && !isSoldForReporting(job);
    });
    
    return {
        count: suspects.length,
        jobs: suspects.map(j => ({
            id: j.id,
            jobNumber: j.jobNumber,
            installStatus: j.installStatus,
            saleStatus: j.saleStatus,
            contractStatus: j.contractStatus,
            paymentStatus: j.paymentStatus,
            reason: 'Installed but isSoldForReporting returns false'
        }))
    };
}

/**
 * DIAGNOSTIC 2: Paid jobs not counting toward KPIs
 * Expected: 0 (all paid jobs should count as sold)
 */
export async function getPaidButNotCounted(companyId) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    const suspects = allJobs.filter(job => {
        return job.paymentStatus === 'payment_received' 
            && !job.saleVoidedAt 
            && !isSoldForReporting(job);
    });
    
    return {
        count: suspects.length,
        jobs: suspects.map(j => ({
            id: j.id,
            jobNumber: j.jobNumber,
            paymentStatus: j.paymentStatus,
            saleStatus: j.saleStatus,
            contractStatus: j.contractStatus,
            installStatus: j.installStatus,
            reason: 'Payment received but isSoldForReporting returns false'
        }))
    };
}

/**
 * DIAGNOSTIC 3: Installed jobs with unsold status
 * Expected: trending to 0 (guard rails should auto-correct)
 */
export async function getInstalledWithUnsoldState(companyId) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    const suspects = allJobs.filter(job => {
        return job.installStatus === 'installed' 
            && job.saleStatus === 'unsold'
            && !job.saleVoidedAt;
    });
    
    return {
        count: suspects.length,
        jobs: suspects.map(j => ({
            id: j.id,
            jobNumber: j.jobNumber,
            installStatus: j.installStatus,
            saleStatus: j.saleStatus,
            reason: 'Installed but saleStatus=unsold (guard rail should have prevented this)'
        }))
    };
}

/**
 * DIAGNOSTIC 4: Stale update suspects
 * Jobs with recent activity events but old updatedAt timestamps
 */
export async function getStaleUpdateSuspects(companyId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get recent activity events
    const recentEvents = await base44.entities.CRMActivityEvent.filter({
        companyId
    });
    
    const installPaymentEvents = recentEvents.filter(evt => {
        return (evt.type === 'install_status_updated' || evt.type === 'payment_status_updated')
            && new Date(evt.created_date) > new Date(oneDayAgo);
    });
    
    const suspects = [];
    
    for (const evt of installPaymentEvents) {
        const jobId = evt.jobId;
        const jobs = await base44.entities.CRMJob.filter({ id: jobId });
        const job = jobs[0];
        
        if (job && new Date(job.updated_date) < new Date(evt.created_date)) {
            suspects.push({
                id: job.id,
                jobNumber: job.jobNumber,
                eventType: evt.type,
                eventDate: evt.created_date,
                jobUpdatedDate: job.updated_date,
                reason: 'Activity event is newer than job updated_date (possible persistence failure)'
            });
        }
    }
    
    return {
        count: suspects.length,
        jobs: suspects
    };
}

/**
 * Run all diagnostics and return summary
 */
export async function runAllDiagnostics(companyId) {
    const [installedNotCounted, paidNotCounted, installedUnsold, staleUpdates] = await Promise.all([
        getInstalledButNotCounted(companyId),
        getPaidButNotCounted(companyId),
        getInstalledWithUnsoldState(companyId),
        getStaleUpdateSuspects(companyId)
    ]);
    
    const totalIssues = 
        installedNotCounted.count + 
        paidNotCounted.count + 
        installedUnsold.count + 
        staleUpdates.count;
    
    return {
        totalIssues,
        diagnostics: {
            installedButNotCounted: installedNotCounted,
            paidButNotCounted: paidNotCounted,
            installedWithUnsoldState: installedUnsold,
            staleUpdateSuspects: staleUpdates
        }
    };
}

/**
 * Auto-correct installed/paid jobs with wrong saleStatus
 * This is a repair function that should only be needed once
 */
export async function autoCorrectReportingIssues(companyId) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    const corrected = [];
    
    for (const job of allJobs) {
        let needsCorrection = false;
        const updates = {};
        
        // Auto-correct installed jobs
        if (job.installStatus === 'installed' && job.saleStatus !== 'sold') {
            needsCorrection = true;
            updates.saleStatus = 'sold';
            updates.contractStatus = 'signed';
            updates.lossType = 'na';
            updates.saleStatusReason = 'Auto-corrected by data quality repair';
        }
        
        // Auto-correct paid jobs
        if (job.paymentStatus === 'payment_received' && job.saleStatus !== 'sold') {
            needsCorrection = true;
            updates.saleStatus = 'sold';
            updates.contractStatus = 'signed';
            updates.lossType = 'na';
            updates.saleStatusReason = 'Auto-corrected by data quality repair';
        }
        
        if (needsCorrection) {
            await base44.entities.CRMJob.update(job.id, updates);
            corrected.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                corrections: updates
            });
        }
    }
    
    return {
        correctedCount: corrected.length,
        correctedJobs: corrected
    };
}