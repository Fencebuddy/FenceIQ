import { base44 } from '@/api/base44Client';

/**
 * FenceBuddy IQ Dashboard Service
 * Truth-safe analytics for install reality vs sold pricing
 */

/**
 * Get truth set: closed-out jobs with locked pricing snapshots
 */
export async function getIQTruthSet({ companyId, dateStart, dateEnd }) {
  // Get variance summaries in range
  const variances = await base44.entities.VarianceSummary.filter({
    companyId,
    closedOutAt: { $gte: dateStart, $lte: dateEnd }
  });

  if (variances.length === 0) return [];

  // Get locked pricing snapshots
  const snapshotIds = [...new Set(variances.map(v => v.pricingSnapshotId).filter(Boolean))];
  const snapshots = await base44.entities.PricingSnapshot.filter({
    id: { $in: snapshotIds },
    isLocked: true
  });

  const snapshotMap = new Map(snapshots.map(s => [s.id, s]));

  // Get CRM jobs
  const jobIds = [...new Set(variances.map(v => v.jobId).filter(Boolean))];
  const jobs = await base44.entities.CRMJob.filter({
    id: { $in: jobIds }
  });

  const jobMap = new Map(jobs.map(j => [j.id, j]));

  // Build truth rows
  const truthRows = variances
    .filter(v => snapshotMap.has(v.pricingSnapshotId)) // CRITICAL: only locked snapshots
    .map(v => {
      const job = jobMap.get(v.jobId);
      return {
        jobId: v.jobId,
        jobNumber: job?.jobNumber || 'N/A',
        fenceCategory: v.fenceCategory,
        configKey: v.configKey,
        estimatedNetProfitPercent: v.estimatedNetProfitPercent || 0,
        actualNetProfitPercent: v.actualNetProfitPercent || 0,
        netProfitVariance: v.netProfitVariance || 0,
        estimatedLf: v.estimatedLf || 0,
        actualLfInstalled: v.actualLfInstalled || 0,
        lfVariance: v.lfVariance || 0,
        materialCostVariance: v.materialCostVariance || 0,
        laborCostVariance: v.laborCostVariance || 0,
        directCostVariance: v.directCostVariance || 0,
        closedOutAt: v.closedOutAt
      };
    });

  return truthRows;
}

/**
 * Compute IQ Score (0-100)
 */
export function computeIQScore(truthRows, companySettings) {
  if (!truthRows || truthRows.length === 0) {
    return {
      iqScore: 0,
      components: {
        soldMarginScore: 0,
        realizedMarginScore: 0,
        varianceStabilityScore: 0,
        disciplineScore: 0
      },
      label: 'Insufficient Data'
    };
  }

  const goalNetMargin = companySettings.goalNetMarginPercent || 20;

  // 1) Sold Margin Health (25%)
  const avgSoldMargin = truthRows.reduce((sum, r) => sum + r.estimatedNetProfitPercent, 0) / truthRows.length;
  const soldMarginScore = Math.min(100, (avgSoldMargin / goalNetMargin) * 100);

  // 2) Realized Margin Health (30%)
  const avgRealizedMargin = truthRows.reduce((sum, r) => sum + r.actualNetProfitPercent, 0) / truthRows.length;
  const realizedMarginScore = Math.min(100, (avgRealizedMargin / goalNetMargin) * 100);

  // 3) Variance Stability (25%)
  const withinTolerance = truthRows.filter(r => Math.abs(r.netProfitVariance / r.estimatedNetProfitPercent * 100) <= 5).length;
  const varianceStabilityScore = (withinTolerance / truthRows.length) * 100;

  // 4) Pricing Discipline (20%)
  // Placeholder: will be computed from accepted suggestions
  const disciplineScore = 70; // Default mid-range

  // Weighted IQ Score
  const iqScore = Math.round(
    soldMarginScore * 0.25 +
    realizedMarginScore * 0.30 +
    varianceStabilityScore * 0.25 +
    disciplineScore * 0.20
  );

  // Label
  let label = 'Strong';
  if (iqScore < 60) label = 'Unstable';
  else if (iqScore < 75) label = 'At Risk';

  return {
    iqScore,
    components: {
      soldMarginScore: Math.round(soldMarginScore),
      realizedMarginScore: Math.round(realizedMarginScore),
      varianceStabilityScore: Math.round(varianceStabilityScore),
      disciplineScore: Math.round(disciplineScore)
    },
    label
  };
}

