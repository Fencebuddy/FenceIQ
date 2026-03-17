import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const companyId = 'PrivacyFenceCo49319';

  // Extract a string ID from any weird SDK shape
  function getScalarId(row) {
    const id = row?.id ?? row?._id;

    if (typeof id === 'string') return id;

    // Common wrappers
    if (id && typeof id === 'object') {
      if (typeof id.$oid === 'string') return id.$oid;
      if (typeof id.value === 'string') return id.value;
      if (typeof id.id === 'string') return id.id;
      if (typeof id._id === 'string') return id._id;
    }

    // As a last resort, scan row for a plausible id string
    for (const k of ['id', '_id', 'objectId', 'oid']) {
      const v = row?.[k];
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof v.$oid === 'string') return v.$oid;
    }

    throw new Error(`UNSUPPORTED_ID_SHAPE: ${JSON.stringify(row?.id ?? row?._id)}`);
  }

  async function listAllRows(base44) {
    // If the SDK supports pagination tokens, use them.
    // Otherwise, use a high limit. Adjust if Base44 caps limits.
    const ent = base44.asServiceRole.entities.CompanySkuMap;

    // Try filter() pattern
    if (typeof ent.filter === 'function') {
      const rows = await ent.filter({ companyId }, undefined, 100000);
      return Array.isArray(rows) ? rows : [];
    }

    throw new Error('NO_SUPPORTED_LIST_METHOD');
  }

  async function countRows(base44) {
    const ent = base44.asServiceRole.entities.CompanySkuMap;
    if (typeof ent.count === 'function') {
      try {
        return await ent.count({ companyId });
      } catch (e) {
        console.warn('[countRows] count() failed, falling back to filter...');
      }
    }
    if (typeof ent.countWhere === 'function') {
      try {
        return await ent.countWhere({ companyId });
      } catch (e) {
        console.warn('[countRows] countWhere() failed, falling back to filter...');
      }
    }
    const rows = await listAllRows(base44);
    return rows.length;
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[hardWipeCompanySkuMapRowLoop] Starting row-by-row deletion...');
    
    const preCount = await countRows(base44);
    console.log(`[hardWipeCompanySkuMapRowLoop] Pre-wipe count: ${preCount}`);

    // Pull all rows in this scope
    console.log('[hardWipeCompanySkuMapRowLoop] Listing all rows to delete...');
    const rows = await listAllRows(base44);
    console.log(`[hardWipeCompanySkuMapRowLoop] Listed ${rows.length} rows`);

    // Delete sequentially (safe) or in small batches (faster).
    // Start sequential for safety.
    let deletedCount = 0;
    const failures = [];

    console.log('[hardWipeCompanySkuMapRowLoop] Deleting rows sequentially...');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const scalarId = getScalarId(row);
        await base44.asServiceRole.entities.CompanySkuMap.delete(scalarId);
        deletedCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`[hardWipeCompanySkuMapRowLoop] Deleted ${i + 1}/${rows.length}`);
        }
      } catch (e) {
        failures.push({
          error: e?.message || String(e),
          // include minimal identifiers to debug without flooding logs
          uck: row?.uck ?? row?.canonicalKey ?? null,
          rawId: row?.id ?? row?._id ?? null,
        });
        console.warn(`[hardWipeCompanySkuMapRowLoop] Delete failed for row ${i}: ${e?.message}`);
      }
    }

    console.log(`[hardWipeCompanySkuMapRowLoop] Deletion complete: ${deletedCount}/${rows.length}`);

    const postCount = await countRows(base44);
    console.log(`[hardWipeCompanySkuMapRowLoop] Post-wipe count: ${postCount}`);
    
    const pass = postCount === 0 && failures.length === 0;

    if (pass) {
      console.log('[hardWipeCompanySkuMapRowLoop] PASS: All rows deleted successfully');
    } else {
      if (postCount > 0) {
        console.error(`[hardWipeCompanySkuMapRowLoop] FAIL: postCount=${postCount}, expected 0`);
      }
      if (failures.length > 0) {
        console.error(`[hardWipeCompanySkuMapRowLoop] FAIL: ${failures.length} deletion failures`);
      }
    }

    // Hard rules: do not reseed here.
    return Response.json({
      preCount,
      listedCount: rows.length,
      deletedCount,
      postCount,
      pass,
      failureCount: failures.length,
      // return up to 25 failures for debugging (no samples of success)
      failures: failures.slice(0, 25),
    });
  } catch (e) {
    console.error('[hardWipeCompanySkuMapRowLoop] Fatal error:', e?.message);
    return Response.json({
      error: 'HARD_WIPE_ROW_LOOP_FAILED',
      message: e?.message || String(e),
    }, { status: 500 });
  }
});