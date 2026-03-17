/**
 * AGENT MONITORING SERVICE
 * Read-only service for agent health, alerts, and logs
 * Enforces tenant isolation and pagination
 */

import { base44 } from '@/api/base44Client';

/**
 * Get global agent health (super admin only)
 */
export async function getGlobalAgentHealth({ limit = 50, skip = 0 } = {}) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get all agent runs from last 24h
  const runs = await base44.entities.AgentRunLog.filter(
    { ranAt: { $gte: oneDayAgo } },
    '-ranAt',
    1000
  );
  
  // Get all alerts from last 24h
  const alerts = await base44.entities.AlertRecord.filter(
    { createdAt: { $gte: oneDayAgo } },
    '-createdAt',
    1000
  );
  
  // Aggregate by agent
  const agentStats = {};
  const agentNames = ['dataIntegrityAgent', 'usageTrackingAgent', 'performanceInsightsAgent', 'materialLinkGuardian'];
  
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
    
    agentStats[agentName] = {
      agentName,
      enabled: true, // TODO: Get from feature flags
      dryRunMode: agentRuns[0]?.dryRun || false,
      lastRun,
      totalRuns,
      okPercentage: totalRuns > 0 ? Math.round((okCount / totalRuns) * 100) : 0,
      warnCount,
      errorCount,
      avgDuration,
      alertsCreated: agentAlerts.length,
      status: errorCount > 0 ? 'RED' : (warnCount > 0 ? 'YELLOW' : 'GREEN')
    };
  }
  
  return {
    agents: Object.values(agentStats).slice(skip, skip + limit),
    total: Object.values(agentStats).length,
    period: '24h'
  };
}

/**
 * Get company automation dashboard (company admin)
 */
export async function getCompanyAutomationDashboard(companyId, { limit = 50, skip = 0 } = {}) {
  if (!companyId) {
    throw new Error('companyId required');
  }
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get active alerts (unacknowledged)
  const activeAlerts = await base44.entities.AlertRecord.filter(
    { 
      companyId,
      acknowledgedAt: null
    },
    '-createdAt',
    limit
  );
  
  // Get suggestions (open)
  const suggestions = await base44.entities.SuggestionRecord.filter(
    {
      companyId,
      status: 'OPEN'
    },
    '-createdAt',
    limit
  );
  
  // Get recent agent runs
  const recentRuns = await base44.entities.AgentRunLog.filter(
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
  
  return {
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
  };
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId, userId) {
  const alert = await base44.entities.AlertRecord.filter({ id: alertId }).then(r => r[0]);
  
  if (!alert) {
    throw new Error('Alert not found');
  }
  
  await base44.entities.AlertRecord.update(alertId, {
    acknowledgedAt: new Date().toISOString(),
    acknowledgedByUserId: userId
  });
  
  return { success: true };
}

/**
 * Dismiss suggestion
 */
export async function dismissSuggestion(suggestionId, userId) {
  await base44.entities.SuggestionRecord.update(suggestionId, {
    status: 'DISMISSED',
    appliedByUserId: userId,
    appliedAt: new Date().toISOString()
  });
  
  return { success: true };
}