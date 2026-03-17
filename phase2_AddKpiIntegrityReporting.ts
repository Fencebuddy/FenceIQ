import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 2 — ADD KPI INTEGRITY REPORTING
 * 
 * Exposes data-quality gaps clearly before changing KPI compute logic.
 * 
 * Reports:
 * - Signed jobs missing proposal snapshot linkage
 * - Sold jobs missing contract value
 * - Jobs missing cost source
 * - Jobs with snapshot mismatch
 * - Jobs with unmapped/unknown pricing discipline source
 * - Jobs with missing appointment linkage
 * - Jobs with unmapped production stage
 * 
 * Produces honest coverage metrics and sample records for each gap.
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

    // === COMPUTE INTEGRITY METRICS ===
    const integrityReport = await computeIntegrityMetrics(base44, companyId);

    // === PRODUCE DASHBOARD-READY WARNINGS ===
    const warnings = produceWarnings(integrityReport);

    // === COVERAGE SUMMARY ===
    const coverageSummary = produceCoverageSummary(integrityReport);

    // === SYNTHESIS & RECOMMENDATIONS ===
    const synthesis = synthesizeIntegrityAssessment(integrityReport, coverageSummary);

    return Response.json({
      phase: 'Phase 2 Add KPI Integrity Reporting',
      timestamp: new Date().toISOString(),
      companyId,
      integrityMetrics: integrityReport,
      warnings,
      coverage: coverageSummary,
      synthesis,
      dashboardReady: {
        warningsForDisplay: warnings.filter(w => w.severity === 'HIGH' || w.severity === 'CRITICAL'),
        coverageMetrics: Object.entries(coverageSummary).map(([kpi, data]) => ({
          kpi,
          completeness: data.completeness,
          status: data.status
        })),
        actionItems: synthesis.actionItems
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// COMPUTE INTEGRITY METRICS
// ============================================================
async function computeIntegrityMetrics(base44, companyId) {
  const metrics = {
    signedDealLinkage: {},
    contractValue: {},
    costSource: {},
    pricingDiscipline: {},
    appointmentLinkage: {},
    productionStage: {},
    snapshotMismatch: {}
  };

  try {
    // Fetch all CRM jobs
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    const signedJobs = allJobs.filter(j => j.contractStatus === 'signed');
    const soldJobs = allJobs.filter(j => j.saleStatus === 'sold');

    // Fetch snapshots for cross-reference
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    const jobCostSnapshots = await base44.entities.JobCostSnapshot.list();
    const calendarEvents = await base44.entities.CalendarEvent.filter({ companyId });

    // === METRIC 1: SIGNED DEAL LINKAGE ===
    const withProposalSnapshot = signedJobs.filter(j => j.currentProposalSnapshotId);
    const withExternalJobId = signedJobs.filter(j => j.externalJobId);
    const withoutEitherLinkage = signedJobs.filter(j => !j.currentProposalSnapshotId && !j.externalJobId);

    metrics.signedDealLinkage = {
      total: signedJobs.length,
      withCurrentProposalSnapshotId: {
        count: withProposalSnapshot.length,
        percent: signedJobs.length > 0 ? (withProposalSnapshot.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withProposalSnapshot.length / signedJobs.length >= 0.75 ? 'OK' : 'INCOMPLETE'
      },
      withExternalJobId: {
        count: withExternalJobId.length,
        percent: signedJobs.length > 0 ? (withExternalJobId.length / signedJobs.length * 100).toFixed(1) : 0
      },
      missingBothLinkages: {
        count: withoutEitherLinkage.length,
        percent: signedJobs.length > 0 ? (withoutEitherLinkage.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withoutEitherLinkage.length > 0 ? 'MISSING_PROPOSAL_SNAPSHOT' : 'OK',
        samples: withoutEitherLinkage.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          wonAt: j.wonAt
        }))
      }
    };

    // === METRIC 2: CONTRACT VALUE ===
    const withContractValue = soldJobs.filter(j => j.contractValueCents && j.contractValueCents > 0);
    const missingContractValue = soldJobs.filter(j => !j.contractValueCents || j.contractValueCents <= 0);

    metrics.contractValue = {
      total: soldJobs.length,
      withValue: {
        count: withContractValue.length,
        percent: soldJobs.length > 0 ? (withContractValue.length / soldJobs.length * 100).toFixed(1) : 0,
        status: withContractValue.length / soldJobs.length >= 0.98 ? 'OK' : 'INCOMPLETE'
      },
      missing: {
        count: missingContractValue.length,
        percent: soldJobs.length > 0 ? (missingContractValue.length / soldJobs.length * 100).toFixed(1) : 0,
        status: missingContractValue.length > 0 ? 'MISSING_CONTRACT_VALUE' : 'OK',
        samples: missingContractValue.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          saleStatus: j.saleStatus
        }))
      }
    };

    // === METRIC 3: COST SOURCE ===
    const withCostData = signedJobs.filter(j => j.directCostCents && j.directCostCents > 0);
    const missingCost = signedJobs.filter(j => !j.directCostCents || j.directCostCents <= 0);

    metrics.costSource = {
      total: signedJobs.length,
      withCost: {
        count: withCostData.length,
        percent: signedJobs.length > 0 ? (withCostData.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withCostData.length / signedJobs.length >= 0.60 ? 'PARTIAL' : 'INCOMPLETE'
      },
      missing: {
        count: missingCost.length,
        percent: signedJobs.length > 0 ? (missingCost.length / signedJobs.length * 100).toFixed(1) : 0,
        status: missingCost.length > 0 ? 'MISSING_COST' : 'OK',
        samples: missingCost.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          costSource: j.costSource
        }))
      }
    };

    // === METRIC 4: PRICING DISCIPLINE ===
    const proposalSnapshotMap = new Map();
    proposalSnapshots.forEach(ps => {
      proposalSnapshotMap.set(ps.id, ps);
    });

    const withValidPricing = signedJobs.filter(j => {
      const snapshot = proposalSnapshotMap.get(j.currentProposalSnapshotId);
      return snapshot && snapshot.model_sell_price && snapshot.model_sell_price > 0 &&
             snapshot.presented_sell_price && snapshot.presented_sell_price > 0;
    });

    const withoutValidPricing = signedJobs.filter(j => {
      const snapshot = proposalSnapshotMap.get(j.currentProposalSnapshotId);
      return !snapshot || !snapshot.model_sell_price || snapshot.model_sell_price <= 0 ||
             !snapshot.presented_sell_price || snapshot.presented_sell_price <= 0;
    });

    metrics.pricingDiscipline = {
      total: signedJobs.length,
      withValidPricing: {
        count: withValidPricing.length,
        percent: signedJobs.length > 0 ? (withValidPricing.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withValidPricing.length / signedJobs.length >= 0.75 ? 'PARTIAL' : 'INCOMPLETE'
      },
      unknown: {
        count: withoutValidPricing.length,
        percent: signedJobs.length > 0 ? (withoutValidPricing.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withoutValidPricing.length > 0 ? 'UNKNOWN_PRICING_SOURCE' : 'OK',
        samples: withoutValidPricing.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          reason: j.currentProposalSnapshotId ? 'snapshot missing model_sell_price' : 'no proposal snapshot'
        }))
      }
    };

    // === METRIC 5: APPOINTMENT LINKAGE ===
    const calendarEventJobIds = new Set(
      calendarEvents.filter(e => e.crmJobId).map(e => e.crmJobId)
    );

    const withAppointmentStatus = allJobs.filter(j => j.appointmentStatus);
    const withCalendarEvent = allJobs.filter(j => calendarEventJobIds.has(j.id));
    const withoutBothApptSources = allJobs.filter(j => !j.appointmentStatus && !calendarEventJobIds.has(j.id));

    metrics.appointmentLinkage = {
      total: allJobs.length,
      crmJobAppointmentStatus: {
        count: withAppointmentStatus.length,
        percent: allJobs.length > 0 ? (withAppointmentStatus.length / allJobs.length * 100).toFixed(1) : 0,
        status: withAppointmentStatus.length > 0 ? 'SPARSE' : 'UNAVAILABLE'
      },
      calendarEvent: {
        count: withCalendarEvent.length,
        percent: allJobs.length > 0 ? (withCalendarEvent.length / allJobs.length * 100).toFixed(1) : 0,
        status: withCalendarEvent.length / allJobs.length >= 0.85 ? 'OK' : 'SPARSE'
      },
      missingBothSources: {
        count: withoutBothApptSources.length,
        percent: allJobs.length > 0 ? (withoutBothApptSources.length / allJobs.length * 100).toFixed(1) : 0,
        status: withoutBothApptSources.length > 0 ? 'MISSING_APPOINTMENT_LINKAGE' : 'OK',
        samples: withoutBothApptSources.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          status: j.status
        }))
      }
    };

    // === METRIC 6: PRODUCTION STAGE ===
    const withInstallStage = signedJobs.filter(j => j.installStage);
    const withoutInstallStage = signedJobs.filter(j => !j.installStage);
    const installStageDistribution = {};
    signedJobs.forEach(j => {
      const stage = j.installStage || 'UNMAPPED';
      installStageDistribution[stage] = (installStageDistribution[stage] || 0) + 1;
    });

    metrics.productionStage = {
      total: signedJobs.length,
      mapped: {
        count: withInstallStage.length,
        percent: signedJobs.length > 0 ? (withInstallStage.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withInstallStage.length / signedJobs.length >= 0.85 ? 'OK' : 'INCOMPLETE'
      },
      unmapped: {
        count: withoutInstallStage.length,
        percent: signedJobs.length > 0 ? (withoutInstallStage.length / signedJobs.length * 100).toFixed(1) : 0,
        status: withoutInstallStage.length > 0 ? 'UNMAPPED_PRODUCTION_STAGE' : 'OK',
        samples: withoutInstallStage.slice(0, 3).map(j => ({
          jobNumber: j.jobNumber,
          jobId: j.id,
          paymentStage: j.paymentStage
        }))
      },
      distribution: installStageDistribution
    };

    // === METRIC 7: SNAPSHOT MISMATCH ===
    const snapshotMismatches = [];
    for (const job of signedJobs) {
      if (!job.currentProposalSnapshotId) continue;
      const snapshot = proposalSnapshotMap.get(job.currentProposalSnapshotId);
      if (!snapshot) {
        snapshotMismatches.push({
          jobNumber: job.jobNumber,
          jobId: job.id,
          issue: 'currentProposalSnapshotId points to non-existent snapshot',
          snapshotId: job.currentProposalSnapshotId
        });
      }
    }

    metrics.snapshotMismatch = {
      total: signedJobs.length,
      mismatchCount: snapshotMismatches.length,
      percent: signedJobs.length > 0 ? (snapshotMismatches.length / signedJobs.length * 100).toFixed(1) : 0,
      status: snapshotMismatches.length === 0 ? 'OK' : 'SNAPSHOT_MISMATCH',
      samples: snapshotMismatches.slice(0, 3)
    };

  } catch (error) {
    metrics.error = error.message;
  }

  return metrics;
}

