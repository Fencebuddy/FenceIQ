import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const companyId = 'PrivacyFenceCo49319';

  // --- Helpers ---
  async function safeCount(base44, filter) {
    const ent = base44.asServiceRole.entities.CompanySkuMap;

    // Prefer native count if available
    if (typeof ent.count === 'function') {
      try {
        return await ent.count(filter);
      } catch (e) {
        console.warn('[safeCount] count() failed, falling back to filter...');
      }
    }
    if (typeof ent.countWhere === 'function') {
      try {
        return await ent.countWhere(filter);
      } catch (e) {
        console.warn('[safeCount] countWhere() failed, falling back to filter...');
      }
    }

    // Fallback: filter + length (safe in maintenance mode)
    const rows = await ent.filter(filter, undefined, 100000);
    return Array.isArray(rows) ? rows.length : 0;
  }

  async function bulkDelete(base44, filter) {
    const ent = base44.asServiceRole.entities.CompanySkuMap;

    // Only accept server-side bulk delete methods.
    const candidates = [
      'deleteMany',
      'deleteWhere',
      'destroyWhere',
      'removeWhere',
      'bulkDelete',
    ];

    for (const fn of candidates) {
      if (typeof ent[fn] !== 'function') {
        console.log(`[bulkDelete] ${fn} not a function, trying next...`);
        continue;
      }

      console.log(`[bulkDelete] Attempting ${fn}(${JSON.stringify(filter)})...`);

      try {
        const result = await ent[fn](filter);

        // Normalize deletedCount if the SDK returns it
        let deletedCount = null;
        if (typeof result === 'number') deletedCount = result;
        else if (result && typeof result.deletedCount === 'number') deletedCount = result.deletedCount;
        else if (result && typeof result.count === 'number') deletedCount = result.count;
        else if (result && typeof result.removed === 'number') deletedCount = result.removed;

        console.log(`[bulkDelete] ${fn} succeeded, deletedCount=${deletedCount}`);
        return { ok: true, deletedCount, methodUsed: fn };
      } catch (err) {
        console.log(`[bulkDelete] ${fn} failed: ${err.message}, trying next...`);
      }
    }

    console.error('[bulkDelete] No bulk delete methods available');
    return { ok: false, deleteManyUnsupported: true };
  }

  // --- Execution ---
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // PRECHECK
    console.log('[hardWipeCompanySkuMap] Counting existing records...');
    const preCount = await safeCount(base44, { companyId });
    console.log(`[hardWipeCompanySkuMap] Pre-wipe count: ${preCount}`);

    // WIPE (filter-delete only)
    console.log('[hardWipeCompanySkuMap] Attempting bulk delete by filter...');
    const del = await bulkDelete(base44, { companyId });

    if (!del.ok) {
      const postCount = await safeCount(base44, { companyId });
      console.log('[hardWipeCompanySkuMap] FAIL: Bulk delete methods not supported');
      return Response.json({
        preCount,
        deletedCount: null,
        postCount,
        pass: false,
        deleteManyUnsupported: true,
      });
    }

    // POSTCHECK
    console.log('[hardWipeCompanySkuMap] Counting records after wipe...');
    const postCount = await safeCount(base44, { companyId });
    console.log(`[hardWipeCompanySkuMap] Post-wipe count: ${postCount}`);
    
    const pass = postCount === 0;

    if (pass) {
      console.log('[hardWipeCompanySkuMap] PASS: All records deleted successfully');
    } else {
      console.error(`[hardWipeCompanySkuMap] FAIL: postCount=${postCount}, expected 0`);
    }

    return Response.json({
      preCount,
      deletedCount: del.deletedCount,
      postCount,
      pass,
      deleteManyUnsupported: false,
      methodUsed: del.methodUsed,
    });
  } catch (e) {
    // Hard fail: do not attempt row.id delete, do not reseed
    console.error('[hardWipeCompanySkuMap] Fatal error:', e.message);
    return Response.json({
      error: 'HARD_WIPE_FAILED',
      message: e?.message || String(e),
    }, { status: 500 });
  }
});