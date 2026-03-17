import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DIAGNOSTIC + FIX FUNCTION
 * 
 * Checks all CompanySkuMap entries and:
 * 1. Identifies broken mappings (pointing to non-existent catalog items)
 * 2. Finds correct catalog items by matching UCK patterns
 * 3. Auto-repairs mappings or marks as unmapped
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all CompanySkuMap entries
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.list();
    
    // Get all catalog items
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
    const catalogById = new Map(catalog.map(c => [c.id, c]));
    
    const diagnostics = {
      total_mappings: allMappings.length,
      broken_count: 0,
      repaired_count: 0,
      unfixable_count: 0,
      broken_details: [],
      repairs: []
    };

    // Check each mapping
    for (const mapping of allMappings) {
      const catalogItem = catalogById.get(mapping.materialCatalogId);
      
      if (!catalogItem) {
        diagnostics.broken_count++;
        
        // Try to find correct item by canonical_key match
        const matchingCatalogItem = catalog.find(c => 
          c.canonical_key && 
          mapping.uck && 
          c.canonical_key.toLowerCase() === mapping.uck.toLowerCase()
        );
        
        if (matchingCatalogItem) {
          // REPAIR: Update mapping to correct catalog item
          await base44.asServiceRole.entities.CompanySkuMap.update(mapping.id, {
            materialCatalogId: matchingCatalogItem.id,
            materialCatalogName: matchingCatalogItem.crm_name,
            status: 'mapped'
          });
          
          diagnostics.repaired_count++;
          diagnostics.repairs.push({
            uck: mapping.uck,
            old_id: mapping.materialCatalogId,
            new_id: matchingCatalogItem.id,
            new_name: matchingCatalogItem.crm_name
          });
        } else {
          // UNFIXABLE: No matching catalog item found
          diagnostics.unfixable_count++;
          diagnostics.broken_details.push({
            uck: mapping.uck,
            broken_catalog_id: mapping.materialCatalogId,
            reason: 'No matching catalog item found by canonical_key'
          });
        }
      }
    }

    return Response.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    console.error('[diagnosticFixBrokenMappings] Error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});