import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ============================================================================
    // PART A — READ ONLY: IDENTIFY BROKEN MAP ROWS
    // ============================================================================
    console.log('[PART A] Identifying broken map rows...');
    
    const brokenRows = [];
    let skip = 0;
    
    while (true) {
      const page = await base44.asServiceRole.entities.CompanySkuMap.filter(
        { companyId: 'PrivacyFenceCo49319' },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;

      for (const row of page) {
        // Check if materialCatalogId exists in MaterialCatalog
        try {
          await base44.asServiceRole.entities.MaterialCatalog.get(row.materialCatalogId);
        } catch (err) {
          brokenRows.push({
            companySkuMapId: row.id,
            uck: row.uck,
            materialCatalogId: row.materialCatalogId
          });
        }
      }
      skip += 100;
      if (page.length < 100) break;
    }

    const brokenCount = brokenRows.length;
    console.log(`[PART A] Found ${brokenCount} broken rows`);

    // ============================================================================
    // PART B — WRITE: REPAIR BROKEN materialCatalogId LINKS
    // ============================================================================
    console.log('[PART B] Repairing broken links...');
    
    let repairedCount = 0;
    const missingCatalogForUck = [];
    const ambiguousCatalogForUck = [];

    // First, load all active catalog items into a map
    const catalogByKey = new Map();
    let catSkip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        100,
        catSkip
      );
      if (page.length === 0) break;
      for (const item of page) {
        if (!catalogByKey.has(item.canonical_key)) {
          catalogByKey.set(item.canonical_key, []);
        }
        catalogByKey.get(item.canonical_key).push(item);
      }
      catSkip += 100;
      if (page.length < 100) break;
    }

    for (const broken of brokenRows) {
      const candidates = catalogByKey.get(broken.uck) || [];
      
      if (candidates.length === 0) {
        missingCatalogForUck.push(broken.uck);
      } else if (candidates.length === 1) {
        // Repair the link
        const catalogItem = candidates[0];
        await base44.asServiceRole.entities.CompanySkuMap.update(broken.companySkuMapId, {
          materialCatalogId: catalogItem.id
        });
        repairedCount++;
      } else if (candidates.length > 1) {
        ambiguousCatalogForUck.push({
          uck: broken.uck,
          foundCount: candidates.length
        });
      }
    }

    console.log(`[PART B] Repaired=${repairedCount}, Missing=${missingCatalogForUck.length}, Ambiguous=${ambiguousCatalogForUck.length}`);

    // ============================================================================
    // PART C — WRITE: NORMALIZE 3 ILLEGAL KEYS
    // ============================================================================
    console.log('[PART C] Normalizing illegal keys...');
    
    const keyMappings = [
      { old: 'chainlink_rail_top_10.5ft_black', new: 'chainlink_rail_top_10_5ft_black' },
      { old: 'aluminum_panel_pacific_4.5x6', new: 'aluminum_panel_pacific_4_5x6' },
      { old: 'chainlink_hardware_cane_bolt_galvanized', new: 'chainlink_cane_bolt_galv' }
    ];

    let updatedCatalogKeysCount = 0;
    let updatedMapKeysCount = 0;
    const failures = [];

    for (const mapping of keyMappings) {
      try {
        // Find and update MaterialCatalog records
        const catalogItems = await base44.asServiceRole.entities.MaterialCatalog.filter(
          { canonical_key: mapping.old },
          undefined,
          100
        );

        for (const item of catalogItems) {
          await base44.asServiceRole.entities.MaterialCatalog.update(item.id, {
            canonical_key: mapping.new
          });
          updatedCatalogKeysCount++;
        }

        // Find and update CompanySkuMap records for PrivacyFenceCo49319
        const mapItems = await base44.asServiceRole.entities.CompanySkuMap.filter(
          { companyId: 'PrivacyFenceCo49319', uck: mapping.old },
          undefined,
          100
        );

        for (const item of mapItems) {
          await base44.asServiceRole.entities.CompanySkuMap.update(item.id, {
            uck: mapping.new
          });
          updatedMapKeysCount++;
        }
      } catch (err) {
        failures.push({
          mapping: `${mapping.old} -> ${mapping.new}`,
          error: err.message
        });
      }
    }

    console.log(`[PART C] Updated catalog keys=${updatedCatalogKeysCount}, map keys=${updatedMapKeysCount}, failures=${failures.length}`);

    // ============================================================================
    // PART D — READ ONLY: RE-RUN PHASE 3C SANITY GATE
    // ============================================================================
    console.log('[PART D] Running sanity gate...');
    
    // Count active catalog
    let activeCatalogCount = 0;
    skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.MaterialCatalog.filter(
        { active: true },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      activeCatalogCount += page.length;
      skip += 100;
      if (page.length < 100) break;
    }

    // Count maps
    let mapCount = 0;
    skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.CompanySkuMap.filter(
        { companyId: 'PrivacyFenceCo49319' },
        undefined,
        100,
        skip
      );
      if (page.length === 0) break;
      mapCount += page.length;
      skip += 100;
      if (page.length < 100) break;
    }

    // Validation checks
    let missingCatalogId = 0;
    let missingCatalogRow = 0;
    let inactiveCatalogRow = 0;
    let keyMismatchCount = 0;
    let nullCostCount = 0;
    let nullUnitCount = 0;
    let badPackageQtyCount = 0;

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
      skip += 100;
      if (page.length < 100) break;
    }

    for (const map of allMaps) {
      if (!map.materialCatalogId) {
        missingCatalogId++;
        continue;
      }

      let catalogRecord = null;
      try {
        catalogRecord = await base44.asServiceRole.entities.MaterialCatalog.get(map.materialCatalogId);
      } catch (err) {
        missingCatalogRow++;
        continue;
      }

      if (!catalogRecord.active) {
        inactiveCatalogRow++;
        continue;
      }

      if (catalogRecord.canonical_key !== map.uck) {
        keyMismatchCount++;
      }

      if (catalogRecord.cost === null || catalogRecord.cost === undefined) {
        nullCostCount++;
      }

      if (!catalogRecord.unit || catalogRecord.unit.trim() === '') {
        nullUnitCount++;
      }

      if (catalogRecord.package_qty === null || catalogRecord.package_qty === undefined || catalogRecord.package_qty <= 0) {
        badPackageQtyCount++;
      }
    }

    // UCK constitution check
    const forbiddenCoatings = ['galvanized', 'black_vinyl', 'vinyl_coated'];
    const validCharRegex = /^[a-z0-9_x]+$/;
    let violationCount = 0;
    const violatingSamples = [];

    for (const map of allMaps) {
      const uck = map.uck || '';
      
      if (uck !== uck.toLowerCase()) {
        violationCount++;
        if (violatingSamples.length < 10) {
          violatingSamples.push({ uck, reason: 'contains uppercase' });
        }
        continue;
      }

      if (!validCharRegex.test(uck)) {
        violationCount++;
        if (violatingSamples.length < 10) {
          violatingSamples.push({ uck, reason: 'invalid characters' });
        }
        continue;
      }

      let hasForbidden = false;
      for (const forbidden of forbiddenCoatings) {
        if (uck.includes(forbidden)) {
          hasForbidden = true;
          break;
        }
      }

      if (hasForbidden) {
        violationCount++;
        if (violatingSamples.length < 10) {
          violatingSamples.push({ uck, reason: 'forbidden coating word' });
        }
      }
    }

    console.log(`[PART D] Sanity check complete: violations=${violationCount}`);

    // ============================================================================
    // FINAL RESPONSE
    // ============================================================================
    const allRepairsPass = repairedCount > 0 || brokenCount === 0;
    const allChecksPass = missingCatalogId === 0 && 
                          missingCatalogRow === 0 && 
                          inactiveCatalogRow === 0 && 
                          keyMismatchCount === 0 && 
                          nullCostCount === 0 && 
                          nullUnitCount === 0 && 
                          badPackageQtyCount === 0 &&
                          violationCount === 0;

    return Response.json({
      success: allRepairsPass && allChecksPass,
      partA: {
        brokenCount,
        listBroken: brokenRows.slice(0, 20)
      },
      partB: {
        repairedCount,
        missingCatalogForUckCount: missingCatalogForUck.length,
        missingCatalogForUckList: missingCatalogForUck.slice(0, 20),
        ambiguousCatalogForUckCount: ambiguousCatalogForUck.length,
        ambiguousCatalogForUckList: ambiguousCatalogForUck.slice(0, 20)
      },
      partC: {
        updatedCatalogKeysCount,
        updatedMapKeysCount,
        failuresCount: failures.length,
        failuresSamples: failures.slice(0, 5)
      },
      partD: {
        activeCatalogCount,
        mapCount,
        missingCatalogId,
        missingCatalogRow,
        inactiveCatalogRow,
        keyMismatchCount,
        nullCostCount,
        nullUnitCount,
        badPackageQtyCount,
        violationCount,
        violatingSamples,
        allChecksPass
      }
    });
  } catch (error) {
    console.error('[REPAIR] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});