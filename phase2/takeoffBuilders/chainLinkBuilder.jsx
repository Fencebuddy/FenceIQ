/**
 * CHAIN LINK TAKEOFF BUILDER (UCK GENERATION)
 * Builds chain link takeoffs with Universal Canonical Keys
 * VARIANT-SPECIFIC: Requires materialSet with immutable coating
 */

import { normalizeFinish, getFinishLabel } from '@/components/materials/normalizeFinish';

/**
 * Deterministic fabric height selection.
 * No fallbacks, no inference from posts.
 */
function getFabricHeightForFenceHeight(fenceHeightFt) {
  const validHeights = [3, 4, 5, 6, 8, 10, 12];
  if (validHeights.includes(fenceHeightFt)) {
    return fenceHeightFt;
  }
  throw new Error(`getFabricHeightForFenceHeight: invalid fence height ${fenceHeightFt}ft`);
}

/**
 * Generate UCK for chain link item
 * Format: chainlink_<kind>_<height>_<finish>
 * Always uses materialSet.coating (never job defaults)
 */
function generateChainLinkUCK({ kind, height_ft, finish }) {
  const finToken = normalizeFinish(finish);
  const heightToken = typeof height_ft === 'number' ? `${height_ft}ft` : height_ft;
  
  return `chainlink_${kind}_${heightToken}_${finToken}`;
}

