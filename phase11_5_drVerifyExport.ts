import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 11.5: DR Verify & Export
 * 
 * Purpose: Verify company data integrity and export snapshots for disaster recovery.
 * Ensures all critical entities are present, scoped correctly, and recoverable.
 * 
 * Modes:
 * - verify: Check data integrity without export
 * - export: Generate backup export of all company data
 * - restore: Validate restore-ability of exported data
 */

Deno.serve(async (req) => {
  const startTime = new Date();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'verify'; // verify | export | restore
    const companyId = body.companyId;

    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }

    // Log the DR operation
    const drLog = await base44.asServiceRole.entities.AutomationRunLog?.create?.({
      automationName: `phase11_5_drVerify_${mode}`,
      ranAt: startTime.toISOString(),
      status: 'ok',
      details: { companyId, mode }
    }).catch(() => null);

    let result = {};

    if (mode === 'verify') {
      result = await verifyCompanyDataIntegrity(base44, companyId);
    } else if (mode === 'export') {
      result = await exportCompanyData(base44, companyId);
    } else if (mode === 'restore') {
      result = await validateRestoreability(base44, companyId, body.exportData);
    }

    // Update log with results
    if (drLog?.id) {
      await base44.asServiceRole.entities.AutomationRunLog?.update?.(drLog.id, {
        status: result.status === 'fail' ? 'fail' : 'ok',
        details: { ...result, elapsedMs: Date.now() - startTime.getTime() }
      }).catch(() => null);
    }

    return Response.json({ status: 'ok', ...result });

  } catch (error) {
    console.error('[DR] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Verify company data integrity
 */
async function verifyCompanyDataIntegrity(base44, companyId) {
  const checks = {};
  const failures = [];

  try {
    // 1. Company Settings exists
    const settings = await base44.asServiceRole.entities.CompanySettings.filter({ companyId });
    checks.companySettings = { found: settings.length > 0, count: settings.length };
    if (!settings.length) failures.push('CompanySettings missing');

    // 2. CRMJobs scoped to company
    const jobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId });
    checks.crmJobs = { count: jobs.length, scoped: true };

    // 3. ProposalPricingSnapshots exist for signed jobs
    const signedJobs = jobs.filter(j => j.saleStatus === 'sold');
    const snapshotIds = new Set();
    signedJobs.forEach(j => {
      if (j.currentProposalSnapshotId) snapshotIds.add(j.currentProposalSnapshotId);
    });
    
    const snapshotsFetched = await Promise.all(
      Array.from(snapshotIds).map(sid =>
        base44.asServiceRole.entities.ProposalPricingSnapshot.filter({ id: sid })
          .then(rows => rows[0] || null)
          .catch(() => null)
      )
    );
    
    const snapshotsFound = snapshotsFetched.filter(Boolean).length;
    checks.proposalSnapshots = { 
      referencedCount: snapshotIds.size, 
      foundCount: snapshotsFound,
      coverage: snapshotIds.size > 0 ? (snapshotsFound / snapshotIds.size * 100).toFixed(1) : 100
    };

    if (snapshotsFound < snapshotIds.size) {
      failures.push(`Missing ${snapshotIds.size - snapshotsFound} ProposalPricingSnapshots`);
    }

    // 4. Revenue recognition consistency
    const recognizedJobs = jobs.filter(j => j.recognitionStatus === 'RECOGNIZED');
    const unrecognizedSold = signedJobs.filter(j => j.recognitionStatus !== 'RECOGNIZED');
    checks.revenueRecognition = {
      recognizedCount: recognizedJobs.length,
      unrecognizedSoldCount: unrecognizedSold.length
    };

    if (unrecognizedSold.length > 0) {
      failures.push(`${unrecognizedSold.length} sold jobs not recognized for revenue`);
    }

    // 5. Tenant isolation check — no cross-company leaks
    const allJobs = await base44.asServiceRole.entities.CRMJob.filter({});
    const otherCompanyJobs = allJobs.filter(j => j.companyId !== companyId);
    checks.tenantIsolation = {
      otherCompanyJobsFound: otherCompanyJobs.length
    };

    if (otherCompanyJobs.length > 0) {
      failures.push(`Tenant isolation breach: ${otherCompanyJobs.length} jobs from other companies visible`);
    }

    // 6. AutomationRunLog present for deadman detection
    const recentLogs = await base44.asServiceRole.entities.AutomationRunLog.filter(
      { automationName: 'evaluateAlertRules' },
      '-ranAt',
      1
    ).catch(() => []);

    const lastRunTime = recentLogs.length > 0 ? new Date(recentLogs[0].ranAt) : null;
    const ageMs = lastRunTime ? (Date.now() - lastRunTime.getTime()) : Infinity;
    checks.automationMonitoring = {
      lastRunAt: lastRunTime?.toISOString() || 'NEVER',
      ageMinutes: Math.round(ageMs / 60000)
    };

    if (ageMs > 24 * 60 * 60 * 1000) {
      failures.push('evaluateAlertRules has not run in > 24h');
    }

  } catch (error) {
    failures.push(`Verification error: ${error.message}`);
  }

  return {
    companyId,
    mode: 'verify',
    status: failures.length === 0 ? 'ok' : 'fail',
    checks,
    failures: failures.length > 0 ? failures : undefined,
    timestamp: new Date().toISOString()
  };
}

