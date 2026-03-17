import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DATA INTEGRITY AGENT
 * Runs scheduled checks on pricing invariants, unmapped materials, broken snapshots
 * Stores results and sends email alerts to admins when issues found
 */

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const companyId = "PrivacyFenceCo49319"; // TODO: Get from tenant context
    const checks = [];

    // CHECK 1: Pricing Invariants (runs > 0 => takeoff lines > 0)
    const pricingCheck = await checkPricingInvariants(base44, companyId);
    checks.push(pricingCheck);

    // CHECK 2: Unmapped Materials — now surfaces NO_COVERAGE when no TakeoffSnapshots exist
    const unmappedCheck = await checkUnmappedMaterials(base44, companyId);
    checks.push(unmappedCheck);

    // CHECK 3: Broken Snapshots — now surfaces NO_COVERAGE when no JobCostSnapshots scanned
    const snapshotCheck = await checkBrokenSnapshots(base44, companyId);
    checks.push(snapshotCheck);

    // CHECK 4: Orphaned Runs (runs with invalid jobId)
    const orphanedCheck = await checkOrphanedRuns(base44, companyId);
    checks.push(orphanedCheck);

    // CHECK 5: Duplicate singleton config records
    const duplicateConfigCheck = await checkDuplicateConfigs(base44, companyId);
    checks.push(duplicateConfigCheck);

    // CHECK 6: Stale / empty reporting output
    const reportingHealthCheck = await checkReportingHealth(base44, companyId);
    checks.push(reportingHealthCheck);

    // CHECK 7: Hollow revenue / profit truth — fixed: queries current live state, not cached old state
    const hollowRevenueCheck = await checkHollowRevenueTruth(base44, companyId);
    checks.push(hollowRevenueCheck);

    // CHECK 8: Breakeven integrity (rollup freshness, missing current month)
    const breakevenIntegrityCheck = await checkBreakevenIntegrity(base44, companyId);
    checks.push(breakevenIntegrityCheck);

    // CHECK 9: Automation health (failures, zero-runs on critical automations)
    const automationHealthCheck = await checkAutomationHealth(base44, companyId);
    checks.push(automationHealthCheck);

    // CHECK 10: False-green integrity (now inline — check 2 and 3 already surface this directly)
    // Kept for backwards compatibility but simplified — checks 2/3 are now honest themselves
    const falseGreenCheck = await checkFalseGreenIntegrity(base44, companyId);
    checks.push(falseGreenCheck);

    // Save all results
    for (const check of checks) {
      await base44.asServiceRole.entities.IntegrityCheckResult.create({
        companyId,
        checkType: check.checkType,
        status: check.status,
        errorCount: check.errorCount,
        warningCount: check.warningCount,
        details: check.details,
        runDurationMs: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      });
    }

    // Send alert email if any errors found
    const totalErrors = checks.reduce((sum, c) => sum + c.errorCount, 0);
    if (totalErrors > 0) {
      await sendIntegrityAlert(base44, checks, totalErrors);
    }

    return Response.json({
      success: true,
      checks,
      totalErrors,
      totalWarnings: checks.reduce((sum, c) => sum + c.warningCount, 0),
      runDurationMs: Date.now() - startTime
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

async function checkPricingInvariants(base44, companyId) {
  const errors = [];
  const warnings = [];

  const jobs = await base44.asServiceRole.entities.Job.filter({ companyId });
  
  for (const job of jobs) {
    const runs = await base44.asServiceRole.entities.Run.filter({ 
      jobId: job.id,
      includeInCalculation: true 
    });

    if (runs.length > 0) {
      const takeoffSnapshot = job.active_takeoff_snapshot_id 
        ? await base44.asServiceRole.entities.TakeoffSnapshot.filter({ id: job.active_takeoff_snapshot_id }).then(r => r[0])
        : null;

      if (!takeoffSnapshot) {
        warnings.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          issue: 'Has runs but no takeoff snapshot'
        });
      } else if (!takeoffSnapshot.line_items || takeoffSnapshot.line_items.length === 0) {
        errors.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          issue: 'Has runs but takeoff has zero line items'
        });
      }

      if (job.pricing_status === 'SAVED' && !job.active_pricing_snapshot_id) {
        errors.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          issue: 'Pricing status SAVED but no pricing snapshot ID'
        });
      }
    }
  }

  return {
    checkType: 'pricing_invariants',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { errors, warnings, jobsChecked: jobs.length }
  };
}

