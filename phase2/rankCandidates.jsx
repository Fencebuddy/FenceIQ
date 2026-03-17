/**
 * RANK CANDIDATES FOR PHASE 2
 * Assigns GOOD/BETTER/BEST tiers by material cost
 * 
 * VARIANT-SPECIFIC: Uses materialSet.coating to validate variant assignments.
 */

export function rankCandidatesIntoTiers(pricedCandidates, materialSet) {
  if (!materialSet) {
    throw new Error("Phase2 rankCandidatesIntoTiers missing materialSet");
  }
  const complete = (pricedCandidates || []).filter(c => c.status === "complete");

  // Sort by material_cost (lowest → highest)
  complete.sort((a, b) => (a.material_cost || 0) - (b.material_cost || 0));

  // INVARIANT: If Variant B is chain link, it must be black_vinyl
  if (materialSet.variantKey === 'b' && materialSet.materialTypeKey === 'chain_link') {
    if (materialSet.coating !== 'black_vinyl') {
      throw new Error(`rankCandidatesIntoTiers: Variant B chain link MUST be black_vinyl, got ${materialSet.coating}`);
    }
  }

  return {
    GOOD: complete[0] || null,
    BETTER: complete[1] || null,
    BEST: complete[2] || complete[complete.length - 1] || null,
  };
}