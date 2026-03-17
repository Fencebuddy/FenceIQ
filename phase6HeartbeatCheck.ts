/**
 * PHASE 6: CUTOVER HEARTBEAT CHECK
 * 
 * READ-ONLY monitoring probe. Detects resolver misses, validator failures,
 * drift, and proposal instability during the 72-hour cutover window.
 * 
 * Returns exact counts + offending keys for investigation.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const HEARTBEAT_WINDOW_HOURS = 24; // Last 24h

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const heartbeat = {
      timestamp: new Date().toISOString(),
      window: `last_${HEARTBEAT_WINDOW_HOURS}h`,
      steps: {}
    };

    // STEP 1: Resolver Health
    console.log('[Heartbeat] STEP 1: Resolver health check...');
    heartbeat.steps.resolverHealth = await checkResolverHealth(base44);

    // STEP 2: Validator Health
    console.log('[Heartbeat] STEP 2: Validator health check...');
    heartbeat.steps.validatorHealth = await checkValidatorHealth(base44);

    // STEP 3: CompanySkuMap Drift
    console.log('[Heartbeat] STEP 3: Drift check...');
    heartbeat.steps.driftCheck = await checkDrift(base44);

    // STEP 4: Proposal Pipeline
    console.log('[Heartbeat] STEP 4: Proposal pipeline health...');
    heartbeat.steps.proposalHealth = await checkProposalHealth(base44);

    // STEP 5: Summary
    const summary = computeHealthSummary(heartbeat);
    heartbeat.summary = summary;

    console.log(`[Heartbeat] Complete - Status: ${summary.status}`);
    return Response.json(heartbeat);

  } catch (error) {
    console.error('[Heartbeat] Fatal error:', error);
    return Response.json({
      error: 'HEARTBEAT_CHECK_FAILED',
      message: error?.message || String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

/**
 * STEP 1: Resolver Health
 * Check for resolver misses in the monitoring window
 */
async function checkResolverHealth(base44) {
  try {
    // Check DiagnosticsLog for resolver failures
    const diagnosticLogs = await base44.asServiceRole.entities.DiagnosticsLog.filter(
      {},
      '-updated_date',
      100
    ) || [];

    const resolverMisses = diagnosticLogs.filter(log =>
      log.log_type === 'RESOLVER_MISS' || 
      (log.content && log.content.includes('resolver') && log.content.includes('miss'))
    );

    // Also check for jobs with unresolved materials
    const recentJobs = await base44.asServiceRole.entities.Job.filter(
      { status: { $ne: 'Closed' } },
      '-updated_date',
      500
    ) || [];

    const missingSummary = {
      resolverMissCount: resolverMisses.length,
      details: resolverMisses.slice(0, 20).map(log => ({
        uck: log.uck || 'unknown',
        companyId: log.companyId || 'PrivacyFenceCo49319',
        feature: log.feature || log.source || 'unknown',
        timestamp: log.created_date || log.timestamp,
        reason: log.reason || 'unspecified'
      })),
      status: resolverMisses.length === 0 ? 'PASS' : 'FAIL'
    };

    return missingSummary;
  } catch (error) {
    console.warn('[Heartbeat] Resolver health check error:', error.message);
    return {
      resolverMissCount: 0,
      details: [],
      status: 'UNKNOWN',
      error: error.message
    };
  }
}

/**
 * STEP 2: Validator Health
 * Check for canonical key validation failures
 */
async function checkValidatorHealth(base44) {
  try {
    // Check DiagnosticsLog for validator failures
    const diagnosticLogs = await base44.asServiceRole.entities.DiagnosticsLog.filter(
      {},
      '-updated_date',
      100
    ) || [];

    const validatorFailures = diagnosticLogs.filter(log =>
      log.log_type === 'VALIDATOR_FAILURE' ||
      (log.content && log.content.includes('assertCanonicalKey') && log.content.includes('failed'))
    );

    const failuresSummary = {
      validatorFailureCount: validatorFailures.length,
      details: validatorFailures.slice(0, 20).map(log => ({
        key: log.key || 'unknown',
        reason: extractFailureReason(log),
        feature: log.feature || log.source || 'unknown',
        timestamp: log.created_date || log.timestamp
      })),
      status: validatorFailures.length === 0 ? 'PASS' : 'FAIL'
    };

    return failuresSummary;
  } catch (error) {
    console.warn('[Heartbeat] Validator health check error:', error.message);
    return {
      validatorFailureCount: 0,
      details: [],
      status: 'UNKNOWN',
      error: error.message
    };
  }
}

/**
 * STEP 3: CompanySkuMap Drift Check
 * Verifies 1:1 sync and data integrity
 */