// ============================================================
// PRODUCE WARNINGS FOR DASHBOARD
// ============================================================
function produceWarnings(integrityReport) {
  const warnings = [];

  // Signed deal linkage
  if (integrityReport.signedDealLinkage.missingBothLinkages?.count > 0) {
    warnings.push({
      severity: 'HIGH',
      family: 'Signed Deals',
      title: 'Proposal Snapshot Linkage Incomplete',
      message: `${integrityReport.signedDealLinkage.missingBothLinkages.count} signed jobs missing proposal snapshot linkage (${integrityReport.signedDealLinkage.missingBothLinkages.percent}%).`,
      action: 'Phase 3 backfill will repair linkages.',
      status: 'INCOMPLETE'
    });
  }

  // Contract value
  if (integrityReport.contractValue.missing?.count > 0) {
    warnings.push({
      severity: 'CRITICAL',
      family: 'Contract Value',
      title: 'Sold Jobs Missing Contract Value',
      message: `${integrityReport.contractValue.missing.count} sold jobs missing contractValueCents (${integrityReport.contractValue.missing.percent}%).`,
      action: 'Phase 3 backfill will derive from proposals.',
      status: 'INCOMPLETE'
    });
  }

  // Cost source
  if (integrityReport.costSource.missing?.count > 0) {
    warnings.push({
      severity: 'MEDIUM',
      family: 'Cost Truth',
      title: 'Cost Data Missing or Incomplete',
      message: `${integrityReport.costSource.missing.count} signed jobs missing cost data (${integrityReport.costSource.missing.percent}%).`,
      action: 'Phase 1 decision required on canonical cost source.',
      status: 'PARTIAL'
    });
  }

  // Pricing discipline
  if (integrityReport.pricingDiscipline.unknown?.count > 0) {
    warnings.push({
      severity: 'MEDIUM',
      family: 'Pricing Discipline',
      title: 'Unknown Pricing Source',
      message: `${integrityReport.pricingDiscipline.unknown.count} jobs missing model/presented prices (${integrityReport.pricingDiscipline.unknown.percent}%).`,
      action: 'Phase 4 will mark KPI as PARTIAL until sources are complete.',
      status: 'UNKNOWN'
    });
  }

  // Appointment linkage
  if (integrityReport.appointmentLinkage.missingBothSources?.count > 0) {
    warnings.push({
      severity: 'MEDIUM',
      family: 'Appointments',
      title: 'Missing Appointment Linkage',
      message: `${integrityReport.appointmentLinkage.missingBothSources.count} jobs without appointment data (${integrityReport.appointmentLinkage.missingBothSources.percent}%).`,
      action: 'Phase 5 will migrate to CalendarEvent source.',
      status: 'MISSING'
    });
  }

  // Production stage
  if (integrityReport.productionStage.unmapped?.count > 0) {
    warnings.push({
      severity: 'LOW',
      family: 'Production',
      title: 'Unmapped Production Stages',
      message: `${integrityReport.productionStage.unmapped.count} jobs without installStage mapping (${integrityReport.productionStage.unmapped.percent}%).`,
      action: 'Phase 4 will backfill based on paymentStage.',
      status: 'UNMAPPED'
    });
  }

  // Snapshot mismatch
  if (integrityReport.snapshotMismatch.mismatchCount > 0) {
    warnings.push({
      severity: 'HIGH',
      family: 'Data Integrity',
      title: 'Snapshot Foreign Key Mismatch',
      message: `${integrityReport.snapshotMismatch.mismatchCount} jobs reference non-existent snapshots (${integrityReport.snapshotMismatch.percent}%).`,
      action: 'Phase 3 backfill will repair or remove invalid references.',
      status: 'MISMATCH'
    });
  }

  return warnings;
}

