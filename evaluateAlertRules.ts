/**
 * SCHEDULED ALERT RULE EVALUATOR — PHASE 10.5A
 *
 * Runs every 5 minutes via automation.
 * Evaluates ALL rules from AlertRules.js against live MetricsEvent data.
 *
 * Rules evaluated:
 *   - resolver_miss_warning / resolver_miss_critical
 *   - validator_failure_warning
 *   - proposal_failure_rate_warning / proposal_failure_critical
 *   - takeoff_latency_warning (P95)
 *   - error_rate_critical
 *   - OPS_TELEMETRY_DOWN (deadman)
 *   - ROLLUP_STALE_WARN / ROLLUP_STALE_CRITICAL
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 12.5 integration: Correlation ID support
 * Threads correlation ID into all writes (MetricsEvent, AlertEvent, AutomationRunLog).
 */
function getOrCreateCorrelationId(req: Request): string {
  const existingId = req.headers.get('x-correlation-id');
  return existingId || crypto.randomUUID();
}

// ── Inline rule definitions (mirrors AlertRules.js — no local imports allowed) ──
const METRIC_RULES = [
  // WARNING rules
  {
    id: 'resolver_miss_warning',
    metric: 'resolver_miss_total',
    windowMs: 5 * 60 * 1000,
    computeType: 'count',
    threshold: 0,
    condition: (v) => v > 0,
    severity: 'WARNING',
    title: 'Resolver miss detected',
    description: 'Canonical key not found in catalog or map'
  },
  {
    id: 'validator_failure_warning',
    metric: 'validator_failure_total',
    windowMs: 5 * 60 * 1000,
    computeType: 'count',
    threshold: 0,
    condition: (v) => v > 0,
    severity: 'WARNING',
    title: 'Validator failure detected',
    description: 'Key schema validation failed'
  },
  {
    id: 'proposal_failure_rate_warning',
    metric: 'proposal_generation_failed_total',
    windowMs: 10 * 60 * 1000,
    computeType: 'rate_vs_total',
    totalMetric: 'proposal_generation_total',
    threshold: 0.005,
    condition: (v) => v > 0.005,
    severity: 'WARNING',
    title: 'Proposal failure rate elevated',
    description: 'Proposal generation failing >0.5% of requests'
  },
  {
    id: 'takeoff_latency_warning',
    metric: 'takeoff_latency_ms',
    windowMs: 10 * 60 * 1000,
    computeType: 'p95',
    threshold: 1500,
    condition: (v) => v > 1500,
    severity: 'WARNING',
    title: 'Takeoff latency high',
    description: 'P95 takeoff generation latency > 1500ms'
  },
  // CRITICAL rules
  {
    id: 'resolver_miss_critical',
    metric: 'resolver_miss_total',
    windowMs: 5 * 60 * 1000,
    computeType: 'count',
    threshold: 5,
    condition: (v) => v > 5,
    severity: 'CRITICAL',
    title: 'CRITICAL: Multiple resolver misses',
    description: 'Resolver miss count exceeded threshold (>5 in 5m)',
    actionRequired: 'Verify MaterialCatalog and CompanySkuMap sync'
  },
  {
    id: 'proposal_failure_critical',
    metric: 'proposal_generation_failed_total',
    windowMs: 5 * 60 * 1000,
    computeType: 'rate_vs_total',
    totalMetric: 'proposal_generation_total',
    threshold: 0.02,
    condition: (v) => v > 0.02,
    severity: 'CRITICAL',
    title: 'CRITICAL: Proposal failure rate critical',
    description: 'Proposal generation failing >2% of requests',
    actionRequired: 'Check snapshots and pricing engine health'
  },
  {
    id: 'error_rate_critical',
    metric: 'error_rate_pct',
    windowMs: 5 * 60 * 1000,
    computeType: 'avg',
    threshold: 2,
    condition: (v) => v > 2,
    severity: 'CRITICAL',
    title: 'CRITICAL: Error rate spike',
    description: 'Endpoint error rate >2%',
    actionRequired: 'Check backend logs and database connectivity'
  }
];

const DEADMAN_WINDOW_MS    = 15 * 60 * 1000;
const ROLLUP_WARN_MS       = 26 * 60 * 60 * 1000;
const ROLLUP_CRITICAL_MS   = 48 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

async function getMetricEvents(base44, metricName, windowStartIso) {
  const rows = await base44.asServiceRole.entities.MetricsEvent.filter(
    { metricName, recorded: true, timestamp: { $gte: windowStartIso } },
    '-timestamp',
    200
  ).catch(() => []);
  return rows;
}

