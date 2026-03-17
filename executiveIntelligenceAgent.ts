import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const { event, data, old_data } = payload;
        
        // Only process CRMJob updates
        if (event?.entity_name !== 'CRMJob' || event?.type !== 'update') {
            return Response.json({ skipped: 'Not a CRMJob update' });
        }
        
        if (!data || !data.companyId) {
            return Response.json({ skipped: 'Missing company data' });
        }
        
        // Load company settings
        const companySettings = await base44.asServiceRole.entities.CompanySettings.filter({ 
            companyId: data.companyId 
        });
        const settings = companySettings[0];
        
        // GATE: Feature flag check
        if (!settings || !settings.realtimeRollupsEnabled) {
            return Response.json({ skipped: 'Real-time rollups not enabled for this company' });
        }
        
        const diagnosticsEnabled = settings.realtimeDiagnosticsEnabled || false;
        
        // TRIGGER: Only fire on sold transition
        // Check both saleStatus (canonical) and contractStatus (fallback)
        const wasSold = old_data?.saleStatus === 'sold' || old_data?.contractStatus === 'signed';
        const nowSold = data.saleStatus === 'sold' || data.contractStatus === 'signed';
        
        if (wasSold || !nowSold) {
            return Response.json({ skipped: 'Not a sold transition' });
        }
        
        const companyId = data.companyId;
        const jobId = data.id;
        
        // Determine soldAt timestamp (source of truth for idempotency)
        let soldAt = data.wonAt || data.saleStatusUpdatedAt || data.updated_date;
        
        // Fetch signature record for more accurate timestamp
        const signatures = await base44.asServiceRole.entities.SignatureRecord.filter({ 
            jobId,
            companyId 
        });
        
        if (signatures.length > 0) {
            soldAt = signatures[0].signedAt;
        }
        
        // IDEMPOTENCY: Check if already processed
        const soldAtISO = new Date(soldAt).toISOString();
        const idempotencyKey = `rollup:${companyId}:${jobId}:${soldAtISO}`;
        
        const existing = await base44.asServiceRole.entities.RollupEventProcessed.filter({ 
            idempotencyKey 
        });
        
        if (existing.length > 0) {
            return Response.json({ 
                skipped: 'Already processed', 
                idempotencyKey,
                processedAt: existing[0].processedAt 
            });
        }
        
        // DATA INPUTS: Load authoritative records
        // Support both pricingSnapshotId and proposalSnapshotId
        const snapshotId = signatures.length > 0 
            ? (signatures[0].pricingSnapshotId || signatures[0].proposalSnapshotId)
            : null;
        
        const pricingSnapshots = snapshotId
            ? await base44.asServiceRole.entities.ProposalPricingSnapshot.filter({ 
                id: snapshotId 
              })
            : [];
        const pricingSnapshot = pricingSnapshots[0];
        
        if (!pricingSnapshot) {
            if (diagnosticsEnabled) {
                console.log('[EI Agent] No pricing snapshot found for job', jobId);
            }
            return Response.json({ 
                warning: 'No pricing snapshot found',
                jobId 
            });
        }
        
        // Get job cost snapshot for cost data if not in pricing snapshot
        const jobCostSnapshots = data.externalJobId 
            ? await base44.asServiceRole.entities.JobCostSnapshot.filter({ 
                jobId: data.externalJobId 
              })
            : [];
        const jobCostSnapshot = jobCostSnapshots[0];
        
        // METRICS COMPUTATION
        const soldRevenue = pricingSnapshot.agreed_subtotal || 0;
        const directCost = pricingSnapshot.direct_cost || jobCostSnapshot?.direct_cost || 0;
        const overheadPercent = pricingSnapshot.overhead_percent || settings.defaultOverheadRate || 0.14;
        const commissionPercent = pricingSnapshot.commission_percent || settings.defaultCommissionRate || 0.10;
        
        const overhead = soldRevenue * overheadPercent;
        const commission = soldRevenue * commissionPercent;
        const grossProfit = soldRevenue - directCost;
        const netProfit = soldRevenue - directCost - overhead - commission;
        const grossMarginPct = soldRevenue > 0 ? (grossProfit / soldRevenue) * 100 : 0;
        const netMarginPct = soldRevenue > 0 ? (netProfit / soldRevenue) * 100 : 0;
        
        // REP ATTRIBUTION
        const repId = data.assignedRepUserId || 'unassigned';
        
        // DATE BUCKETING (America/Detroit timezone)
         const timezone = settings.reportingRollupTimezone || 'America/Detroit';
         const soldDate = new Date(soldAt);
         const parts = soldDate.toLocaleDateString('en-US', { 
             timeZone: timezone, 
             year: 'numeric', 
             month: '2-digit', 
             day: '2-digit' 
         }).split('/'); // MM/DD/YYYY
         const year = parts[2];
         const month = parts[0];
         const day = parts[1];
         const dateBucket = `${year}-${month}-${day}`; // YYYY-MM-DD
        
        // ROLLUP UPDATE STRATEGY: Recompute from raw
        await updateRollupForDateAndScope({
            base44: base44.asServiceRole,
            companyId,
            dateBucket,
            scopeType: 'all_reps',
            repId: null,
            timezone,
            diagnosticsEnabled
        });
        
        await updateRollupForDateAndScope({
            base44: base44.asServiceRole,
            companyId,
            dateBucket,
            scopeType: 'rep',
            repId,
            timezone,
            diagnosticsEnabled
        });
        
        // FINALIZE: Create idempotency record
        await base44.asServiceRole.entities.RollupEventProcessed.create({
            companyId,
            jobId,
            soldAt: soldAtISO,
            idempotencyKey,
            processedAt: new Date().toISOString(),
            meta: {
                soldRevenue,
                netProfit,
                repId,
                dateBucket
            }
        });
        
        if (diagnosticsEnabled) {
            console.log('[EI Agent] Processed sold job:', {
                jobId,
                dateBucket,
                soldRevenue,
                netProfit,
                netMarginPct,
                repId
            });
        }
        
        return Response.json({
            success: true,
            message: 'Executive intelligence updated',
            jobId,
            dateBucket,
            idempotencyKey,
            metrics: {
                soldRevenue,
                grossProfit,
                netProfit,
                grossMarginPct,
                netMarginPct
            }
        });
    } catch (error) {
        console.error('[EI Agent] Error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

// Helper: Update rollup for specific date and scope (recompute from raw)
async function updateRollupForDateAndScope({ base44, companyId, dateBucket, scopeType, repId, timezone, diagnosticsEnabled }) {
    // Query all sold jobs for this date bucket and scope
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    const dateStart = new Date(dateBucket + 'T00:00:00');
    const dateEnd = new Date(dateBucket + 'T23:59:59');
    
    const soldJobs = allJobs.filter(job => {
        const isSold = job.saleStatus === 'sold' || job.contractStatus === 'signed';
        if (!isSold) return false;

        const jobSoldAt = new Date(job.wonAt || job.saleStatusUpdatedAt || job.created_date);
        const jobParts = jobSoldAt.toLocaleDateString('en-US', { 
            timeZone: timezone, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).split('/'); // MM/DD/YYYY
        const jobYear = jobParts[2];
        const jobMonth = jobParts[0];
        const jobDay = jobParts[1];
        const jobDateStr = `${jobYear}-${jobMonth}-${jobDay}`; // YYYY-MM-DD

        if (jobDateStr !== dateBucket) return false;
        
        // Filter by rep if scope is rep-specific
        if (scopeType === 'rep' && (job.assignedRepUserId || 'unassigned') !== repId) {
            return false;
        }
        
        return true;
    });
    
    // Compute totals from all sold jobs in this bucket
    let totalRevenue = 0;
    let totalGrossProfit = 0;
    let totalNetProfit = 0;
    let jobCount = 0;
    
    for (const job of soldJobs) {
        // Get signature and pricing snapshot
        const sigs = await base44.entities.SignatureRecord.filter({ jobId: job.id, companyId });
        if (sigs.length === 0) continue;
        
        const sig = sigs[0];
        const snapshotId = sig.pricingSnapshotId || sig.proposalSnapshotId;
        const pricingSnaps = snapshotId 
            ? await base44.entities.ProposalPricingSnapshot.filter({ id: snapshotId })
            : [];
        
        if (pricingSnaps.length === 0) continue;
        
        const pricing = pricingSnaps[0];
        const revenue = pricing.agreed_subtotal || 0;
        const directCost = pricing.direct_cost || 0;
        const overheadPct = pricing.overhead_percent || 0.14;
        const commissionPct = pricing.commission_percent || 0.10;
        
        const gross = revenue - directCost;
        const net = revenue - directCost - (revenue * overheadPct) - (revenue * commissionPct);
        
        totalRevenue += revenue;
        totalGrossProfit += gross;
        totalNetProfit += net;
        jobCount += 1;
    }
    
    const avgTicket = jobCount > 0 ? totalRevenue / jobCount : 0;
    const netMarginPct = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    
    // Upsert rollup row
    const query = {
        companyId,
        rollupDate: dateBucket,
        repUserId: repId,
        fenceCategory: null,
        source: null
    };
    
    const existing = await base44.entities.ReportRollupDaily.filter(query);
    
    const rollupData = {
        ...query,
        signedCount: jobCount,
        wonRevenue: totalRevenue,
        netProfitAmount: totalNetProfit,
        netMarginPercentWeighted: netMarginPct,
        avgTicket,
        proposalsSentCount: 0, // Not computed in real-time agent
        proposalsSignedCount: jobCount,
        closeRatePercent: 0 // Not computed in real-time agent
    };
    
    if (existing.length > 0) {
        await base44.entities.ReportRollupDaily.update(existing[0].id, rollupData);
    } else {
        await base44.entities.ReportRollupDaily.create(rollupData);
    }
    
    if (diagnosticsEnabled) {
        console.log('[EI Agent] Updated rollup:', {
            dateBucket,
            scopeType,
            repId,
            jobCount,
            totalRevenue,
            totalNetProfit,
            netMarginPct
        });
    }
}