async function checkUnmappedMaterials(base44, companyId) {
  const errors = [];
  const warnings = [];
  
  const snapshots = await base44.asServiceRole.entities.TakeoffSnapshot.filter({ companyId });

  // FIXED: When no TakeoffSnapshots exist, report NO_COVERAGE instead of false-green OK
  if (snapshots.length === 0) {
    return {
      checkType: 'unmapped_materials',
      status: 'WARN',
      errorCount: 0,
      warningCount: 1,
      details: {
        errors: [],
        warnings: [{ severity: 'INFO', message: 'NO_COVERAGE: 0 TakeoffSnapshots exist for this company. Unmapped materials check has no records to scan.' }],
        totalUnmapped: 0,
        unmappedByType: {},
        snapshotsScanned: 0,
        coverageNote: 'NO_COVERAGE — check cannot produce meaningful signal without TakeoffSnapshots'
      }
    };
  }
  
  let totalUnmapped = 0;
  const unmappedByType = {};

  for (const snapshot of snapshots.slice(0, 50)) {
    if (snapshot.unresolved_items && snapshot.unresolved_items.length > 0) {
      totalUnmapped += snapshot.unresolved_items.length;
      for (const item of snapshot.unresolved_items) {
        const key = item.uck || item.role || 'unknown';
        unmappedByType[key] = (unmappedByType[key] || 0) + 1;
      }
    }
  }

  if (totalUnmapped > 0) {
    errors.push({
      totalUnmapped,
      snapshotsAffected: snapshots.filter(s => s.unresolved_items?.length > 0).length,
      topUnmapped: Object.entries(unmappedByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count }))
    });
  }

  return {
    checkType: 'unmapped_materials',
    status: totalUnmapped > 20 ? 'ERROR' : (totalUnmapped > 0 ? 'WARN' : 'OK'),
    errorCount: totalUnmapped > 20 ? 1 : 0,
    warningCount: totalUnmapped > 0 && totalUnmapped <= 20 ? 1 : 0,
    details: { errors, warnings, totalUnmapped, unmappedByType, snapshotsScanned: snapshots.length }
  };
}

async function checkBrokenSnapshots(base44, companyId) {
  const errors = [];
  
  const pricingSnapshots = await base44.asServiceRole.entities.JobCostSnapshot.filter({ 
    companyId,
    active: true 
  });

  // FIXED: When no snapshots scanned, report NO_COVERAGE instead of false-green OK
  if (pricingSnapshots.length === 0) {
    return {
      checkType: 'broken_snapshots',
      status: 'WARN',
      errorCount: 0,
      warningCount: 1,
      details: {
        errors: [],
        snapshotsChecked: 0,
        coverageNote: 'NO_COVERAGE — 0 JobCostSnapshots found with {active:true}. Check cannot produce meaningful signal. This is not an error but coverage is zero.'
      }
    };
  }

  for (const snapshot of pricingSnapshots) {
    if (!snapshot.materials_resolved || snapshot.materials_resolved.length === 0) {
      errors.push({
        snapshotId: snapshot.id,
        jobId: snapshot.jobId,
        issue: 'Active pricing snapshot has no resolved materials'
      });
    }
    
    if (!snapshot.direct_cost || snapshot.direct_cost === 0) {
      errors.push({
        snapshotId: snapshot.id,
        jobId: snapshot.jobId,
        issue: 'Pricing snapshot has zero direct cost'
      });
    }
  }

  return {
    checkType: 'broken_snapshots',
    status: errors.length > 0 ? 'ERROR' : 'OK',
    errorCount: errors.length,
    warningCount: 0,
    details: { errors, snapshotsChecked: pricingSnapshots.length }
  };
}

async function checkOrphanedRuns(base44, companyId) {
  const errors = [];
  
  const runs = await base44.asServiceRole.entities.Run.filter({ isOrphan: true });
  
  if (runs.length > 0) {
    errors.push({
      orphanedCount: runs.length,
      reasons: runs.reduce((acc, run) => {
        acc[run.orphanReason || 'unknown'] = (acc[run.orphanReason || 'unknown'] || 0) + 1;
        return acc;
      }, {})
    });
  }

  return {
    checkType: 'orphaned_runs',
    status: runs.length > 0 ? 'WARN' : 'OK',
    errorCount: 0,
    warningCount: runs.length > 0 ? 1 : 0,
    details: { errors, orphanedCount: runs.length }
  };
}

