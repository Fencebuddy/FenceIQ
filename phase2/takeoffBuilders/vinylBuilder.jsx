/**
 * VINYL TAKEOFF BUILDER
 * Builds vinyl privacy fence takeoffs from takeoff_input with 8' spacing
 */

export function buildVinylTakeoff(takeoff_input, materialSet) {
  const { runs } = takeoff_input;
  const heightFt = materialSet.heightFt;
  const totalLf = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const color = (materialSet.color || 'White').toLowerCase();
  
  // Calculate totals
  const totalFenceFt = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const totalGateWidthFt = runs.reduce((sum, r) => {
    return sum + r.gates.reduce((gs, g) => gs + g.width_ft, 0);
  }, 0);
  const netFenceFt = Math.max(0, totalFenceFt - totalGateWidthFt);
  
  // Panels - 8' spacing
  const panels = Math.ceil(netFenceFt / 8);
  
  // Posts - simplified estimate
  const linePosts = Math.max(0, panels - 1);
  const gateCount = runs.reduce((sum, r) => sum + r.gates.length, 0);
  const gatePosts = gateCount * 2;
  const terminalPosts = runs.length * 2;
  const totalVinylPosts = terminalPosts + gatePosts + linePosts;
  
  // Extract system from materialSet (e.g., 'savannah', 'lakeshore')
  const system = materialSet.system || 'savannah';
  
  const lineItems = [
    {
      uck: `vinyl_panel_privacy_${heightFt}ft`,
      canonical_key: `vinyl_panel_privacy_${heightFt}ft`,
      lineItemName: `${heightFt}' Privacy Vinyl Panels`,
      quantityCalculated: panels,
      uom: 'pcs',
      notes: `${panels} panels for ${netFenceFt.toFixed(1)} LF`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_post_line_5x5`,
      canonical_key: `vinyl_post_line_5x5`,
      lineItemName: '5x5 Vinyl Line Post',
      quantityCalculated: linePosts,
      uom: 'pcs',
      notes: `${linePosts} line posts`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_post_end_5x5`,
      canonical_key: `vinyl_post_end_5x5`,
      lineItemName: '5x5 Vinyl End Post',
      quantityCalculated: terminalPosts,
      uom: 'pcs',
      notes: `${terminalPosts} terminal posts`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_hardware_post_cap`,
      canonical_key: `vinyl_hardware_post_cap`,
      lineItemName: 'Vinyl Post Caps',
      quantityCalculated: totalVinylPosts,
      uom: 'pcs',
      notes: '1 per post',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_hardware_galvanized_post_2_5in`,
      canonical_key: `vinyl_hardware_galvanized_post_2_5in`,
      lineItemName: '2.5" Galvanized Post',
      quantityCalculated: totalVinylPosts,
      uom: 'pcs',
      notes: '1 per vinyl post',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_hardware_nodig_donut`,
      canonical_key: `vinyl_hardware_nodig_donut`,
      lineItemName: 'No-Dig Donuts',
      quantityCalculated: totalVinylPosts * 2,
      uom: 'pcs',
      notes: '2 per post',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_hardware_gate_hinge_set`,
      canonical_key: `vinyl_hardware_gate_hinge_set`,
      lineItemName: 'Gate Hinge Set',
      quantityCalculated: gateCount,
      uom: 'sets',
      notes: '1 set per gate',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `vinyl_hardware_locklatch_5in`,
      canonical_key: `vinyl_hardware_locklatch_5in`,
      lineItemName: 'Locklatch 5in',
      quantityCalculated: gateCount,
      uom: 'pcs',
      notes: '1 per gate',
      runLabel: 'Overall',
      source: 'phase2'
    }
  ];
  
  console.log('[vinylBuilder] Built', lineItems.length, 'line items for', materialSet.id);
  return lineItems;
}