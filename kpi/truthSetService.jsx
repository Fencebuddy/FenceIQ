/**
 * TRUTH SET SERVICE
 * Deterministic canonical data for KPI computation
 * Enforces data integrity rules and inclusion criteria
 */

import { base44 } from '@/api/base44Client';

/**
 * Get signed deals truth set with full integrity checks
 * Inclusion rule: contractStatus === 'signed' (signature optional)
 */
export async function getSignedDealsTruthSet({ companyId, dateStart, dateEnd, repId, territoryId, leadSource, productSystem, financingOnly }) {
    // Fetch all CRM jobs
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    // Batch load snapshots
    const allProposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    const allJobCostSnapshots = await base44.entities.JobCostSnapshot.list();
    
    // Build lookup maps
    const proposalMap = new Map();
    allProposalSnapshots.forEach(pps => {
        proposalMap.set(pps.id, pps);
        if (pps.job_id) proposalMap.set(pps.job_id, pps);
    });
    
    const costMap = new Map();
    allJobCostSnapshots.forEach(jcs => {
        if (jcs.jobId) costMap.set(jcs.jobId, jcs);
    });
    
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    end.setDate(end.getDate() + 1);
    
    const truthRows = [];
    
    for (const job of allJobs) {
        // INCLUSION RULE: contractStatus === 'signed'
        if (job.contractStatus !== 'signed') continue;
        
        // Date filter
        const jobDate = new Date(job.wonAt || job.saleStatusUpdatedAt || job.created_date);
        if (jobDate < start || jobDate > end) continue;
        
        // Apply optional filters
        if (repId && job.assignedRepUserId !== repId) continue;
        if (territoryId && job.territoryId !== territoryId) continue;
        if (leadSource && job.source !== leadSource) continue;
        if (productSystem && job.fenceCategory !== productSystem) continue;
        
        // Get proposal snapshot
        let proposalSnapshot = null;
        if (job.currentProposalSnapshotId) {
            proposalSnapshot = proposalMap.get(job.currentProposalSnapshotId);
        }
        if (!proposalSnapshot && job.externalJobId) {
            proposalSnapshot = proposalMap.get(job.externalJobId);
        }
        
        // Integrity flags
        let integrityStatus = 'OK';
        let missingFields = [];
        
        if (!proposalSnapshot) {
            integrityStatus = 'MISSING_PROPOSAL';
            missingFields.push('proposal_snapshot');
        }
        
        let agreedSubtotal = 0;
        let directCost = 0;
        let overheadPercent = 0.14;
        let commissionPercent = 0.10;
        let modelSellPrice = null;
        let presentedSellPrice = null;
        let overrideApplied = false;
        
        if (proposalSnapshot) {
            agreedSubtotal = proposalSnapshot.agreed_subtotal || 0;
            overheadPercent = proposalSnapshot.overhead_percent || 0.14;
            commissionPercent = proposalSnapshot.commission_percent || 0.10;
            modelSellPrice = proposalSnapshot.model_sell_price;
            presentedSellPrice = proposalSnapshot.presented_sell_price;
            overrideApplied = proposalSnapshot.override_applied || false;
            
            // Cost resolution: proposal first, fallback to JobCostSnapshot
            if (proposalSnapshot.direct_cost && proposalSnapshot.direct_cost > 0) {
                directCost = proposalSnapshot.direct_cost;
            } else if (job.externalJobId) {
                const costSnapshot = costMap.get(job.externalJobId);
                if (costSnapshot && costSnapshot.direct_cost > 0) {
                    directCost = costSnapshot.direct_cost;
                } else {
                    integrityStatus = 'MISSING_COST';
                    missingFields.push('direct_cost');
                }
            } else {
                integrityStatus = 'MISSING_COST';
                missingFields.push('direct_cost');
            }
            
            // Model availability check
            if (!modelSellPrice || modelSellPrice <= 0) {
                if (integrityStatus === 'OK') {
                    integrityStatus = 'MODEL_UNAVAILABLE';
                }
                missingFields.push('model_sell_price');
            }
        }
        
        // Calculate net profit
        let netProfit = 0;
        let netMarginPct = 0;
        
        if (integrityStatus !== 'MISSING_COST' && directCost > 0) {
            const overhead = agreedSubtotal * overheadPercent;
            const commission = agreedSubtotal * commissionPercent;
            netProfit = agreedSubtotal - directCost - overhead - commission;
            netMarginPct = agreedSubtotal > 0 ? (netProfit / agreedSubtotal) * 100 : 0;
        }
        
        truthRows.push({
            crmJobId: job.id,
            jobNumber: job.jobNumber,
            customerName: job.customerName,
            repUserId: job.assignedRepUserId,
            territoryId: job.territoryId,
            leadSource: job.source,
            productSystem: job.fenceCategory,
            wonAt: job.wonAt || job.created_date,
            agreedSubtotal,
            directCost,
            netProfit,
            netMarginPct,
            overheadPercent,
            commissionPercent,
            modelSellPrice,
            presentedSellPrice,
            overrideApplied,
            integrityStatus,
            missingFields,
            proposalSnapshotId: job.currentProposalSnapshotId,
            hasFinancing: job.financingEnabled || false
        });
    }
    
    console.log('[Truth Set] Signed deals:', {
        total: truthRows.length,
        ok: truthRows.filter(r => r.integrityStatus === 'OK').length,
        missingProposal: truthRows.filter(r => r.integrityStatus === 'MISSING_PROPOSAL').length,
        missingCost: truthRows.filter(r => r.integrityStatus === 'MISSING_COST').length,
        modelUnavailable: truthRows.filter(r => r.integrityStatus === 'MODEL_UNAVAILABLE').length
    });
    
    return truthRows;
}