/**
 * Get margin truth summary
 */
export function getMarginTruthSummary(truthRows) {
  if (!truthRows || truthRows.length === 0) {
    return {
      avgSoldMargin: 0,
      avgRealizedMargin: 0,
      avgVariancePercent: 0
    };
  }

  const avgSoldMargin = truthRows.reduce((sum, r) => sum + r.estimatedNetProfitPercent, 0) / truthRows.length;
  const avgRealizedMargin = truthRows.reduce((sum, r) => sum + r.actualNetProfitPercent, 0) / truthRows.length;
  const avgVariancePercent = avgRealizedMargin - avgSoldMargin;

  return {
    avgSoldMargin: Number(avgSoldMargin.toFixed(2)),
    avgRealizedMargin: Number(avgRealizedMargin.toFixed(2)),
    avgVariancePercent: Number(avgVariancePercent.toFixed(2))
  };
}

/**
 * Get tolerance stats (±5% net profit variance)
 */
export function getToleranceStats(truthRows) {
  if (!truthRows || truthRows.length === 0) {
    return {
      withinTolerancePercent: 0,
      jobsWithin: 0,
      jobsTotal: 0
    };
  }

  const jobsWithin = truthRows.filter(r => {
    if (r.estimatedNetProfitPercent === 0) return false;
    const variancePct = Math.abs(r.netProfitVariance / r.estimatedNetProfitPercent * 100);
    return variancePct <= 5;
  }).length;

  const jobsTotal = truthRows.length;
  const withinTolerancePercent = (jobsWithin / jobsTotal) * 100;

  return {
    withinTolerancePercent: Number(withinTolerancePercent.toFixed(1)),
    jobsWithin,
    jobsTotal
  };
}

/**
 * Get leakage sources (absolute variance impact)
 */
export function getLeakageSources(truthRows) {
  if (!truthRows || truthRows.length === 0) {
    return [];
  }

  const totalLaborVariance = truthRows.reduce((sum, r) => sum + Math.abs(r.laborCostVariance), 0);
  const totalMaterialVariance = truthRows.reduce((sum, r) => sum + Math.abs(r.materialCostVariance), 0);
  const totalDirectVariance = truthRows.reduce((sum, r) => sum + Math.abs(r.directCostVariance), 0);
  const totalOther = Math.max(0, totalDirectVariance - totalLaborVariance - totalMaterialVariance);

  const sources = [
    { type: 'Labor', impact: totalLaborVariance },
    { type: 'Material', impact: totalMaterialVariance },
    { type: 'Other', impact: totalOther }
  ];

  return sources.sort((a, b) => b.impact - a.impact);
}

/**
 * Get benchmark table
 */
export async function getBenchmarkTable({ companyId, dateStart, dateEnd }) {
  const benchmarks = await base44.entities.ProductBenchmarkDaily.filter({
    companyId,
    rollupDate: { $gte: dateStart, $lte: dateEnd }
  });

  if (benchmarks.length === 0) return [];

  // Aggregate by (fenceCategory, configKey)
  const grouped = {};

  benchmarks.forEach(b => {
    const key = `${b.fenceCategory}_${b.configKey}`;
    if (!grouped[key]) {
      grouped[key] = {
        fenceCategory: b.fenceCategory,
        configKey: b.configKey,
        jobsCount: 0,
        totalLf: 0,
        totalLaborHours: 0,
        totalLaborHoursPerLf: 0,
        p90Values: [],
        totalMaterialOverage: 0,
        totalRealizedMargin: 0,
        count: 0
      };
    }

    const g = grouped[key];
    g.jobsCount += b.jobsCount || 0;
    g.totalLf += (b.avgLf || 0) * (b.jobsCount || 0);
    g.totalLaborHours += (b.avgLaborHours || 0) * (b.jobsCount || 0);
    g.totalLaborHoursPerLf += (b.avgLaborHoursPerLf || 0) * (b.jobsCount || 0);
    g.p90Values.push(b.p90LaborHoursPerLf || 0);
    g.totalMaterialOverage += (b.avgMaterialOveragePercent || 0) * (b.jobsCount || 0);
    g.totalRealizedMargin += (b.avgNetProfitPercentRealized || 0) * (b.jobsCount || 0);
    g.count++;
  });

  // Compute company goal for status
  const companySettings = await base44.entities.CompanySettings.filter({ id: companyId });
  const goalMargin = companySettings[0]?.goalNetMarginPercent || 20;

  const rows = Object.values(grouped).map(g => {
    const avgLf = g.totalLf / g.jobsCount;
    const avgLaborHoursPerLf = g.totalLaborHoursPerLf / g.jobsCount;
    const p90LaborHoursPerLf = Math.max(...g.p90Values);
    const avgMaterialOveragePercent = g.totalMaterialOverage / g.jobsCount;
    const avgNetProfitPercentRealized = g.totalRealizedMargin / g.jobsCount;

    // Status logic
    let status = 'stable';
    if (avgNetProfitPercentRealized < goalMargin - 3) status = 'problem';
    else if (avgNetProfitPercentRealized < goalMargin) status = 'watch';

    return {
      fenceCategory: g.fenceCategory,
      configKey: g.configKey,
      jobsCount: g.jobsCount,
      avgLf: Number(avgLf.toFixed(1)),
      avgLaborHoursPerLf: Number(avgLaborHoursPerLf.toFixed(2)),
      p90LaborHoursPerLf: Number(p90LaborHoursPerLf.toFixed(2)),
      avgMaterialOveragePercent: Number(avgMaterialOveragePercent.toFixed(1)),
      avgNetProfitPercentRealized: Number(avgNetProfitPercentRealized.toFixed(1)),
      status
    };
  });

  return rows.sort((a, b) => b.jobsCount - a.jobsCount);
}