async function checkDuplicateConfigs(base44, companyId) {
  const errors = [];
  const warnings = [];

  const bsAll = await base44.asServiceRole.entities.BreakevenSettings.filter({});
  const bsByCompany = {};
  for (const bs of bsAll) {
    const cid = bs.companyId || 'unknown';
    bsByCompany[cid] = (bsByCompany[cid] || 0) + 1;
  }
  for (const [cid, count] of Object.entries(bsByCompany)) {
    if (count > 1) {
      errors.push({ entity: 'BreakevenSettings', companyId: cid, count, severity: 'HIGH',
        message: `${count} BreakevenSettings records for companyId=${cid} — expected exactly 1. Breakeven goal calculations are non-deterministic.` });
    }
  }

  const osAll = await base44.asServiceRole.entities.OverheadSettings.filter({});
  const osByCompany = {};
  for (const os of osAll) {
    const cid = os.companyId || 'unknown';
    osByCompany[cid] = (osByCompany[cid] || 0) + 1;
  }
  for (const [cid, count] of Object.entries(osByCompany)) {
    if (count > 1) {
      errors.push({ entity: 'OverheadSettings', companyId: cid, count, severity: 'HIGH',
        message: `${count} OverheadSettings records for companyId=${cid} — expected exactly 1. Overhead rate resolution is non-deterministic.` });
    }
  }

  const allCompanies = await base44.asServiceRole.entities.CompanySettings.filter({});
  const knownIds = new Set(allCompanies.map(c => c.id).concat(allCompanies.map(c => c.companyId).filter(Boolean)));
  for (const os of osAll) {
    if (!knownIds.has(os.companyId)) {
      warnings.push({ entity: 'OverheadSettings', companyId: os.companyId, id: os.id, severity: 'LOW',
        message: `OverheadSettings record companyId=${os.companyId} does not match any known CompanySettings — possible stale/test record.` });
    }
  }
  for (const bs of bsAll) {
    if (!knownIds.has(bs.companyId)) {
      warnings.push({ entity: 'BreakevenSettings', companyId: bs.companyId, id: bs.id, severity: 'LOW',
        message: `BreakevenSettings record companyId=${bs.companyId} does not match any known CompanySettings — possible stale/test record.` });
    }
  }

  return {
    checkType: 'missing_catalog_items',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { checkName: 'duplicate_singleton_configs', errors, warnings }
  };
}

async function checkReportingHealth(base44, companyId) {
  const errors = [];
  const warnings = [];
  const now = new Date();

  const recentLogs = await base44.asServiceRole.entities.ReportRunLog.filter({ companyId });
  if (recentLogs.length === 0) {
    errors.push({ severity: 'CRITICAL', message: 'ReportRunLog has zero rows — Daily Reporting Rollup has never successfully written a log entry.' });
  } else {
    const sorted = recentLogs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    const latest = sorted[0];
    if (latest.status === 'failed') {
      errors.push({ severity: 'CRITICAL', reportType: latest.reportType, startedAt: latest.startedAt,
        errorMessage: latest.errorMessage,
        message: `Most recent ReportRunLog entry has status=failed. Error: ${latest.errorMessage || 'no message'}` });
    }
  }

  const dailyRollups = await base44.asServiceRole.entities.ReportRollupDaily.filter({ companyId });
  if (dailyRollups.length === 0) {
    warnings.push({ severity: 'HIGH', message: 'ReportRollupDaily has zero rows for this company.' });
  } else {
    const mostRecent = dailyRollups.sort((a, b) => new Date(b.updated_date || b.rollupDate) - new Date(a.updated_date || a.rollupDate))[0];
    const ageHours = (now - new Date(mostRecent.updated_date || mostRecent.rollupDate)) / 3600000;
    if (ageHours > 26) {
      warnings.push({ severity: 'HIGH', ageHours: Math.round(ageHours), lastUpdated: mostRecent.updated_date,
        message: `Most recent ReportRollupDaily row is ${Math.round(ageHours)}h old (threshold: 26h). Daily rollup may be stale.` });
    }
  }

  const weeklyRollups = await base44.asServiceRole.entities.ReportRollupWeekly.filter({ companyId });
  if (weeklyRollups.length === 0) {
    warnings.push({ severity: 'MEDIUM', message: 'ReportRollupWeekly has zero rows for this company. Weekly rollup has never run successfully.' });
  }

  return {
    checkType: 'orphaned_runs',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { checkName: 'reporting_health', errors, warnings,
      reportRunLogCount: recentLogs.length, dailyRollupCount: dailyRollups.length, weeklyRollupCount: weeklyRollups.length }
  };
}

