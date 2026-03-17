import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // STEP 0: READ COUNTS (NO WRITES)
    let activeCatalogCount = 0;
    let existingMapCount = 0;
    
    // Count active catalog items
    const catalogCheck = await base44.asServiceRole.entities.MaterialCatalog.filter(
      { active: true },
      undefined,
      1
    );
    
    // Use a workaround: fetch all to count (or estimate from first fetch)
    let catalogPage = await base44.asServiceRole.entities.MaterialCatalog.filter(
      { active: true },
      undefined,
      100,
      0
    );
    activeCatalogCount = catalogPage.length;
    let catalogSkip = 100;
    
    while (catalogPage.length === 100) {
      catalogPage = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        100,
        catalogSkip
      );
      if (catalogPage.length > 0) {
        activeCatalogCount += catalogPage.length;
        catalogSkip += 100;
      }
    }

    // Count existing maps for PrivacyFenceCo49319
    const existingMaps = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      1
    );
    existingMapCount = existingMaps.length > 0 ? 1 : 0; // Just check if any exist

    console.log(`[STEP 0] activeCatalogCount=${activeCatalogCount}, existingMapCount=${existingMaps.length}`);

    // STEP 1: HARD RESET MAPPING SCOPE
    let deletedCount = 0;
    let deletedDefaultCount = 0;

    // Delete all existing maps for PrivacyFenceCo49319
    const mapsToDelete = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      1000
    );
    
    for (const map of mapsToDelete) {
      await base44.asServiceRole.entities.CompanySkuMap.delete(map.id);
      deletedCount++;
    }

    // Also delete default scope
    const defaultMaps = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'default' },
      undefined,
      1000
    );
    
    for (const map of defaultMaps) {
      await base44.asServiceRole.entities.CompanySkuMap.delete(map.id);
      deletedDefaultCount++;
    }

    console.log(`[STEP 1] Deleted ${deletedCount} from PrivacyFenceCo49319, ${deletedDefaultCount} from default`);

    // STEP 2: BULK RESEED FROM CATALOG
    let fetchedTotal = 0;
    let insertedTotal = 0;
    let batchCount = 0;
    const errors = [];
    let skip = 0;
    const pageSize = 100;
    const batchInsertSize = 100;
    let insertBatch = [];

    while (true) {
      const page = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        pageSize,
        skip
      );

      if (page.length === 0) break;

      for (const mc of page) {
        const mapRow = {
          companyId: 'PrivacyFenceCo49319',
          uck: mc.canonical_key,
          displayName: mc.crm_name,
          materialType: mc.material_type,
          materialCatalogId: mc.id,
          status: 'mapped',
          uckVersion: 1.0,
          attributes: {},
          notes: 'Auto-seeded from active MaterialCatalog during cutover 2026-02-28',
          lastSeenAt: new Date().toISOString()
        };

        insertBatch.push(mapRow);

        if (insertBatch.length >= batchInsertSize) {
          try {
            await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(insertBatch);
            insertedTotal += insertBatch.length;
            batchCount++;
            insertBatch = [];
          } catch (err) {
            errors.push({
              batch: batchCount,
              error: err.message,
              rowCount: insertBatch.length
            });
            insertBatch = [];
            if (errors.length > 3) {
              // Stop after collecting 3 error samples
              break;
            }
          }
        }

        fetchedTotal++;
      }

      skip += pageSize;
      if (page.length < pageSize) break;
    }

    // Insert remaining rows
    if (insertBatch.length > 0) {
      try {
        await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(insertBatch);
        insertedTotal += insertBatch.length;
        batchCount++;
      } catch (err) {
        errors.push({
          batch: batchCount,
          error: err.message,
          rowCount: insertBatch.length
        });
      }
    }

    console.log(`[STEP 2] Fetched=${fetchedTotal}, Inserted=${insertedTotal}, Batches=${batchCount}`);

    // STEP 3: POST-VERIFY
    const seededRows = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      5000
    );
    const seededCount = seededRows.length;

    // Get all active catalog keys
    let activeCatalogKeys = new Set();
    let activeCatalogIds = new Set();
    skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      for (const mc of page) {
        activeCatalogKeys.add(mc.canonical_key);
        activeCatalogIds.add(mc.id);
      }
      skip += 100;
      if (page.length < 100) break;
    }

    // Check for orphans
    const orphanUck = seededRows.filter(m => !activeCatalogKeys.has(m.uck));
    const orphanCatalogId = seededRows.filter(m => !activeCatalogIds.has(m.materialCatalogId));
    const blankUck = seededRows.filter(m => !m.uck || m.uck.trim() === '');

    console.log(`[STEP 3] Seeded=${seededCount}, OrphanUck=${orphanUck.length}, OrphanId=${orphanCatalogId.length}, BlankUck=${blankUck.length}`);

    // STEP 4: RETURN SUMMARY COUNTS
    return Response.json({
      success: true,
      activeCatalogCount,
      deletedCount,
      deletedDefaultCount,
      fetchedTotal,
      insertedTotal,
      batchCount,
      seededCount,
      orphanUckCount: orphanUck.length,
      orphanCatalogIdCount: orphanCatalogId.length,
      blankUckCount: blankUck.length,
      matchesExpected: seededCount === activeCatalogCount,
      errorCount: errors.length,
      errorSamples: errors.slice(0, 3)
    });
  } catch (error) {
    console.error('[RESEED] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});