/**
 * HOTFIX 10.2A-3: METRICS INGESTION ENDPOINT
 *
 * Endpoint: POST /phase7_metricsCollector  (base44 function path)
 * - Persists MetricsEvent rows immediately (no buffer-only mode that loses data)
 * - Returns 200 with persisted event id
 * - Never requires auth (metrics must succeed even on anonymous context)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();

    if (!payload.name || payload.value === undefined) {
      return Response.json({ error: 'Invalid payload: name and value required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const metricEvent = {
      metricName: payload.name,
      value: Number(payload.value),
      tags: {
        companyId: payload.tags?.companyId || 'unknown',
        environment: 'production',
        endpoint: payload.tags?.endpoint || 'unknown',
        ...(payload.tags || {})
      },
      timestamp: new Date().toISOString(),
      recorded: true
    };

    // Persist immediately — no buffering that risks data loss
    const saved = await base44.asServiceRole.entities.MetricsEvent.create(metricEvent);

    return Response.json({
      status: 'ok',
      id: saved?.id,
      metricName: metricEvent.metricName,
      timestamp: metricEvent.timestamp
    });

  } catch (error) {
    console.error('[MetricsCollector] Error:', error.message);
    // Still return 200 — metrics must never block callers
    return Response.json({ status: 'error', message: error.message });
  }
});