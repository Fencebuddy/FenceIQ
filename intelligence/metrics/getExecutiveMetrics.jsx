/**
 * METRICS INGESTION - LIVE SYSTEM DATA ONLY
 * Pulls metrics from FenceBuddy pricing + job cost systems
 * NO placeholders, NO fabrication
 */

import { base44 } from '@/api/base44Client';
import { getSignedDealsTruthSet, computeWonKpis, getProposalCloseSet, computeCloseRate } from '@/components/services/ownerDashboardService';

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
    console.log('[EIE Metrics] Fetching period metrics:', {
      companyId,
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString()
    });
    
    const dateStart = startDate.toISOString();
    const dateEnd = endDate.toISOString();
    
    // Use ownerDashboardService for consistent data retrieval
    const signedRows = await getSignedDealsTruthSet({ 
      companyId, 
      dateStart, 
      dateEnd 
    });
    
    console.log('[EIE Metrics] Signed rows retrieved:', signedRows.length);
    
    const proposalRows = await getProposalCloseSet({ 
      companyId, 
      dateStart, 
      dateEnd 
    });
    
    console.log('[EIE Metrics] Proposal rows retrieved:', proposalRows.length);
    
    // Compute won KPIs
    const wonKpis = computeWonKpis(signedRows);
    const closeRateKpis = computeCloseRate(proposalRows);
    
    console.log('[EIE Metrics] Won KPIs:', wonKpis);
    console.log('[EIE Metrics] Close rate KPIs:', closeRateKpis);
    
    // Calculate metrics from won KPIs
    const revenue = wonKpis.wonRevenue || 0;
    
    // CRITICAL FIX: Sum netProfitAmount from signedRows (not wonKpis)
    const net_profit = signedRows.reduce((sum, row) => sum + (row.netProfitAmount || 0), 0);
    
    const net_margin = (wonKpis.netMarginPercentWeighted || 0) / 100;
    const gross_margin = (wonKpis.grossMarginPercentWeighted || 0) / 100;
    const jobs_sold = wonKpis.signedCount || 0;
    const close_rate = (closeRateKpis.closeRatePercent || 0) / 100;
    
    console.log('[EIE Metrics] 🔍 Net Profit Calculation:', {
        signedRowsCount: signedRows.length,
        net_profit_calculated: net_profit,
        wonKpis_netProfitAmount: wonKpis.netProfitAmount,
        sampleRow: signedRows[0] ? {
            jobNumber: signedRows[0].jobNumber,
            netProfitAmount: signedRows[0].netProfitAmount
        } : null
    });
    
    // Price integrity and override metrics
    const override_rate = (wonKpis.overrideRate || 0) / 100;
    const price_integrity = 1 - override_rate;
    
    // Upsell average
    const upsell_avg = wonKpis.avgUpsellPerOverride || 0;
    
    // Forecast confidence (based on pricing data completeness)
    const jobsWithPricing = signedRows.filter(r => r.totalPrice > 0 && r.netProfitAmount !== undefined).length;
    const forecast_confidence = jobs_sold > 0 ? (jobsWithPricing / jobs_sold) * 100 : 0;
    
    const metrics = {
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
    
    console.log('[EIE Metrics] Final computed metrics:', metrics);
    
    return metrics;
  } catch (error) {
    console.error('[EIE Metrics] Failed to fetch period metrics:', error);
    return {};
  }
}