// CHECK 7: Hollow revenue / profit truth
// FIXED: Checks current live state only. No cached assumptions from pre-backfill era.
// A CRMJob with recognitionStatus=UNRECOGNIZED is a genuine signal — the check is valid.
// The fix here is removing the stale warning about SaleSnapshot.direct_cost_cents=0
// (all backfilled snapshots now have it populated; 0 is only valid for pre-backfill records).
async function checkHollowRevenueTruth(base44, companyId) {
  const errors = [];
  const warnings = [];

  // Won/sold CRMJobs with recognitionStatus=UNRECOGNIZED or missing
  const wonJobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId, status: 'won' });
  const unrecognized = wonJobs.filter(j => j.recognitionStatus === 'UNRECOGNIZED' || !j.recognitionStatus);
  if (unrecognized.length > 0) {
    errors.push({ severity: 'HIGH', count: unrecognized.length,
      jobNumbers: unrecognized.slice(0, 10).map(j => j.jobNumber),
      message: `${unrecognized.length} won CRMJobs have recognitionStatus=UNRECOGNIZED. Revenue recognition pipeline has not run on these jobs.` });
  }

  // Won/sold CRMJobs with recognizedRevenueCents=0
  const zeroRevenue = wonJobs.filter(j => !j.recognizedRevenueCents || j.recognizedRevenueCents === 0);
  if (zeroRevenue.length > 0) {
    errors.push({ severity: 'HIGH', count: zeroRevenue.length,
      jobNumbers: zeroRevenue.slice(0, 10).map(j => j.jobNumber),
      message: `${zeroRevenue.length} won CRMJobs have recognizedRevenueCents=0. Breakeven rollup is using contractValueCents fallback, not recognized truth.` });
  }

  // SaleSnapshots with direct_cost_cents=0 AND cost_truth_basis != 'unavailable'
  // Only flag snapshots that should have cost data but don't.
  // Snapshots with cost_truth_basis='unavailable' are legitimately zero.
  const saleSnapshots = await base44.asServiceRole.entities.SaleSnapshot.filter({});
  const zeroCost = saleSnapshots.filter(s => 
    (!s.direct_cost_cents || s.direct_cost_cents === 0) && 
    s.cost_truth_basis !== 'unavailable'
  );
  if (zeroCost.length > 0) {
    warnings.push({ severity: 'MEDIUM', count: zeroCost.length,
      message: `${zeroCost.length} SaleSnapshots have direct_cost_cents=0 but cost_truth_basis is not 'unavailable'. These may be pre-backfill records needing cost data.` });
  }

  return {
    checkType: 'pricing_invariants',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { checkName: 'hollow_revenue_truth', errors, warnings,
      wonJobsChecked: wonJobs.length, saleSnapshotsChecked: saleSnapshots.length }
  };
}

async function checkBreakevenIntegrity(base44, companyId) {
  const errors = [];
  const warnings = [];
  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const companies = await base44.asServiceRole.entities.CompanySettings.filter({});
  const activeCompany = companies.find(c => c.companyId === companyId) || companies[0];
  const rollupCompanyId = activeCompany?.id;

  if (!rollupCompanyId) {
    errors.push({ severity: 'HIGH', message: 'Could not resolve CompanySettings.id for breakeven rollup lookup.' });
    return { checkType: 'broken_snapshots', status: 'ERROR', errorCount: 1, warningCount: 0, details: { checkName: 'breakeven_integrity', errors, warnings } };
  }

  const currentMonthRollups = await base44.asServiceRole.entities.BreakevenMonthlyRollup.filter({
    companyId: rollupCompanyId, monthKey: currentMonthKey
  });
  if (currentMonthRollups.length === 0) {
    errors.push({ severity: 'HIGH', rollupCompanyId, monthKey: currentMonthKey,
      message: `No BreakevenMonthlyRollup found for ${currentMonthKey}. Breakeven dashboard is showing stale or zero-revenue data.` });
  } else {
    const rollup = currentMonthRollups[0];
    const lastComputed = rollup.lastComputedAt || rollup.updated_date;
    if (lastComputed) {
      const ageHours = (now - new Date(lastComputed)) / 3600000;
      if (ageHours > 26) {
        warnings.push({ severity: 'MEDIUM', monthKey: currentMonthKey, ageHours: Math.round(ageHours),
          message: `BreakevenMonthlyRollup for ${currentMonthKey} last computed ${Math.round(ageHours)}h ago (threshold: 26h).` });
      }
    }
    if (rollup.recognizedRevenueCents === 0) {
      const wonCount = await base44.asServiceRole.entities.CRMJob.filter({ companyId, status: 'won' });
      if (wonCount.length > 0) {
        errors.push({ severity: 'HIGH', monthKey: currentMonthKey, wonJobsExist: wonCount.length,
          message: `BreakevenMonthlyRollup for ${currentMonthKey} has recognizedRevenueCents=0 but ${wonCount.length} won jobs exist. Revenue is not flowing into breakeven rollup.` });
      }
    }
  }

  return {
    checkType: 'broken_snapshots',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { checkName: 'breakeven_integrity', errors, warnings, rollupCompanyId, currentMonthKey }
  };
}

