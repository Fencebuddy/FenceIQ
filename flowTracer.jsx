import { base44 } from '@/api/base44Client';
import { v4 as uuidv4 } from 'npm:uuid@^9.0.0';

/**
 * FLOW TRACE SYSTEM
 * 
 * Captures deterministic pipeline steps:
 * MAP_SAVE → TAKEOFF_SNAPSHOT → MAPPING_SEED → RESOLVER → PRICING → JOBCOST_SNAPSHOT
 * 
 * NO FALLBACKS, NO LEGACY PATHS, EVERY STEP RECORDED
 */

let currentTraceId = null;

export function createTraceId() {
  currentTraceId = uuidv4();
  return currentTraceId;
}

export function getTraceId() {
  return currentTraceId;
}

/**
 * Log a flow trace event
 */
export async function logTrace({
  traceId,
  jobId,
  variantKey = 'CURRENT',
  pageName,
  stepName,
  functionName,
  inputHashes = {},
  sourcesUsed = [],
  fallbacksUsed = [],
  outputSummary = {},
  entityReads = [],
  entityWrites = [],
  errorOccurred = false,
  errorMessage = null,
  durationMs = 0
}) {
  if (!traceId || !jobId) {
    console.warn('[flowTracer] Missing traceId or jobId, skipping trace');
    return;
  }

  try {
    const traceData = {
      traceId,
      jobId,
      variantKey,
      pageName,
      stepName,
      functionName,
      timestamp: new Date().toISOString(),
      inputHashes,
      sourcesUsed,
      fallbacksUsed,
      outputSummary,
      entityReads,
      entityWrites,
      errorOccurred,
      errorMessage,
      durationMs
    };

    await base44.asServiceRole.entities.FlowTrace.create(traceData);
    
    // Console output for visibility
    const status = errorOccurred ? '❌' : '✅';
    const duration = durationMs ? ` (${durationMs}ms)` : '';
    console.log(`[Trace] ${status} ${stepName}${duration} | fallbacks=${fallbacksUsed.length}`);

  } catch (error) {
    console.error('[flowTracer] Failed to log trace:', error);
  }
}

/**
 * Helper: Entity read record
 */
export function traceEntityRead(entity, query, resultCount) {
  return {
    entity,
    query,
    resultCount
  };
}

/**
 * Helper: Entity write record
 */
export function traceEntityWrite(entity, operation, recordId, dataSnapshot) {
  return {
    entity,
    operation,
    recordId,
    dataSnapshot: dataSnapshot ? Object.keys(dataSnapshot).slice(0, 5) : []
  };
}

/**
 * Fetch all trace events for a job (chronological)
 */
export async function fetchJobTrace(jobId) {
  try {
    const traces = await base44.asServiceRole.entities.FlowTrace.filter(
      { jobId },
      'timestamp',
      1000
    );
    
    return {
      jobId,
      traceCount: traces.length,
      traces: traces.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      summary: {
        fallbacksTotal: traces.reduce((sum, t) => sum + (t.fallbacksUsed?.length || 0), 0),
        errorsTotal: traces.filter(t => t.errorOccurred).length,
        durationTotalMs: traces.reduce((sum, t) => sum + (t.durationMs || 0), 0)
      }
    };
  } catch (error) {
    console.error('[flowTracer] Failed to fetch job trace:', error);
    return null;
  }
}

/**
 * Check if any step used fallbacks or had errors
 */
export function analyzeTraceHealth(traces) {
  const issues = [];

  traces.forEach((trace, idx) => {
    if (trace.fallbacksUsed?.length > 0) {
      issues.push({
        step: idx,
        stepName: trace.stepName,
        type: 'FALLBACK',
        fallbacks: trace.fallbacksUsed,
        severity: 'WARN'
      });
    }

    if (trace.errorOccurred) {
      issues.push({
        step: idx,
        stepName: trace.stepName,
        type: 'ERROR',
        message: trace.errorMessage,
        severity: 'CRITICAL'
      });
    }
  });

  return {
    healthy: issues.length === 0,
    issueCount: issues.length,
    issues,
    verdict: issues.length === 0 ? 'CLEAN' : (
      issues.some(i => i.severity === 'CRITICAL') ? 'BROKEN' : 'DEGRADED'
    )
  };
}