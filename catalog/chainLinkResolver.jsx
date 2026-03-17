/**
 * Chain Link Resolver
 * Maps chain link specifications to actual catalog items with costs
 * Based on CRM pricing data
 */

const CHAINLINK_CATALOG = {
  // FABRIC (50ft rolls)
  fabric: {
    '4_galvanized': { cost: 85.00, name: "4' Chain Link Fabric (Galvanized) - 50ft Roll" },
    '5_galvanized': { cost: 95.00, name: "5' Chain Link Fabric (Galvanized) - 50ft Roll" },
    '6_galvanized': { cost: 105.00, name: "6' Chain Link Fabric (Galvanized) - 50ft Roll" },
    '4_aluminized': { cost: 95.00, name: "4' Chain Link Fabric (Aluminized) - 50ft Roll" },
    '6_aluminized': { cost: 115.00, name: "6' Chain Link Fabric (Aluminized) - 50ft Roll" },
    '4_black_vinyl_coated': { cost: 125.00, name: "4' Chain Link Fabric (Black Vinyl Coated) - 50ft Roll" },
    '5_black_vinyl_coated': { cost: 135.00, name: "5' Chain Link Fabric (Black Vinyl Coated) - 50ft Roll" },
    '6_black_vinyl_coated': { cost: 145.00, name: "6' Chain Link Fabric (Black Vinyl Coated) - 50ft Roll" }
  },
  
  // POSTS
  posts: {
    'terminal_4_galvanized': { cost: 17.00, name: 'GALV Terminal Post 2-1/2in - 8ft (4\' Chain Link)' },
    'terminal_5_galvanized': { cost: 17.00, name: 'GALV Terminal Post 2-1/2in - 8ft (5\' Chain Link)' },
    'terminal_6_galvanized': { cost: 17.00, name: 'GALV Terminal Post 2-1/2in - 8ft (6\' Chain Link)' },
    'terminal_4_black_vinyl_coated': { cost: 23.00, name: 'BLK Terminal Post 2-1/2in - 8ft (4\' Chain Link)' },
    'terminal_5_black_vinyl_coated': { cost: 23.00, name: 'BLK Terminal Post 2-1/2in - 8ft (5\' Chain Link)' },
    'terminal_6_black_vinyl_coated': { cost: 23.00, name: 'BLK Terminal Post 2-1/2in - 8ft (6\' Chain Link)' },
    'end_4_black_vinyl_coated': { cost: 101.74, name: '4\' BLK Vinyl Coated Chain Link End Post Assembly' },
    'line_4_galvanized': { cost: 11.00, name: 'GALV Line Post 1-5/8in - 7ft' },
    'line_5_galvanized': { cost: 11.00, name: 'GALV Line Post 1-5/8in - 7ft' },
    'line_6_galvanized': { cost: 13.00, name: 'GALV Line Post 1-5/8in - 9ft' },
    'line_4_black_vinyl_coated': { cost: 15.00, name: 'BLK Line Post 1-5/8in - 7ft' },
    'line_5_black_vinyl_coated': { cost: 15.00, name: 'BLK Line Post 1-5/8in - 7ft' },
    'line_6_black_vinyl_coated': { cost: 17.00, name: 'BLK Line Post 1-5/8in - 9ft' },
    'terminal_post_gate': { cost: 17.00, name: 'GALV Terminal Post (Gate) 2-1/2in - 8ft' }
  },
  
  // TOP RAILS
  rails: {
    'galvanized': { cost: 28.81, name: 'GALV Top Rail 1-3/8in - 21ft Stick' },
    '1.375in_galvanized': { cost: 28.81, name: 'GALV Top Rail 1-3/8in - 21ft Stick' },
    'black_vinyl_coated': { cost: 35.00, name: 'BLK Top Rail 1-3/8in - 21ft Stick' }
  },
  
  // GATES
  gates: {
    'single_4_4': { cost: 129.90, name: '4\' x 4\' Chain Link Gate Single' },
    'single_4_5': { cost: 145.00, name: '4\' x 5\' Chain Link Gate Single' },
    'single_6_4': { cost: 175.00, name: '6\' x 4\' Chain Link Gate' },
    'single_4_4_black': { cost: 275.00, name: '4X4\' BLK Chain Link Gate' },
    'double_4_10': { cost: 285.00, name: '4\' x 10\' Chain Link Gate Double' },
    'double_4_12': { cost: 285.00, name: '4\' x 12\' Chain Link Gate (Double)' },
    'double_6_8': { cost: 350.00, name: '6\' x 8\' Chain Link Gate (Double)' },
    'double_8': { cost: 259.80, name: '8\' Chain Link Gate (Double)' }
  },
  
  // HARDWARE (also handles 'misc' prefix for backwards compatibility)
  hardware: {
    // Loop Caps
    'loop_cap_galvanized': { cost: 1.25, name: 'GALV Loop Cap 1-5/8in (Line)' },
    'loop_cap_black_vinyl_coated': { cost: 1.75, name: 'BLK Loop Cap 1-5/8in (Line)' },
    
    // Dome Caps
    'dome_cap_galvanized': { cost: 1.50, name: 'GALV Dome Cap 2-1/2in (Terminal)' },
    'dome_cap_black_vinyl_coated': { cost: 2.00, name: 'BLK Dome Cap 2-1/2in (Terminal)' },
    
    // Tension Bands
    'tension_band_galvanized': { cost: 1.20, name: 'GALV Tension Band 2-1/2in' },
    'tension_band_black_vinyl_coated': { cost: 1.75, name: 'BLK Tension Band 2-1/2in' },
    
    // Brace Bands
    'brace_band_galvanized': { cost: 1.80, name: 'GALV Brace Band 2-1/2in' },
    'brace_band_black_vinyl_coated': { cost: 2.50, name: 'BLK Brace Band 2-1/2in' },
    
    // Tension Bars
    'tension_bar_4_galvanized': { cost: 4.50, name: 'GALV Tension Bar 48in (4ft)' },
    'tension_bar_5_galvanized': { cost: 5.50, name: 'GALV Tension Bar 60in (5ft)' },
    'tension_bar_6_galvanized': { cost: 6.50, name: 'GALV Tension Bar 72in (6ft)' },
    'tension_bar_4_black_vinyl_coated': { cost: 6.00, name: 'BLK Tension Bar 48in (4ft)' },
    'tension_bar_5_black_vinyl_coated': { cost: 7.00, name: 'BLK Tension Bar 60in (5ft)' },
    'tension_bar_6_black_vinyl_coated': { cost: 8.00, name: 'BLK Tension Bar 72in (6ft)' },
    
    // Fence Ties
    'fence_tie_galvanized': { cost: 0.08, name: 'Chain Link Fence Tie (Galv) 9ga x 6-1/2in' },
    'fence_tie_black_vinyl_coated': { cost: 0.12, name: 'Chain Link Fence Tie (Black) 9ga x 6-1/2in' },
    'fence_tie_aluminized': { cost: 0.10, name: 'Chain Link Fence Tie (Aluminum) 9ga x 6-1/2in' },
    
    // Gate Hardware
    'gate_hinge': { cost: 12.00, name: 'Gate Hinges (pair) - Chain Link' },
    'gate_latch': { cost: 25.00, name: 'Pool Gate Latch (Chain Link)' },
    'gate_cap': { cost: 1.50, name: 'Gate Caps - Chain Link' },
    
    // Tension Wire
    'tension_wire_galvanized': { cost: 15.00, name: 'GALV Tension Wire (Bottom) - 100ft Roll' },
    'tension_wire_black_vinyl_coated': { cost: 20.00, name: 'BLK Tension Wire (Bottom) - 100ft Roll' },
    
    // Dome Caps
    'dome_cap_galvanized': { cost: 2.50, name: 'Dome Cap (Terminal Post)' },
    'dome_cap_black_vinyl_coated': { cost: 3.50, name: 'Dome Cap (Terminal Post - Black)' },
    'dome_cap': { cost: 2.50, name: 'Dome Cap (Terminal Post)' },
    
    // Carriage Bolts
    'carriage_bolt_galvanized': { cost: 0.15, name: 'Carriage Bolt 5/16 x 1-1/4 (Galv)' },
    'carriage_bolt_black_vinyl_coated': { cost: 0.20, name: 'Carriage Bolt 5/16 x 1-1/4 (Black)' },
    'carriage_bolt': { cost: 0.15, name: 'Carriage Bolt 5/16 x 1-1/4 (Galv)' },
    
    // Cane Bolts
    'cane_bolt': { cost: 12.00, name: 'Cane Bolts (double gates)' }
  }
};