/**
 * Get appointments truth set
 */
export async function getAppointmentsTruthSet({ companyId, dateStart, dateEnd, repId }) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    end.setDate(end.getDate() + 1);
    
    const rows = [];
    
    for (const job of allJobs) {
        const jobDate = new Date(job.created_date);
        if (jobDate < start || jobDate > end) continue;
        if (repId && job.assignedRepUserId !== repId) continue;
        
        let status = 'SET';
        if (job.appointmentStatus === 'cancelled') status = 'CANCELED';
        else if (job.appointmentStatus === 'completed') status = 'RAN';
        
        rows.push({
            crmJobId: job.id,
            jobNumber: job.jobNumber,
            repUserId: job.assignedRepUserId,
            status,
            scheduledAt: job.appointmentDateTime || job.created_date,
            ranAt: job.appointmentStatus === 'completed' ? job.updated_date : null
        });
    }
    
    return rows;
}

/**
 * Get pricing discipline truth set
 * Only includes jobs with valid model prices
 */
export async function getPricingDisciplineTruthSet({ companyId, dateStart, dateEnd, repId }) {
    const signedDeals = await getSignedDealsTruthSet({ 
        companyId, 
        dateStart, 
        dateEnd, 
        repId 
    });
    
    // Filter to only jobs with valid model prices
    const eligible = signedDeals.filter(deal => {
        return deal.modelSellPrice && deal.modelSellPrice > 0 &&
               deal.presentedSellPrice && deal.presentedSellPrice > 0;
    });
    
    const rows = eligible.map(deal => {
        const model = deal.modelSellPrice;
        const presented = deal.presentedSellPrice;
        const deviation = Math.abs((presented - model) / model);
        const isOverride = deviation > 0.02; // 2% tolerance
        
        return {
            ...deal,
            deviation: deviation * 100,
            isOverride
        };
    });
    
    return rows;
}

/**
 * Get production truth set
 */
export async function getProductionTruthSet({ companyId, dateStart, dateEnd, crewId }) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    end.setDate(end.getDate() + 1);
    
    const rows = [];
    
    for (const job of allJobs) {
        if (job.contractStatus !== 'signed') continue;
        
        const jobDate = new Date(job.wonAt || job.created_date);
        if (jobDate < start || jobDate > end) continue;
        if (crewId && job.crewId !== crewId) continue;
        
        const now = new Date();
        const daysInStage = job.installStageUpdatedAt 
            ? Math.floor((now - new Date(job.installStageUpdatedAt)) / (1000 * 60 * 60 * 24))
            : 0;
        
        rows.push({
            crmJobId: job.id,
            jobNumber: job.jobNumber,
            installStage: job.installStage || 'SOLD_NOT_SCHEDULED',
            daysInStage,
            crewId: job.crewId,
            scheduledAt: job.installScheduledAt,
            completedAt: job.installCompletedAt
        });
    }
    
    return rows;
}