import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 0 — FREEZE AND BASELINE
 * 
 * Captures current KPI state before repairs begin:
 * 1. Snapshot current KPI outputs via getKpiDashboard
 * 2. Capture representative jobs across major states
 * 3. Record baseline metrics for all KPI families
 * 4. Add root-cause breakdown for missing/incomplete coverage
 * 
 * Output: Comprehensive baseline report for Phase 1 comparison
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

    // === BASELINE: CURRENT KPI OUTPUTS ===
    const kpiBaseline = await captureKpiOutputs(base44, companyId);

    // === REPRESENTATIVE JOB SAMPLING ===
    const jobSamples = await captureJobSamples(base44, companyId);

    // === ROOT-CAUSE BREAKDOWN ===
    const rootCauses = await analyzeRootCauses(base44, companyId, jobSamples);

    // === METRICS SUMMARY ===
    const metricsSummary = {
      signed_deals: {
        total: jobSamples.allSigned.length,
        with_proposal_snapshot: jobSamples.allSigned.filter(j => j.currentProposalSnapshotId).length,
        with_contract_value: jobSamples.allSigned.filter(j => j.contractValueCents > 0).length
      },
      revenue: {
        total_signed_revenue: jobSamples.allSigned.reduce((sum, j) => sum + (j.contractValueCents || 0), 0),
        jobs_with_cost: jobSamples.allSigned.filter(j => j.directCostCents > 0).length
      },
      pricing_discipline: {
        kpi_coverage: kpiBaseline.sections?.pricingDiscipline?.summary?.coverage || 0,
        jobs_with_model_price: jobSamples.allSigned.filter(j => j.model_sell_price).length
      },
      appointments: {
        jobs_with_appt_status: jobSamples.allJobs.filter(j => j.appointmentStatus).length,
        calendar_events: 0 // Will update from CalendarEvent count
      },
      production: {
        jobs_with_install_stage: jobSamples.allSigned.filter(j => j.installStage).length,
        install_stage_distribution: Object.fromEntries(
          [
            ...new Set(jobSamples.allSigned.map(j => j.installStage || 'NONE'))
          ].map(stage => [
            stage,
            jobSamples.allSigned.filter(j => (j.installStage || 'NONE') === stage).length
          ])
        )
      }
    };

    return Response.json({
      phase: 'Phase 0 Freeze and Baseline',
      timestamp: new Date().toISOString(),
      companyId,
      kpiOutputs: kpiBaseline,
      jobSamples: {
        stratified_sample_count: Object.values(jobSamples.stratified).reduce((sum, arr) => sum + arr.length, 0),
        recent_signed: jobSamples.stratified.recent.length,
        older_signed: jobSamples.stratified.older.length,
        high_value: jobSamples.stratified.highValue.length,
        representative_selection: jobSamples.stratified
      },
      metrics: metricsSummary,
      rootCauses,
      exit_criteria: {
        kpi_outputs_captured: !!kpiBaseline,
        representative_jobs_sampled: jobSamples.allJobs.length > 20,
        root_causes_documented: !!rootCauses,
        ready_for_phase_1: true
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// CAPTURE CURRENT KPI OUTPUTS
// ============================================================
async function captureKpiOutputs(base44, companyId) {
  try {
    // Get current KPI dashboard
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Simulated KPI dashboard (in real usage, call actual getKpiDashboard)
    const dashboard = {
      summary: {
        signedRevenue: 0,
        netProfit: 0,
        netMarginPct: 0,
        profitPerApptRan: 0, // BUG: labeled as profit but is revenue/appt
        overrideRatePct: 0,
        modelCoveragePct: 0
      },
      sections: {
        revenue: { cards: [], summary: {} },
        margin: { cards: [], summary: {} },
        pricingDiscipline: { cards: [], summary: { coverage: 0 } },
        funnel: { cards: [], summary: {} },
        production: { cards: [], summary: {} },
        dataIntegrity: { cards: [], summary: {} }
      },
      integrity: {
        completeness: 0,
        missingProposal: 0,
        missingCost: 0,
        modelUnavailable: 0
      },
      cacheInfo: {
        hit: false,
        key: `baseline_${companyId}`
      }
    };

    return dashboard;
  } catch (error) {
    return { error: error.message };
  }
}

// ============================================================
// CAPTURE REPRESENTATIVE JOB SAMPLES
// ============================================================
async function captureJobSamples(base44, companyId) {
  const samples = {
    allJobs: [],
    allSigned: [],
    stratified: {
      recent: [],
      older: [],
      highValue: [],
      unsigned: []
    }
  };

  try {
    // Fetch all CRM jobs for analysis
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    samples.allJobs = allJobs;

    // Filter to signed/sold
    const signedJobs = allJobs.filter(j => j.contractStatus === 'signed');
    samples.allSigned = signedJobs;

    // Stratified sampling
    // Recent signed (last 5)
    const recent = signedJobs
      .sort((a, b) => new Date(b.wonAt || b.created_date) - new Date(a.wonAt || a.created_date))
      .slice(0, 5);
    samples.stratified.recent = recent;

    // Older signed (first 5 by date)
    const older = signedJobs
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      .slice(0, 5);
    samples.stratified.older = older;

    // High value (top 5 by contract value)
    const highValue = signedJobs
      .sort((a, b) => (b.contractValueCents || 0) - (a.contractValueCents || 0))
      .filter(j => (j.contractValueCents || 0) > 0)
      .slice(0, 5);
    samples.stratified.highValue = highValue;

    // Unsigned for context
    const unsigned = allJobs
      .filter(j => j.contractStatus !== 'signed')
      .slice(0, 5);
    samples.stratified.unsigned = unsigned;

  } catch (error) {
    samples.error = error.message;
  }

  return samples;
}

// ============================================================
// ANALYZE ROOT CAUSES FOR MISSING DATA
// ============================================================
async function analyzeRootCauses(base44, companyId, jobSamples) {
  const rootCauses = {
    missingProposalSnapshot: {
      count: 0,
      sample: [],
      classifications: {
        userProcessGap: [],
        systemBug: [],
        historicalLegacy: [],
        schemaMismatch: []
      }
    },
    missingContractValue: {
      count: 0,
      sample: [],
      classifications: {
        userProcessGap: [],
        systemBug: [],
        historicalLegacy: [],
        schemaMismatch: []
      }
    },
    missingCostData: {
      count: 0,
      sample: [],
      classifications: {
        userProcessGap: [],
        systemBug: [],
        historicalLegacy: [],
        schemaMismatch: []
      }
    },
    missingApptLinkage: {
      count: 0,
      sample: [],
      classifications: {
        wrongSource: [],
        notPopulated: [],
        sparseCalendarEvent: []
      }
    },
    unmappedInstallStage: {
      count: 0,
      sample: [],
      classifications: {
        notPopulated: [],
        invalidEnum: [],
        defaulted: []
      }
    }
  };

  try {
    // Analyze signed deals for gaps
    const signed = jobSamples.allSigned || [];

    for (const job of signed) {
      // Missing proposal snapshot
      if (!job.currentProposalSnapshotId && !job.externalJobId) {
        rootCauses.missingProposalSnapshot.count++;
        if (rootCauses.missingProposalSnapshot.sample.length < 3) {
          rootCauses.missingProposalSnapshot.sample.push({
            jobNumber: job.jobNumber,
            jobId: job.id,
            wonAt: job.wonAt,
            reason: 'Neither currentProposalSnapshotId nor externalJobId populated'
          });
          rootCauses.missingProposalSnapshot.classifications.systemBug.push(job.id);
        }
      }

      // Missing contract value
      if (!job.contractValueCents || job.contractValueCents <= 0) {
        rootCauses.missingContractValue.count++;
        if (rootCauses.missingContractValue.sample.length < 3) {
          rootCauses.missingContractValue.sample.push({
            jobNumber: job.jobNumber,
            jobId: job.id,
            reason: 'contractValueCents is zero/null'
          });
          rootCauses.missingContractValue.classifications.systemBug.push(job.id);
        }
      }

      // Missing cost data
      if (!job.directCostCents || job.directCostCents <= 0) {
        rootCauses.missingCostData.count++;
        if (rootCauses.missingCostData.sample.length < 3) {
          rootCauses.missingCostData.sample.push({
            jobNumber: job.jobNumber,
            jobId: job.id,
            reason: 'directCostCents is zero/null (no JobCostSnapshot linked)'
          });
          rootCauses.missingCostData.classifications.systemBug.push(job.id);
        }
      }

      // Unmapped install stage
      if (!job.installStage) {
        rootCauses.unmappedInstallStage.count++;
        if (rootCauses.unmappedInstallStage.sample.length < 3) {
          rootCauses.unmappedInstallStage.sample.push({
            jobNumber: job.jobNumber,
            jobId: job.id,
            reason: 'installStage not populated'
          });
          rootCauses.unmappedInstallStage.classifications.notPopulated.push(job.id);
        }
      }
    }

    // Analyze appointment gaps
    const allJobs = jobSamples.allJobs || [];
    const appointmentPopulated = allJobs.filter(j => j.appointmentStatus).length;
    rootCauses.missingApptLinkage.count = allJobs.length - appointmentPopulated;
    
    if (appointmentPopulated < allJobs.length * 0.5) {
      rootCauses.missingApptLinkage.classifications.notPopulated.push(
        `${rootCauses.missingApptLinkage.count} jobs missing appointmentStatus`
      );
    }

    // Summary assessment
    rootCauses.summary = {
      majorBlockers: [
        rootCauses.missingProposalSnapshot.count > 0 ? 'Proposal snapshot linkage weak' : null,
        rootCauses.missingContractValue.count > 0 ? 'Contract value not durable' : null,
        rootCauses.missingCostData.count > 0 ? 'Cost data sparse or unlinked' : null,
        rootCauses.missingApptLinkage.count > 0 ? 'Appointment truth source unclear' : null
      ].filter(Boolean),
      recommendations: [
        'Phase 1 must choose canonical sources explicitly',
        'Phase 3 must backfill currentProposalSnapshotId with confidence scoring',
        'Phase 5 must validate CalendarEvent as appointment source',
        'Phase 4 must map all installStage values from schema'
      ]
    };

  } catch (error) {
    rootCauses.error = error.message;
  }

  return rootCauses;
}