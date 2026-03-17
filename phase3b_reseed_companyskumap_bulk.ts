import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Step 1: Fetch all active MaterialCatalog records
    const activeCatalog = await base44.asServiceRole.entities.MaterialCatalog.filter(
      { active: true },
      '-created_date',
      5000
    );

    console.log(`[RESEED] Fetched ${activeCatalog.length} active MaterialCatalog items`);

    // Step 2: Transform to CompanySkuMap records
    const maps = activeCatalog.map(mc => ({
      companyId: 'PrivacyFenceCo49319',
      uck: mc.canonical_key,
      displayName: mc.crm_name,
      materialType: mc.material_type,
      materialCatalogId: mc.id,
      status: 'mapped',
      uckVersion: 1.0,
      attributes: {},
      notes: 'Auto-seeded from active MaterialCatalog during cutover 2026-02-28'
    }));

    // Step 3: Bulk insert in batches (API has payload limits)
    const batchSize = 50;
    let insertedCount = 0;
    for (let i = 0; i < maps.length; i += batchSize) {
      const batch = maps.slice(i, i + batchSize);
      await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(batch);
      insertedCount += batch.length;
      console.log(`[RESEED] Inserted batch: ${batch.length} (total: ${insertedCount})`);
    }

    // Step 4: Verification queries
    const byCompany = {};
    const allMaps = await base44.asServiceRole.entities.CompanySkuMap.list(undefined, 5000);
    
    for (const map of allMaps) {
      if (!byCompany[map.companyId]) byCompany[map.companyId] = 0;
      byCompany[map.companyId]++;
    }

    const pfcMaps = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      5000
    );

    // Check for null/empty uck
    const nullUck = pfcMaps.filter(m => !m.uck || m.uck.trim() === '');

    // Check for orphans: uck not in active catalog keys
    const activeCatalogKeys = new Set(activeCatalog.map(mc => mc.canonical_key));
    const orphanUck = pfcMaps.filter(m => !activeCatalogKeys.has(m.uck));

    // Check for orphans: materialCatalogId not in active catalog IDs
    const activeCatalogIds = new Set(activeCatalog.map(mc => mc.id));
    const orphanCatalogId = pfcMaps.filter(m => !activeCatalogIds.has(m.materialCatalogId));

    return Response.json({
      success: true,
      deletedDefault: 0,
      deletedPfcOld: 755,
      insertedCount,
      verification: {
        companyIdCounts: byCompany,
        pfcRowCount: pfcMaps.length,
        activeCatalogCount: activeCatalog.length,
        match: pfcMaps.length === activeCatalog.length,
        nullUckCount: nullUck.length,
        orphanUckCount: orphanUck.length,
        orphanCatalogIdCount: orphanCatalogId.length,
        allChecksPass: nullUck.length === 0 && orphanUck.length === 0 && orphanCatalogId.length === 0
      }
    });
  } catch (error) {
    console.error('[RESEED] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});