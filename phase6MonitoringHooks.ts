/**
 * PHASE 6: MONITORING HOOKS FOR 72-HOUR CUTOVER WATCH
 * 
 * Logs resolver misses, validator failures, and guards against catalog/map drift
 * for the critical 72-hour window post-unfreeze.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MONITORING_STATE = {
  enabled: true,
  startTime: new Date().toISOString(),
  alerts: {
    resolverMisses: 0,
    validatorFailures: 0,
    invalidCompanySkuMapWrites: 0
  }
};

/**
 * HOOK A: Log resolver misses with full context
 */
export async function logResolverMiss(context) {
  if (!MONITORING_STATE.enabled) return;
  
  const { companyId, uck, feature, lineItemName, error } = context;
  
  MONITORING_STATE.alerts.resolverMisses++;
  
  console.error('[PHASE_6_MONITORING] Resolver Miss Alert', {
    timestamp: new Date().toISOString(),
    companyId,
    uck,
    lineItemName,
    feature,
    error: error?.message || String(error),
    stackTrace: error?.stack?.split('\n').slice(0, 5).join(' | '),
    alertCount: MONITORING_STATE.alerts.resolverMisses
  });

  // If threshold exceeded, could trigger immediate re-enable of maintenance mode
  if (MONITORING_STATE.alerts.resolverMisses > 5) {
    console.error('[PHASE_6_CRITICAL] Resolver miss threshold exceeded! Consider rollback.');
  }
}

/**
 * HOOK B: Log validator failures
 */
export async function logValidatorFailure(context) {
  if (!MONITORING_STATE.enabled) return;
  
  const { key, reason, feature, error } = context;
  
  MONITORING_STATE.alerts.validatorFailures++;
  
  console.error('[PHASE_6_MONITORING] Validator Failure Alert', {
    timestamp: new Date().toISOString(),
    key,
    reason,
    feature,
    error: error?.message || String(error),
    alertCount: MONITORING_STATE.alerts.validatorFailures
  });

  if (MONITORING_STATE.alerts.validatorFailures > 3) {
    console.error('[PHASE_6_CRITICAL] Validator failure threshold exceeded! Consider rollback.');
  }
}

/**
 * HOOK C: Guard against CompanySkuMap drift (write validation)
 * Call this before any CompanySkuMap write to ensure:
 * 1. canonicalKey exists in MaterialCatalog
 * 2. linked catalog item is still active
 */
export async function validateCompanySkuMapWrite(req, writeData) {
  if (!MONITORING_STATE.enabled) return { allowed: true };
  
  try {
    const base44 = createClientFromRequest(req);
    const { uck, materialCatalogId } = writeData;

    if (!uck || !materialCatalogId) {
      return { allowed: true }; // Validation only on complete writes
    }

    // Verify catalog item exists and is active
    let catalogItem;
    try {
      catalogItem = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { id: materialCatalogId, active: true },
        undefined,
        1
      );
      if (!catalogItem || catalogItem.length === 0) {
        throw new Error('Catalog item not found or inactive');
      }
    } catch (e) {
      MONITORING_STATE.alerts.invalidCompanySkuMapWrites++;
      console.error('[PHASE_6_MONITORING] Invalid CompanySkuMap Write Blocked', {
        timestamp: new Date().toISOString(),
        uck,
        materialCatalogId,
        reason: 'Catalog item inactive or missing',
        alertCount: MONITORING_STATE.alerts.invalidCompanySkuMapWrites
      });
      return { allowed: false, reason: 'Catalog item invalid' };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[PHASE_6_MONITORING] Drift guard error:', error);
    return { allowed: true }; // Default to allow, but log error
  }
}

/**
 * Get monitoring state (health check)
 */
export function getMonitoringState() {
  return {
    ...MONITORING_STATE,
    uptime: new Date(new Date() - new Date(MONITORING_STATE.startTime)).toISOString()
  };
}

/**
 * Disable monitoring (called if rollback occurs)
 */
export function disableMonitoring() {
  MONITORING_STATE.enabled = false;
  console.warn('[PHASE_6_MONITORING] Monitoring disabled - possible rollback triggered');
}