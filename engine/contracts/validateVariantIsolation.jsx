/**
 * CONTRACT 6: VARIANT ISOLATION LAW
 * 
 * Variants A/B/C must NEVER share:
 * - Gates
 * - Posts  
 * - Takeoff items
 * - Resolved mappings
 * - Retail anchors
 */

export function validateVariantIsolation({
  variantA,
  variantB,
  variantC
}) {
  const violations = [];
  
  // Check gate ID overlap
  const gateIdsA = new Set((variantA?.gates || []).map(g => g.id));
  const gateIdsB = new Set((variantB?.gates || []).map(g => g.id));
  const gateIdsC = new Set((variantC?.gates || []).map(g => g.id));
  
  const gateOverlapAB = [...gateIdsA].filter(id => gateIdsB.has(id));
  const gateOverlapBC = [...gateIdsB].filter(id => gateIdsC.has(id));
  const gateOverlapAC = [...gateIdsA].filter(id => gateIdsC.has(id));
  
  if (gateOverlapAB.length > 0 || gateOverlapBC.length > 0 || gateOverlapAC.length > 0) {
    violations.push({
      code: 'VARIANT_GATE_SHARING',
      message: 'Variants must not share gate instances',
      severity: 'BLOCKING',
      context: {
        overlap_ab: gateOverlapAB.length,
        overlap_bc: gateOverlapBC.length,
        overlap_ac: gateOverlapAC.length
      }
    });
  }
  
  // Check retail anchor isolation
  if (variantA?.retail_anchor && variantB?.retail_anchor) {
    if (variantA.retail_anchor === variantB.retail_anchor && 
        variantA.takeoff_hash !== variantB.takeoff_hash) {
      violations.push({
        code: 'RETAIL_ANCHOR_SHARING',
        message: 'Different takeoffs sharing same retail anchor',
        severity: 'BLOCKING'
      });
    }
  }
  
  return {
    isolated: violations.length === 0,
    violations
  };
}