import { base44 } from '@/api/base44Client';

/**
 * Data Quality Service - Diagnostic queries for reporting data issues
 */

/**
 * Get data quality metrics
 */
export async function getDataQuality({ companyId, dateStart, dateEnd }) {
    const results = {
        signedMissingSignatureRecordCount: 0,
        signedMissingSignatureRecordJobIds: [],
        signedMissingSentAtCount: 0,
        signedMissingSentAtProposalIds: [],
        soldNoActiveSignatureCount: 0,
        soldNoActiveSignatureJobIds: [],
        installedNotClosedOutCount: 0,
        installedNotClosedOutJobIds: [],
        invalidatedStillSoldCount: 0,
        invalidatedStillSoldJobIds: []
    };

    // 1) Signed jobs missing SignatureRecord
    const signedJobs = await base44.entities.CRMJob.filter({
        companyId,
        contractStatus: 'signed',
        saleStatus: 'sold'
    });

    for (const job of signedJobs) {
        const sigs = await base44.entities.SignatureRecord.filter({
            companyId,
            jobId: job.id,
            status: 'active'
        });
        
        if (sigs.length === 0) {
            results.signedMissingSignatureRecordCount++;
            results.signedMissingSignatureRecordJobIds.push(job.id);
        }
    }

    // 2) Signed proposals missing sentAt
    try {
        const proposals = await base44.entities.ProposalPricingSnapshot.filter({});
        
        const filteredProposals = proposals.filter(p => {
            if (p.status !== 'signed') return false;
            if (p.sentAt) return false;
            
            const created = new Date(p.created_date);
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            
            return created >= start && created <= end;
        });

        results.signedMissingSentAtCount = filteredProposals.length;
        results.signedMissingSentAtProposalIds = filteredProposals.map(p => p.id);
    } catch (e) {
        console.warn('[DataQuality] Failed to check ProposalPricingSnapshot:', e);
    }

    // 3) Sold jobs with no active signature
    const soldJobs = await base44.entities.CRMJob.filter({
        companyId,
        saleStatus: 'sold'
    });

    for (const job of soldJobs) {
        const sigs = await base44.entities.SignatureRecord.filter({
            companyId,
            jobId: job.id,
            status: 'active'
        });
        
        if (sigs.length === 0) {
            results.soldNoActiveSignatureCount++;
            results.soldNoActiveSignatureJobIds.push(job.id);
        }
    }

    // 4) Installed jobs not closed out
    try {
        const installedJobs = await base44.entities.CRMJob.filter({
            companyId,
            installStatus: 'installed'
        });

        for (const job of installedJobs) {
            const variances = await base44.entities.VarianceSummary.filter({
                companyId,
                jobId: job.id
            });
            
            const hasCloseout = variances.some(v => v.closedOutAt);
            
            if (!hasCloseout) {
                results.installedNotClosedOutCount++;
                results.installedNotClosedOutJobIds.push(job.id);
            }
        }
    } catch (e) {
        console.warn('[DataQuality] VarianceSummary not available:', e);
    }

    // 5) Invalidated but still sold
    const invalidatedSold = await base44.entities.CRMJob.filter({
        companyId,
        contractStatus: 'invalidated',
        saleStatus: 'sold'
    });

    results.invalidatedStillSoldCount = invalidatedSold.length;
    results.invalidatedStillSoldJobIds = invalidatedSold.map(j => j.id);

    return results;
}