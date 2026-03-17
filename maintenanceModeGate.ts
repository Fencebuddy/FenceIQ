/**
 * MAINTENANCE MODE GATE — Runtime toggle (Phase 10.7)
 *
 * Replaces hard-coded MAINTENANCE_MODE constant.
 * State is stored in the MaintenanceMode entity (single-row singleton).
 *
 * Routes:
 *   GET  /   → getMaintenanceMode()  — admin only
 *   POST /   → setMaintenanceMode()  — admin only
 *             body: { enabled: bool, reason: string }
 *
 * Used by other functions via:
 *   import { checkMaintenanceGate } from './maintenanceModeGate.js'
 *   → NOT possible cross-file in Deno. Call this endpoint instead:
 *     POST /maintenanceModeGate  { action: 'check', operation: 'takeoff/generate' }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Singleton helpers ─────────────────────────────────────────────────────────

async function loadRecord(base44) {
  const rows = await base44.asServiceRole.entities.MaintenanceMode.list();
  return rows[0] || null;
}

async function ensureRecord(base44) {
  let rec = await loadRecord(base44);
  if (!rec) {
    rec = await base44.asServiceRole.entities.MaintenanceMode.create({
      enabled: false,
      reason: 'Initial state',
      gatedEndpoints: [
        'takeoff/generate',
        'proposal/reprice',
        'snapshot/takeoff/create',
        'snapshot/pricing/create',
        'companyskumap/auto-seed'
      ],
      history: [],
      changedAt: new Date().toISOString(),
      changedByActor: 'system'
    });
  }
  return rec;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || (req.method === 'GET' ? 'get' : 'set');

    // ── GET / CHECK ─────────────────────────────────────────────────────────
    if (action === 'get' || req.method === 'GET') {
      const rec = await ensureRecord(base44);
      return Response.json({
        enabled: rec.enabled,
        reason: rec.reason,
        changedByActor: rec.changedByActor,
        changedAt: rec.changedAt,
        enabledAt: rec.enabledAt,
        disabledAt: rec.disabledAt,
        gatedEndpoints: rec.gatedEndpoints || [],
        history: (rec.history || []).slice(-20) // last 20 entries
      });
    }

    // ── CHECK (used by gated functions) ────────────────────────────────────
    if (action === 'check') {
      const operation = body.operation || '';
      const rec = await loadRecord(base44);
      if (!rec || !rec.enabled) {
        return Response.json({ blocked: false });
      }
      const gated = rec.gatedEndpoints || [];
      const isBlocked = gated.some(ep =>
        operation.toLowerCase().includes(ep.toLowerCase())
      );
      return Response.json({
        blocked: isBlocked,
        reason: isBlocked ? rec.reason : null,
        changedAt: rec.changedAt
      });
    }

    // ── SET ─────────────────────────────────────────────────────────────────
    if (action === 'set') {
      const { enabled, reason } = body;
      if (typeof enabled !== 'boolean') {
        return Response.json({ error: 'enabled (boolean) is required' }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return Response.json({ error: 'reason is required' }, { status: 400 });
      }

      const rec = await ensureRecord(base44);
      const now = new Date().toISOString();
      const actor = user.email || user.id;

      // Append to history (cap at 100 entries)
      const history = [...(rec.history || []), {
        action: enabled ? 'ENABLE' : 'DISABLE',
        actor,
        reason: reason.trim(),
        at: now
      }].slice(-100);

      const updates = {
        enabled,
        reason: reason.trim(),
        changedByActor: actor,
        changedAt: now,
        history,
        ...(enabled  ? { enabledAt:  now } : {}),
        ...(!enabled ? { disabledAt: now } : {})
      };

      const updated = await base44.asServiceRole.entities.MaintenanceMode.update(rec.id, updates);

      console.log(`[MaintenanceModeGate] ${enabled ? 'ENABLED' : 'DISABLED'} by ${actor} — reason: ${reason}`);

      return Response.json({
        success: true,
        enabled: updated.enabled,
        reason: updated.reason,
        changedByActor: actor,
        changedAt: now
      });
    }

    return Response.json({ error: 'Unknown action. Use: get | set | check' }, { status: 400 });

  } catch (error) {
    console.error('[MaintenanceModeGate] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});