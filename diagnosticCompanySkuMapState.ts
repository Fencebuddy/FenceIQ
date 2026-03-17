import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company settings
    const settings = await base44.entities.CompanySettings.filter({});
    const companyId = settings?.[0]?.companyId || null;

    // Get company-specific maps only (faster)
    const companyMaps = companyId 
      ? await base44.entities.CompanySkuMap.filter({ companyId })
      : [];

    // Analyze mappingKey presence
    const missingMappingKey = companyMaps.filter(m => !m.mappingKey).length;
    const hasMappingKey = companyMaps.filter(m => m.mappingKey).length;
    const lockedMaps = companyMaps.filter(m => m.locked === true).length;

    // Get MaterialCatalog count (just count, not full list)
    const catalog = await base44.entities.MaterialCatalog.filter({}, undefined, 1);

    // Sample data
    const sampleCompanyMap = companyMaps[0] || null;

    return Response.json({
      status: 'DIAGNOSTIC_COMPLETE',
      company: {
        companyId,
        settingsCount: settings.length
      },
      companySkuMap: {
        forThisCompany: companyMaps.length,
        missingMappingKey,
        hasMappingKey,
        lockedCount: lockedMaps
      },
      catalog: {
        count: catalog.length
      },
      sample: sampleCompanyMap ? {
        id: sampleCompanyMap.id,
        uck: sampleCompanyMap.uck,
        mappingKey: sampleCompanyMap.mappingKey || 'MISSING',
        locked: sampleCompanyMap.locked ?? null
      } : 'NO_MAPS',
      diagnosis: generateDiagnosis(companyMaps, catalog.length)
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

function generateDiagnosis(companyMaps, catalogCount) {
  if (companyMaps.length === 0) {
    return 'NUKE_AND_REBUILD: No CompanySkuMap entries exist. Must auto-create all mappings.';
  }

  if (companyMaps.filter(m => !m.mappingKey).length > 0) {
    return 'REBUILD_MAPPING_KEYS: CompanySkuMap exists but missing mappingKey hashes. Rebuild required.';
  }

  if (catalogCount === 0) {
    return 'MISSING_CATALOG: MaterialCatalog is empty. Cannot resolve without catalog.';
  }

  return 'MAPS_EXIST_WITH_KEYS: CompanySkuMap looks OK. Resolver matching logic may be broken.';
}