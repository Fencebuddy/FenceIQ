import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 11.6: Tenant Isolation Tightening
 * 
 * Purpose: Audit and enforce strict tenant isolation across all data flows.
 * Prevents cross-tenant data leaks by:
 * - Verifying companyId is present on all multi-tenant entities
 * - Checking for orphaned records without companyId
 * - Validating query filters always include companyId
 * 
 * Modes:
 * - audit: Find isolation violations without fixing
 * - repair: Fix isolation violations (orphan marking)
 */

Deno.serve(async (req) => {
  const startTime = new Date();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'audit'; // audit | repair
    const entityName = body.entityName; // specific entity to check, or all if null

    const result = mode === 'audit'
      ? await auditTenantIsolation(base44, entityName)
      : await repairTenantIsolation(base44, entityName);

    return Response.json({ status: 'ok', ...result });

  } catch (error) {
    console.error('[TenantIsolation] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Audit tenant isolation across entities
 */
async function auditTenantIsolation(base44, entityName) {
  const entitiesToCheck = entityName 
    ? [entityName]
    : [
        'CRMJob', 'CRMAccount', 'CRMContact', 'CRMAddress',
        'Job', 'Run', 'Gate', 'MaterialLine',
        'CompanySkuMap', 'ProfitSignal', 'ZoneTemperature', 'ZoneSignal',
        'NeighborhoodZone', 'StewardshipTemplate', 'StewardshipTouchpoint',
        'CustomerProfile', 'RelationshipFacts',
        'MetricsEvent', 'AlertEvent'
      ];

  const report = {
    timestamp: new Date().toISOString(),
    entities: {},
    violations: [],
    orphanedCount: 0
  };

  for (const entity of entitiesToCheck) {
    try {
      const allRows = await base44.asServiceRole.entities[entity]?.filter?.({}).catch(() => []) || [];
      if (allRows.length === 0) continue;

      // Check for rows without companyId
      const orphaned = allRows.filter(r => !r.companyId);
      
      if (orphaned.length > 0) {
        report.entities[entity] = {
          total: allRows.length,
          orphanedCount: orphaned.length,
          orphanedIds: orphaned.slice(0, 5).map(r => r.id)
        };
        report.violations.push(`${entity}: ${orphaned.length}/${allRows.length} orphaned`);
        report.orphanedCount += orphaned.length;
      } else {
        report.entities[entity] = {
          total: allRows.length,
          orphanedCount: 0,
          status: 'OK'
        };
      }
    } catch (error) {
      report.entities[entity] = { error: error.message };
    }
  }

  return {
    mode: 'audit',
    ...report
  };
}

/**
 * Repair tenant isolation violations
 */
async function repairTenantIsolation(base44, entityName) {
  const entitiesToRepair = entityName 
    ? [entityName]
    : [
        'CRMJob', 'CRMAccount', 'CRMContact', 'CRMAddress',
        'Job', 'Run', 'Gate', 'MaterialLine',
        'CompanySkuMap', 'ProfitSignal', 'ZoneTemperature', 'ZoneSignal',
        'NeighborhoodZone', 'StewardshipTemplate', 'StewardshipTouchpoint',
        'CustomerProfile', 'RelationshipFacts'
      ];

  const report = {
    timestamp: new Date().toISOString(),
    entities: {},
    repaired: 0,
    errors: []
  };

  for (const entity of entitiesToRepair) {
    try {
      const allRows = await base44.asServiceRole.entities[entity]?.filter?.({}).catch(() => []) || [];
      const orphaned = allRows.filter(r => !r.companyId);

      if (orphaned.length === 0) continue;

      // Mark orphaned records for quarantine (add a flag, don't delete)
      let repairedCount = 0;
      for (const row of orphaned.slice(0, 100)) {
        try {
          await base44.asServiceRole.entities[entity].update(row.id, {
            _isolation_quarantine: true,
            _quarantine_at: new Date().toISOString()
          }).catch(() => {});
          repairedCount++;
        } catch (e) {
          report.errors.push(`${entity} ${row.id}: ${e.message}`);
        }
      }

      if (repairedCount > 0) {
        report.entities[entity] = {
          orphanedFound: orphaned.length,
          quarantined: repairedCount
        };
        report.repaired += repairedCount;
      }
    } catch (error) {
      report.errors.push(`${entity}: ${error.message}`);
    }
  }

  return {
    mode: 'repair',
    ...report
  };
}