// ============================================================
// PRODUCE COVERAGE SUMMARY
// ============================================================
function produceCoverageSummary(integrityReport) {
  return {
    signedDealLinkage: {
      completeness: parseFloat(integrityReport.signedDealLinkage.withCurrentProposalSnapshotId?.percent || 0),
      status: integrityReport.signedDealLinkage.missingBothLinkages?.count > 0 ? 'INCOMPLETE' : 'OK'
    },
    contractValue: {
      completeness: parseFloat(integrityReport.contractValue.withValue?.percent || 0),
      status: integrityReport.contractValue.missing?.count > 0 ? 'INCOMPLETE' : 'OK'
    },
    costSource: {
      completeness: parseFloat(integrityReport.costSource.withCost?.percent || 0),
      status: integrityReport.costSource.missing?.count > 0 ? 'PARTIAL' : 'OK'
    },
    pricingDiscipline: {
      completeness: parseFloat(integrityReport.pricingDiscipline.withValidPricing?.percent || 0),
      status: integrityReport.pricingDiscipline.unknown?.count > 0 ? 'UNKNOWN' : 'OK'
    },
    appointmentLinkage: {
      completeness: parseFloat(integrityReport.appointmentLinkage.calendarEvent?.percent || 0),
      status: integrityReport.appointmentLinkage.missingBothSources?.count > 0 ? 'MISSING' : 'OK'
    },
    productionStage: {
      completeness: parseFloat(integrityReport.productionStage.mapped?.percent || 0),
      status: integrityReport.productionStage.unmapped?.count > 0 ? 'UNMAPPED' : 'OK'
    }
  };
}

