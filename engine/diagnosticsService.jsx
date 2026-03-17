/**
 * FENCEBUDDY V2 ENGINE — DIAGNOSTICS SERVICE
 * 
 * CONTRACT 0.10: ERROR VISIBILITY (HARD)
 * No silent failures. Every failure must be logged and surfaced.
 */

import { base44 } from '@/api/base44Client';

/**
 * Log diagnostic error/warning/info
 */
export async function logDiagnostic({
  phase,
  severity,
  code,
  message,
  actionHint = '',
  deepLink = '',
  companyId = null,
  jobId = null,
  variantId = null,
  references = {},
  context = {}
}) {
  try {
    const diagnostic = await base44.entities.DiagnosticsLog.create({
      timestamp: new Date().toISOString(),
      companyId,
      jobId,
      variantId,
      phase,
      severity,
      code,
      message,
      actionHint,
      deepLink,
      references,
      context,
      resolved: false
    });
    
    console.log(`[Diagnostics] ${severity} ${phase}:`, code, message);
    
    return diagnostic;
  } catch (error) {
    console.error('[Diagnostics] Failed to log:', error);
    return null;
  }
}

/**
 * Get unresolved diagnostics for a job/variant
 */
export async function getUnresolvedDiagnostics({ jobId, variantId }) {
  const query = { resolved: false };
  if (jobId) query.jobId = jobId;
  if (variantId) query.variantId = variantId;
  
  const diagnostics = await base44.entities.DiagnosticsLog.filter(query);
  
  return diagnostics.sort((a, b) => {
    // Sort: BLOCKING > WARN > INFO
    const severityOrder = { BLOCKING: 0, WARN: 1, INFO: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Resolve diagnostic
 */
export async function resolveDiagnostic(diagnosticId) {
  await base44.entities.DiagnosticsLog.update(diagnosticId, {
    resolved: true,
    resolvedAt: new Date().toISOString()
  });
}

/**
 * Clear old resolved diagnostics (cleanup)
 */
export async function clearOldDiagnostics(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const oldDiagnostics = await base44.entities.DiagnosticsLog.filter({
    resolved: true
  });
  
  const toDelete = oldDiagnostics.filter(d => 
    new Date(d.resolvedAt) < cutoffDate
  );
  
  for (const diagnostic of toDelete) {
    await base44.entities.DiagnosticsLog.delete(diagnostic.id);
  }
  
  return toDelete.length;
}