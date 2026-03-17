import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calculate overhead coverage for current month
 * Returns exact dollar amounts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company
    const companies = await base44.entities.CompanySettings.list();
    const companyEntityId = companies[0]?.id;
    
    // Get overhead settings
    const overheadSettings = await base44.entities.OverheadSettings.filter({ companyId: companyEntityId });
    
    if (!overheadSettings || overheadSettings.length === 0) {
      return Response.json({ error: 'No overhead settings found' }, { status: 404 });
    }

    const totalAnnualOverhead = overheadSettings[0].totalAnnualOverhead || 0;
    const monthlyOverhead = totalAnnualOverhead / 12;

    const effectiveOverheadPct = overheadSettings[0].lockOverride && overheadSettings[0].manualOverridePct !== null
      ? overheadSettings[0].manualOverridePct / 100
      : overheadSettings[0].computedOverheadPct / 100;

    // Get current month sold jobs
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const jobs = await base44.entities.CRMJob.filter({ companyId: companyEntityId });
    
    const isSold = (job) => {
      return job.contractStatus === 'signed' || 
             ['signed', 'production', 'installed'].includes(job.stage) ||
             job.saleStatus === 'sold';
    };
    
    const committedJobs = jobs.filter(job => {
      const jobDate = new Date(job.wonAt || job.saleStatusUpdatedAt || job.created_date);
      const hasDate = jobDate >= new Date(startDate) && jobDate <= new Date(endDate);
      return hasDate && isSold(job);
    });

    // Calculate overhead covered
    let overheadCoveredMTD = 0;
    const jobBreakdown = [];
    
    for (const job of committedJobs) {
      let jobOverhead = 0;
      let source = 'none';
      
      if (job.recognizedOverheadCents && job.recognizedOverheadCents > 0) {
        jobOverhead = job.recognizedOverheadCents / 100;
        source = 'recognizedOverheadCents';
      } else if (job.contractValueCents && job.contractValueCents > 0) {
        jobOverhead = (job.contractValueCents / 100) * effectiveOverheadPct;
        source = 'contractValueCents';
      } else if (job.recognizedRevenueCents && job.recognizedRevenueCents > 0) {
        jobOverhead = (job.recognizedRevenueCents / 100) * effectiveOverheadPct;
        source = 'recognizedRevenueCents';
      } else if (job.externalJobId) {
        try {
          const linkedJob = await base44.entities.Job.read(job.externalJobId);
          if (linkedJob?.active_pricing_snapshot_id) {
            const snapshot = await base44.entities.JobCostSnapshot.read(linkedJob.active_pricing_snapshot_id);
            if (snapshot?.sell_price && snapshot.sell_price > 0) {
              jobOverhead = snapshot.sell_price * effectiveOverheadPct;
              source = 'linkedJobSnapshot';
            }
          }
        } catch (e) {
          // Continue
        }
      }
      
      overheadCoveredMTD += jobOverhead;
      jobBreakdown.push({
        jobNumber: job.jobNumber,
        overheadContribution: jobOverhead,
        source
      });
    }

    const remainingOverhead = Math.max(0, monthlyOverhead - overheadCoveredMTD);
    const coveragePct = monthlyOverhead > 0 ? (overheadCoveredMTD / monthlyOverhead) * 100 : 0;

    return Response.json({
      success: true,
      month: `${year}-${String(month).padStart(2, '0')}`,
      monthlyOverheadTarget: monthlyOverhead,
      overheadCovered: overheadCoveredMTD,
      overheadRemaining: remainingOverhead,
      coveragePercent: coveragePct,
      effectiveOverheadRate: effectiveOverheadPct,
      soldJobsCount: committedJobs.length,
      jobBreakdown
    });
    
  } catch (error) {
    console.error('Calculation failed:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});