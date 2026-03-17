import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 11.7: Snapshot Immutability Enforcement
 * 
 * Purpose: Prevent retroactive changes to pricing and proposal snapshots.
 * Ensures ProposalPricingSnapshot and JobCostSnapshot records cannot be modified
 * after creation, preventing profit fabrication or data tampering.
 * 
 * Modes:
 * - audit: Detect any snapshots that were modified after creation
 * - enforce: Reject updates to snapshot entities (guard at write time)
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
    const mode = body.mode || 'audit'; // audit | enforce
    const snapshotId = body.snapshotId; // optional: check specific snapshot

    let result = {};

    if (mode === 'audit') {
      result = await auditSnapshotMutations(base44, snapshotId);
    } else if (mode === 'enforce') {
      // Enforce mode: verify request is CREATE only, reject UPDATE
      result = await enforceSnapshotImmutability(body);
    }

    return Response.json({ status: 'ok', ...result });

  } catch (error) {
    console.error('[SnapshotImmutability] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Audit snapshot mutations
 */
async function auditSnapshotMutations(base44, snapshotId) {
  const report = {
    timestamp: new Date().toISOString(),
    snapshotsMutated: [],
    violations: []
  };

  try {
    // Fetch snapshots (limit to 1000 for audit)
    const snapshots = await base44.asServiceRole.entities.ProposalPricingSnapshot
      .filter({}, '-created_date', 1000)
      .catch(() => []);

    for (const snapshot of snapshots) {
      // If snapshotId is specified, only check that one
      if (snapshotId && snapshot.id !== snapshotId) continue;

      // Check if snapshot was modified after creation
      const createdTime = new Date(snapshot.created_date);
      const updatedTime = new Date(snapshot.updated_date || snapshot.created_date);
      const isModified = updatedTime > createdTime;

      if (isModified) {
        const ageMs = updatedTime.getTime() - createdTime.getTime();
        report.snapshotsMutated.push({
          id: snapshot.id,
          createdAt: createdTime.toISOString(),
          modifiedAt: updatedTime.toISOString(),
          ageMinutes: Math.round(ageMs / 60000),
          agreedSubtotal: snapshot.agreed_subtotal,
          directCost: snapshot.direct_cost
        });
        report.violations.push(`Snapshot ${snapshot.id} was modified ${Math.round(ageMs / 60000)}min after creation`);
      }
    }

    // Also check JobCostSnapshot
    const jobCostSnapshots = await base44.asServiceRole.entities.JobCostSnapshot
      .filter({}, '-created_date', 1000)
      .catch(() => []);

    for (const snapshot of jobCostSnapshots) {
      const createdTime = new Date(snapshot.created_date);
      const updatedTime = new Date(snapshot.updated_date || snapshot.created_date);
      const isModified = updatedTime > createdTime;

      if (isModified) {
        const ageMs = updatedTime.getTime() - createdTime.getTime();
        report.violations.push(`JobCostSnapshot ${snapshot.id} was modified ${Math.round(ageMs / 60000)}min after creation`);
      }
    }

  } catch (error) {
    report.violations.push(`Audit error: ${error.message}`);
  }

  return {
    mode: 'audit',
    ...report,
    status: report.violations.length === 0 ? 'ok' : 'fail'
  };
}

/**
 * Enforce snapshot immutability at write time
 * This should be called BEFORE accepting any snapshot update
 */
async function enforceSnapshotImmutability(body) {
  const { snapshotEntityName, snapshotId, operation, newValues } = body;

  // Only ProposalPricingSnapshot and JobCostSnapshot are immutable
  const immutableEntities = ['ProposalPricingSnapshot', 'JobCostSnapshot'];

  if (!immutableEntities.includes(snapshotEntityName)) {
    return {
      mode: 'enforce',
      allowed: true,
      reason: 'Entity not immutable'
    };
  }

  // REJECT all UPDATE operations on snapshots
  if (operation === 'update' || operation === 'put') {
    return {
      mode: 'enforce',
      allowed: false,
      reason: 'Snapshots are immutable after creation',
      operation,
      snapshotId,
      entityName: snapshotEntityName
    };
  }

  // ALLOW CREATE operations
  if (operation === 'create' || operation === 'post') {
    // Validate required fields for new snapshots
    const requiredFields = snapshotEntityName === 'ProposalPricingSnapshot'
      ? ['agreed_subtotal', 'direct_cost', 'job_id']
      : ['job_id', 'direct_cost'];

    const missing = requiredFields.filter(f => !(f in newValues));

    if (missing.length > 0) {
      return {
        mode: 'enforce',
        allowed: false,
        reason: `Missing required fields: ${missing.join(', ')}`,
        operation,
        entityName: snapshotEntityName
      };
    }

    return {
      mode: 'enforce',
      allowed: true,
      reason: 'New snapshot creation allowed',
      operation
    };
  }

  return {
    mode: 'enforce',
    allowed: false,
    reason: `Unsupported operation: ${operation}`
  };
}