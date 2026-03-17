/**
 * FENCEBUDDY MATERIAL CATALOG DATA
 * Base list prices - exact as provided
 * Modifiers apply dynamically based on selections
 */

export const VINYL_MATERIALS = [
  // Galvanized Posts
  { crm_name: "2.5\" Galvanized Line Post 7'", canonical_key: "vinyl_hardware_galvanized_post_7ft", cost: 18.52, unit: "pcs", category: "hardware", material_type: "vinyl", size: "7ft" },
  { crm_name: "2.5\" Galvanized Line Post 8'", canonical_key: "vinyl_hardware_galvanized_post_8ft", cost: 19.99, unit: "pcs", category: "hardware", material_type: "vinyl", size: "8ft" },
  { crm_name: "2.5\" Galvanized Line Post 9'", canonical_key: "vinyl_hardware_galvanized_post_9ft", cost: 23.82, unit: "pcs", category: "hardware", material_type: "vinyl", size: "9ft" },
  { crm_name: "2.5\" Galvanized Post", canonical_key: "vinyl_hardware_galvanized_post", cost: 19.99, unit: "pcs", category: "hardware", material_type: "vinyl" },
  
  // Vinyl Line Posts
  { crm_name: "5x5 Vinyl Line Post 7' (4' fence)", canonical_key: "vinyl_post_line_5x5_4ft", cost: 29.97, unit: "pcs", category: "post", material_type: "vinyl", size: "7ft" },
  { crm_name: "5x5 Vinyl Line Post 9' (6' fence)", canonical_key: "vinyl_post_line_5x5_6ft", cost: 31.07, unit: "pcs", category: "post", material_type: "vinyl", size: "9ft" },
  
  // Vinyl End Posts
  { crm_name: "5x5 Vinyl End Post 7'", canonical_key: "vinyl_post_end_5x5_4ft", cost: 33.53, unit: "pcs", category: "post", material_type: "vinyl", size: "7ft" },
  { crm_name: "5x5 Vinyl End Post 9'", canonical_key: "vinyl_post_end_5x5_6ft", cost: 43.23, unit: "pcs", category: "post", material_type: "vinyl", size: "9ft" },
  
  // Vinyl Corner Posts
  { crm_name: "5x5 Vinyl Corner Post 7'", canonical_key: "vinyl_post_corner_5x5_4ft", cost: 29.97, unit: "pcs", category: "post", material_type: "vinyl", size: "7ft" },
  { crm_name: "5x5 Vinyl Corner Post 9'", canonical_key: "vinyl_post_corner_5x5_6ft", cost: 33.53, unit: "pcs", category: "post", material_type: "vinyl", size: "9ft" },
  
  // Vinyl Gate Posts
  { crm_name: "5x5 Vinyl Gate Post (Single)", canonical_key: "vinyl_post_gate_5x5_single", cost: 43.23, unit: "pcs", category: "post", material_type: "vinyl" },
  { crm_name: "5x5 Vinyl Gate Post (Double/Reinforced)", canonical_key: "vinyl_post_gate_5x5_double", cost: 77.00, unit: "pcs", category: "post", material_type: "vinyl" },
  { crm_name: "Blank Post (Gate Against House)", canonical_key: "vinyl_post_blank_gate", cost: 43.23, unit: "pcs", category: "post", material_type: "vinyl" },
  
  // Hardware
  { crm_name: "No-Dig Donuts", canonical_key: "vinyl_hardware_nodig_donut", cost: 5.90, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Vinyl Post Cap", canonical_key: "vinyl_hardware_post_cap", cost: 1.63, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Gate Cap", canonical_key: "vinyl_hardware_gate_cap", cost: 2.41, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Aluminum Gate Beam", canonical_key: "vinyl_hardware_gate_beam_aluminum", cost: 73.00, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Quick Crete (50 lb bags)", canonical_key: "vinyl_concrete_quickcrete_50lb", cost: 7.96, unit: "bags", category: "concrete", material_type: "vinyl" },
  
  // Gates
  { crm_name: "4' Vinyl Gate", canonical_key: "vinyl_gate_single_4ft", cost: 242.44, unit: "pcs", category: "gate", material_type: "vinyl", size: "4ft" },
  { crm_name: "5' Vinyl Gate", canonical_key: "vinyl_gate_single_5ft", cost: 350.00, unit: "pcs", category: "gate", material_type: "vinyl", size: "5ft" },
  { crm_name: "6' Vinyl Gate", canonical_key: "vinyl_gate_single_6ft", cost: 503.87, unit: "pcs", category: "gate", material_type: "vinyl", size: "6ft" },
  { crm_name: "8' Vinyl Gate (Double)", canonical_key: "vinyl_gate_double_8ft", cost: 866.83, unit: "pcs", category: "gate", material_type: "vinyl", size: "8ft" },
  
  // Gate Hardware
  { crm_name: "Vinyl Gate Hinges (sets of 2)", canonical_key: "vinyl_hardware_gate_hinge_set", cost: 83.82, unit: "sets", category: "hardware", material_type: "vinyl" },
  { crm_name: "5\" Locklatch gate latch", canonical_key: "vinyl_hardware_locklatch_5in", cost: 71.44, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "4\" Locklatch gate lock (Double gate)", canonical_key: "vinyl_hardware_locklatch_4in", cost: 71.44, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Cane Bolts (drop rods)", canonical_key: "vinyl_hardware_cane_bolt", cost: 5.82, unit: "pcs", category: "hardware", material_type: "vinyl" },
  { crm_name: "Structural Screws (Vinyl Gate Assembly)", canonical_key: "vinyl_hardware_structural_screws", cost: 24.01, unit: "pcs", category: "hardware", material_type: "vinyl" },
  
  // Panels (white base price - apply color modifier if needed)
  { crm_name: "6' Privacy Panel (White)", canonical_key: "vinyl_panel_privacy_6ft_white", cost: 95.00, unit: "pcs", category: "panel", material_type: "vinyl", size: "6ft", finish: "white" },
  { crm_name: "4' Privacy Panel (White)", canonical_key: "vinyl_panel_privacy_4ft_white", cost: 75.00, unit: "pcs", category: "panel", material_type: "vinyl", size: "4ft", finish: "white" },
];

export const CHAIN_LINK_MATERIALS = [
  // Fabric
  { crm_name: "4' Chain Link Fabric (Galvanized)", canonical_key: "chainlink_fabric_4ft_galvanized", cost: 81.68, unit: "rolls", category: "fabric", material_type: "chainlink", size: "4ft", finish: "galv" },
  { crm_name: "6' Chain Link Fabric (Galvanized)", canonical_key: "chainlink_fabric_6ft_galvanized", cost: 115.00, unit: "rolls", category: "fabric", material_type: "chainlink", size: "6ft", finish: "galv" },
  
  // Rails
  { crm_name: "Top Rail 1-3/8\" galv 7'", canonical_key: "chainlink_rail_top_1.375in_7ft", cost: 2.81, unit: "pcs", category: "rail", material_type: "chainlink", size: "7ft" },
  { crm_name: "Top Rail 1-3/8\" galv 10'", canonical_key: "chainlink_rail_top_1.375in_10ft", cost: 3.66, unit: "pcs", category: "rail", material_type: "chainlink", size: "10ft" },
  { crm_name: "Top Rail (1-3/8\" galv pipe)", canonical_key: "chainlink_rail_top_1.375in_galv", cost: 3.66, unit: "lf", category: "rail", material_type: "chainlink" },
  
  // Wire
  { crm_name: "Tension Wire", canonical_key: "chainlink_hardware_tension_wire", cost: 7.68, unit: "100lf", category: "hardware", material_type: "chainlink" },
  { crm_name: "Bottom Tension Wire", canonical_key: "chainlink_hardware_tension_wire_bottom", cost: 1.89, unit: "100lf", category: "hardware", material_type: "chainlink" },
  
  // Terminal Posts
  { crm_name: "Terminal Post (End)", canonical_key: "chainlink_post_terminal_end_6ft", cost: 86.26, unit: "pcs", category: "post", material_type: "chainlink" },
  { crm_name: "Terminal Post (Corner)", canonical_key: "chainlink_post_terminal_corner_6ft", cost: 97.85, unit: "pcs", category: "post", material_type: "chainlink" },
  { crm_name: "Terminal Post (Gate)", canonical_key: "chainlink_post_terminal_gate_6ft", cost: 150.00, unit: "pcs", category: "post", material_type: "chainlink" },
  
  // Line Posts
  { crm_name: "Line Post (10' spacing)", canonical_key: "chainlink_post_line_6ft", cost: 9.99, unit: "pcs", category: "post", material_type: "chainlink" },
  { crm_name: "Galvanized Line Post", canonical_key: "chainlink_post_line_galv", cost: 12.79, unit: "pcs", category: "post", material_type: "chainlink" },
  
  // Caps
  { crm_name: "Dome Cap (terminal posts)", canonical_key: "chainlink_hardware_dome_cap", cost: 2.75, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Loop Cap (line posts)", canonical_key: "chainlink_hardware_loop_cap", cost: 2.91, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "End Post Cap", canonical_key: "chainlink_hardware_end_post_cap", cost: 2.41, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Gate Cap", canonical_key: "chainlink_hardware_gate_cap", cost: 2.41, unit: "pcs", category: "hardware", material_type: "chainlink" },
  
  // Rail Hardware
  { crm_name: "Brace Band (rail termination)", canonical_key: "chainlink_hardware_brace_band", cost: 0.80, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Rail End Cup", canonical_key: "chainlink_hardware_rail_cup", cost: 1.80, unit: "pcs", category: "hardware", material_type: "chainlink" },
  
  // Fabric Hardware
  { crm_name: "Tension Band", canonical_key: "chainlink_hardware_tension_band", cost: 0.81, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Tension Bar 48\"", canonical_key: "chainlink_hardware_tension_bar_4ft", cost: 2.52, unit: "pcs", category: "hardware", material_type: "chainlink", size: "48in" },
  { crm_name: "Tension Bar 72\"", canonical_key: "chainlink_hardware_tension_bar_6ft", cost: 4.08, unit: "pcs", category: "hardware", material_type: "chainlink", size: "72in" },
  
  // Fasteners
  { crm_name: "Carriage Bolt (all hardware)", canonical_key: "chainlink_hardware_carriage_bolt", cost: 0.33, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Chain Link Fence Tie", canonical_key: "chainlink_hardware_fence_tie", cost: 0.13, unit: "pcs", category: "hardware", material_type: "chainlink" },
  
  // Privacy
  { crm_name: "Privacy Slat (10 ft bundle)", canonical_key: "chainlink_privacy_slats_10ft", cost: 2.19, unit: "bundles", category: "privacy", material_type: "chainlink" },
  { crm_name: "Privacy Screen (50 ft roll)", canonical_key: "chainlink_privacy_screen_50ft", cost: 83.87, unit: "rolls", category: "privacy", material_type: "chainlink" },
  
  // Gates
  { crm_name: "4' Chain Link Gate", canonical_key: "chainlink_gate_single_4ft", cost: 129.90, unit: "pcs", category: "gate", material_type: "chainlink", size: "4ft" },
  { crm_name: "6' Chain Link Gate", canonical_key: "chainlink_gate_single_6ft", cost: 520.75, unit: "pcs", category: "gate", material_type: "chainlink", size: "6ft" },
  { crm_name: "8' Chain Link Gate (Double)", canonical_key: "chainlink_gate_double_8ft", cost: 866.83, unit: "pcs", category: "gate", material_type: "chainlink", size: "8ft" },
  
  // Gate Hardware
  { crm_name: "Gate Hinge (sets of 2)", canonical_key: "chainlink_hardware_gate_hinge_set", cost: 83.82, unit: "sets", category: "hardware", material_type: "chainlink" },
  { crm_name: "Pool gate latch", canonical_key: "chainlink_hardware_pool_latch", cost: 71.44, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Chain Link Gate Latch (Single)", canonical_key: "chainlink_hardware_gate_latch_single", cost: 71.44, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Chain Link Gate Latch (Double)", canonical_key: "chainlink_hardware_gate_latch_double", cost: 71.44, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Cane Bolt", canonical_key: "chainlink_hardware_cane_bolt", cost: 5.82, unit: "pcs", category: "hardware", material_type: "chainlink" },
  { crm_name: "Structural Screws (Chain Link Gate Hardware)", canonical_key: "chainlink_hardware_structural_screws", cost: 24.01, unit: "pcs", category: "hardware", material_type: "chainlink" },
];

export const WOOD_MATERIALS = [
  // Posts
  { crm_name: "4x4 Lifetime Steel Post (Driven)", canonical_key: "wood_post_driven_4x4_steel", cost: 59.99, unit: "pcs", category: "post", material_type: "wood" },
  { crm_name: "4x6x10 Treated Post (Gate)", canonical_key: "wood_post_gate_4x6_treated", cost: 25.88, unit: "pcs", category: "post", material_type: "wood" },
  { crm_name: "PostMaster 8' Steel Post (Wood)", canonical_key: "wood_post_postmaster_8ft", cost: 36.30, unit: "pcs", category: "post", material_type: "wood", size: "8ft" },
  { crm_name: "PostMaster 10' Steel Post (Wood)", canonical_key: "wood_post_postmaster_10ft", cost: 36.30, unit: "pcs", category: "post", material_type: "wood", size: "10ft" },
  
  // Concrete & Rails
  { crm_name: "Fast-Set Concrete (50 lb bags)", canonical_key: "wood_concrete_fastset_50lb", cost: 7.96, unit: "bags", category: "concrete", material_type: "wood" },
  { crm_name: "2x4x8 Treated Rails", canonical_key: "wood_rail_2x4x8_treated", cost: 13.44, unit: "boards", category: "rail", material_type: "wood" },
  
  // Pickets
  { crm_name: "Wood Picket", canonical_key: "wood_picket_privacy_1x6_6ft", cost: 3.28, unit: "pcs", category: "picket", material_type: "wood" },
  { crm_name: "2\" Galvanized Nail (Picket Install)", canonical_key: "wood_hardware_nail_galv_2in", cost: 5.00, unit: "pcs", category: "hardware", material_type: "wood" },
  
  // Screws
  { crm_name: "#9 x 3 in. Tan Star Flat Head Wood Deck Screw (25 lbs / 1543 pcs)", canonical_key: "wood_hardware_screw_deck_3in", cost: 94.97, unit: "box", category: "hardware", material_type: "wood" },
  
  // Gate Hardware
  { crm_name: "Wood Gate Hinge (Heavy Duty / set of 2)", canonical_key: "wood_hardware_gate_hinge_set", cost: 83.82, unit: "sets", category: "hardware", material_type: "wood" },
  { crm_name: "Heavy Duty Gate Building Kit", canonical_key: "wood_hardware_gate_kit_heavy", cost: 178.00, unit: "kits", category: "hardware", material_type: "wood" },
  { crm_name: "4\" Locklatch (Single Gate)", canonical_key: "wood_hardware_locklatch_4in", cost: 71.44, unit: "pcs", category: "hardware", material_type: "wood" },
  { crm_name: "Locklatch 4\" Gate Latch (Double Gate)", canonical_key: "wood_hardware_locklatch_4in_double", cost: 71.44, unit: "pcs", category: "hardware", material_type: "wood" },
  { crm_name: "Cane Bolt / Drop Rod", canonical_key: "wood_hardware_cane_bolt", cost: 5.82, unit: "pcs", category: "hardware", material_type: "wood" },
  { crm_name: "Gate Handle", canonical_key: "wood_hardware_gate_handle", cost: 9.93, unit: "pcs", category: "hardware", material_type: "wood" },
  
  // Gates
  { crm_name: "Wood Gate", canonical_key: "wood_gate_custom", cost: 525.00, unit: "pcs", category: "gate", material_type: "wood" },
  
  // Board-on-Board specific
  { crm_name: "2x4x8 Top Frame (Board-on-Board)", canonical_key: "wood_rail_2x4x8_topframe", cost: 13.44, unit: "boards", category: "rail", material_type: "wood" },
  { crm_name: "1x4x8 AC2 Under Cap (Board-on-Board)", canonical_key: "wood_cap_1x4x8_undercap", cost: 4.78, unit: "boards", category: "rail", material_type: "wood" },
];

export const ALUMINUM_MATERIALS = [
  // Posts
  { crm_name: "Aluminum End Post", canonical_key: "aluminum_post_end_4ft", cost: 24.99, unit: "pcs", category: "post", material_type: "aluminum" },
  { crm_name: "Aluminum Corner Post", canonical_key: "aluminum_post_corner_4ft", cost: 24.99, unit: "pcs", category: "post", material_type: "aluminum" },
  { crm_name: "Aluminum Line Post", canonical_key: "aluminum_post_line_4ft", cost: 24.99, unit: "pcs", category: "post", material_type: "aluminum" },
  { crm_name: "Aluminum Gate Post", canonical_key: "aluminum_post_gate_4ft", cost: 77.00, unit: "pcs", category: "post", material_type: "aluminum" },
  
  // Panels & Gates
  { crm_name: "Aluminum Fence Panel", canonical_key: "aluminum_panel_fence_4ft", cost: 535.00, unit: "pcs", category: "panel", material_type: "aluminum" },
  { crm_name: "Aluminum Gate Panel", canonical_key: "aluminum_gate_panel_4ft", cost: 1753.63, unit: "pcs", category: "gate", material_type: "aluminum" },
  
  // Hardware
  { crm_name: "Aluminum Post Cap", canonical_key: "aluminum_hardware_post_cap", cost: 1.57, unit: "pcs", category: "hardware", material_type: "aluminum" },
  { crm_name: "Aluminum Gate Hinge (sets of 2)", canonical_key: "aluminum_hardware_gate_hinge_set", cost: 78.41, unit: "sets", category: "hardware", material_type: "aluminum" },
  { crm_name: "5\" Locklatch gate latch", canonical_key: "aluminum_hardware_locklatch_5in", cost: 71.44, unit: "pcs", category: "hardware", material_type: "aluminum" },
  { crm_name: "4\" Locklatch gate lock", canonical_key: "aluminum_hardware_locklatch_4in", cost: 71.44, unit: "pcs", category: "hardware", material_type: "aluminum" },
  { crm_name: "D&D Magna Latch", canonical_key: "aluminum_hardware_magna_latch", cost: 71.44, unit: "pcs", category: "hardware", material_type: "aluminum" },
  { crm_name: "Structural Screws (Aluminum Gate Assembly)", canonical_key: "aluminum_hardware_structural_screws", cost: 24.01, unit: "pcs", category: "hardware", material_type: "aluminum" },
  { crm_name: "Cane Bolt (double gates)", canonical_key: "aluminum_hardware_cane_bolt", cost: 5.82, unit: "pcs", category: "hardware", material_type: "aluminum" },
  
  // Concrete (aluminum is concrete-set)
  { crm_name: "Fast-Set Concrete (50 lb bags)", canonical_key: "aluminum_concrete_fastset_50lb", cost: 7.96, unit: "bags", category: "concrete", material_type: "aluminum" },
];

// Price Modifiers
export const PRICE_MODIFIERS = {
  chainlink_coating: {
    galvanized: 1.00,
    black_vinyl: {
      major_components: 1.22, // fabric, posts, gates, ties
      finish_hardware: 1.12,  // caps, bands, tension bars
      mechanical_hardware: 1.00 // hinges, latches, cane bolts
    }
  },
  vinyl_color: {
    white: 1.00,
    colored: {
      structural: 1.20, // panels, posts, gates, blank posts
      accessories: 1.10, // caps
      non_vinyl_hardware: 1.00 // hinges, latches, screws, etc.
    }
  }
};

// Helper to determine if item gets major/finish/mechanical modifier
export function getChainLinkModifier(itemName, coating) {
  if (coating === 'galvanized') return 1.00;
  
  const majorComponents = ['fabric', 'post', 'gate', 'tie'];
  const finishHardware = ['cap', 'band', 'tension bar'];
  const mechanicalHardware = ['hinge', 'latch', 'cane bolt'];
  
  const nameLower = itemName.toLowerCase();
  
  if (majorComponents.some(c => nameLower.includes(c))) {
    return PRICE_MODIFIERS.chainlink_coating.black_vinyl.major_components;
  } else if (finishHardware.some(c => nameLower.includes(c))) {
    return PRICE_MODIFIERS.chainlink_coating.black_vinyl.finish_hardware;
  } else {
    return PRICE_MODIFIERS.chainlink_coating.black_vinyl.mechanical_hardware;
  }
}

export function getVinylModifier(itemName, color) {
  if (color === 'white' || color === 'White') return 1.00;
  
  const structural = ['panel', 'post', 'gate', 'blank'];
  const accessories = ['cap'];
  
  const nameLower = itemName.toLowerCase();
  
  if (structural.some(c => nameLower.includes(c))) {
    return PRICE_MODIFIERS.vinyl_color.colored.structural;
  } else if (accessories.some(c => nameLower.includes(c))) {
    return PRICE_MODIFIERS.vinyl_color.colored.accessories;
  } else {
    return PRICE_MODIFIERS.vinyl_color.colored.non_vinyl_hardware;
  }
}