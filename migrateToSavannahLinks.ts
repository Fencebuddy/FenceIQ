import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Maps old/legacy canonical keys to new Savannah canonical keys
 * Handles height extraction and color normalization
 */
const LEGACY_TO_SAVANNAH_MAPPINGS = [
  // PANELS - old key doesn't include "savannah", just has height + color
  { legacy: /^vinyl_panel_privacy_(\d+)ft_tan$/, savannah: (m, h) => `vinyl_panel_privacy_${h}ft_savannah_tan` },
  { legacy: /^vinyl_panel_privacy_(\d+)ft_white$/, savannah: (m, h) => `vinyl_panel_privacy_${h}ft_savannah_white` },
  { legacy: /^vinyl_panel_privacy_(\d+)ft_grey$/, savannah: (m, h) => `vinyl_panel_privacy_${h}ft_savannah_grey` },
  { legacy: /^vinyl_panel_privacy_(\d+)ft_khaki$/, savannah: (m, h) => `vinyl_panel_privacy_${h}ft_savannah_khaki` },

  // POSTS - old key has "5x5" size, need to extract height and role
  { legacy: /^vinyl_post_end_5x5_(\d+)ft$/, savannah: (m, h) => `vinyl_post_end_${h}ft_savannah_tan` },
  { legacy: /^vinyl_post_corner_5x5_(\d+)ft$/, savannah: (m, h) => `vinyl_post_corner_${h}ft_savannah_tan` },
  { legacy: /^vinyl_post_line_5x5_(\d+)ft$/, savannah: (m, h) => `vinyl_post_line_${h}ft_savannah_tan` },
  { legacy: /^vinyl_post_gate_5x5_(\d+)ft$/, savannah: (m, h) => `vinyl_post_gate_${h}ft_savannah_tan` },

  // GATES - old key missing width in inches, use placeholder widths
  // For single gates, map by height only (will need manual review)
  { legacy: /^vinyl_gate_single_(\d+)ft$/, savannah: (m, h) => `vinyl_gate_single_62.5in_${h}ft` },
  
  // For double gates, map by height and estimated width
  { legacy: /^vinyl_gate_double_(\d+)ft$/, savannah: (m, h) => `vinyl_gate_double_68.5in_${h}ft` },

  // HARDWARE - these need manual mapping, so we'll create generic placeholders
  { legacy: /^vinyl_hardware_post_cap$/, savannah: () => `vinyl_cap_new_england_6ft_tan` },
  { legacy: /^vinyl_hardware_gate_hinge_set$/, savannah: () => `vinyl_gate_hardware_hinge_set` },
  { legacy: /^vinyl_hardware_locklatch_5in$/, savannah: () => `vinyl_gate_hardware_locklatch_5in` },
  { legacy: /^vinyl_hardware_locklatch_4in$/, savannah: () => `vinyl_gate_hardware_locklatch_4in` },
  { legacy: /^vinyl_hardware_cane_bolt$/, savannah: () => `vinyl_gate_hardware_cane_bolt` },
  { legacy: /^vinyl_hardware_galvanized_post$/, savannah: () => `vinyl_hardware_galvanized_post_6ft` },
  { legacy: /^vinyl_hardware_nodig_donut$/, savannah: () => `vinyl_hardware_nodig_donut` },
  { legacy: /^vinyl_hardware_gate_beam_aluminum$/, savannah: () => `vinyl_hardware_gate_beam_aluminum` },
  { legacy: /^vinyl_concrete_quickcrete_50lb$/, savannah: () => `vinyl_concrete_quickcrete_50lb` }
];

/**
 * Convert legacy canonical key to Savannah key
 */
function convertLegacyToSavannah(legacyKey) {
  for (const mapping of LEGACY_TO_SAVANNAH_MAPPINGS) {
    const match = legacyKey.match(mapping.legacy);
    if (match) {
      return mapping.savannah(match, match[1]);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const mode = new URL(req.url).searchParams.get('mode') || 'preview';
    const legacyKeys = [
      'vinyl_panel_privacy_6ft_tan',
      'vinyl_hardware_galvanized_post',
      'vinyl_hardware_nodig_donut',
      'vinyl_post_end_5x5_6ft',
      'vinyl_post_corner_5x5_6ft',
      'vinyl_post_line_5x5_6ft',
      'vinyl_hardware_post_cap',
      'vinyl_post_gate_5x5_6ft',
      'vinyl_hardware_gate_beam_aluminum',
      'vinyl_concrete_quickcrete_50lb',
      'vinyl_gate_single_4ft',
      'vinyl_gate_single_5ft',
      'vinyl_gate_single_6ft',
      'vinyl_gate_double_8ft',
      'vinyl_gate_double_10ft',
      'vinyl_gate_double_12ft',
      'vinyl_hardware_gate_hinge_set',
      'vinyl_hardware_locklatch_5in',
      'vinyl_hardware_locklatch_4in',
      'vinyl_hardware_cane_bolt'
    ];

    const conversions = [];
    const unmappable = [];
    const linkMaps = [];

    // Convert each legacy key
    for (const legacyKey of legacyKeys) {
      const savannahKey = convertLegacyToSavannah(legacyKey);

      if (savannahKey) {
        conversions.push({
          legacy: legacyKey,
          savannah: savannahKey
        });

        // If we have a Savannah key, try to find the catalog item
        if (mode === 'execute') {
          const catalogMatches = await base44.entities.MaterialCatalog.filter({
            canonical_key: savannahKey,
            active: true
          });

          if (catalogMatches.length > 0) {
            const catalogItem = catalogMatches[0];

            // Create link from legacy key to Savannah catalog item
            const existingLink = await base44.entities.CatalogLinkMap.filter({
              canonical_key: legacyKey,
              active: true
            });

            if (existingLink.length === 0) {
              await base44.entities.CatalogLinkMap.create({
                canonical_key: legacyKey,
                catalog_item_id: catalogItem.id,
                priority: 1,
                active: true,
                notes: `Legacy mapping to Savannah ${savannahKey}`
              });

              linkMaps.push({
                legacy: legacyKey,
                catalogItem: catalogItem.crm_name,
                catalogId: catalogItem.id
              });
            }
          }
        }
      } else {
        unmappable.push(legacyKey);
      }
    }

    if (mode === 'execute') {
      return Response.json({
        success: true,
        message: `Created ${linkMaps.length} legacy-to-Savannah links`,
        mode: 'execute',
        created: linkMaps,
        unmappable
      });
    } else {
      return Response.json({
        success: true,
        preview: true,
        conversions: conversions.length,
        unmappable: unmappable.length,
        breakdown: conversions,
        unmappableKeys: unmappable,
        note: 'Add ?mode=execute to create links. Note: Hardware items may need manual catalog entries.'
      });
    }
  } catch (error) {
    console.error('[migrateToSavannahLinks] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});