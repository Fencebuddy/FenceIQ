/**
 * Fetch monitoring alerts for dashboard.
 * Returns alert events within time window.
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

    // Fetch recent alerts with timestamp filter
    const now = new Date();
    const windowStart = new Date(now - timeWindow);
    const recentAlerts = await base44.asServiceRole.entities.AlertEvent?.filter?.(
      { timestamp: { $gte: windowStart.toISOString() } },
      '-timestamp',
      100
    ) || [];

    return Response.json(recentAlerts.map(a => ({
      id: a.id,
      rule: a.rule,
      severity: a.severity,
      title: a.title,
      metric: a.metric,
      value: a.value,
      timestamp: a.timestamp,
      correlationId: a.correlationId,
      tags: a.tags
    })));

  } catch (error) {
    console.error('[GetMonitoringAlerts] Error:', error);
    return Response.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});