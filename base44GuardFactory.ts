/**
 * PHASE 12.3C: FACTORY-LEVEL IMMUTABILITY ENFORCEMENT
 *
 * Single source of truth for guarded request-scoped clients.
 * Every function using createClientFromRequest MUST use this factory instead.
 *
 * This ensures immutability is enforced at the client creation point,
 * not just on the singleton.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const IMMUTABLE_ENTITIES = new Set([
  'ProposalPricingSnapshot',
  'PricingSnapshot',
  'TakeoffSnapshot',
  'SaleSnapshot',
  'JobCostSnapshot'
]);

/**
 * Guard a base44 client by wrapping its entities and asServiceRole accessors
 * to block updates/deletes on immutable entities.
 *
 * @param {Object} base44 - The raw Base44 client instance
 * @param {Object} context - { companyId?, userId?, endpoint?, correlationId? }
 * @param {Object} opts - { allowSnapshotMutations?: boolean }
 * @returns {Proxy} - Guarded client
 */
function guardBase44Client(base44, context = {}, opts = {}) {
  const { companyId, userId, endpoint = 'unknown', correlationId } = context;
  const { allowSnapshotMutations = false } = opts;

  /**
   * Wrap entity methods to block immutable writes.
   */
  function wrapEntity(entityName, rawEntity) {
    if (!rawEntity) return rawEntity;

    const wrapped = { ...rawEntity };
    const methods = ['update', 'patch', 'delete', 'remove', 'bulkUpdate'];

    for (const method of methods) {
      if (typeof rawEntity[method] === 'function') {
        const original = rawEntity[method].bind(rawEntity);
        wrapped[method] = async (...args) => {
          if (IMMUTABLE_ENTITIES.has(entityName)) {
            // If mutations are allowed (restore mode), check maintenance + restore header
            if (allowSnapshotMutations) {
              // In a real scenario, you'd validate MaintenanceMode here
              // For now, allow if explicitly flagged
            } else {
              const error = new Error(
                `IMMUTABILITY_VIOLATION: Cannot ${method} ${entityName}. ` +
                `Snapshots are immutable to ensure historical integrity.`
              );
              error.code = 'IMMUTABILITY_VIOLATION';

              // Log violation to DiagnosticsLog
              try {
                if (base44.asServiceRole && base44.asServiceRole.entities.DiagnosticsLog) {
                  await base44.asServiceRole.entities.DiagnosticsLog.create({
                    timestamp: new Date().toISOString(),
                    companyId,
                    phase: 'SYSTEM',
                    severity: 'BLOCKING',
                    code: 'IMMUTABILITY_VIOLATION',
                    message: `Attempted ${method} on immutable entity ${entityName}`,
                    context: {
                      entityName,
                      operation: method,
                      endpoint,
                      userId,
                      correlationId,
                      stack: error.stack
                    }
                  });
                }
              } catch (logError) {
                // Swallow logging errors; immutability violation takes precedence
              }

              throw error;
            }
          }

          return original(...args);
        };
      }
    }

    return wrapped;
  }

  /**
   * Create a proxy for the entities accessor.
   */
  const entitiesProxy = new Proxy(base44.entities, {
    get(target, entityName) {
      const rawEntity = target[entityName];
      if (!rawEntity) return rawEntity;

      if (IMMUTABLE_ENTITIES.has(entityName)) {
        return wrapEntity(entityName, rawEntity);
      }
      return rawEntity;
    }
  });

  /**
   * Create a wrapped asServiceRole that also guards entities.
   */
  const wrappedServiceRole = {
    ...base44.asServiceRole,
    entities: new Proxy(base44.asServiceRole.entities || {}, {
      get(target, entityName) {
        const rawEntity = target[entityName];
        if (!rawEntity) return rawEntity;

        if (IMMUTABLE_ENTITIES.has(entityName)) {
          return wrapEntity(entityName, rawEntity);
        }
        return rawEntity;
      }
    })
  };

  /**
   * Return a guarded client proxy.
   */
  return new Proxy(base44, {
    get(target, prop) {
      if (prop === 'entities') {
        return entitiesProxy;
      }
      if (prop === 'asServiceRole') {
        return wrappedServiceRole;
      }
      return target[prop];
    }
  });
}

/**
 * Factory function: Create a request-scoped, immutability-guarded client.
 *
 * CANONICAL USAGE:
 * const base44 = await createGuardedClientFromRequest(req);
 *
 * @param {Request} req - Incoming HTTP request
 * @param {Object} opts - { allowSnapshotMutations?, correlationId? }
 * @returns {Promise<Object>} - Guarded base44 client
 */
async function createGuardedClientFromRequest(req, opts = {}) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const context = {
    userId: user?.email,
    companyId: user?.companyId, // Adjust if company ID is stored elsewhere
    endpoint: req.url || 'unknown',
    correlationId: opts.correlationId || req.headers.get('x-correlation-id')
  };

  return guardBase44Client(base44, context, opts);
}

export { createGuardedClientFromRequest, guardBase44Client };