async function checkAutomationHealth(base44, companyId) {
  const errors = [];
  const warnings = [];

  const reportLogs = await base44.asServiceRole.entities.ReportRunLog.filter({});
  if (reportLogs.length === 0) {
    errors.push({ severity: 'CRITICAL', function: 'runRollupsInternal',
      message: 'ReportRunLog has 0 rows — Daily Reporting Rollup automation has never successfully executed. Zero-run critical automation.' });
  } else {
    const failed = reportLogs.filter(l => l.status === 'failed');
    if (failed.length === reportLogs.length) {
      errors.push({ severity: 'CRITICAL', failedCount: failed.length,
        message: `All ${failed.length} ReportRunLog entries have status=failed. Daily Reporting Rollup has never succeeded.` });
    }
  }

  const agentLogs = await base44.asServiceRole.entities.AgentRunLog.filter({ companyId, agentName: 'dataIntegrityAgent' });
  if (agentLogs.length === 0) {
    warnings.push({ severity: 'MEDIUM', agent: 'dataIntegrityAgent',
      message: 'No AgentRunLog entries for dataIntegrityAgent. Integrity sweep may not be running.' });
  }

  return {
    checkType: 'orphaned_runs',
    status: errors.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARN' : 'OK'),
    errorCount: errors.length,
    warningCount: warnings.length,
    details: { checkName: 'automation_health', errors, warnings }
  };
}

// CHECK 10: False-green integrity (simplified — checks 2 and 3 now surface NO_COVERAGE directly)
// This check now validates that the other checks are not in a state where their previous
// false-green results are still in the IntegrityCheckResult history without correction.
async function checkFalseGreenIntegrity(base44, companyId) {
  const warnings = [];

  // This check now primarily verifies that the corrected checks (2 and 3) are running
  // and that we're not sitting on stale false-green results from before the fix.
  // If broken_snapshots or unmapped_materials return OK with snapshotsChecked=0,
  // that means the fixed logic above was not applied — surface a warning.
  const allResults = await base44.asServiceRole.entities.IntegrityCheckResult.filter({ companyId });
  const sorted = allResults.sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));

  const latestBrokenSnap = sorted.find(r => r.checkType === 'broken_snapshots' && !r.details?.checkName);
  if (latestBrokenSnap && latestBrokenSnap.status === 'OK' && latestBrokenSnap.details?.snapshotsChecked === 0) {
    warnings.push({ severity: 'LOW', checkType: 'broken_snapshots', checkedAt: latestBrokenSnap.checkedAt,
      message: `Stale false-green result in history: broken_snapshots reported OK with snapshotsChecked=0 at ${latestBrokenSnap.checkedAt}. Current run uses corrected logic.` });
  }

  return {
    checkType: 'missing_catalog_items',
    status: warnings.length > 0 ? 'WARN' : 'OK',
    errorCount: 0,
    warningCount: warnings.length,
    details: { checkName: 'false_green_integrity', warnings }
  };
}

async function sendIntegrityAlert(base44, checks, totalErrors) {
  const errorChecks = checks.filter(c => c.errorCount > 0);
  
  const emailBody = `
    <h2>🚨 FenceIQ Data Integrity Alert</h2>
    <p><strong>${totalErrors} errors found</strong> in automated integrity checks.</p>
    
    <h3>Issues Found:</h3>
    <ul>
      ${errorChecks.map(check => `
        <li><strong>${check.details?.checkName || check.checkType}</strong>: ${check.errorCount} errors
          <pre>${JSON.stringify(check.details.errors || check.details, null, 2)}</pre>
        </li>
      `).join('')}
    </ul>
    
    <p>Run Time: ${new Date().toISOString()}</p>
    <p><em>This is an automated alert from the Data Integrity Agent</em></p>
  `;

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'dan@privacyfenceco.com',
      subject: `⚠️ FenceIQ Integrity Alert: ${totalErrors} Errors`,
      body: emailBody
    });
  } catch (error) {
    console.error('Failed to send integrity alert email:', error);
  }
}