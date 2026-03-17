import { base44 } from '@/api/base44Client';

/**
 * Job UX Service - Shared helpers for status labels and next actions
 */

/**
 * Compute job list label with badge type
 */
export function computeJobListLabel(job) {
    // Priority order
    if (job.installStatus === 'installed') {
        return { label: 'Installed', badgeType: 'success' };
    }
    
    if (job.paymentStatus === 'payment_received') {
        return { label: 'Payment Received', badgeType: 'success' };
    }
    
    if (job.saleStatus === 'sold' && job.paymentStatus === 'payment_pending') {
        return { label: 'Payment Pending', badgeType: 'warning' };
    }
    
    if (job.saleStatus === 'sold' && job.contractStatus === 'signed') {
        return { label: 'Signed/Sold', badgeType: 'success' };
    }
    
    if (job.saleStatus === 'unsold' && job.lossType === 'demo_no_sale') {
        return { label: 'Demo No-Sale', badgeType: 'danger' };
    }
    
    if (job.saleStatus === 'unsold' && job.lossType === 'sale_lost') {
        return { label: 'Sale Lost', badgeType: 'danger' };
    }
    
    if (job.contractStatus === 'invalidated') {
        return { label: 'Needs Re-Sign', badgeType: 'warning' };
    }
    
    return { label: 'Open', badgeType: 'neutral' };
}

/**
 * Get next action for a job
 */
export function getNextAction(job, latestProposal, activeSignature) {
    // 1) Invalidated => Re-sign
    if (job.saleStatus === 'unsold' && job.contractStatus === 'invalidated') {
        return {
            key: 'resign',
            label: 'Re-Send for Signature',
            route: `/Proposal?jobId=${job.externalJobId}`
        };
    }
    
    // 2) No proposal => Create
    if (!latestProposal) {
        return {
            key: 'create_proposal',
            label: 'Create Proposal',
            route: `/PricePresentation?jobId=${job.externalJobId}`
        };
    }
    
    // 3) Draft or not sent => Send
    if (['draft', 'created'].includes(latestProposal.status) || !latestProposal.sentAt) {
        return {
            key: 'send_proposal',
            label: 'Send Proposal',
            route: `/Proposal?jobId=${job.externalJobId}`
        };
    }
    
    // 4) Sent but not signed => Collect signature
    if (latestProposal.sentAt && (latestProposal.status !== 'signed' || !activeSignature)) {
        return {
            key: 'collect_signature',
            label: 'Collect Signature',
            route: `/Proposal?jobId=${job.externalJobId}`
        };
    }
    
    // 5) Signed but payment not received => Collect payment
    if (job.paymentStatus !== 'payment_received') {
        return {
            key: 'collect_payment',
            label: 'Collect Payment',
            route: `/JobDetail?jobId=${job.externalJobId}`
        };
    }
    
    // 6) Payment received but not installed => Schedule install
    if (job.installStatus !== 'installed') {
        return {
            key: 'schedule_install',
            label: 'Schedule Install',
            route: `/JobDetail?jobId=${job.externalJobId}`
        };
    }
    
    // 7) All done => View summary
    return {
        key: 'view_summary',
        label: 'View Summary',
        route: `/JobDetail?jobId=${job.externalJobId}`
    };
}

/**
 * Fetch job context (job, latest proposal, active signature)
 */
export async function fetchJobContext({ companyId, jobId }) {
    // Load CRMJob
    const jobs = await base44.entities.CRMJob.filter({ id: jobId });
    const job = jobs[0];
    
    if (!job) {
        throw new Error('Job not found');
    }
    
    // Load latest ProposalSnapshot (try both entities)
    let latestProposal = null;
    try {
        const proposals = await base44.entities.ProposalPricingSnapshot.filter({
            job_id: job.externalJobId
        });
        if (proposals.length > 0) {
            proposals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            latestProposal = proposals[0];
        }
    } catch (e) {
        console.warn('Failed to load ProposalPricingSnapshot:', e);
    }
    
    // Fallback to ProposalSnapshot
    if (!latestProposal) {
        try {
            const proposals = await base44.entities.ProposalSnapshot.filter({
                jobId: job.id
            });
            if (proposals.length > 0) {
                proposals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                latestProposal = proposals[0];
            }
        } catch (e) {
            console.warn('Failed to load ProposalSnapshot:', e);
        }
    }
    
    // Load active SignatureRecord
    const signatures = await base44.entities.SignatureRecord.filter({
        companyId,
        jobId: job.id,
        status: 'active'
    });
    
    let activeSignature = null;
    if (signatures.length > 0) {
        signatures.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));
        activeSignature = signatures[0];
    }
    
    return {
        job,
        latestProposal,
        activeSignature
    };
}