import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AUDIT: What IS Currently Mapped
 * Shows all existing CompanySkuMappings and MaterialCatalog entries
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company
    const companies = await base44.entities.CompanySettings.filter({});
    const company = companies[0];
    if (!company) {
      return Response.json({ error: 'No company found' }, { status: 400 });
    }

    const companyId = company.id;

    // Fetch all mappings, catalog, and materials
    const [mappings, catalog, allMaterials] = await Promise.all([
      base44.entities.CompanySkuMap.filter({ companyId }, '', 500),
      base44.entities.MaterialCatalog.filter({ active: true }, '', 500),
      base44.entities.MaterialCatalog.filter({}, '', 500)
    ]);

    // Organize catalog by category
    const catalogByCategory = {};
    for (const item of catalog) {
      if (!catalogByCategory[item.category]) {
        catalogByCategory[item.category] = [];
      }
      catalogByCategory[item.category].push({
        id: item.id,
        crm_name: item.crm_name,
        canonical_key: item.canonical_key,
        material_type: item.material_type,
        finish: item.finish,
        unit: item.unit,
        active: item.active,
        cost: item.cost
      });
    }

    // Organize mappings by material type
    const mappingsByMaterial = {};
    for (const mapping of mappings) {
      if (!mappingsByMaterial[mapping.materialType]) {
        mappingsByMaterial[mapping.materialType] = [];
      }
      mappingsByMaterial[mapping.materialType].push({
        uck: mapping.uck,
        displayName: mapping.displayName,
        status: mapping.status,
        materialCatalogId: mapping.materialCatalogId
      });
    }

    // Extract fence system keywords
    const fenceTypes = new Set();
    const materials = new Set();
    const finishes = new Set();
    for (const item of catalog) {
      if (item.keywords) {
        item.keywords.forEach(k => {
          if (['chainlink', 'vinyl', 'wood', 'aluminum'].includes(k)) {
            materials.add(k);
          }
          if (['4', '5', '6', '8', '10', '12', 'gate', 'post', 'panel', 'rail'].includes(k)) {
            fenceTypes.add(k);
          }
        });
      }
      if (item.finish) finishes.add(item.finish);
    }

    return Response.json({
      status: 'EXISTING_MAPPING_AUDIT',
      timestamp: new Date().toISOString(),
      company: company.companyName,
      summary: {
        totalMappings: mappings.length,
        totalCatalogItems: catalog.length,
        totalCatalogItemsAllStatuses: allMaterials.length,
        categoriesCovered: Object.keys(catalogByCategory).length
      },
      mappingsByMaterial,
      catalogByCategory,
      systemInventory: {
        materialTypesInCatalog: Array.from(new Set(catalog.map(c => c.material_type))),
        heightsDetected: Array.from(new Set(catalog.flatMap(c => c.keywords || []).filter(k => ['4', '5', '6', '8', '10', '12'].includes(k)))).sort(),
        finishesAvailable: Array.from(finishes).sort(),
        categoriesPopulated: Object.keys(catalogByCategory).sort()
      },
      verdict: {
        isSystemSeeded: catalog.length > 0,
        hasGateMappings: mappings.some(m => m.uck.includes('gate')),
        hasPanelMappings: mappings.some(m => m.uck.includes('panel')),
        hasFenceMappings: mappings.some(m => m.uck.includes('fence')),
        mappingCompleteness: `${Math.round((mappings.length / Math.max(catalog.length, 1)) * 100)}%`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});