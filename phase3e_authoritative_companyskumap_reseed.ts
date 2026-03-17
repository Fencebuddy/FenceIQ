import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ============================================================================
    // PART A — READ ONLY: BUILD AUTHORITATIVE SEED LIST
    // ============================================================================
    console.log('[PART A] Building authoritative seed list from live catalog...');
    
    const allActiveCatalog = [];
    const distinctKeys = new Set();
    let skip = 0;

    while (true) {
      const page = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      allActiveCatalog.push(...page);
      for (const item of page) {
        distinctKeys.add(item.canonical_key);
      }
      skip += 100;
      if (page.length < 100) break;
    }

    const activeCatalogCount = allActiveCatalog.length;
    const distinctCanonicalKeyCount = distinctKeys.size;
    const sampleKeys = Array.from(distinctKeys).slice(0, 10);

    console.log(`[PART A] activeCatalogCount=${activeCatalogCount}, distinctKeys=${distinctCanonicalKeyCount}`);

    // ============================================================================
    // PART B — WRITE: WIPE COMPANY MAP FOR TARGET COMPANY (VIA CASCADING UPDATES)
    // ============================================================================
    console.log('[PART B] Preparing to replace CompanySkuMap for PrivacyFenceCo49319...');
    
    // Count existing before clear
    let countBefore = 0;
    skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.CompanySkuMap.filter(
        { companyId: 'PrivacyFenceCo49319' },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      countBefore += page.length;
      skip += 100;
      if (page.length < 100) break;
    }

    console.log(`[PART B] Existing map rows for PrivacyFenceCo49319: ${countBefore}`);

    // ============================================================================
    // PART C — WRITE: INSERT FROM LIVE CATALOG (NO OTHER SOURCE)
    // ============================================================================
    console.log('[PART C] Inserting CompanySkuMap rows from live catalog...');
    
    let insertedCount = 0;
    let batchCount = 0;
    const insertBatch = [];
    const batchSize = 100;

    for (const mc of allActiveCatalog) {
      const mapRow = {
        companyId: 'PrivacyFenceCo49319',
        uck: mc.canonical_key,
        materialCatalogId: mc.id,
        materialCatalogName: mc.crm_name,
        materialType: mc.material_type,
        status: 'mapped',
        notes: 'Phase 3E authoritative reseed from live active MaterialCatalog on 2026-02-28'
      };

      insertBatch.push(mapRow);

      if (insertBatch.length >= batchSize) {
        await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(insertBatch);
        insertedCount += insertBatch.length;
        batchCount++;
        insertBatch.length = 0;
      }
    }

    // Insert remaining rows
    if (insertBatch.length > 0) {
      await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(insertBatch);
      insertedCount += insertBatch.length;
      batchCount++;
    }

    console.log(`[PART C] Inserted=${insertedCount}, Batches=${batchCount}`);

    // ============================================================================
    // PART D — READ ONLY: SANITY GATE
    // ============================================================================
    console.log('[PART D] Running sanity gate...');
    
    // Count current maps
    let mapCount = 0;
    skip = 0;
    const allMaps = [];

    while (true) {
      const page = await base44.asServiceRole.entities.CompanySkuMap.filter(
        { companyId: 'PrivacyFenceCo49319' },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      allMaps.push(...page);
      mapCount += page.length;
      skip += 100;
      if (page.length < 100) break;
    }

    // Check for broken references
    let missingCatalogRow = 0;
    let missingCatalogId = 0;

    for (const map of allMaps) {
      if (!map.materialCatalogId) {
        missingCatalogId++;
        continue;
      }

      try {
        await base44.asServiceRole.entities.MaterialCatalog.get(map.materialCatalogId);
      } catch (err) {
        missingCatalogRow++;
      }
    }

    // Build maps for comparison
    const catalogKeySet = new Set();
    const catalogIdSet = new Set();
    for (const cat of allActiveCatalog) {
      catalogKeySet.add(cat.canonical_key);
      catalogIdSet.add(cat.id);
    }

    const mapKeySet = new Set();
    for (const map of allMaps) {
      mapKeySet.add(map.uck);
    }

    // Find extra and missing keys
    let missingByKey = 0;
    const extraMapKeys = [];
    const missingMapKeys = [];

    // Check for extra keys in map (should be 0)
    for (const uck of mapKeySet) {
      if (!catalogKeySet.has(uck)) {
        extraMapKeys.push(uck);
      }
    }

    // Check for missing keys in map (should be 0)
    for (const key of catalogKeySet) {
      if (!mapKeySet.has(key)) {
        missingMapKeys.push(key);
        missingByKey++;
      }
    }

    const allCheckPass = insertedCount === activeCatalogCount &&
                         missingCatalogRow === 0 &&
                         missingCatalogId === 0 &&
                         missingByKey === 0 &&
                         extraMapKeys.length === 0 &&
                         missingMapKeys.length === 0;

    console.log(`[PART D] Sanity checks: mapCount=${mapCount}, missingCatalogRow=${missingCatalogRow}, missingByKey=${missingByKey}, extraKeys=${extraMapKeys.length}, missingKeys=${missingMapKeys.length}`);

    // ============================================================================
    // FINAL RESPONSE
    // ============================================================================
    return Response.json({
      success: allCheckPass,
      partA: {
        activeCatalogCount,
        distinctCanonicalKeyCount,
        sampleKeys
      },
      partB: {
        deletedCount
      },
      partC: {
        insertedCount,
        batchCount
      },
      partD: {
        mapCount,
        missingCatalogRow,
        missingCatalogId,
        missingByKey,
        extraMapKeysCount: extraMapKeys.length,
        extraMapKeysSample: extraMapKeys.slice(0, 25),
        missingMapKeysCount: missingMapKeys.length,
        missingMapKeysSample: missingMapKeys.slice(0, 25),
        allCheckPass
      }
    });
  } catch (error) {
    console.error('[PHASE 3E] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});