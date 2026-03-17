import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * FIX BROKEN MAPPINGS V2
 * 
 * Auto-repairs broken CompanySkuMap entries by:
 * 1. Finding catalog items with PARTIAL key match (ignore fence system suffix)
 * 2. Auto-linking if high confidence match found
 * 3. Marking as unmapped if no match found
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }

    // Get all CompanySkuMap entries for this company
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ 
      companyId,
      status: 'mapped'
    });
    
    // Get all active catalog items
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
    const catalogById = new Map(catalog.map(c => [c.id, c]));
    
    const results = {
      checked: 0,
      broken: 0,
      repaired: 0,
      unmapped: 0,
      repairs: [],
      unmapped_items: []
    };

    // Check each mapping
    for (const mapping of allMappings) {
      results.checked++;
      
      const catalogItem = catalogById.get(mapping.materialCatalogId);
      
      if (!catalogItem) {
        // BROKEN MAPPING
        results.broken++;
        
        // Try fuzzy match: strip fence system tokens (_savannah, _lakeshore) from UCK
        const uckBase = (mapping.uck || '')
          .replace(/_savannah/g, '')
          .replace(/_lakeshore/g, '')
          .replace(/_yorktown/g, '');
        
        // Find catalog items with matching base key
        const matchByCK = catalog.find(c => {
          const catKeyBase = (c.canonical_key || '')
            .replace(/_savannah/g, '')
            .replace(/_lakeshore/g, '')
            .replace(/_yorktown/g, '');
          return catKeyBase === uckBase;
        });
        
        if (matchByCK) {
          // HIGH CONFIDENCE: Repair mapping
          await base44.asServiceRole.entities.CompanySkuMap.update(mapping.id, {
            materialCatalogId: matchByCK.id,
            materialCatalogName: matchByCK.crm_name,
            status: 'mapped'
          });
          
          results.repaired++;
          results.repairs.push({
            uck: mapping.uck,
            matched_catalog: matchByCK.crm_name,
            matched_cost: matchByCK.cost
          });
        } else {
          // NO MATCH: Unmap
          await base44.asServiceRole.entities.CompanySkuMap.update(mapping.id, {
            materialCatalogId: null,
            materialCatalogName: null,
            status: 'unmapped'
          });
          
          results.unmapped++;
          results.unmapped_items.push({
            uck: mapping.uck,
            displayName: mapping.displayName
          });
        }
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[fixBrokenMappingsV2] Error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});