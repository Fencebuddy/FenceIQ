import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AUTO-MAP ALL UCKS
 * 
 * Scans MaterialCatalog and creates CompanySkuMap entries for ALL catalog items.
 * This is the bridge layer that was missing.
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

    // Get all active catalog items
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
    
    // Get existing mappings for this company
    const existingMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    const existingUcks = new Set(existingMappings.map(m => m.uck));

    const results = {
      total_catalog_items: catalog.length,
      already_mapped: existingMappings.length,
      created: 0,
      skipped: 0,
      created_ucks: []
    };

    // Batch create mappings
    const toCreate = [];
    
    for (const item of catalog) {
      const uck = item.canonical_key;
      
      if (!uck) {
        results.skipped++;
        continue;
      }
      
      // Skip if already exists
      if (existingUcks.has(uck)) {
        results.skipped++;
        continue;
      }

      // Parse attributes from UCK
      const attributes = parseUckAttributes(uck);
      
      toCreate.push({
        companyId,
        uck,
        materialCatalogId: item.id,
        materialCatalogName: item.crm_name,
        materialType: item.material_type || 'general',
        fenceSystem: attributes.fenceSystem || 'savannah',
        attributes,
        displayName: item.crm_name,
        status: 'mapped',
        lastSeenAt: new Date().toISOString()
      });
      
      results.created_ucks.push(uck);
    }
    
    // Batch create in chunks of 50 to avoid rate limits
    const chunkSize = 50;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      await base44.asServiceRole.entities.CompanySkuMap.bulkCreate(chunk);
      results.created += chunk.length;
      
      // Small delay between batches
      if (i + chunkSize < toCreate.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[autoMapAllUcks] Error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});

/**
 * Parse UCK into attributes
 */
function parseUckAttributes(uck) {
  const parts = (uck || '').split('_');
  
  const attributes = {};
  
  // Detect fence system
  if (uck.includes('_savannah')) attributes.fenceSystem = 'savannah';
  if (uck.includes('_lakeshore')) attributes.fenceSystem = 'lakeshore';
  if (uck.includes('_yorktown')) attributes.fenceSystem = 'yorktown';
  
  // Detect height
  const heightMatch = uck.match(/(\d+)ft/);
  if (heightMatch) attributes.height_ft = parseInt(heightMatch[1]);
  
  // Detect finish/color
  if (uck.includes('_white')) attributes.finish = 'white';
  if (uck.includes('_tan')) attributes.finish = 'tan';
  if (uck.includes('_khaki')) attributes.finish = 'khaki';
  if (uck.includes('_grey') || uck.includes('_gray')) attributes.finish = 'grey';
  if (uck.includes('_black')) attributes.finish = 'black';
  if (uck.includes('_cedar_tone')) attributes.finish = 'cedar_tone';
  if (uck.includes('_coastal_grey')) attributes.finish = 'coastal_grey';
  
  // Detect coating (chain link)
  if (uck.includes('_galv')) attributes.coating = 'galv';
  if (uck.includes('_black_vinyl')) attributes.coating = 'black_vinyl';
  if (uck.includes('_aluminized')) attributes.coating = 'aluminized';
  
  return attributes;
}