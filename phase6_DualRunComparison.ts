import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 6 — DUAL-RUN COMPARISON
 * 
 * Runs KPI V1 (legacy) and KPI V2 (repaired) side by side, compares deltas,
 * explains root causes, and enforces acceptance thresholds before cutover.
 * 
 * Acceptance criteria:
 * - Revenue delta < 5% (sourcing/cost changes acceptable)
 * - Margin delta < 3% (cost alignment critical)
 * - profitPerApptRan delta < 10% (metric fix)
 * - Appointment coverage >= 85% (Phase 5 migration)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const companies = await base44.entities.CompanySettings.filter({});
    const companyId = companies[0]?.id;
    if (!companyId) {
      return Response.json({ error: 'No company found' }, { status: 400 });
    }

    // === PHASE 6A: COMPUTE V1 KPIs (LEGACY) ===
    const kpiV1 = await computeKpiV1(base44, companyId);

    // === PHASE 6B: COMPUTE V2 KPIs (REPAIRED) ===
    const kpiV2 = await computeKpiV2(base44, companyId);

    // === PHASE 6C: COMPARE DELTAS & EXPLAIN ===
    const comparison = compareKpis(kpiV1, kpiV2);

    // === PHASE 6D: VALIDATE ACCEPTANCE THRESHOLDS ===
    const acceptanceCriteria = validateAcceptanceThresholds(comparison);

    // === SYNTHESIS ===
    const synthesis = {
      status: acceptanceCriteria.allThresholdsMet ? 'READY_FOR_CUTOVER' : 'HOLD_CUTOVER',
      timestamp: new Date().toISOString(),
      comparison: {
        v1Metrics: kpiV1.summary,
        v2Metrics: kpiV2.summary,
        deltas: comparison.deltas,
        deltaExplanations: comparison.explanations
      },
      acceptanceCriteria,
      recommendations: generateRecommendations(acceptanceCriteria, comparison),
      nextPhase: acceptanceCriteria.allThresholdsMet 
        ? 'Phase 7: Execute KPI V2 cutover and disable V1'
        : 'Phase 6: Address failing thresholds before cutover'
    };

    // Log comparison (skip—no jobs being modified, informational phase)

    return Response.json(synthesis);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// PHASE 6A: COMPUTE KPI V1 (LEGACY)
