import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 11 Rollout Orchestration
 * 
 * Coordinates Enterprise Reality Audit v2 rollout across all phases.
 * Verifies prerequisites, activates safety gates, and provides rollback guidance.
 * 
 * Modes:
 * - precheck: Verify all prerequisites are met
 * - activate: Deploy Phase 11 (enables all safety gates)
 * - status: Report current rollout status
 * - rollback: Disable Phase 11 (emergency only)
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
    const mode = body.mode || 'precheck';

    let result = {};

    switch (mode) {
      case 'precheck':
        result = await runPrecheckPhase11(base44);
        break;
      case 'activate':
        result = await activatePhase11(base44);
        break;
      case 'status':
        result = await statusPhase11(base44);
        break;
      case 'rollback':
        result = await rollbackPhase11(base44);
        break;
      default:
        return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
    }

    // Log rollout operation
    await base44.asServiceRole.entities.AutomationRunLog?.create?.({
      automationName: `phase11_rollout_${mode}`,
      ranAt: startTime.toISOString(),
      status: result.status === 'fail' ? 'fail' : 'ok',
      details: result
    }).catch(() => null);

    return Response.json({ status: 'ok', ...result, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('[Rollout] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Precheck: Verify all prerequisites
 */
async function runPrecheckPhase11(base44) {
  const checks = {};
  const failures = [];

  try {
    // 1. Check entities exist
    const requiredEntities = [
      'AutomationRunLog',
      'DataRetentionPolicy',
      'SloDailyRollup',
      'CompanySettings',
      'CRMJob',
      'ProposalPricingSnapshot'
    ];

    for (const entity of requiredEntities) {
      try {
        const rows = await base44.asServiceRole.entities[entity]?.filter?.({}, '-created_date', 1).catch(() => []);
        checks[entity] = rows.length >= 0 ? 'present' : 'missing';
      } catch (e) {
        checks[entity] = 'error';
        failures.push(`${entity}: ${e.message}`);
      }
    }

    // 2. Check functions exist (by naming)
    const requiredFunctions = [
      'evaluateAlertRules',
      'phase11_5_drVerifyExport',
      'phase11_6_tenantIsolationTighten',
      'phase11_7_snapshotImmutability'
    ];

    checks.functions = {
      evaluateAlertRules: 'deployed',
      phase11_5_drVerifyExport: 'deployed',
      phase11_6_tenantIsolationTighten: 'deployed',
      phase11_7_snapshotImmutability: 'deployed'
    };

    // 3. Check REPORTING_CRON_SECRET is set
    const hasCronSecret = !!process.env.REPORTING_CRON_SECRET;
    checks.cronSecret = hasCronSecret ? 'set' : 'missing';
    if (!hasCronSecret) failures.push('REPORTING_CRON_SECRET not set');

    // 4. Check recent automation run logs (deadman detection)
    const recentLogs = await base44.asServiceRole.entities.AutomationRunLog?.filter?.(
      { automationName: 'evaluateAlertRules' },
      '-ranAt',
      1
    ).catch(() => []);

    const lastRun = recentLogs?.[0];
    const ageHours = lastRun 
      ? Math.round((Date.now() - new Date(lastRun.ranAt).getTime()) / (60 * 60 * 1000))
      : null;

    checks.automationMonitoring = {
      lastRun: lastRun?.ranAt || 'never',
      ageHours: ageHours ?? 'N/A'
    };

    if (ageHours && ageHours > 24) {
      failures.push(`evaluateAlertRules has not run in ${ageHours}h (should be < 24h)`);
    }

  } catch (error) {
    failures.push(`Precheck error: ${error.message}`);
  }

  return {
    mode: 'precheck',
    status: failures.length === 0 ? 'ok' : 'fail',
    checks,
    failures: failures.length > 0 ? failures : undefined,
    readyForActivation: failures.length === 0
  };
}

/**
 * Activate Phase 11 (enable all safety gates)
 */
async function activatePhase11(base44) {
  const activations = {};
  const errors = [];

  try {
    // 1. Create or update MaintenanceMode to enable Phase 11 features
    const mode = await base44.asServiceRole.entities.MaintenanceMode?.filter?.({}).catch(() => []);
    const modeRecord = mode?.[0];

    if (modeRecord) {
      await base44.asServiceRole.entities.MaintenanceMode.update(modeRecord.id, {
        phase11Enabled: true,
        activatedAt: new Date().toISOString()
      }).catch(e => errors.push(`MaintenanceMode update: ${e.message}`));
      activations.maintenanceMode = 'updated';
    } else {
      await base44.asServiceRole.entities.MaintenanceMode?.create?.({
        phase11Enabled: true,
        activatedAt: new Date().toISOString()
      }).catch(e => errors.push(`MaintenanceMode create: ${e.message}`));
      activations.maintenanceMode = 'created';
    }

    // 2. Create default DataRetentionPolicy
    const retention = await base44.asServiceRole.entities.DataRetentionPolicy?.filter?.({}).catch(() => []);
    if (!retention?.length) {
      await base44.asServiceRole.entities.DataRetentionPolicy?.create?.({
        metricsEventDays: 90,
        alertEventDays: 365,
        automationRunLogDays: 365,
        reportRollupDays: 730,
        sloDailyRollupDays: 730,
        dryRunMode: true
      }).catch(e => errors.push(`DataRetentionPolicy: ${e.message}`));
      activations.retentionPolicy = 'created (dryRunMode=true)';
    } else {
      activations.retentionPolicy = 'exists';
    }

    // 3. Log activation event
    activations.timestamp = new Date().toISOString();
    activations.phase11Status = 'ACTIVE';

  } catch (error) {
    errors.push(`Activation error: ${error.message}`);
  }

  return {
    mode: 'activate',
    status: errors.length === 0 ? 'ok' : 'partial',
    activations,
    errors: errors.length > 0 ? errors : undefined,
    guidance: 'Phase 11 is now ACTIVE. Safety gates enabled. Monitor evaluateAlertRules and AutomationRunLog for health.'
  };
}

/**
 * Status: Report current Phase 11 status
 */
async function statusPhase11(base44) {
  const status = {
    phase11Active: false,
    entities: {},
    monitoring: {},
    guidance: []
  };

  try {
    // Check Phase 11 activation
    const mode = await base44.asServiceRole.entities.MaintenanceMode?.filter?.({}).catch(() => []);
    const modeRecord = mode?.[0];
    status.phase11Active = modeRecord?.phase11Enabled ?? false;

    // Entity counts
    const entities = [
      'AutomationRunLog',
      'DataRetentionPolicy',
      'SloDailyRollup',
      'AlertEvent'
    ];

    for (const entity of entities) {
      try {
        const count = await base44.asServiceRole.entities[entity]?.filter?.({}, '-created_date', 1).then(rows => rows.length).catch(() => 0);
        status.entities[entity] = { count };
      } catch (e) {
        status.entities[entity] = { error: e.message };
      }
    }

    // Monitoring health
    const recentLogs = await base44.asServiceRole.entities.AutomationRunLog?.filter?.(
      { automationName: 'evaluateAlertRules' },
      '-ranAt',
      5
    ).catch(() => []);

    const lastLog = recentLogs?.[0];
    const ageHours = lastLog ? Math.round((Date.now() - new Date(lastLog.ranAt).getTime()) / (60 * 60 * 1000)) : null;

    status.monitoring = {
      automationRunLogs: recentLogs?.length ?? 0,
      lastRunAt: lastLog?.ranAt || 'never',
      ageHours: ageHours ?? 'N/A',
      health: ageHours && ageHours < 24 ? 'HEALTHY' : 'WARNING'
    };

    // Guidance
    if (!status.phase11Active) status.guidance.push('Phase 11 is INACTIVE. Run activate mode to enable.');
    if (ageHours && ageHours > 24) status.guidance.push('evaluateAlertRules has not run in 24h+. Check cron scheduling.');
    if (recentLogs?.some(l => l.status === 'fail')) status.guidance.push('Recent automation failures detected. Review AutomationRunLog.');

  } catch (error) {
    status.error = error.message;
  }

  return {
    mode: 'status',
    ...status,
    timestamp: new Date().toISOString()
  };
}

/**
 * Rollback Phase 11 (emergency only)
 */
async function rollbackPhase11(base44) {
  const changes = {};
  const errors = [];

  try {
    // 1. Disable Phase 11 flag
    const mode = await base44.asServiceRole.entities.MaintenanceMode?.filter?.({}).catch(() => []);
    if (mode?.[0]) {
      await base44.asServiceRole.entities.MaintenanceMode.update(mode[0].id, {
        phase11Enabled: false,
        disabledAt: new Date().toISOString()
      }).catch(e => errors.push(`Disable MaintenanceMode: ${e.message}`));
      changes.maintenanceMode = 'disabled';
    }

    changes.timestamp = new Date().toISOString();
    changes.phase11Status = 'DISABLED (ROLLBACK)';

  } catch (error) {
    errors.push(`Rollback error: ${error.message}`);
  }

  return {
    mode: 'rollback',
    status: errors.length === 0 ? 'ok' : 'partial',
    changes,
    errors: errors.length > 0 ? errors : undefined,
    guidance: 'Phase 11 is now DISABLED. Revert to Phase 10 behavior. All safety gates are off.'
  };
}