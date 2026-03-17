import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // STEP 1: COUNTS (READ ONLY)
    let activeCatalogCount = 0;
    let skip = 0;
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

    console.log(`[STEP 1] activeCatalogCount=${activeCatalogCount}, mapCount=${mapCount}`);

    // STEP 2: FULL JOIN VALIDATION (READ ONLY)
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
      // Check materialCatalogId exists
      if (!map.materialCatalogId) {
        missingCatalogId++;
        continue;
      }

      // Fetch the catalog record
      let catalogRecord = null;
      try {
        // Try to fetch by ID directly
        catalogRecord = await base44.asServiceRole.entities.MaterialCatalog.get(map.materialCatalogId);
      } catch (err) {
        missingCatalogRow++;
        continue;
      }

      // Check if active
      if (!catalogRecord.active) {
        inactiveCatalogRow++;
        continue;
      }

      // Check canonical_key == uck
      if (catalogRecord.canonical_key !== map.uck) {
        keyMismatchCount++;
      }

      // Check cost
      if (catalogRecord.cost === null || catalogRecord.cost === undefined) {
        nullCostCount++;
      }

      // Check unit
      if (!catalogRecord.unit || catalogRecord.unit.trim() === '') {
        nullUnitCount++;
      }

      // Check package_qty
      if (catalogRecord.package_qty === null || catalogRecord.package_qty === undefined || catalogRecord.package_qty <= 0) {
        badPackageQtyCount++;
      }
    }

    console.log(`[STEP 2] Missing ID=${missingCatalogId}, Missing Row=${missingCatalogRow}, Inactive=${inactiveCatalogRow}, KeyMismatch=${keyMismatchCount}, NullCost=${nullCostCount}, NullUnit=${nullUnitCount}, BadPkgQty=${badPackageQtyCount}`);

    // STEP 3: CONSTITUTION TOKEN SCAN (READ ONLY)
    const forbiddenCoatings = ['galvanized', 'black_vinyl', 'vinyl_coated'];
    const validCharRegex = /^[a-z0-9_x]+$/;
    let violationCount = 0;
    const violatingSamples = [];

    for (const map of allMaps) {
      const uck = map.uck || '';
      
      // Check for lowercase only
      if (uck !== uck.toLowerCase()) {
        violationCount++;
        if (violatingSamples.length < 10) {
          violatingSamples.push({ uck, reason: 'contains uppercase' });
        }
        continue;
      }

      // Check allowed chars (a-z 0-9 _ x)
      if (!validCharRegex.test(uck)) {
        violationCount++;
        if (violatingSamples.length < 10) {
          violatingSamples.push({ uck, reason: 'invalid characters (spaces, dots, hyphens, etc)' });
        }
        continue;
      }

      // Check forbidden coating words
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
          violatingSamples.push({ uck, reason: 'contains forbidden coating word' });
        }
      }
    }

    console.log(`[STEP 3] Violations=${violationCount}`);

    // FINAL SANITY CHECK
    const allChecksPass = missingCatalogId === 0 && 
                          missingCatalogRow === 0 && 
                          inactiveCatalogRow === 0 && 
                          keyMismatchCount === 0 && 
                          nullCostCount === 0 && 
                          nullUnitCount === 0 && 
                          badPackageQtyCount === 0 &&
                          violationCount === 0;

    return Response.json({
      success: allChecksPass,
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
    });
  } catch (error) {
    console.error('[SANITY GATE] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});