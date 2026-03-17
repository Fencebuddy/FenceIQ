/**
 * AGENT RUNNER
 * Central executor for all FenceIQ agents
 * Enforces: companyId isolation, feature flags, dry-run mode, logging
 */

import { base44 } from '@/api/base44Client';
import { AGENT_FLAGS, shouldAgentRun, isDryRunMode } from '@/components/config/agentFeatureFlags';

/**
 * Execute an agent with full safety guardrails
 */
export async function runAgent({
  agentKey,
  triggerType,
  triggerRef,
  companyId,
  agentFunction,
  payload = {}
}) {
  const startTime = Date.now();
  
  // GUARDRAIL 1: Verify companyId present
  if (!companyId) {
    throw new Error(`[AgentRunner] companyId required for agent ${agentKey}`);
  }
  
  // GUARDRAIL 2: Check if agent is enabled
  if (!shouldAgentRun(agentKey)) {
    console.log(`[AgentRunner] Agent ${agentKey} is disabled by feature flag`);
    return {
      skipped: true,
      reason: 'Agent disabled by feature flag'
    };
  }
  
  // GUARDRAIL 3: Check global dry run mode
  const globalDryRun = AGENT_FLAGS.agents.globalDryRun;
  
  console.log(`[AgentRunner] Running ${agentKey} (dryRun: ${globalDryRun}, trigger: ${triggerType})`);
  
  let result;
  let status = 'OK';
  let summary = '';
  let detailsJson = {};
  
  try {
    // Execute agent function
    result = await agentFunction({
      companyId,
      triggerType,
      triggerRef,
      globalDryRun,
      ...payload
    });
    
    summary = result.summary || 'Agent executed successfully';
    detailsJson = result.details || result;
    status = result.status || 'OK';
    
  } catch (error) {
    status = 'ERROR';
    summary = error.message;
    detailsJson = {
      error: error.message,
      stack: error.stack
    };
    console.error(`[AgentRunner] Agent ${agentKey} failed:`, error);
  }
  
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  
  // GUARDRAIL 4: Always log agent run
  try {
    await base44.entities.AgentRunLog.create({
      companyId,
      agentName: agentKey,
      triggerType,
      triggerEntityType: triggerRef?.split(':')[0],
      triggerEntityId: triggerRef?.split(':')[1],
      status: status === 'OK' ? 'success' : (status === 'WARN' ? 'success' : 'error'),
      dryRun: globalDryRun,
      durationMs,
      findings: detailsJson,
      ranAt: finishedAt
    });
  } catch (logError) {
    console.error('[AgentRunner] Failed to log agent run:', logError);
  }
  
  return {
    success: status !== 'ERROR',
    status,
    summary,
    details: detailsJson,
    durationMs,
    dryRun: globalDryRun
  };
}

/**
 * Create an alert record
 */
export async function createAlert({
  companyId,
  alertType,
  severity,
  entityType,
  entityId,
  title,
  message,
  detailsJson = {}
}) {
  const globalDryRun = AGENT_FLAGS.agents.globalDryRun;
  
  if (globalDryRun) {
    console.log(`[DRY RUN] Would create alert: ${title}`, { alertType, severity });
    return { dryRun: true };
  }
  
  return await base44.entities.AlertRecord.create({
    companyId,
    alertType,
    severity,
    entityType,
    entityId,
    title,
    message,
    detailsJson,
    createdAt: new Date().toISOString()
  });
}

/**
 * Create a suggestion record
 */
export async function createSuggestion({
  companyId,
  suggestionType,
  entityType,
  entityId,
  suggestedPatchJson,
  confidence,
  reasoning
}) {
  const globalDryRun = AGENT_FLAGS.agents.globalDryRun;
  
  if (globalDryRun) {
    console.log(`[DRY RUN] Would create suggestion:`, { suggestionType, entityType, entityId, confidence });
    return { dryRun: true };
  }
  
  return await base44.entities.SuggestionRecord.create({
    companyId,
    suggestionType,
    entityType,
    entityId,
    suggestedPatchJson,
    confidence,
    status: 'OPEN',
    reasoning,
    createdAt: new Date().toISOString()
  });
}