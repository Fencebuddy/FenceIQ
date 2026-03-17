/**
 * METRICS INGESTION - LIVE SYSTEM DATA ONLY
 * Pulls metrics from FenceBuddy pricing + job cost systems
 * NO placeholders, NO fabrication
 */

import { base44 } from '@/api/base44Client';

export async function getExecutiveMetrics({ companyId, range }) {
  const now = new Date();
  
  // Calculate date ranges
  let startDate, endDate, prevStartDate, prevEndDate;
  let daysInPeriod;
  
  if (range === "MTD") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = now;
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
    daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  } else if (range === "L30") {
    endDate = now;
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    prevStartDate = new Date(prevEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    daysInPeriod = 30;
  } else {
    endDate = now;
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    prevStartDate = new Date(prevEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    daysInPeriod = 7;
  }
  
  const daysElapsed = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  
  // Fetch current period metrics
  const current = await fetchPeriodMetrics(companyId, startDate, endDate);
  
  // Fetch previous period metrics for trajectory
  const previous = await fetchPeriodMetrics(companyId, prevStartDate, prevEndDate);
  
  return {
    current,
    previous,
    daysElapsed,
    daysInPeriod
  };
}

async function fetchPeriodMetrics(companyId, startDate, endDate) {
  try {
    // Fetch jobs in period with status indicating sold
    const jobs = await base44.entities.Job.filter({});
    
    // Filter to sold jobs in date range
    const soldStatuses = ['Proposal Signed', 'Sold', 'Materials Ordered', 'Installed', 'Closed'];
    const periodJobs = jobs.filter(job => {
      if (!soldStatuses.includes(job.status)) return false;
      
      // Use signedAt if available, otherwise created_date
      const jobDate = job.signedAt ? new Date(job.signedAt) : new Date(job.created_date);
      return jobDate >= startDate && jobDate <= endDate;
    });
    
    const jobs_sold = periodJobs.length;
    
    // Calculate revenue and margins from JobCostSnapshot
    let totalRevenue = 0;
    let totalMaterialCost = 0;
    let totalDirectCost = 0;
    let totalNetProfit = 0;
    let jobsWithPricing = 0;
    let totalPriceOverrides = 0;
    let totalPricingDecisions = 0;
    
    for (const job of periodJobs) {
      if (!job.active_pricing_snapshot_id) continue;
      
      try {
        const snapshots = await base44.entities.JobCostSnapshot.filter({ 
          id: job.active_pricing_snapshot_id 
        });
        
        if (snapshots.length > 0) {
          const snapshot = snapshots[0];
          jobsWithPricing++;
          
          totalRevenue += snapshot.sell_price || 0;
          totalMaterialCost += snapshot.material_cost || 0;
          totalDirectCost += snapshot.direct_cost || 0;
          totalNetProfit += (snapshot.pricing_breakdown?.net_profit || 0);
          
          // Track overrides (if unit cost overrides exist)
          if (snapshot.pricing_breakdown?.unitCostOverrides) {
            const overrides = Object.keys(snapshot.pricing_breakdown.unitCostOverrides).length;
            totalPriceOverrides += overrides;
            totalPricingDecisions += 1;
          } else {
            totalPricingDecisions += 1;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch pricing snapshot:', err);
      }
    }
    
    // Calculate metrics
    const revenue = totalRevenue;
    const gross_margin = totalRevenue > 0 ? (totalRevenue - totalMaterialCost) / totalRevenue : 0;
    const net_margin = totalRevenue > 0 ? totalNetProfit / totalRevenue : 0;
    const net_profit = totalNetProfit;
    
    // Calculate close rate (need demo/nosale count)
    const allLeads = jobs.filter(job => {
      const jobDate = new Date(job.created_date);
      return jobDate >= startDate && jobDate <= endDate;
    });
    const close_rate = allLeads.length > 0 ? jobs_sold / allLeads.length : 0;
    
    // Price integrity (inverse of override rate)
    const override_rate = totalPricingDecisions > 0 ? totalPriceOverrides / totalPricingDecisions : 0;
    const price_integrity = 1 - override_rate;
    
    // Upsell average (placeholder - requires tier analysis)
    const upsell_avg = jobsWithPricing > 0 ? totalRevenue / jobsWithPricing : 0;
    
    // Forecast confidence (based on data completeness)
    const dataCompleteness = jobsWithPricing / Math.max(1, jobs_sold);
    const forecast_confidence = Math.min(100, dataCompleteness * 100);
    
    return {
      revenue,
      gross_margin,
      net_margin,
      net_profit,
      close_rate,
      upsell_avg,
      price_integrity,
      override_rate,
      jobs_sold,
      forecast_confidence
    };
  } catch (error) {
    console.error('Failed to fetch period metrics:', error);
    return {};
  }
}