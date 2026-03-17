import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse query params
        const url = new URL(req.url);
        const dateStart = url.searchParams.get('start');
        const dateEnd = url.searchParams.get('end');

        if (!dateStart || !dateEnd) {
            return Response.json({ error: 'Missing start or end date' }, { status: 400 });
        }

        // Get company settings
        const settings = await base44.entities.CompanySettings.filter({});
        const companyId = settings[0]?.id;

        if (!companyId) {
            return Response.json({ error: 'Company settings not found' }, { status: 404 });
        }

        if (!settings[0]?.crmEnabled) {
            return Response.json({ error: 'CRM not enabled' }, { status: 403 });
        }

        // Run data quality checks
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
            console.warn('Failed to check ProposalPricingSnapshot:', e);
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
            console.warn('VarianceSummary not available:', e);
        }

        // 5) Invalidated but still sold
        const invalidatedSold = await base44.entities.CRMJob.filter({
            companyId,
            contractStatus: 'invalidated',
            saleStatus: 'sold'
        });

        results.invalidatedStillSoldCount = invalidatedSold.length;
        results.invalidatedStillSoldJobIds = invalidatedSold.map(j => j.id);

        // Add fix links
        const fixLinks = {
            signedMissingSignatureRecord: '/Jobs?filter=signedMissingSig',
            signedMissingSentAt: '/Jobs?filter=signedMissingSentAt',
            soldNoActiveSignature: '/Jobs?filter=soldNoActiveSig',
            installedNotClosedOut: '/Jobs?filter=installedNotClosedOut',
            invalidatedStillSold: '/Jobs?filter=invalidatedStillSold'
        };

        return Response.json({
            ...results,
            fixLinks
        });
    } catch (error) {
        console.error('Data quality check failed:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});