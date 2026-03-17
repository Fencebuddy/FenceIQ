/**
 * REQUIRED PARTS LIST BY FENCE TYPE
 * Fixed canonical keys that MUST be mapped for each fence system
 */

export const REQUIRED_PARTS_BY_TYPE = {
  'Chain Link': [
    { canonical_key: 'chainlink_fabric', description: 'Chain Link Fabric' },
    { canonical_key: 'chainlink_rail_top', description: 'Top Rail' },
    { canonical_key: 'chainlink_post_line', description: 'Line Post' },
    { canonical_key: 'chainlink_post_terminal', description: 'Terminal Post' },
    { canonical_key: 'chainlink_tension_wire', description: 'Tension Wire' },
    { canonical_key: 'chainlink_band_brace', description: 'Brace Band' },
    { canonical_key: 'chainlink_band_tension', description: 'Tension Band' },
    { canonical_key: 'chainlink_cap_loop', description: 'Loop Caps' },
    { canonical_key: 'chainlink_cap_dome', description: 'Dome Caps' }
  ],
  
  'Vinyl': [
    { canonical_key: 'vinyl_panel_privacy', description: 'Privacy Panel' },
    { canonical_key: 'vinyl_post_line', description: 'Line Post' },
    { canonical_key: 'vinyl_post_terminal', description: 'Terminal/End Post' },
    { canonical_key: 'vinyl_post_corner', description: 'Corner Post' },
    { canonical_key: 'vinyl_post_gate', description: 'Gate Post' },
    { canonical_key: 'vinyl_gate_single', description: 'Single Gate' },
    { canonical_key: 'vinyl_gate_double', description: 'Double Gate' },
    { canonical_key: 'vinyl_gate_hardware', description: 'Gate Hardware Kit' },
    { canonical_key: 'vinyl_gate_latch_single', description: 'Single Gate Latch' },
    { canonical_key: 'vinyl_gate_latch_double', description: 'Double Gate Latch' },
    { canonical_key: 'vinyl_gate_latch_pool', description: 'Pool Latch' },
    { canonical_key: 'vinyl_cane_bolt', description: 'Cane Bolt' },
    { canonical_key: 'vinyl_post_cap', description: 'Post Caps' },
    { canonical_key: 'vinyl_donut', description: 'Donut' },
    { canonical_key: 'vinyl_post_support', description: 'Post Support' },
    { canonical_key: 'vinyl_concrete', description: 'Concrete per Post' }
  ],
  
  'Aluminum': [
    { canonical_key: 'aluminum_panel', description: 'Panel' },
    { canonical_key: 'aluminum_post_line', description: 'Line Post' },
    { canonical_key: 'aluminum_post_terminal', description: 'Terminal Post' },
    { canonical_key: 'aluminum_cap_flat', description: 'Post Caps' }
  ],
  
  'Wood': [
    { canonical_key: 'wood_picket', description: 'Pickets/Boards' },
    { canonical_key: 'wood_post_line', description: 'Line Post' },
    { canonical_key: 'wood_post_corner', description: 'Corner Post' },
    { canonical_key: 'wood_post_end', description: 'End Post' },
    { canonical_key: 'wood_post_gate', description: 'Gate Post' },
    { canonical_key: 'wood_rail_top', description: 'Top Rail' },
    { canonical_key: 'wood_rail_bottom', description: 'Bottom Rail' },
    { canonical_key: 'wood_rail_mid', description: 'Mid Rail' },
    { canonical_key: 'wood_gate_single', description: 'Single Gate' },
    { canonical_key: 'wood_gate_double', description: 'Double Gate' },
    { canonical_key: 'wood_gate_hardware', description: 'Gate Hardware' },
    { canonical_key: 'wood_concrete', description: 'Concrete per Post' },
    { canonical_key: 'wood_fasteners_screws', description: 'Fasteners - Screws' },
    { canonical_key: 'wood_fasteners_nails', description: 'Fasteners - Nails' }
  ]
};

/**
 * Get required parts for a fence type
 */
export function getRequiredParts(fenceType) {
  return REQUIRED_PARTS_BY_TYPE[fenceType] || [];
}