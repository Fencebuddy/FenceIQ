import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Links unresolved items to catalog by creating CatalogLinkMap entries
 * Requires catalog items to exist first (run seedSavannahCatalog first)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const mode = new URL(req.url).searchParams.get('mode') || 'preview';

    // Items to link - match what takeoff engine actually generates
    const colors = ['white', 'tan', 'khaki', 'grey'];
    const heights = ['4ft', '5ft', '6ft', '8ft'];
    const itemsToLink = [];
    
    // Panels - WITH color suffix (takeoff includes color)
    heights.forEach(height => {
      colors.forEach(color => {
        itemsToLink.push({ canonical_key: `vinyl_panel_privacy_${height}_${color}`, description: `${height.replace('ft', '\'')} Privacy Vinyl Panels (${color})` });
      });
    });
    
    // Posts - WITHOUT color suffix (takeoff doesn't include color)
    heights.forEach(height => {
      itemsToLink.push({ canonical_key: `vinyl_post_end_5x5_${height}`, description: `5x5 Vinyl End Post ${height.replace('ft', '\'')}` });
      itemsToLink.push({ canonical_key: `vinyl_post_corner_5x5_${height}`, description: `5x5 Vinyl Corner Post ${height.replace('ft', '\'')}` });
      itemsToLink.push({ canonical_key: `vinyl_post_line_5x5_${height}`, description: `5x5 Vinyl Line Post ${height.replace('ft', '\'')}` });
      itemsToLink.push({ canonical_key: `vinyl_post_gate_5x5_${height}`, description: `5x5 Vinyl Gate Post ${height.replace('ft', '\'')}` });
    });
    
    // Gates - WITHOUT color suffix (takeoff doesn't include color)
    const singleGateWidths = ['4ft', '5ft', '6ft'];
    const doubleGateWidths = ['8ft', '10ft', '12ft'];
    
    singleGateWidths.forEach(width => {
      itemsToLink.push({ canonical_key: `vinyl_gate_single_${width}`, description: `6' x ${width.replace('ft', '\'')} Vinyl Gate` });
    });
    
    doubleGateWidths.forEach(width => {
      itemsToLink.push({ canonical_key: `vinyl_gate_double_${width}`, description: `6' x ${width.replace('ft', '\'')} Vinyl Gate (Double)` });
    });
    
    // Hardware & Materials - WITHOUT color suffix
    itemsToLink.push({ canonical_key: 'vinyl_hardware_galvanized_post', description: '2.5" Galvanized Post' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_nodig_donut', description: 'No-Dig Donuts' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_post_cap', description: 'Vinyl Post Caps' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_gate_beam_aluminum', description: 'Aluminum Gate Beam (I-Beam)' });
    itemsToLink.push({ canonical_key: 'vinyl_concrete_quickcrete_50lb', description: 'Quick Crete (50 lb bags)' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_gate_hinge_set', description: 'Vinyl Gate Hinges (sets of 2)' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_locklatch_5in', description: '5" Locklatch gate latch' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_locklatch_4in', description: '4" Locklatch gate lock' });
    itemsToLink.push({ canonical_key: 'vinyl_hardware_cane_bolt', description: 'Cane Bolts (drop rods)' });
    
    // Hardware - color-neutral
    itemsToLink.push(
      { canonical_key: 'vinyl_hardware_galvanized_post', description: '2.5" Galvanized Post' },
      { canonical_key: 'vinyl_hardware_nodig_donut', description: 'No-Dig Donuts (2 per Post)' },
      { canonical_key: 'vinyl_hardware_post_cap', description: 'Vinyl Post Caps' },
      { canonical_key: 'vinyl_hardware_gate_beam_aluminum', description: 'Aluminum Gate Beam (I-Beam)' },
      { canonical_key: 'vinyl_concrete_quickcrete_50lb', description: 'Quick Crete (50 lb bags)' },
      { canonical_key: 'vinyl_hardware_gate_hinge_set', description: 'Vinyl Gate Hinges (sets of 2)' },
      { canonical_key: 'vinyl_hardware_locklatch_5in', description: '5" Locklatch gate latch' },
      { canonical_key: 'vinyl_hardware_locklatch_4in', description: '4" Locklatch gate lock (Double)' },
      { canonical_key: 'vinyl_hardware_cane_bolt', description: 'Cane Bolts (drop rods)' }
    );

    const created = [];
    const failed = [];
    const skipped = [];

    for (const item of itemsToLink) {
      // Find catalog item by canonical key
      const catalogMatches = await base44.entities.MaterialCatalog.filter({
        canonical_key: item.canonical_key,
        active: true
      });

      if (catalogMatches.length === 0) {
        failed.push({
          canonical_key: item.canonical_key,
          reason: 'Catalog item not found - run seedSavannahCatalog first'
        });
        continue;
      }

      // Check if link already exists
      const existingLink = await base44.entities.CatalogLinkMap.filter({
        canonical_key: item.canonical_key,
        active: true
      });

      if (existingLink.length > 0) {
        skipped.push({
          canonical_key: item.canonical_key,
          reason: 'Link already exists'
        });
        continue;
      }

      if (mode === 'execute') {
        const catalogItem = catalogMatches[0];
        await base44.entities.CatalogLinkMap.create({
          canonical_key: item.canonical_key,
          catalog_item_id: catalogItem.id,
          priority: 1,
          active: true,
          notes: `Auto-linked: ${item.description}`
        });

        created.push({
          canonical_key: item.canonical_key,
          catalogItem: catalogItem.crm_name
        });
      }
    }

    if (mode === 'preview') {
      return Response.json({
        preview: true,
        message: 'Preview mode - add ?mode=execute to create links',
        itemsToProcess: itemsToLink,
        wouldCreate: itemsToLink.length,
        note: 'Ensure catalog items exist first (run seedSavannahCatalog)'
      });
    } else {
      return Response.json({
        success: true,
        created: created.length,
        failed: failed.length,
        skipped: skipped.length,
        details: { created, failed, skipped }
      });
    }
  } catch (error) {
    console.error('[linkUnresolvedItems] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});