export function buildChainLinkTakeoff(takeoff_input, materialSet) {
  if (!materialSet) {
    throw new Error("Phase2 builder missing materialSet (variant material required)");
  }
  
  const { runs } = takeoff_input;
  
  // GUARD: Variant B chain link MUST be black_vinyl
  if (materialSet.variantKey === 'b' && materialSet.materialTypeKey === 'chain_link') {
    if (materialSet.coating !== 'black_vinyl') {
      console.error(`[chainLinkBuilder] INVARIANT VIOLATED: Variant B chain link is not black_vinyl!`, {
        variantKey: materialSet.variantKey,
        coating: materialSet.coating,
        expected: 'black_vinyl'
      });
      throw new Error(`Variant B chain link MUST have black_vinyl coating, got ${materialSet.coating}`);
    }
  }
  
  // Get height from materialSet (never from job defaults)
  const heightFt = materialSet.heightFt;
  if (!heightFt || ![3, 4, 5, 6, 8, 10, 12].includes(heightFt)) {
    throw new Error(`buildChainLinkTakeoff: invalid heightFt from materialSet: ${heightFt}`);
  }
  
  // Fabric height must match fence height (no fallback, no default to 6)
  const fabricHeightFt = getFabricHeightForFenceHeight(heightFt);
  
  const coating = materialSet.coating;
  if (!coating) {
    throw new Error(`buildChainLinkTakeoff: materialSet.coating missing for chain link`);
  }
  
  const fin = normalizeFinish(coating);
  const finLabel = getFinishLabel(fin);
  const heightToken = materialSet.heightToken;
  
  // DEBUG: Log variant materialSet state (dev only)
  console.log(`[Phase2] variant ${materialSet.variantKey} materialSet`, {
    materialType: materialSet.materialType,
    coating: materialSet.coating,
    heightFt,
    fabricHeightFt,
    heightToken
  });
  
  // Calculate totals
  const totalFenceFt = runs.reduce((sum, r) => sum + r.length_lf, 0);
  const totalGateWidthFt = runs.reduce((sum, r) => {
    return sum + r.gates.reduce((gs, g) => gs + g.width_ft, 0);
  }, 0);
  const netFenceFt = Math.max(0, totalFenceFt - totalGateWidthFt);
  
  // Constants
  const wastePct = 0.05;
  const fabricRollLengthFt = 50;
  const topRailStickLengthFt = 21;
  
  // Fabric & Rails
  const effectiveFenceFtWithWaste = Math.ceil(netFenceFt * (1 + wastePct));
  const fabricRolls = Math.ceil(effectiveFenceFtWithWaste / fabricRollLengthFt);
  const topRailSticks = Math.ceil(effectiveFenceFtWithWaste / topRailStickLengthFt);
  
  // Posts - simplified for Phase 2 (estimate from length)
  const linePosts = Math.floor(netFenceFt / 10); // 10' spacing
  const gateCount = runs.reduce((sum, r) => sum + r.gates.length, 0);
  const gatePosts = gateCount * 2;
  const terminalPosts = runs.length * 2; // Estimate: 2 per run
  
  const lineItems = [];
  
  // Fabric - use fabricHeightFt (NOT fence height) for canonical key
  const fabricUCK = generateChainLinkUCK({ 
    kind: 'fabric', 
    height_ft: fabricHeightFt,
    finish: coating
  });
  lineItems.push({
    uck: fabricUCK,
    canonical_key: 'chainlink_fabric',
    lineItemName: `${fabricHeightFt}' Chain Link Fabric (${finLabel})`,
    displayName: `${fabricHeightFt}' Chain Link Fabric (${finLabel})`,
    quantityCalculated: fabricRolls,
    uom: 'roll',
    materialType: 'chain_link',
    fenceSystem: 'chainlink_residential',
    attributes: { height_ft: fabricHeightFt, finish: fin },
    notes: `${fabricRolls} rolls × 50 ft`,
    source: 'phase2'
  });
  
  // Top Rail
  const railUCK = generateChainLinkUCK({ 
    kind: 'rail_top', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: railUCK,
    canonical_key: 'chainlink_rail_top',
    lineItemName: `Top Rail (${finLabel})`,
    displayName: `Top Rail (${finLabel})`,
    quantityCalculated: effectiveFenceFtWithWaste,
    uom: 'lf',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Tension Wire
  const tensionWireUCK = generateChainLinkUCK({ 
    kind: 'tension_wire', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: tensionWireUCK,
    canonical_key: 'chainlink_tension_wire',
    lineItemName: `Tension Wire (${finLabel})`,
    displayName: `Tension Wire (${finLabel})`,
    quantityCalculated: effectiveFenceFtWithWaste,
    uom: 'lf',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Terminal Posts
  const terminalPostUCK = generateChainLinkUCK({ 
    kind: 'post_terminal', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: terminalPostUCK,
    canonical_key: 'chainlink_post_terminal',
    lineItemName: `Terminal Posts (${finLabel})`,
    displayName: `Terminal Posts (${finLabel})`,
    quantityCalculated: terminalPosts + gatePosts,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Line Posts
  const linePostUCK = generateChainLinkUCK({ 
    kind: 'post_line', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: linePostUCK,
    canonical_key: 'chainlink_post_line',
    lineItemName: `Line Posts (${finLabel})`,
    displayName: `Line Posts (${finLabel})`,
    quantityCalculated: linePosts,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Loop Caps
  const loopCapUCK = generateChainLinkUCK({ 
    kind: 'cap_loop', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: loopCapUCK,
    canonical_key: 'chainlink_cap_loop',
    lineItemName: `Loop Caps (${finLabel})`,
    displayName: `Loop Caps (${finLabel})`,
    quantityCalculated: linePosts,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Dome Caps
  const domeCapUCK = generateChainLinkUCK({ 
    kind: 'cap_dome', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: domeCapUCK,
    canonical_key: 'chainlink_cap_dome',
    lineItemName: `Dome Caps (${finLabel})`,
    displayName: `Dome Caps (${finLabel})`,
    quantityCalculated: terminalPosts + gatePosts,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Brace Bands
  const braceBandUCK = generateChainLinkUCK({ 
    kind: 'band_brace', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: braceBandUCK,
    canonical_key: 'chainlink_band_brace',
    lineItemName: `Brace Bands (${finLabel})`,
    displayName: `Brace Bands (${finLabel})`,
    quantityCalculated: (terminalPosts + gatePosts) * 2,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  // Tension Bands
  const tensionBandUCK = generateChainLinkUCK({ 
    kind: 'band_tension', 
    height_ft: heightFt, 
    finish: coating 
  });
  lineItems.push({
    uck: tensionBandUCK,
    canonical_key: 'chainlink_band_tension',
    lineItemName: `Tension Bands (${finLabel})`,
    displayName: `Tension Bands (${finLabel})`,
    quantityCalculated: (terminalPosts + gatePosts) * 5,
    uom: 'pcs',
    materialType: 'chain_link',
    source: 'phase2'
  });
  
  console.log(`[chainLinkBuilder] Variant ${materialSet.variantKey}: ${lineItems.length} items, fabricHeight=${fabricHeightFt}ft, coating=${coating}`);
  
  return lineItems;
}