// ============================================================
// SYNTHESIZE INTEGRITY ASSESSMENT
// ============================================================
function synthesizeIntegrityAssessment(integrityReport, coverageSummary) {
  const criticalCount = Object.values(coverageSummary)
    .filter(c => c.status === 'INCOMPLETE' || c.status === 'UNKNOWN' || c.status === 'MISSING')
    .length;

  return {
    overallStatus: criticalCount > 3 ? 'NEEDS_REPAIR' : criticalCount > 0 ? 'PARTIAL_COVERAGE' : 'OK',
    affectedKpiFamilies: Object.entries(coverageSummary)
      .filter(([_, data]) => data.status !== 'OK')
      .map(([name, data]) => ({ name, status: data.status, completeness: data.completeness })),
    blockers: [
      integrityReport.contractValue.missing?.count > 0 
        ? 'Contract value missing for sold jobs—blocks revenue KPI'
        : null,
      integrityReport.signedDealLinkage.missingBothLinkages?.count > 0
        ? 'Proposal snapshot linkage weak—blocks pricing discipline KPI'
        : null,
      integrityReport.snapshotMismatch.mismatchCount > 0
        ? 'Snapshot foreign key mismatch—data integrity risk'
        : null
    ].filter(Boolean),
    actionItems: [
      'Review warnings and understand data-quality gaps',
      'Phase 3 backfill will repair snapshot linkages',
      'Phase 1 cost-source decision required before Phase 3',
      'Phase 5 appointment migration path needed if CalendarEvent sparse',
      'Monitor Phase 2 → Phase 3 transition for coverage improvement'
    ]
  };
}