async function checkDrift(base44) {
  const driftResult = {
    activeCatalogCount: 0,
    companyMapCount: 0,
    unmappedCount: 0,
    missingCatalogTargetCount: 0,
    missingByKeyCount: 0,
    extraMapKeys: [],
    missingMapKeys: [],
    status: 'PASS'
  };

  try {
    // Get active catalog
    const activeCatalog = await base44.asServiceRole.entities.MaterialCatalog.filter(
      { active: true },
      undefined,
      10000
    ) || [];

    driftResult.activeCatalogCount = activeCatalog.length;

    // Get company map
    const companyMap = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      10000
    ) || [];

    driftResult.companyMapCount = companyMap.length;

    // Check unmapped rows
    const unmapped = companyMap.filter(m => m.status !== 'mapped');
    driftResult.unmappedCount = unmapped.length;

    // Check for broken links (map -> missing catalog)
    const catalogIds = new Set(activeCatalog.map(c => c.id));
    const brokenLinks = companyMap.filter(m => !catalogIds.has(m.materialCatalogId));
    driftResult.missingCatalogTargetCount = brokenLinks.length;

    // Build key lookups
    const catalogKeySet = new Set(activeCatalog.map(c => c.canonical_key));
    const mapKeySet = new Set(companyMap.map(m => m.uck));

    // Find extra and missing
    for (const key of mapKeySet) {
      if (!catalogKeySet.has(key)) {
        driftResult.extraMapKeys.push(key);
      }
    }
    driftResult.extraMapKeys = driftResult.extraMapKeys.slice(0, 20);
    driftResult.missingByKeyCount = driftResult.extraMapKeys.length;

    for (const key of catalogKeySet) {
      if (!mapKeySet.has(key)) {
        driftResult.missingMapKeys.push(key);
      }
    }
    driftResult.missingMapKeys = driftResult.missingMapKeys.slice(0, 20);

    // Pass/Fail
    const allChecks = [
      driftResult.activeCatalogCount === driftResult.companyMapCount,
      driftResult.unmappedCount === 0,
      driftResult.missingCatalogTargetCount === 0,
      driftResult.missingByKeyCount === 0,
      driftResult.extraMapKeys.length === 0,
      driftResult.missingMapKeys.length === 0
    ];

    driftResult.status = allChecks.every(c => c) ? 'PASS' : 'FAIL';

    return driftResult;
  } catch (error) {
    console.warn('[Heartbeat] Drift check error:', error.message);
    driftResult.status = 'UNKNOWN';
    driftResult.error = error.message;
    return driftResult;
  }
}

/**
 * STEP 4: Proposal Pipeline Health
 * Check for recent generation failures and anomalies
 */
async function checkProposalHealth(base44) {
  const pipelineResult = {
    proposalGenerationFailures: 0,
    takeoffGenerationFailures: 0,
    pricingSnapshotFailures: 0,
    avgProposalLatencyMs: 0,
    zeroPricingAnomalies: 0,
    status: 'PASS'
  };

  try {
    // Check recent jobs for pricing_status issues
    const recentJobs = await base44.asServiceRole.entities.Job.filter(
      { updated_date: { $gte: getWindowStartTime() } },
      '-updated_date',
      1000
    ) || [];

    let failureCount = 0;
    let zeroPrice = 0;

    for (const job of recentJobs) {
      if (job.pricing_status === 'NEEDS_RECALC') failureCount++;
      
      // Check if any recent snapshot has $0 pricing
      if (job.active_pricing_snapshot_id) {
        try {
          const snapshot = await base44.asServiceRole.entities.JobCostSnapshot.filter(
            { id: job.active_pricing_snapshot_id },
            undefined,
            1
          );
          if (snapshot && snapshot.length > 0) {
            if (snapshot[0].sell_price === 0 || snapshot[0].sell_price === null) {
              zeroPrice++;
            }
          }
        } catch (e) {
          // Ignore snapshot lookup errors
        }
      }
    }

    pipelineResult.proposalGenerationFailures = failureCount;
    pipelineResult.zeroPricingAnomalies = zeroPrice;

    // Check for takeoff/pricing snapshot failures in diagnostics
    const diagnosticLogs = await base44.asServiceRole.entities.DiagnosticsLog.filter(
      {},
      '-updated_date',
      100
    ) || [];

    const takeoffFails = diagnosticLogs.filter(log =>
      log.log_type === 'TAKEOFF_GENERATION_FAILURE'
    ).length;

    const pricingFails = diagnosticLogs.filter(log =>
      log.log_type === 'PRICING_SNAPSHOT_FAILURE'
    ).length;

    pipelineResult.takeoffGenerationFailures = takeoffFails;
    pipelineResult.pricingSnapshotFailures = pricingFails;

    // Determine status
    const pipelineChecks = [
      pipelineResult.proposalGenerationFailures === 0,
      pipelineResult.takeoffGenerationFailures === 0,
      pipelineResult.pricingSnapshotFailures === 0,
      pipelineResult.zeroPricingAnomalies === 0
    ];

    pipelineResult.status = pipelineChecks.every(c => c) ? 'PASS' : 'FAIL';

    return pipelineResult;
  } catch (error) {
    console.warn('[Heartbeat] Proposal health check error:', error.message);
    pipelineResult.status = 'UNKNOWN';
    pipelineResult.error = error.message;
    return pipelineResult;
  }
}