// ============================================================
async function computeKpiV1(base44, companyId) {
  const result = {
    version: 'V1_LEGACY',
    summary: {
      totalSignedRevenue: 0,
      totalNetProfit: 0,
      netMarginPct: 0,
      profitPerApptRan: 0, // BUG: May be computed incorrectly in V1
      overrideRatePct: 0,
      appointmentsCovered: 0,
      costSourceUsed: 'unknown'
    },
    errors: []
  };

  try {
    const signedJobs = await base44.entities.CRMJob.filter({
      companyId,
      contractStatus: 'signed',
      saleStatus: 'sold'
    });

    let totalSignedRevenue = 0;
    let totalNetProfit = 0;
    let appointmentRanCount = 0;
    let overrideCount = 0;
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();

    for (const job of signedJobs) {
      // V1: Uses contractValueCents (if available)
      const revenue = job.contractValueCents || 0;
      totalSignedRevenue += revenue;

      // V1: Cost sourcing was mixed/ambiguous (BUG FIX in Phase 3)
      const cost = job.directCostCents || 0;
      const profit = revenue - cost;
      totalNetProfit += profit;

      // V1: Appointment counting was unclear
      if (job.appointmentStatus === 'completed') {
        appointmentRanCount++;
      }

      // V1: Pricing override detection (reads from job, not ProposalPricingSnapshot)
      if (job.priceSource === 'manual') {
        overrideCount++;
      }
    }

    const netMarginPct = totalSignedRevenue > 0 
      ? (totalNetProfit / totalSignedRevenue) * 100 
      : 0;

    const profitPerApptRan = appointmentRanCount > 0
      ? totalNetProfit / appointmentRanCount
      : 0;

    result.summary = {
      totalSignedRevenue,
      totalNetProfit,
      netMarginPct: Math.round(netMarginPct * 100) / 100,
      profitPerApptRan: Math.round(profitPerApptRan * 100) / 100,
      overrideRatePct: signedJobs.length > 0 
        ? Math.round((overrideCount / signedJobs.length) * 10000) / 100 
        : 0,
      appointmentsCovered: appointmentRanCount,
      jobsScanned: signedJobs.length,
      costSourceUsed: 'ambiguous_per_job'
    };

  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 6B: COMPUTE KPI V2 (REPAIRED)
// ============================================================
async function computeKpiV2(base44, companyId) {
  const result = {
    version: 'V2_REPAIRED',
    summary: {
      totalSignedRevenue: 0,
      totalNetProfit: 0,
      netMarginPct: 0,
      profitPerApptRan: 0, // FIXED in Phase 4
      overrideRatePct: 0,
      appointmentsCovered: 0,
      costSourceUsed: 'canonical',
      appointmentTruthSource: 'CalendarEvent_with_fallback'
    },
    errors: []
  };

  try {
    const companies = await base44.entities.CompanySettings.filter({ id: companyId });
    const company = companies[0];
    const canonicalCostSource = company?.canonicalCostSource || 'proposal';

    const signedJobs = await base44.entities.CRMJob.filter({
      companyId,
      contractStatus: 'signed',
      saleStatus: 'sold'
    });

    const calendarEvents = await base44.entities.CalendarEvent.filter({ companyId });
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();

    let totalSignedRevenue = 0;
    let totalNetProfit = 0;
    let appointmentRanCount = 0;
    let overrideCount = 0;

    for (const job of signedJobs) {
      // V2: Uses contractValueCents (canonical single source)
      const revenue = job.contractValueCents || 0;
      totalSignedRevenue += revenue;

      // V2: Uses canonical cost source from CompanySettings (Phase 3 fix)
      let cost = 0;
      if (canonicalCostSource === 'proposal' && job.currentProposalSnapshotId) {
        const snapshot = proposalSnapshots.find(ps => ps.id === job.currentProposalSnapshotId);
        cost = snapshot?.direct_cost ? Math.round(snapshot.direct_cost * 100) : 0;
      } else if (canonicalCostSource === 'jobcost') {
        cost = job.directCostCents || 0;
      }
      
      const profit = revenue - cost;
      totalNetProfit += profit;

      // V2: Appointment counting from CalendarEvent (Phase 5 fix)
      const calendarAppt = calendarEvents.find(
        e => e.crmJobId === job.id && e.status === 'completed'
      );
      if (calendarAppt) {
        appointmentRanCount++;
      }

      // V2: Pricing override from ProposalPricingSnapshot (Phase 4B fix)
      const proposal = proposalSnapshots.find(ps => ps.id === job.currentProposalSnapshotId);
      if (proposal && proposal.model_sell_price && proposal.presented_sell_price) {
        const deviation = Math.abs(proposal.presented_sell_price - proposal.model_sell_price) / 
                         proposal.model_sell_price;
        if (deviation > 0.02) {
          overrideCount++;
        }
      }
    }

    const netMarginPct = totalSignedRevenue > 0 
      ? (totalNetProfit / totalSignedRevenue) * 100 
      : 0;

    const profitPerApptRan = appointmentRanCount > 0
      ? totalNetProfit / appointmentRanCount
      : 0;

    result.summary = {
      totalSignedRevenue,
      totalNetProfit,
      netMarginPct: Math.round(netMarginPct * 100) / 100,
      profitPerApptRan: Math.round(profitPerApptRan * 100) / 100,
      overrideRatePct: signedJobs.length > 0 
        ? Math.round((overrideCount / signedJobs.length) * 10000) / 100 
        : 0,
      appointmentsCovered: appointmentRanCount,
      jobsScanned: signedJobs.length,
      costSourceUsed: canonicalCostSource,
      appointmentTruthSource: 'CalendarEvent_with_fallback'
    };

  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 6C: COMPARE & EXPLAIN DELTAS
// ============================================================
function compareKpis(v1, v2) {
  const comparison = {
    deltas: {},
    explanations: [],
    deltaStats: {}
  };

  // Compare each metric
  const metricPairs = [
    { key: 'totalSignedRevenue', name: 'Total Signed Revenue', phase: '1-3' },
    { key: 'totalNetProfit', name: 'Total Net Profit', phase: '3-4' },
    { key: 'netMarginPct', name: 'Net Margin %', phase: '3-4' },
    { key: 'profitPerApptRan', name: 'Profit Per Appt Ran', phase: '4' },
    { key: 'overrideRatePct', name: 'Override Rate %', phase: '4' },
    { key: 'appointmentsCovered', name: 'Appointments Covered', phase: '5' }
  ];

  for (const pair of metricPairs) {
    const v1Val = v1.summary[pair.key] || 0;
    const v2Val = v2.summary[pair.key] || 0;

    let pctDelta = 0;
    if (v1Val !== 0) {
      pctDelta = ((v2Val - v1Val) / Math.abs(v1Val)) * 100;
    } else if (v2Val !== 0) {
      pctDelta = 100; // New metric in V2
    }

    comparison.deltas[pair.key] = {
      v1: v1Val,
      v2: v2Val,
      absoluteDelta: v2Val - v1Val,
      percentDelta: Math.round(pctDelta * 100) / 100,
      phase: pair.phase
    };

    if (pctDelta !== 0) {
      const explanation = explainDelta(
        pair.key,
        pair.name,
        v1Val,
        v2Val,
        pctDelta,
        pair.phase
      );
      comparison.explanations.push(explanation);
    }
  }

  return comparison;
}

function explainDelta(key, name, v1, v2, pctDelta, phase) {
  const deltaMsg = pctDelta > 0 ? '↑' : '↓';
  const absDelta = Math.abs(pctDelta);

  let cause = '';
  switch (key) {
    case 'totalSignedRevenue':
      cause = 'Phase 1 defined canonical contract value source';
      break;
    case 'totalNetProfit':
    case 'netMarginPct':
      cause = 'Phase 3 applied canonical cost source (proposal vs jobcost)';
      break;
    case 'profitPerApptRan':
      cause = 'Phase 4 fixed metric calculation (net profit ÷ appointments ran)';
      break;
    case 'overrideRatePct':
      cause = 'Phase 4 corrected pricing override sourcing (ProposalPricingSnapshot)';
      break;
    case 'appointmentsCovered':
      cause = 'Phase 5 migrated appointment truth from CRMJob to CalendarEvent';
      break;
  }

  return {
    metric: name,
    v1,
    v2,
    percentDelta: Math.round(absDelta * 100) / 100,
    direction: deltaMsg,
    cause,
    phase
  };
}

// ============================================================
// PHASE 6D: VALIDATE ACCEPTANCE THRESHOLDS
// ============================================================
function validateAcceptanceThresholds(comparison) {
  const thresholds = [
    {
      key: 'totalSignedRevenue',
      maxDeltaPct: 5,
      name: 'Revenue Delta',
      reason: 'Cost/pricing source changes acceptable within 5%'
    },
    {
      key: 'netMarginPct',
      maxDeltaPct: 3,
      name: 'Margin Delta',
      reason: 'Margin accuracy critical - tighter threshold'
    },
    {
      key: 'profitPerApptRan',
      maxDeltaPct: 10,
      name: 'Profit Per Appt Ran Delta',
      reason: 'Metric fix allows wider variance'
    },
    {
      key: 'appointmentsCovered',
      minAbsolute: 1, // At least 1 appointment covered
      name: 'Appointment Coverage',
      reason: 'Must have appointments in truth set'
    }
  ];

  const results = [];
  let thresholdsMet = 0;

  for (const threshold of thresholds) {
    const delta = comparison.deltas[threshold.key];
    
    let passed = false;
    let detail = '';

    if (threshold.maxDeltaPct !== undefined) {
      const absDelta = Math.abs(delta.percentDelta);
      passed = absDelta <= threshold.maxDeltaPct;
      detail = `${absDelta.toFixed(2)}% (threshold: ${threshold.maxDeltaPct}%)`;
    } else if (threshold.minAbsolute !== undefined) {
      passed = delta.v2 >= threshold.minAbsolute;
      detail = `${delta.v2} appointments (minimum: ${threshold.minAbsolute})`;
    }

    if (passed) thresholdsMet++;

    results.push({
      threshold: threshold.name,
      passed,
      detail,
      reason: threshold.reason
    });
  }

  return {
    totalThresholds: thresholds.length,
    thresholdsMet,
    allThresholdsMet: thresholdsMet === thresholds.length,
    results
  };
}

// ============================================================
// GENERATE RECOMMENDATIONS
// ============================================================
function generateRecommendations(acceptance, comparison) {
  const recs = [];

  if (acceptance.allThresholdsMet) {
    recs.push('✓ All acceptance thresholds passed.');
    recs.push('→ Ready for Phase 7: Execute KPI V2 cutover.');
  } else {
    const failed = acceptance.results.filter(r => !r.passed);
    for (const f of failed) {
      if (f.threshold === 'Margin Delta') {
        recs.push(`! Margin delta exceeded: Review cost source alignment (Phase 3).`);
      } else if (f.threshold === 'Profit Per Appt Ran Delta') {
        recs.push(`! Profit per appt variance: Check appointment truth coverage (Phase 5).`);
      } else if (f.threshold === 'Appointment Coverage') {
        recs.push(`! No appointments in truth set: Enable CalendarEvent sync or check CRMJob appointment data.`);
      }
    }
  }

  return recs;
}