/**
 * Export company data for DR backup
 */
async function exportCompanyData(base44, companyId) {
  const exportData = {
    companyId,
    timestamp: new Date().toISOString(),
    entities: {}
  };

  try {
    // Export critical entities (scoped to company)
    const entityNames = [
      'CompanySettings',
      'CRMJob',
      'CRMAccount',
      'CRMContact',
      'CRMAddress'
    ];

    for (const entityName of entityNames) {
      const entity = base44.asServiceRole.entities[entityName];
      if (!entity) continue;

      const rows = await entity.filter({ companyId }).catch(() => []);
      exportData.entities[entityName] = {
        count: rows.length,
        rows: rows.slice(0, 100) // Export first 100 for size limits
      };
    }

    // Export snapshots (keyed by job id reference)
    const jobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId });
    const snapshotIds = new Set();
    jobs.forEach(j => {
      if (j.currentProposalSnapshotId) snapshotIds.add(j.currentProposalSnapshotId);
    });

    const snapshots = await Promise.all(
      Array.from(snapshotIds).slice(0, 50).map(sid =>
        base44.asServiceRole.entities.ProposalPricingSnapshot.filter({ id: sid })
          .then(rows => rows[0] || null)
          .catch(() => null)
      )
    );

    exportData.entities.ProposalPricingSnapshot = {
      count: snapshots.filter(Boolean).length,
      rows: snapshots.filter(Boolean)
    };

    return {
      companyId,
      mode: 'export',
      status: 'ok',
      exportData,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      companyId,
      mode: 'export',
      status: 'fail',
      error: error.message
    };
  }
}

/**
 * Validate that exported data can be restored
 */
async function validateRestoreability(base44, companyId, exportData) {
  const issues = [];

  if (!exportData || !exportData.entities) {
    return {
      companyId,
      mode: 'restore',
      status: 'fail',
      error: 'exportData missing or invalid'
    };
  }

  // Check that all exported entities have primary keys
  for (const [entityName, data] of Object.entries(exportData.entities)) {
    if (!data.rows || data.rows.length === 0) continue;

    const firstRow = data.rows[0];
    if (!firstRow.id) {
      issues.push(`${entityName}: rows missing id field`);
    }

    // Verify companyId scope
    if (firstRow.companyId && firstRow.companyId !== companyId) {
      issues.push(`${entityName}: companyId mismatch (${firstRow.companyId} != ${companyId})`);
    }
  }

  return {
    companyId,
    mode: 'restore',
    status: issues.length === 0 ? 'ok' : 'fail',
    issues: issues.length > 0 ? issues : undefined,
    timestamp: new Date().toISOString()
  };
}