/**
 * STEP 5: Compute overall health summary
 */
function computeHealthSummary(heartbeat) {
  const resolver = heartbeat.steps.resolverHealth;
  const validator = heartbeat.steps.validatorHealth;
  const drift = heartbeat.steps.driftCheck;
  const pipeline = heartbeat.steps.proposalHealth;

  const issues = [];

  if (resolver.status === 'FAIL' && resolver.resolverMissCount > 0) {
    issues.push(`Resolver: ${resolver.resolverMissCount} misses detected`);
  }
  if (validator.status === 'FAIL' && validator.validatorFailureCount > 0) {
    issues.push(`Validator: ${validator.validatorFailureCount} failures detected`);
  }
  if (drift.status === 'FAIL') {
    const driftIssues = [];
    if (drift.unmappedCount > 0) driftIssues.push(`${drift.unmappedCount} unmapped rows`);
    if (drift.missingCatalogTargetCount > 0) driftIssues.push(`${drift.missingCatalogTargetCount} broken links`);
    if (drift.extraMapKeys.length > 0) driftIssues.push(`${drift.extraMapKeys.length} extra keys in map`);
    if (drift.missingMapKeys.length > 0) driftIssues.push(`${drift.missingMapKeys.length} missing from map`);
    if (driftIssues.length > 0) {
      issues.push(`Drift: ${driftIssues.join(', ')}`);
    }
  }
  if (pipeline.status === 'FAIL') {
    const pipelineIssues = [];
    if (pipeline.proposalGenerationFailures > 0) pipelineIssues.push(`${pipeline.proposalGenerationFailures} proposal failures`);
    if (pipeline.takeoffGenerationFailures > 0) pipelineIssues.push(`${pipeline.takeoffGenerationFailures} takeoff failures`);
    if (pipeline.pricingSnapshotFailures > 0) pipelineIssues.push(`${pipeline.pricingSnapshotFailures} pricing failures`);
    if (pipeline.zeroPricingAnomalies > 0) pipelineIssues.push(`${pipeline.zeroPricingAnomalies} $0 pricing anomalies`);
    if (pipelineIssues.length > 0) {
      issues.push(`Pipeline: ${pipelineIssues.join(', ')}`);
    }
  }

  let status = 'CUTOVER_HEALTH: STABLE';
  let recommendation = null;

  if (issues.length > 0) {
    // Determine severity
    const criticalIssues = issues.filter(i =>
      i.includes('broken links') ||
      i.includes('extra keys') ||
      i.includes('pricing failures')
    );

    if (criticalIssues.length > 0) {
      status = 'CUTOVER_HEALTH: CRITICAL';
      recommendation = 're-enable maintenance mode, investigate catalog/map corruption, rollback to Phase 5';
    } else {
      status = 'CUTOVER_HEALTH: WARNING';
      recommendation = 'monitor closely, investigate resolver/validator failures, escalate if no improvement in 1h';
    }
  }

  return {
    status,
    issues,
    recommendation,
    passConditions: {
      activeCatalogCountMatches: drift.activeCatalogCount === drift.companyMapCount,
      allMapped: drift.unmappedCount === 0,
      noBrokenLinks: drift.missingCatalogTargetCount === 0,
      noKeyMismatches: drift.missingByKeyCount === 0,
      noExtraKeys: drift.extraMapKeys.length === 0,
      noMissingKeys: drift.missingMapKeys.length === 0,
      noResolverMisses: resolver.resolverMissCount === 0,
      noValidatorFailures: validator.validatorFailureCount === 0,
      noPipelineFailures: pipeline.proposalGenerationFailures === 0 &&
                          pipeline.takeoffGenerationFailures === 0 &&
                          pipeline.pricingSnapshotFailures === 0,
      noPricingAnomalies: pipeline.zeroPricingAnomalies === 0
    }
  };
}

/**
 * Helper: Get window start time (last N hours)
 */
function getWindowStartTime() {
  const now = new Date();
  const windowMs = HEARTBEAT_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(now.getTime() - windowMs).toISOString();
}

/**
 * Helper: Extract failure reason from log
 */
function extractFailureReason(log) {
  if (log.reason) return log.reason;
  
  const content = log.content || '';
  if (content.includes('dot')) return 'dot_in_key';
  if (content.includes('forbidden')) return 'forbidden_token';
  if (content.includes('duplicate')) return 'duplicate_key';
  if (content.includes('inactive')) return 'inactive_target';
  if (content.includes('mismatch')) return 'attribute_mismatch';
  
  return 'unspecified';
}