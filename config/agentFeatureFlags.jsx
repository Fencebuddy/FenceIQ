/**
 * AGENT FEATURE FLAGS
 * Central configuration for agent behavior
 * Single source of truth for agent toggles
 */

export const AGENT_FLAGS = {
  // Global agent controls
  agents: {
    enabled: true,           // Master kill switch for all agents
    globalDryRun: true,      // TRUE = agents log only, no writes (SAFE DEFAULT FOR 48H)
    dryRunMode: true,        // DEPRECATED: use globalDryRun
    logAllRuns: true,        // Log every agent execution to AgentRunLog
    
    // Per-agent toggles
    dataIntegrity: {
      enabled: true,
      runOnEntityCreate: true,
      runOnEntityUpdate: true,
      runNightlyScan: true,
      nightlyStartHour: 2,    // 2 AM local time
      maxErrorsBeforeAlert: 5
    },
    
    usageTracking: {
      enabled: true,
      trackJobCreate: true,
      trackPricingCompute: true,
      trackProposalSent: true,
      trackProposalSigned: true,
      trackExports: true
    },
    
    performanceInsights: {
      enabled: true,
      trackComputeStart: true,
      trackComputeEnd: true,
      slowOperationThresholdMs: 3000,
      runHourlySummary: true,
      hourlySummaryMinute: 0,  // Top of the hour
      excessiveRecomputeRatio: 5  // Alert if pricing:jobs ratio > 5:1
    },
    
    // NEW AGENTS (Platform Intelligence Suite)
    materialLinkGuardian: {
      enabled: true,
      runOnSelectionSetChange: true,
      runOnCatalogChange: true,
      runNightlyScan: true,
      nightlyStartHour: 2,
      autoFix: false  // Manual approval required for fixes
    }
  },
  
  // Tenant isolation
  tenant: {
    enforceCompanyId: true,   // All agent queries must include companyId
    defaultCompanyId: "PrivacyFenceCo49319"
  },
  
  // Alert settings
  alerts: {
    emailEnabled: false,      // Email alerts (disable until verified)
    alertEmail: "admin@fencebuddy.com",
    minSeverity: "ERROR"      // Only send ERROR alerts (not WARN)
  }
};

/**
 * Get current flag value
 */
export function getAgentFlag(path) {
  const keys = path.split('.');
  let value = AGENT_FLAGS;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return null;
  }
  
  return value;
}

/**
 * Check if agent should run
 */
export function shouldAgentRun(agentName) {
  if (!AGENT_FLAGS.agents.enabled) return false;
  
  const agentConfig = AGENT_FLAGS.agents[agentName];
  return agentConfig?.enabled === true;
}

/**
 * Check if in dry run mode
 */
export function isDryRunMode() {
  return AGENT_FLAGS.agents.dryRunMode === true;
}