async function computeMetricValue(base44, rule, windowStartIso) {
  const events = await getMetricEvents(base44, rule.metric, windowStartIso);

  if (rule.computeType === 'count') {
    return events.reduce((s, e) => s + (e.value || 1), 0);
  }

  if (rule.computeType === 'p95') {
    return p95(events.map(e => e.value || 0));
  }

  if (rule.computeType === 'avg') {
    if (!events.length) return 0;
    return events.reduce((s, e) => s + (e.value || 0), 0) / events.length;
  }

  if (rule.computeType === 'rate_vs_total') {
    const failCount = events.reduce((s, e) => s + (e.value || 1), 0);
    const totalEvents = await getMetricEvents(base44, rule.totalMetric, windowStartIso);
    const totalCount = totalEvents.reduce((s, e) => s + (e.value || 1), 0);
    return totalCount > 0 ? failCount / totalCount : 0;
  }

  return 0;
}

async function maybeFireAlert(base44, rule, metricValue, windowStart, windowEnd, dateBucket) {
const dedupeKey = `${rule.id}:${dateBucket}`;
const existing = await base44.asServiceRole.entities.AlertEvent.filter({ dedupeKey }).catch(() => []);
if (existing.length) {
  return { rule: rule.id, fired: false, reason: 'already_fired_today', value: metricValue };
}

const alert = await base44.asServiceRole.entities.AlertEvent.create({
  rule: rule.id,
  severity: rule.severity,
  title: rule.title,
  description: rule.description,
  actionRequired: rule.actionRequired || null,
  metric: rule.metric,
  value: metricValue,
  threshold: rule.threshold,
  timestamp: new Date().toISOString(),
  firedAt: new Date().toISOString(),
  tags: { environment: 'production', windowStart, windowEnd, correlationId },
  correlationId,
  dedupeKey
});

  console.log(`[AlertEval] ${rule.severity === 'CRITICAL' ? '🚨' : '⚠️'} ${rule.id} fired (value=${metricValue})`);
  return { rule: rule.id, fired: true, value: metricValue, id: alert?.id };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const runStartTime = new Date();
  const correlationId = getOrCreateCorrelationId(req);
  
  try {
    const base44 = createClientFromRequest(req);

    // Phase 11.3: Log automation run for deadman detection
    const logEntry = await base44.asServiceRole.entities.AutomationRunLog?.create?.({
      automationName: 'evaluateAlertRules',
      ranAt: runStartTime.toISOString(),
      status: 'ok',
      details: {},
      correlationId
    }).catch(() => null);

    // Phase 12.1: Record execution proof for monitoring schedule verification
    await base44.asServiceRole.entities.AutomationScheduleProof?.create?.({
      automationName: 'evaluateAlertRules',
      expectedIntervalMinutes: 5,
      lastSeenAt: runStartTime.toISOString(),
      lastRunId: logEntry?.id,
      status: 'healthy'
    }).catch(() => null);

    // Parse body once (needed for secret OR test mode)
    const body = await req.json().catch(() => ({}));

    // Auth: admin user OR cron secret
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      isAuthorized = user?.role === 'admin';
    } catch (_) {
      const secret = req.headers.get('x-cron-secret') || body.secret;
      isAuthorized = secret === Deno.env.get('REPORTING_CRON_SECRET');
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── TEST HARNESS MODE ──────────────────────────────────────────────────────
    if (body.mode === 'test') {
      return await runTestHarness(base44);
    }

    // ── NORMAL EVALUATION ─────────────────────────────────────────────────────
    const now = new Date();
    const dateBucket = now.toISOString().split('T')[0];
    const results = [];

    // 1. Evaluate all metric-based rules from METRIC_RULES
    for (const rule of METRIC_RULES) {
      const windowStart = new Date(now.getTime() - rule.windowMs);
      const windowStartIso = windowStart.toISOString();
      const windowEndIso = now.toISOString();

      const metricValue = await computeMetricValue(base44, rule, windowStartIso);

      if (rule.condition(metricValue)) {
        const result = await maybeFireAlert(base44, rule, metricValue, windowStartIso, windowEndIso, dateBucket);
        results.push(result);
      } else {
        results.push({ rule: rule.id, fired: false, value: metricValue });
      }
    }

    // 2. Deadman switch — no MetricsEvent in last 15 minutes
    const deadmanCutoff = new Date(now.getTime() - DEADMAN_WINDOW_MS).toISOString();
    const recentMetrics = await base44.asServiceRole.entities.MetricsEvent.filter(
      { recorded: true, timestamp: { $gte: deadmanCutoff } }, '-timestamp', 10
    ).catch(() => []);

    const lastMetricTime = recentMetrics.length > 0 ? new Date(recentMetrics[0].timestamp) : null;
    const telemetryDown = !lastMetricTime || lastMetricTime < new Date(deadmanCutoff);

    if (telemetryDown) {
      const dedupeKey = `OPS_TELEMETRY_DOWN:${dateBucket}`;
      const existing = await base44.asServiceRole.entities.AlertEvent.filter({ dedupeKey }).catch(() => []);
      if (!existing.length) {
        const alert = await base44.asServiceRole.entities.AlertEvent.create({
          rule: 'OPS_TELEMETRY_DOWN',
          severity: 'CRITICAL',
          title: 'Telemetry Deadman: No MetricsEvent in last 15 minutes',
          description: `Last metric received: ${lastMetricTime?.toISOString() ?? 'NEVER'}`,
          metric: 'metrics_event_recency',
          value: lastMetricTime ? Math.round((now - lastMetricTime) / 60000) : 999,
          threshold: 15,
          timestamp: now.toISOString(),
          firedAt: now.toISOString(),
          tags: { environment: 'production', rule: 'deadman', correlationId },
          correlationId,
          dedupeKey
        });
        results.push({ rule: 'OPS_TELEMETRY_DOWN', fired: true, id: alert?.id });
        console.log('[AlertEval] 🚨 OPS_TELEMETRY_DOWN fired');
      } else {
        results.push({ rule: 'OPS_TELEMETRY_DOWN', fired: false, reason: 'already_fired_today' });
      }
    } else {
      results.push({ rule: 'OPS_TELEMETRY_DOWN', fired: false, lastMetric: lastMetricTime?.toISOString() });
    }

    // 3. Rollup staleness
    const recentRollups = await base44.asServiceRole.entities.ReportRollupDaily.filter(
      {}, '-created_date', 1
    ).catch(() => []);

    const lastRollupTime = recentRollups.length > 0
      ? new Date(recentRollups[0].updated_date || recentRollups[0].created_date)
      : null;
    const rollupAgeMs = lastRollupTime ? (now - lastRollupTime) : Infinity;
    const rollupAgeHours = Math.round(rollupAgeMs / (60 * 60 * 1000));

    if (rollupAgeMs >= ROLLUP_CRITICAL_MS) {
      const dedupeKey = `ROLLUP_STALE_CRITICAL:${dateBucket}`;
      const existing = await base44.asServiceRole.entities.AlertEvent.filter({ dedupeKey }).catch(() => []);
      if (!existing.length) {
        const alert = await base44.asServiceRole.entities.AlertEvent.create({
          rule: 'ROLLUP_STALE_CRITICAL', severity: 'CRITICAL',
          title: `Daily Rollup stale: ${rollupAgeHours}h (threshold 48h)`,
          description: `Last rollup: ${lastRollupTime?.toISOString() ?? 'NEVER'}`,
          metric: 'rollup_age_hours', value: rollupAgeHours, threshold: 48,
          timestamp: now.toISOString(), firedAt: now.toISOString(),
          tags: { environment: 'production', rule: 'rollup_staleness', correlationId },
          correlationId,
          dedupeKey
        });
        results.push({ rule: 'ROLLUP_STALE_CRITICAL', fired: true, ageHours: rollupAgeHours, id: alert?.id });
      } else {
        results.push({ rule: 'ROLLUP_STALE_CRITICAL', fired: false, reason: 'already_fired_today' });
      }
    } else if (rollupAgeMs >= ROLLUP_WARN_MS) {
      const dedupeKey = `ROLLUP_STALE_WARN:${dateBucket}`;
      const existing = await base44.asServiceRole.entities.AlertEvent.filter({ dedupeKey }).catch(() => []);
      if (!existing.length) {
        const alert = await base44.asServiceRole.entities.AlertEvent.create({
          rule: 'ROLLUP_STALE_WARN', severity: 'WARNING',
          title: `Daily Rollup stale: ${rollupAgeHours}h (threshold 26h)`,
          description: `Last rollup: ${lastRollupTime?.toISOString() ?? 'NEVER'}`,
          metric: 'rollup_age_hours', value: rollupAgeHours, threshold: 26,
          timestamp: now.toISOString(), firedAt: now.toISOString(),
          tags: { environment: 'production', rule: 'rollup_staleness', correlationId },
          correlationId,
          dedupeKey
        });
        results.push({ rule: 'ROLLUP_STALE_WARN', fired: true, ageHours: rollupAgeHours, id: alert?.id });
      } else {
        results.push({ rule: 'ROLLUP_STALE_WARN', fired: false, reason: 'already_fired_today' });
      }
    } else {
      results.push({ rule: 'ROLLUP_STALENESS', fired: false, ageHours: rollupAgeHours });
    }

    // Update run log with success
    if (logEntry?.id) {
      await base44.asServiceRole.entities.AutomationRunLog?.update?.(logEntry.id, {
        status: 'ok',
        details: { rulesEvaluated: METRIC_RULES.length + 3, resultsFired: results.filter(r => r.fired).length }
      }).catch(() => null);
    }

    return Response.json({
      status: 'ok',
      evaluatedAt: now.toISOString(),
      rulesEvaluated: METRIC_RULES.length + 3, // metric rules + deadman + 2 rollup
      rules: results
    });

  } catch (error) {
    console.error('[AlertEval] Fatal error:', error.message);
    // Mark run log as failed
    const logEntry = await base44.asServiceRole.entities.AutomationRunLog?.create?.({
      automationName: 'evaluateAlertRules',
      ranAt: runStartTime.toISOString(),
      status: 'fail',
      errorMessage: error.message
    }).catch(() => null);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Test Harness ──────────────────────────────────────────────────────────────

async function runTestHarness(base44) {
  const now = new Date();
  const testResults = [];

  console.log('[AlertEval:Test] Starting synthetic test harness...');

  // Insert synthetic MetricsEvent rows to trip each rule
  const syntheticEvents = [
    // Trip resolver_miss_warning (count > 0) and resolver_miss_critical (count > 5)
    ...Array(6).fill(null).map(() => ({
      metricName: 'resolver_miss_total', value: 1,
      timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2min ago
      recorded: true, tags: { environment: 'test' }
    })),
    // Trip validator_failure_warning
    {
      metricName: 'validator_failure_total', value: 1,
      timestamp: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
      recorded: true, tags: { environment: 'test' }
    },
    // Trip proposal_failure (need both failed + total)
    { metricName: 'proposal_generation_failed_total', value: 1,
      timestamp: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
      recorded: true, tags: { environment: 'test' } },
    { metricName: 'proposal_generation_total', value: 10,
      timestamp: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
      recorded: true, tags: { environment: 'test' } },
    // Trip takeoff_latency_warning (P95 > 1500ms)
    ...Array(20).fill(null).map((_, i) => ({
      metricName: 'takeoff_latency_ms', value: i < 18 ? 500 : 2000, // P95 ~ 2000
      timestamp: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
      recorded: true, tags: { environment: 'test' }
    })),
    // Trip error_rate_critical (avg > 2%)
    { metricName: 'error_rate_pct', value: 5.0,
      timestamp: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
      recorded: true, tags: { environment: 'test' } }
  ];

  // Insert all synthetic events
  const inserted = [];
  for (const ev of syntheticEvents) {
    const created = await base44.asServiceRole.entities.MetricsEvent.create(ev).catch(e => ({ error: e.message }));
    inserted.push(created);
  }
  console.log(`[AlertEval:Test] Inserted ${inserted.length} synthetic MetricsEvent rows`);

  // Run evaluation against the test data (use a per-test dedupe suffix to avoid clash with real alerts)
  const testDate = `test-${now.toISOString()}`;

  for (const rule of METRIC_RULES) {
    const windowStart = new Date(now.getTime() - rule.windowMs);
    const metricValue = await computeMetricValue(base44, rule, windowStart.toISOString());
    const trips = rule.condition(metricValue);

    let alertId = null;
    if (trips) {
      const alert = await base44.asServiceRole.entities.AlertEvent.create({
        rule: rule.id,
        severity: rule.severity,
        title: `[TEST] ${rule.title}`,
        description: `[TEST HARNESS] ${rule.description}`,
        metric: rule.metric,
        value: metricValue,
        threshold: rule.threshold,
        timestamp: now.toISOString(),
        firedAt: now.toISOString(),
        tags: { environment: 'test', windowStart: windowStart.toISOString() },
        dedupeKey: `${rule.id}:${testDate}`
      }).catch(e => ({ error: e.message }));
      alertId = alert?.id;
    }

    testResults.push({ rule: rule.id, metricValue, trips, alertId });
    console.log(`[AlertEval:Test] ${rule.id}: value=${metricValue}, trips=${trips}${alertId ? `, alertId=${alertId}` : ''}`);
  }

  // Clean up synthetic events
  for (const ev of inserted) {
    if (ev?.id) {
      await base44.asServiceRole.entities.MetricsEvent.delete(ev.id).catch(() => {});
    }
  }
  console.log('[AlertEval:Test] Cleaned up synthetic MetricsEvent rows');

  return Response.json({
    status: 'test_complete',
    syntheticEventsInserted: inserted.length,
    rulesEvaluated: METRIC_RULES.length,
    results: testResults,
    alertsFired: testResults.filter(r => r.trips).length
  });
}