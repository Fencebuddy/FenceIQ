/**
 * WOOD TAKEOFF BUILDER
 * Builds wood fence takeoffs from takeoff_input with 8' spacing
 */

export function buildWoodTakeoff(takeoff_input, materialSet) {
  const { runs } = takeoff_input;
  const heightFt = materialSet.heightFt;
  const totalLf = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const style = (materialSet.style || 'Privacy').toLowerCase().replace(/[-\s]/g, '');
  
  // Calculate totals
  const totalFenceFt = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const totalGateWidthFt = runs.reduce((sum, r) => {
    return sum + r.gates.reduce((gs, g) => gs + g.width_ft, 0);
  }, 0);
  const effectiveFenceFt = Math.max(0, totalFenceFt - totalGateWidthFt);
  
  // Posts - simplified estimate (8' bays)
  const totalBays = Math.ceil(effectiveFenceFt / 8);
  const linePosts = Math.max(0, totalBays - 1);
  const gateCount = runs.reduce((sum, r) => sum + r.gates.length, 0);
  const gatePosts = gateCount * 2;
  const terminalPosts = runs.length * 2;
  
  // Rails (3 per bay for 6' fence)
  const railsPerBay = heightFt >= 7 ? 4 : heightFt <= 4 ? 2 : 3;
  const railBoards = Math.ceil(totalBays * railsPerBay * 1.10);
  
  // Pickets - formula: (LF / 8) × 17 × 1.05 waste
  const pickets = Math.ceil((effectiveFenceFt / 8) * 17 * 1.05);
  
  // Concrete - gate posts only
  const concreteBags = gatePosts * 2;
  
  // Hardware estimates
  const nailsLbs = Math.ceil(pickets / 100); // ~100 pickets per lb
  const screwsLbs = Math.ceil(railBoards / 50); // ~50 rails per lb
  
  const lineItems = [
    {
      uck: `wood_post_driven_4x4_steel`,
      canonical_key: `wood_post_driven_4x4_steel`,
      lineItemName: 'Driven Steel 4x4 Post',
      quantityCalculated: terminalPosts + linePosts,
      uom: 'pcs',
      notes: `${terminalPosts} terminal + ${linePosts} line`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_post_gate_4x6_treated`,
      canonical_key: `wood_post_gate_4x6_treated`,
      lineItemName: 'Gate Post 4x6 Treated',
      quantityCalculated: gatePosts,
      uom: 'pcs',
      notes: `${gateCount} gates × 2`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_rail_2x4x8_treated`,
      canonical_key: `wood_rail_2x4x8_treated`,
      lineItemName: '2x4x8 Treated Rails',
      quantityCalculated: railBoards,
      uom: 'pcs',
      notes: `${totalBays} bays × ${railsPerBay} rails × 1.10 waste`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_picket_${style}_1x6_${heightFt}ft`,
      canonical_key: `wood_picket_${style}_1x6_${heightFt}ft`,
      lineItemName: `Wood Pickets (${style})`,
      quantityCalculated: pickets,
      uom: 'pcs',
      notes: `(${effectiveFenceFt.toFixed(1)} ft / 8) × 17 × 1.05 waste`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_hardware_nail_galv_2in`,
      canonical_key: `wood_hardware_nail_galv_2in`,
      lineItemName: '2in Galv Nails',
      quantityCalculated: nailsLbs,
      uom: 'lbs',
      notes: 'For pickets',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_hardware_screw_deck_3in`,
      canonical_key: `wood_hardware_screw_deck_3in`,
      lineItemName: '3in Deck Screws',
      quantityCalculated: screwsLbs,
      uom: 'lbs',
      notes: 'For rails',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_concrete_fastset_50lb`,
      canonical_key: `wood_concrete_fastset_50lb`,
      lineItemName: 'Fast-Set Concrete 50lb',
      quantityCalculated: concreteBags,
      uom: 'bags',
      notes: `${gatePosts} gate posts × 2 (line posts are driven)`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_hardware_gate_hinge_set`,
      canonical_key: `wood_hardware_gate_hinge_set`,
      lineItemName: 'Gate Hinge Set',
      quantityCalculated: gateCount,
      uom: 'sets',
      notes: '1 set per gate',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `wood_hardware_locklatch_4in`,
      canonical_key: `wood_hardware_locklatch_4in`,
      lineItemName: 'Locklatch 4in',
      quantityCalculated: gateCount,
      uom: 'pcs',
      notes: '1 per gate',
      runLabel: 'Overall',
      source: 'phase2'
    }
  ];
  
  console.log('[woodBuilder] Built', lineItems.length, 'line items for', materialSet.id);
  return lineItems;
}