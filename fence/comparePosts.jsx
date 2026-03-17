/**
 * COMPARE POSTS
 * Generates post layouts for each variant
 * Pure + deterministic
 */

/**
 * Infer material mode from runs variant
 * @param {Array} runsVariant - Runs for a single variant (a, b, or c)
 * @returns {string} Material type ("Vinyl", "Wood", "Chain Link", "Aluminum") or "Mixed"
 */
export function inferMaterialModeFromRuns(runsVariant) {
  const types = new Set((runsVariant || []).map(r => r.materialType).filter(Boolean));
  if (types.size === 1) return [...types][0];
  return "Mixed";
}

/**
 * Generate post layout for a variant
 * @param {Object} params
 * @param {Function} params.generatePostLayout - Post layout engine
 * @param {Array} params.fenceLines - Fence line geometry
 * @param {Array} params.runsVariant - Runs for this variant (pre-resolved with material overrides)
 * @param {Array} params.gatesClean - Gates (orphan-filtered)
 * @param {number} params.pixelsPerFt - Map scale
 * @returns {Object} { posts, segments, spacingLabels }
 */
export function generateVariantPostLayout({
  generatePostLayout,
  fenceLines,
  runsVariant,
  gatesClean,
  pixelsPerFt
}) {
  const materialMode = inferMaterialModeFromRuns(runsVariant);

  return generatePostLayout({
    fenceLines,
    runs: runsVariant,
    gates: gatesClean,
    materialMode,
    pixelsPerFt
  });
}