import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET GLOBAL AGENT HEALTH
 * Returns agent health metrics across all companies (super admin only)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // RBAC: Super admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get all agent runs from last 24h
    const runs = await base44.asServiceRole.entities.AgentRunLog.filter(
      { ranAt: { $gte: oneDayAgo } },
      '-ranAt',
      1000
    );
    
    // Get all alerts from last 24h
    const alerts = await base44.asServiceRole.entities.AlertRecord.filter(
      { createdAt: { $gte: oneDayAgo } },
      '-createdAt',
      1000
    );
    
    // Aggregate by agent
    const agentNames = ['dataIntegrityAgent', 'usageTrackingAgent', 'performanceInsightsAgent', 'materialLinkGuardian'];
    const agentStats = [];
    
    for (const agentName of agentNames) {
      const agentRuns = runs.filter(r => r.agentName === agentName);
      const agentAlerts = alerts.filter(a => a.detailsJson?.agentKey === agentName);
      
      const totalRuns = agentRuns.length;
      const okCount = agentRuns.filter(r => r.status === 'success').length;
      const errorCount = agentRuns.filter(r => r.status === 'error').length;
      const warnCount = agentRuns.filter(r => r.findings?.warningCount > 0).length;
      
      const durations = agentRuns.filter(r => r.durationMs).map(r => r.durationMs);
      const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      
      const lastRun = agentRuns[0]?.ranAt || null;
      
      agentStats.push({
        agentName,
        enabled: true,
        dryRunMode: agentRuns[0]?.dryRun || false,
        lastRun,
        totalRuns,
        okPercentage: totalRuns > 0 ? Math.round((okCount / totalRuns) * 100) : 0,
        warnCount,
        errorCount,
        avgDuration,
        alertsCreated: agentAlerts.length,
        status: errorCount > 0 ? 'RED' : (warnCount > 0 ? 'YELLOW' : 'GREEN')
      });
    }
    
    return Response.json({
      agents: agentStats.slice(skip, skip + limit),
      total: agentStats.length,
      period: '24h',
      limit,
      skip
    });
    
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});