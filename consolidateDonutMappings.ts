/**
 * DONUT MAPPING CONSOLIDATION
 * 
 * Collapses all legacy donut mappings (with height/system/color suffixes)
 * into a single global mapping: vinyl_hardware_nodig_donut
 * 
 * Strategy:
 * - Find all donut mappings (any suffix)
 * - Choose most common materialCatalogId (or most recent)
 * - Create global mapping if it doesn't exist
 * - Mark legacy mappings as deprecated
 * - Cleanup stale unresolved donut rows
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { companyId, mode = 'dry_run' } = await req.json();
    
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }
    
    console.log('[ConsolidateDonutMappings] Starting:', { companyId, mode });
    
    // Fetch all donut mappings
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    
    const donutMappings = allMappings.filter(m => 
      m.uck?.startsWith('vinyl_hardware_nodig_donut')
    );
    
    const globalMapping = donutMappings.find(m => m.uck === 'vinyl_hardware_nodig_donut');
    const legacyMappings = donutMappings.filter(m => m.uck !== 'vinyl_hardware_nodig_donut');
    
    console.log('[ConsolidateDonutMappings] Found:', {
      total: donutMappings.length,
      global: globalMapping ? 1 : 0,
      legacy: legacyMappings.length
    });
    
    const report = {
      globalMappingExists: !!globalMapping,
      legacyCount: legacyMappings.length,
      chosenMaterialCatalogId: null,
      chosenFrom: null,
      deprecatedCount: 0,
      cleanupCount: 0
    };
    
    // If global mapping doesn't exist, create it
    if (!globalMapping && legacyMappings.length > 0) {
      // Find most common materialCatalogId
      const catalogIdCounts = new Map();
      legacyMappings.forEach(m => {
        const id = m.materialCatalogId;
        catalogIdCounts.set(id, (catalogIdCounts.get(id) || 0) + 1);
      });
      
      let chosenId = null;
      let maxCount = 0;
      for (const [id, count] of catalogIdCounts) {
        if (count > maxCount) {
          maxCount = count;
          chosenId = id;
        }
      }
      
      // Fallback: use most recent
      if (!chosenId && legacyMappings.length > 0) {
        const sorted = [...legacyMappings].sort((a, b) => 
          new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
        );
        chosenId = sorted[0].materialCatalogId;
      }
      
      const chosenMapping = legacyMappings.find(m => m.materialCatalogId === chosenId);
      
      report.chosenMaterialCatalogId = chosenId;
      report.chosenFrom = maxCount > 1 ? `majority (${maxCount}/${legacyMappings.length})` : 'most_recent';
      
      console.log('[ConsolidateDonutMappings] Chosen materialCatalogId:', chosenId, 'from', report.chosenFrom);
      
      if (mode === 'commit') {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId,
          uck: 'vinyl_hardware_nodig_donut',
          materialCatalogId: chosenId,
          materialCatalogName: chosenMapping?.materialCatalogName || 'No-Dig Donut',
          materialType: 'vinyl',
          status: 'mapped',
          attributes: {
            migrationMeta: {
              source: 'donut_global_migration_v1',
              derivedFrom: report.chosenFrom,
              legacyCount: legacyMappings.length,
              migratedAt: new Date().toISOString()
            }
          }
        });
        
        console.log('[ConsolidateDonutMappings] Created global donut mapping');
      }
    } else if (globalMapping) {
      report.chosenMaterialCatalogId = globalMapping.materialCatalogId;
      report.chosenFrom = 'existing_global';
    }
    
    // Mark legacy mappings as deprecated
    if (mode === 'commit' && legacyMappings.length > 0) {
      for (const legacy of legacyMappings) {
        await base44.asServiceRole.entities.CompanySkuMap.update(legacy.id, {
          status: 'unmapped',
          notes: '[DEPRECATED] Consolidated to global donut mapping',
          attributes: {
            ...(legacy.attributes || {}),
            deprecated: true,
            deprecatedAt: new Date().toISOString(),
            consolidatedTo: 'vinyl_hardware_nodig_donut'
          }
        });
        report.deprecatedCount++;
      }
    }
    
    // Cleanup stale unresolved donut rows
    if (mode === 'commit') {
      const unmappedRows = await base44.asServiceRole.entities.CompanySkuMap.filter({
        companyId,
        status: 'unmapped'
      });
      
      const donutUnmapped = unmappedRows.filter(m => 
        m.uck?.startsWith('vinyl_hardware_nodig_donut')
      );
      
      for (const unmapped of donutUnmapped) {
        await base44.asServiceRole.entities.CompanySkuMap.delete(unmapped.id);
        report.cleanupCount++;
      }
    }
    
    console.log('[ConsolidateDonutMappings] Complete:', report);
    
    return Response.json({
      success: true,
      mode,
      companyId,
      report,
      summary: `Global mapping ${report.globalMappingExists ? 'exists' : 'created'}. ${mode === 'commit' ? 'Deprecated' : 'Would deprecate'}: ${legacyMappings.length} legacy mappings. Cleaned up: ${report.cleanupCount} stale rows.`
    });
    
  } catch (error) {
    console.error('[ConsolidateDonutMappings] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});