/**
 * Get pricing suggestions
 */
export async function getPricingSuggestions({ companyId }) {
  const suggestions = await base44.entities.PricingAdjustmentSuggestion.filter({
    companyId,
    status: { $in: ['new', 'reviewing'] }
  });

  return suggestions.map(s => ({
    suggestionId: s.id,
    fenceCategory: s.fenceCategory,
    configKey: s.configKey,
    confidence: s.confidence || 0,
    impactEstimatedNetMarginDeltaPercent: s.impactEstimatedNetMarginDeltaPercent || 0,
    evidenceSummary: s.evidenceSummary || '',
    status: s.status,
    basedOnJobsCount: s.basedOnJobsCount || 0
  }));
}

/**
 * Get action queue
 */
export async function getActionQueue({ companyId }) {
  const actions = [];

  // 1) Open suggestions
  const suggestions = await getPricingSuggestions({ companyId });
  suggestions.forEach(s => {
    actions.push({
      type: 'suggestion',
      id: s.suggestionId,
      label: `Pricing adjustment for ${s.configKey}`,
      severity: s.confidence > 0.75 ? 'high' : 'medium',
      cta: 'Review'
    });
  });

  // 2) Recent high-variance jobs (placeholder for now)
  // Future: query VarianceSummary for jobs with >10% variance in last 7 days

  return actions;
}

/**
 * Accept pricing suggestion
 */
export async function acceptPricingSuggestion({ suggestionId, userId, companyId, jobId }) {
  const suggestion = await base44.entities.PricingAdjustmentSuggestion.filter({ id: suggestionId });
  
  if (suggestion.length === 0) {
    throw new Error('Suggestion not found');
  }

  // Update suggestion
  await base44.entities.PricingAdjustmentSuggestion.update(suggestionId, {
    status: 'accepted',
    decidedByUserId: userId,
    decidedAt: new Date().toISOString()
  });

  // Emit event
  await base44.entities.CRMActivityEvent.create({
    companyId,
    jobId: jobId || suggestion[0].configKey, // Use configKey as fallback
    type: 'pricing_suggestion_created',
    actorUserId: userId,
    occurredAt: new Date().toISOString(),
    metadata: {
      suggestionId,
      configKey: suggestion[0].configKey,
      action: 'accepted'
    }
  });

  return true;
}

/**
 * Reject pricing suggestion
 */
export async function rejectPricingSuggestion({ suggestionId, userId, companyId, jobId }) {
  const suggestion = await base44.entities.PricingAdjustmentSuggestion.filter({ id: suggestionId });
  
  if (suggestion.length === 0) {
    throw new Error('Suggestion not found');
  }

  // Update suggestion
  await base44.entities.PricingAdjustmentSuggestion.update(suggestionId, {
    status: 'rejected',
    decidedByUserId: userId,
    decidedAt: new Date().toISOString()
  });

  return true;
}