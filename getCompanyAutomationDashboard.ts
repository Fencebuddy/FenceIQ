import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET COMPANY AUTOMATION DASHBOARD
 * Returns automation health for a specific company (company admin)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // RBAC: Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { companyId } = await req.json();
    
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get active alerts (unacknowledged)
    const activeAlerts = await base44.asServiceRole.entities.AlertRecord.filter(
      { 
        companyId,
        acknowledgedAt: null
      },
      '-createdAt',
      50
    );
    
    // Get open suggestions
    const suggestions = await base44.asServiceRole.entities.SuggestionRecord.filter(
      {
        companyId,
        status: 'OPEN'
      },
      '-createdAt',
      50
    );
    
    // Get recent agent runs
    const recentRuns = await base44.asServiceRole.entities.AgentRunLog.filter(
      {
        companyId,
        ranAt: { $gte: oneDayAgo }
      },
      '-ranAt',
      100
    );
    
    // Calculate health score
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
    const warnAlerts = activeAlerts.filter(a => a.severity === 'WARN').length;
    
    let healthScore = 100;
    healthScore -= Math.min(criticalAlerts * 20, 60);
    healthScore -= Math.min(warnAlerts * 10, 30);
    healthScore = Math.max(healthScore, 0);
    
    // Agent activity snapshot
    const errorRuns = recentRuns.filter(r => r.status === 'error').length;
    const lastRun = recentRuns[0]?.ranAt || null;
    
    return Response.json({
      healthScore,
      healthStatus: healthScore >= 80 ? 'GOOD' : (healthScore >= 50 ? 'WARNING' : 'CRITICAL'),
      activeAlerts: {
        items: activeAlerts,
        total: activeAlerts.length,
        critical: criticalAlerts,
        warn: warnAlerts
      },
      suggestions: {
        items: suggestions,
        total: suggestions.length
      },
      agentActivity: {
        runsLast24h: recentRuns.length,
        errorsLast24h: errorRuns,
        lastRun
      }
    });
    
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});