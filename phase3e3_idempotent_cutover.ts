import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const companyId = 'PrivacyFenceCo49319';

  // ============================================================================
  // HELPERS
  // ============================================================================

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const is429 = err?.status === 429 || err?.response?.status === 429 || 
                     err?.message?.includes('429');
        if (!is429 || attempt === maxRetries - 1) throw err;
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[withRetry] 429 on attempt ${attempt + 1}, backoff ${delayMs}ms`);
        await sleep(delayMs);
      }
    }
  }

  function validateCanonicalKey(key) {
    if (!key || typeof key !== 'string') return false;
    // No spaces, no hyphens, no uppercase, no dots
    if (/\s|-|\./.test(key)) return false;
    if (/[A-Z]/.test(key)) return false;
    return true;
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[phase3e3] Starting idempotent cutover...');

    // ========================================================================
    // PHASE A: HARD WIPE
    // ========================================================================
    console.log('[phase3e3-A] Wiping existing CompanySkuMap...');
    
    let mapCountAfterDelete = 0;
    try {
      // Row-by-row delete (proven to work)
      const ent = base44.asServiceRole.entities.CompanySkuMap;
      const rows = await withRetry(() => ent.filter({ companyId }, undefined, 100000));
      console.log(`[phase3e3-A] Found ${rows.length} rows to delete`);
      
      for (const row of rows) {
        await withRetry(() => ent.delete(row.id));
      }
      console.log(`[phase3e3-A] Deleted ${rows.length} rows`);
    } catch (err) {
      console.error('[phase3e3-A] Wipe failed:', err.message);
      throw err;
    }

    // Verify wipe
    mapCountAfterDelete = await withRetry(async () => {
      const ent = base44.asServiceRole.entities.CompanySkuMap;
      if (typeof ent.count === 'function') {
        return await ent.count({ companyId });
      }
      const rows = await ent.filter({ companyId }, undefined, 100000);
      return Array.isArray(rows) ? rows.length : 0;
    });

    if (mapCountAfterDelete !== 0) {
      return Response.json({
        pass: false,
        error: 'WIPE_VERIFICATION_FAILED',
        mapCountAfterDelete,
      }, { status: 400 });
    }
    console.log('[phase3e3-A] ✓ Wipe verified: mapCountAfterDelete=0');

    // ========================================================================
    // PHASE B: AUTHORITATIVE SEED LIST (READ-ONLY)
    // ========================================================================
    console.log('[phase3e3-B] Reading active catalog...');
    
    const catalog = await withRetry(async () => {
      const ent = base44.asServiceRole.entities.MaterialCatalog;
      const rows = await ent.filter({ active: true }, undefined, 5000);
      return Array.isArray(rows) ? rows : [];
    });

    const catalogCount = catalog.length;
    console.log(`[phase3e3-B] Catalog loaded: catalogCount=${catalogCount}`);

    if (catalogCount === 0) {
      return Response.json({
        pass: false,
        error: 'EMPTY_CATALOG',
        catalogCount: 0,
      }, { status: 400 });
    }

    // Check for collisions (set-based)
    console.log('[phase3e3-B] Checking canonical_key uniqueness...');
    const keyMap = new Map();
    const collisions = [];
    for (const row of catalog) {
      const key = row.canonical_key;
      if (!key) {
        collisions.push({ id: row.id, issue: 'null_key' });
        continue;
      }
      if (keyMap.has(key)) {
        collisions.push({ key, id: row.id, existing: keyMap.get(key) });
      } else {
        keyMap.set(key, row.id);
      }
    }

    if (collisions.length > 0) {
      return Response.json({
        pass: false,
        error: 'CANONICAL_KEY_COLLISIONS',
        collisions: collisions.slice(0, 10),
      }, { status: 400 });
    }
    console.log('[phase3e3-B] ✓ No canonical_key collisions');

    // Check key hygiene (set-based)
    console.log('[phase3e3-B] Checking key hygiene...');
    const violations = catalog.filter((row) => !validateCanonicalKey(row.canonical_key));
    const violationsCount = violations.length;

    if (violationsCount > 0) {
      return Response.json({
        pass: false,
        error: 'KEY_HYGIENE_VIOLATIONS',
        violationsCount,
        violations: violations.slice(0, 10).map((r) => ({
          id: r.id,
          canonical_key: r.canonical_key,
        })),
      }, { status: 400 });
    }
    console.log('[phase3e3-B] ✓ All keys pass hygiene check');

    // ========================================================================
    // PHASE C: INSERT (WRITE)
    // ========================================================================
    console.log('[phase3e3-C] Inserting CompanySkuMap rows...');
    
    const toInsert = catalog.map((mc) => ({
      companyId,
      uck: mc.canonical_key,
      materialCatalogId: mc.id,
      displayName: mc.crm_name,
      materialType: mc.material_type,
      status: 'mapped',
      notes: `CUTOVER_RESEED_2026-02-28 authoritative mirror`,
    }));

    let insertedCount = 0;
    const batchSize = 50;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      try {
        await withRetry(async () => {
          const ent = base44.asServiceRole.entities.CompanySkuMap;
          return await ent.bulkCreate(batch);
        });
        insertedCount += batch.length;
        console.log(`[phase3e3-C] Inserted ${insertedCount}/${toInsert.length}`);
      } catch (err) {
        console.error(`[phase3e3-C] Batch insert failed at offset ${i}:`, err.message);
        throw err;
      }
    }
    console.log(`[phase3e3-C] ✓ All ${insertedCount} rows inserted`);

    // ========================================================================
    // PHASE D: SANITY GATES (READ-ONLY, SET-BASED)
    // ========================================================================
    console.log('[phase3e3-D] Running sanity gates...');

    // Gate 1: Count match
    const mapCountAfterInsert = await withRetry(async () => {
      const ent = base44.asServiceRole.entities.CompanySkuMap;
      if (typeof ent.count === 'function') {
        return await ent.count({ companyId });
      }
      const rows = await ent.filter({ companyId }, undefined, 100000);
      return Array.isArray(rows) ? rows.length : 0;
    });

    if (mapCountAfterInsert !== catalogCount) {
      return Response.json({
        pass: false,
        error: 'COUNT_MISMATCH',
        catalogCount,
        mapCountAfterInsert,
      }, { status: 400 });
    }
    console.log(`[phase3e3-D] ✓ Gate 1: Count match (${mapCountAfterInsert}=${catalogCount})`);

    // Gate 2: Duplicate prevention (set-based)
    const mapRows = await withRetry(async () => {
      const ent = base44.asServiceRole.entities.CompanySkuMap;
      const rows = await ent.filter({ companyId }, undefined, 100000);
      return Array.isArray(rows) ? rows : [];
    });

    const uckMap = new Map();
    const dupes = [];
    for (const row of mapRows) {
      const uck = row.uck;
      if (uckMap.has(uck)) {
        dupes.push({ uck, id: row.id, existing: uckMap.get(uck) });
      } else {
        uckMap.set(uck, row.id);
      }
    }

    const dupesCount = dupes.length;
    if (dupesCount > 0) {
      return Response.json({
        pass: false,
        error: 'DUPLICATE_UCKEYS',
        dupesCount,
        dupes: dupes.slice(0, 10),
      }, { status: 400 });
    }
    console.log('[phase3e3-D] ✓ Gate 2: No duplicate UCKs');

    // Gate 3: Orphan catalogId check (set-based, NO loops)
    const catalogIds = new Set(catalog.map((c) => c.id));
    const mappedCatalogIds = new Set(mapRows.map((m) => m.materialCatalogId));
    const missingIds = Array.from(mappedCatalogIds).filter((id) => !catalogIds.has(id));
    const missingIdsCount = missingIds.length;

    if (missingIdsCount > 0) {
      return Response.json({
        pass: false,
        error: 'ORPHAN_CATALOG_IDS',
        missingIdsCount,
        missingIds: missingIds.slice(0, 10),
      }, { status: 400 });
    }
    console.log('[phase3e3-D] ✓ Gate 3: No orphan catalogIds');

    // Gate 4: Key equality check (set-based lookup)
    const catalogById = new Map(catalog.map((c) => [c.id, c.canonical_key]));
    const mismatches = mapRows.filter((m) => {
      const expectedKey = catalogById.get(m.materialCatalogId);
      return expectedKey && m.uck !== expectedKey;
    });

    if (mismatches.length > 0) {
      return Response.json({
        pass: false,
        error: 'KEY_EQUALITY_MISMATCH',
        mismatchCount: mismatches.length,
        samples: mismatches.slice(0, 10).map((m) => ({
          id: m.id,
          uck: m.uck,
          expected: catalogById.get(m.materialCatalogId),
        })),
      }, { status: 400 });
    }
    console.log('[phase3e3-D] ✓ Gate 4: All keys match catalog');

    // ========================================================================
    // SUCCESS
    // ========================================================================
    console.log('[phase3e3] ✓ CUTOVER COMPLETE');

    return Response.json({
      pass: true,
      catalogCount,
      mapCountAfterDelete,
      mapCountAfterInsert,
      insertedCount,
      dupesCount,
      missingIdsCount,
      violationsCount,
    });
  } catch (err) {
    console.error('[phase3e3] Fatal error:', err?.message);
    return Response.json({
      pass: false,
      error: 'FATAL',
      message: err?.message || String(err),
    }, { status: 500 });
  }
});