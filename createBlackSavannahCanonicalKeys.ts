import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Step 1: Remove incorrect white→black mappings
    const whiteKeysToRemove = [
      'vinyl_panel_privacy_6ft_savannah_white',
      'vinyl_post_end_6ft_savannah_white',
      'vinyl_post_line_6ft_savannah_white',
      'vinyl_cap_new_england_6ft_white'
    ];

    for (const key of whiteKeysToRemove) {
      const existing = await base44.asServiceRole.entities.CatalogLinkMap.filter({ canonical_key: key });
      for (const link of existing) {
        if (link.catalog_item_id.includes('Black') || link.catalog_item_id.includes('black')) {
          await base44.asServiceRole.entities.CatalogLinkMap.delete(link.id);
          console.log(`Removed incorrect white→black link: ${key}`);
        }
      }
    }

    // Step 2: Get all Black Savannah catalog items
    const blackItems = await base44.asServiceRole.entities.MaterialCatalog.filter({
      crm_name: { '$regex': '.*Black.*' }
    });

    console.log(`Found ${blackItems.length} Black Savannah items`);

    // Step 3: Create proper BLACK canonical key mappings
    const blackKeyMappings = [
      {
        canonical_key: 'vinyl_panel_privacy_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Privacy Panel.*Black',
        description: 'Privacy panels for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_post_end_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl End Post.*Black',
        description: 'End posts for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_post_line_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Line Post.*Black',
        description: 'Line posts for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_post_corner_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Corner Post.*Black',
        description: 'Corner posts for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_post_blank_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Blank Post.*Black',
        description: 'Blank posts for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_post_3way_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl 3-Way Post.*Black',
        description: '3-way posts for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_cap_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Post Cap.*Black',
        description: 'Post caps for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_single_38p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Single Gate.*38.5W.*Black',
        description: 'Single gate 38.5" for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_single_44p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Single Gate.*44.5W.*Black',
        description: 'Single gate 44.5" for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_single_62p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Single Gate.*62.5W.*Black',
        description: 'Single gate 62.5" for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_double_38p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Double Gate.*38.5W.*Black',
        description: 'Double gate 38.5" for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_double_44p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Double Gate.*44.5W.*Black',
        description: 'Double gate 44.5" for 6ft Black Savannah'
      },
      {
        canonical_key: 'vinyl_gate_double_62p5in_6ft_savannah_black',
        crm_pattern: 'Savannah Vinyl Double Gate.*62.5W.*Black',
        description: 'Double gate 62.5" for 6ft Black Savannah'
      }
    ];

    // Step 4: Create CatalogLinkMap entries for each BLACK key
    const newLinks = [];
    for (const mapping of blackKeyMappings) {
      const regex = new RegExp(mapping.crm_pattern);
      const matchingItem = blackItems.find(item => regex.test(item.crm_name));
      
      if (matchingItem) {
        newLinks.push({
          canonical_key: mapping.canonical_key,
          catalog_item_id: matchingItem.id,
          priority: 1,
          active: true,
          notes: mapping.description
        });
        console.log(`Mapped ${mapping.canonical_key} → ${matchingItem.crm_name}`);
      } else {
        console.log(`WARNING: No match found for pattern ${mapping.crm_pattern}`);
      }
    }

    const createdLinks = await base44.asServiceRole.entities.CatalogLinkMap.bulkCreate(newLinks);

    return Response.json({
      success: true,
      cleanedUpIncorrectLinks: whiteKeysToRemove.length,
      createdBlackCanonicalKeys: createdLinks.length,
      message: 'Black Savannah canonical keys created - DO NOT USE WHITE KEYS'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});