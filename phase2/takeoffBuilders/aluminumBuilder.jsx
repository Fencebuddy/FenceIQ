/**
 * ALUMINUM TAKEOFF BUILDER
 * Builds aluminum pool fence takeoffs from takeoff_input with 6' spacing
 */

export function buildAluminumTakeoff(takeoff_input, materialSet) {
  const { runs } = takeoff_input;
  const heightFt = materialSet.heightFt;
  const totalLf = runs.reduce((sum, r) => sum + r.length_lf, 0);
  
  // Calculate totals
  const totalFenceFt = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const totalGateWidthFt = runs.reduce((sum, r) => {
    return sum + r.gates.reduce((gs, g) => gs + g.width_ft, 0);
  }, 0);
  const netFenceFt = Math.max(0, totalFenceFt - totalGateWidthFt);
  
  // Panels - 6' spacing
  const panels = Math.ceil(netFenceFt / 6);
  
  // Posts - simplified estimate
  const linePosts = Math.max(0, panels - 1);
  const gateCount = runs.reduce((sum, r) => sum + r.gates.length, 0);
  const gatePosts = gateCount * 2;
  const terminalPosts = runs.length * 2;
  const totalPosts = terminalPosts + gatePosts + linePosts;
  
  // Concrete - all posts
  const concreteBags = totalPosts * 2;
  
  // Generate UCKs with height and attributes
  const color = materialSet.fenceColor?.toLowerCase() || 'black';
  
  const lineItems = [
    {
      uck: `aluminum_panel_${heightFt}ft_${color}`,
      canonical_key: 'aluminum_panel',
      lineItemName: `${heightFt}' Aluminum Fence Panels`,
      displayName: `${heightFt}' Aluminum Fence Panels`,
      quantityCalculated: panels,
      uom: 'pcs',
      materialType: 'aluminum',
      attributes: { height_ft: heightFt, color },
      notes: `${panels} panels (6' max width)`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_post_line_${heightFt}ft_${color}`,
      canonical_key: 'aluminum_post_line',
      lineItemName: 'Aluminum Line Posts',
      displayName: 'Aluminum Line Posts',
      quantityCalculated: linePosts,
      uom: 'pcs',
      materialType: 'aluminum',
      attributes: { height_ft: heightFt, color },
      notes: `${linePosts} line posts`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_post_terminal_${heightFt}ft_${color}`,
      canonical_key: 'aluminum_post_terminal',
      lineItemName: 'Aluminum Terminal Posts',
      displayName: 'Aluminum Terminal Posts',
      quantityCalculated: terminalPosts,
      uom: 'pcs',
      materialType: 'aluminum',
      attributes: { height_ft: heightFt, color },
      notes: `${terminalPosts} terminal posts`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_cap_flat_${color}`,
      canonical_key: 'aluminum_cap_flat',
      lineItemName: 'Aluminum Post Caps',
      displayName: 'Aluminum Post Caps',
      quantityCalculated: totalPosts,
      uom: 'pcs',
      materialType: 'aluminum',
      attributes: { color },
      notes: '1 per post',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_concrete_fastset_50lb`,
      canonical_key: `aluminum_concrete_fastset_50lb`,
      lineItemName: 'Fast-Set Concrete 50lb',
      quantityCalculated: concreteBags,
      uom: 'bags',
      notes: `${totalPosts} posts × 2 bags`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_gate_panel_${heightFt}ft`,
      canonical_key: `aluminum_gate_panel_${heightFt}ft`,
      lineItemName: 'Aluminum Gate Panel',
      quantityCalculated: gateCount,
      uom: 'pcs',
      notes: `${gateCount} gates`,
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_hardware_gate_hinge_set`,
      canonical_key: `aluminum_hardware_gate_hinge_set`,
      lineItemName: 'Aluminum Gate Hinge Set',
      quantityCalculated: gateCount,
      uom: 'sets',
      notes: '1 set per gate',
      runLabel: 'Overall',
      source: 'phase2'
    },
    {
      uck: `aluminum_hardware_locklatch_4in`,
      canonical_key: `aluminum_hardware_locklatch_4in`,
      lineItemName: 'Locklatch 4in',
      quantityCalculated: gateCount,
      uom: 'pcs',
      notes: '1 per gate',
      runLabel: 'Overall',
      source: 'phase2'
    }
  ];
  
  console.log('[aluminumBuilder] Built', lineItems.length, 'line items for', materialSet.id);
  return lineItems;
}