/**
 * OVERHEAD COVERAGE ENGINE (OCE)
 * Real-time survival metric - have we covered overhead yet?
 * Depends on OIE + CRMJob financial data
 */

import { base44 } from '@/api/base44Client';

/**
 * Calculate monthly overhead coverage
 */
export async function calculateMonthlyCoverage(companyId, month, year) {
  if (!companyId) {
    throw new Error('companyId required');
  }

  // Get overhead (single source of truth)
  const overheadSettings = await base44.entities.OverheadSettings.filter({ companyId });
  
  if (!overheadSettings || overheadSettings.length === 0) {
    return null; // OIE not configured
  }

  const totalAnnualOverhead = overheadSettings[0].totalAnnualOverhead || 0;
  const monthlyOverhead = totalAnnualOverhead / 12;

  if (monthlyOverhead === 0) {
    return null; // Cannot divide by zero
  }

  // Get effective overhead percentage
  const effectiveOverheadPct = overheadSettings[0].lockOverride && overheadSettings[0].manualOverridePct !== null
    ? overheadSettings[0].manualOverridePct / 100
    : overheadSettings[0].computedOverheadPct / 100;

  // Query committed revenue (SOLD+)
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  const jobs = await base44.entities.CRMJob.filter({ companyId });
  
  // FIXED: Canonical "sold" predicate (aligned with invariants)
  const isSold = (job) => {
    return job.contractStatus === 'signed' || 
           ['signed', 'production', 'installed'].includes(job.stage) ||
           job.saleStatus === 'sold';
  };
  
  // Filter by date and sold status
  const committedJobs = jobs.filter(job => {
    const jobDate = new Date(job.wonAt || job.saleStatusUpdatedAt || job.created_date);
    const hasDate = jobDate >= new Date(startDate) && jobDate <= new Date(endDate);
    return hasDate && isSold(job);
  });

  // Calculate overhead covered from sold jobs
  let overheadCoveredMTD = 0;
  for (const job of committedJobs) {
    // Priority 1: Use recognizedOverheadCents if populated
    if (job.recognizedOverheadCents && job.recognizedOverheadCents > 0) {
      overheadCoveredMTD += job.recognizedOverheadCents / 100;
      continue;
    }
    
    // Priority 2: Calculate from contractValueCents if available
    if (job.contractValueCents && job.contractValueCents > 0) {
      const revenueDollars = job.contractValueCents / 100;
      overheadCoveredMTD += revenueDollars * effectiveOverheadPct;
      continue;
    }
    
    // Priority 3: Calculate from recognizedRevenueCents
    if (job.recognizedRevenueCents && job.recognizedRevenueCents > 0) {
      const revenueDollars = job.recognizedRevenueCents / 100;
      overheadCoveredMTD += revenueDollars * effectiveOverheadPct;
      continue;
    }
    
    // Priority 4: Fetch from linked Job pricing if externalJobId exists
    if (job.externalJobId) {
      try {
        const linkedJob = await base44.entities.Job.read(job.externalJobId);
        if (linkedJob?.active_pricing_snapshot_id) {
          const snapshot = await base44.entities.JobCostSnapshot.read(linkedJob.active_pricing_snapshot_id);
          if (snapshot?.sell_price && snapshot.sell_price > 0) {
            overheadCoveredMTD += snapshot.sell_price * effectiveOverheadPct;
            continue;
          }
        }
      } catch (e) {
        // Job or snapshot not found, continue to next job
      }
    }
  }

  // Coverage percentage
  const coveragePct = (overheadCoveredMTD / monthlyOverhead) * 100;

  // Remaining coverage
  const remainingOverhead = Math.max(0, monthlyOverhead - overheadCoveredMTD);

  // Pace forecast
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysRemaining = daysInMonth - currentDay;

  const paceForecast = currentDay > 0 
    ? (overheadCoveredMTD / currentDay) * daysInMonth 
    : 0;

  const paceDelta = paceForecast - monthlyOverhead;

  // Status
  let status = 'DANGER';
  if (paceForecast >= monthlyOverhead) {
    status = 'SAFE';
  } else if (paceForecast >= monthlyOverhead * 0.80) {
    status = 'WATCH';
  }

  // Freedom line
  const freedomLineReached = overheadCoveredMTD >= monthlyOverhead;
  let freedomDate = null;
  if (freedomLineReached) {
    // Find the date when overhead was covered
    let runningTotal = 0;
    const sortedJobs = committedJobs.sort((a, b) => 
      new Date(a.wonAt || a.saleStatusUpdatedAt || a.created_date) - 
      new Date(b.wonAt || b.saleStatusUpdatedAt || b.created_date)
    );
    
    for (const job of sortedJobs) {
      let jobOverhead = 0;
      
      if (job.recognizedOverheadCents && job.recognizedOverheadCents > 0) {
        jobOverhead = job.recognizedOverheadCents / 100;
      } else if (job.contractValueCents && job.contractValueCents > 0) {
        jobOverhead = (job.contractValueCents / 100) * effectiveOverheadPct;
      } else if (job.recognizedRevenueCents && job.recognizedRevenueCents > 0) {
        jobOverhead = (job.recognizedRevenueCents / 100) * effectiveOverheadPct;
      } else if (job.externalJobId) {
        try {
          const linkedJob = await base44.entities.Job.read(job.externalJobId);
          if (linkedJob?.active_pricing_snapshot_id) {
            const snapshot = await base44.entities.JobCostSnapshot.read(linkedJob.active_pricing_snapshot_id);
            if (snapshot?.sell_price && snapshot.sell_price > 0) {
              jobOverhead = snapshot.sell_price * effectiveOverheadPct;
            }
          }
        } catch (e) {
          // Continue without this job's contribution
        }
      }
      
      if (jobOverhead > 0) {
        runningTotal += jobOverhead;
        if (runningTotal >= monthlyOverhead) {
          freedomDate = job.wonAt || job.saleStatusUpdatedAt || job.created_date;
          break;
        }
      }
    }
  }

  return {
    companyId,
    month,
    year,
    monthlyOverhead,
    overheadCoveredMTD,
    coveragePct,
    remainingOverhead,
    paceForecast,
    paceDelta,
    daysRemaining,
    status,
    freedomLineReached,
    freedomDate,
    jobCount: committedJobs.length
  };
}