/**
 * Resolve chain link item to catalog entry
 * @param {Object} spec - Item specification
 * @returns {Object} - { valid, unit_cost, canonical_key, reason }
 */
export function resolveChainLinkItem(spec) {
  const { kind, height_ft, coating, role, gate_type, gate_width_ft, hardware_type } = spec;
  
  const coatingKey = normalizeCoating(coating);
  
  // FABRIC
  if (kind === 'fabric') {
    const key = `${height_ft}_${coatingKey}`;
    const item = CHAINLINK_CATALOG.fabric[key];
    
    if (!item) {
      return {
        valid: false,
        reason: `No fabric found for ${height_ft}' ${coating}`
      };
    }
    
    return {
      valid: true,
      unit_cost: item.cost,
      canonical_key: `chainlink_fabric_${height_ft}ft_${coatingKey}`,
      displayName: item.name
    };
  }
  
  // POSTS
  if (kind === 'post') {
    const key = `${role}_${height_ft}_${coatingKey}`;
    const item = CHAINLINK_CATALOG.posts[key];
    
    if (!item) {
      return {
        valid: false,
        reason: `No post found for ${role} ${height_ft}' ${coating}`
      };
    }
    
    return {
      valid: true,
      unit_cost: item.cost,
      canonical_key: `chainlink_post_${role}_${height_ft}ft_${coatingKey}`,
      displayName: item.name
    };
  }
  
  // RAILS
  if (kind === 'rail') {
    // Try with diameter prefix first (e.g., '1.375in_galvanized'), then fallback to coating only
    let item = CHAINLINK_CATALOG.rails[`1.375in_${coatingKey}`] || CHAINLINK_CATALOG.rails[coatingKey];
    
    if (!item) {
      return {
        valid: false,
        reason: `No rail found for ${coating}`
      };
    }
    
    return {
      valid: true,
      unit_cost: item.cost,
      canonical_key: `chainlink_rail_top_${coatingKey}`,
      displayName: item.name
    };
  }
  
  // GATES
  if (kind === 'gate') {
    const key = `${gate_type}_${height_ft}_${gate_width_ft}`;
    const keyWithCoating = `${key}_${coatingKey === 'black_vinyl_coated' ? 'black' : ''}`;
    
    const item = CHAINLINK_CATALOG.gates[keyWithCoating] || CHAINLINK_CATALOG.gates[key];
    
    if (!item) {
      return {
        valid: false,
        reason: `No gate found for ${gate_type} ${height_ft}x${gate_width_ft}`
      };
    }
    
    return {
      valid: true,
      unit_cost: item.cost,
      canonical_key: `chainlink_gate_${gate_type}_${height_ft}ft_${gate_width_ft}ft`,
      displayName: item.name
    };
  }
  
  // HARDWARE
  if (kind === 'hardware') {
    let key = hardware_type;
    
    // Height-dependent hardware (tension bars)
    if (hardware_type === 'tension_bar') {
      key = `${hardware_type}_${height_ft}_${coatingKey}`;
    } else if (['loop_cap', 'dome_cap', 'tension_band', 'brace_band', 'fence_tie', 'tension_wire', 'carriage_bolt', 'cane_bolt', 'gate_hinge', 'gate_latch', 'gate_cap'].includes(hardware_type)) {
      key = `${hardware_type}_${coatingKey}`;
    }
    
    // Fallback to key without coating for items without coating variants
    const item = CHAINLINK_CATALOG.hardware[key] || CHAINLINK_CATALOG.hardware[hardware_type];
    
    if (!item) {
      return {
        valid: false,
        reason: `No hardware found for ${hardware_type} ${coating}`
      };
    }
    
    return {
      valid: true,
      unit_cost: item.cost,
      canonical_key: `chainlink_hardware_${hardware_type}_${coatingKey}`,
      displayName: item.name
    };
  }
  
  return {
    valid: false,
    reason: 'Unknown item kind'
  };
}

/**
 * Normalize coating name to key
 */
function normalizeCoating(coating) {
  if (!coating) return 'galvanized';
  
  const coatingLower = coating.toLowerCase();
  if (coatingLower.includes('black') || coatingLower.includes('vinyl')) return 'black_vinyl_coated';
  if (coatingLower.includes('aluminized') || coatingLower.includes('alum')) return 'aluminized';
  return 'galvanized';
}