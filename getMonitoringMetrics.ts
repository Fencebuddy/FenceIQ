/**
 * Fetch monitoring metrics for dashboard.
 * Aggregates metrics from MetricsEvent entity.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json();
    const timeWindow = payload.timeWindow || 6 * 60 * 60 * 1000; // 6h default

    // Fetch recent metrics with timestamp filter
    const now = new Date();
    const windowStart = new Date(now - timeWindow);
    const recentMetrics = await base44.asServiceRole.entities.MetricsEvent?.filter?.(
      { timestamp: { $gte: windowStart.toISOString() } },
      '-timestamp',
      200
    ) || [];

    // Aggregate metrics
    const aggregated = aggregateMetrics(recentMetrics);

    return Response.json(aggregated);

  } catch (error) {
    console.error('[GetMonitoringMetrics] Error:', error);
    return Response.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

/**
 * Compute true P95 from a sorted array of numeric latency samples.
 *
 * TRACE — latency_p95_ms code path:
 *   1. MetricsEvent rows (metricName = 'takeoff_latency_ms', value = latency in ms)
 *      are fetched above (line 21-25) and filtered to the time window (line 30-32).
 *   2. computeP95(values) [this function] sorts the samples ascending and returns
 *      the value at the ceil(N * 0.95) - 1 index (standard nearest-rank P95).
 *   3. aggregateMetrics() [below] calls computeP95(takeoffLatencies) and stores
 *      the result as result.takeoffP95Latency AND result.latency_p95_ms.
 *   4. Response.json(aggregated) [line 37] returns the object, including
 *      { latency_p95_ms, takeoffP95Latency } to the dashboard.
 *   5. MonitoringDashboard reads metrics.takeoffP95Latency (= latency_p95_ms)
 *      and displays it in the "Takeoff P95 Latency" MetricCard.
 */
function computeP95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Standard nearest-rank: index = ceil(N * 0.95) - 1
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

function aggregateMetrics(metrics) {
  const result = {
    resolverMissCount: 0,
    resolverMissTrend: 'stable',
    validatorFailureCount: 0,
    validatorFailureTrend: 'stable',
    proposalFailureRate: 0,
    proposalFailureTrend: 'stable',
    takeoffP95Latency: 0,
    takeoffLatencyTrend: 'stable',
    pricingP95Latency: 0,
    pricingLatencyTrend: 'stable',
    proposalP95Latency: 0,
    proposalLatencyTrend: 'stable',
    errorRate: 0,
    errorRateTrend: 'stable',
    activeAutomations: 0,
    // Canonical export — traceable field used by dashboard and alert evaluator
    latency_p95_ms: 0,
    latencySampleCount: 0
  };

  // Count metrics
  const resolverMisses = metrics.filter(m => m.metricName?.includes('resolver_miss')).length;
  const validatorFailures = metrics.filter(m => m.metricName?.includes('validator_failure')).length;
  const proposalFailures = metrics.filter(m => m.metricName?.includes('proposal_generation_failed')).length;
  const proposalTotal = metrics.filter(m => m.metricName?.includes('proposal_generation_total')).length;

  result.resolverMissCount = resolverMisses;
  result.validatorFailureCount = validatorFailures;
  result.proposalFailureRate = proposalTotal > 0 ? (proposalFailures / proposalTotal * 100) : 0;

  // STEP 2 (see trace above): Extract latency samples from MetricsEvent rows
  // metricName = 'takeoff_latency_ms', value = observed latency in milliseconds
  const takeoffLatencySamples = metrics
    .filter(m => m.metricName === 'takeoff_latency_ms' && typeof m.value === 'number')
    .map(m => m.value);

  const pricingLatencies = metrics
    .filter(m => m.metricName?.includes('pricing_latency') && typeof m.value === 'number')
    .map(m => m.value);

  const proposalLatencies = metrics
    .filter(m => m.metricName?.includes('proposal_latency') && typeof m.value === 'number')
    .map(m => m.value);

  // STEP 3 (see trace above): Compute P95 via nearest-rank formula
  const takeoffP95 = computeP95(takeoffLatencySamples);
  result.takeoffP95Latency = takeoffP95;
  result.pricingP95Latency = computeP95(pricingLatencies);
  result.proposalP95Latency = computeP95(proposalLatencies);

  // STEP 3 (continued): Canonical latency_p95_ms field — primary tracing target
  result.latency_p95_ms = takeoffP95;
  result.latencySampleCount = takeoffLatencySamples.length;

  // Error rate from error_rate_pct events (avg), or fallback count-based
  const errorRateEvents = metrics.filter(m => m.metricName === 'error_rate_pct' && typeof m.value === 'number');
  if (errorRateEvents.length > 0) {
    result.errorRate = errorRateEvents.reduce((s, e) => s + e.value, 0) / errorRateEvents.length;
  } else {
    const errors = metrics.filter(m => m.metricName?.includes('failed')).length;
    result.errorRate = metrics.length > 0 ? (errors / metrics.length * 100) : 0;
  }

  return result;
}