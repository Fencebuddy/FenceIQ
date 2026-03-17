/**
 * BUILD VARIANT RUNS
 * Apply material overrides from compareVariants field
 * Pure + deterministic
 */

import { ensureRunCompareVariants } from "./compareVariantsService";

/**
 * Build runs for a single variant with material overrides applied
 * @param {Object} params
 * @param {Array} params.runs - Base runs (unvariant)
 * @param {Object} params.job - Job for defaults
 * @param {string} params.variantKey - Variant key: 'a', 'b', or 'c'
 * @returns {Array} Runs with variant material overrides applied
 */
export function buildVariantRuns({ runs, job, variantKey }) {
  if (!runs || !variantKey) return [];

  return runs.map(run => {
    const ensuredRun = ensureRunCompareVariants(run, job);
    const baseRun = { ...ensuredRun };

    // Check if run has compareVariants with overrides for this variant
    if (baseRun.compareVariants && baseRun.compareVariants[variantKey]) {
      const override = baseRun.compareVariants[variantKey];

      // Apply material overrides (only if explicitly set)
      if (override.materialType) baseRun.materialType = override.materialType;
      if (override.fenceHeight) baseRun.fenceHeight = override.fenceHeight;
      if (override.style) baseRun.style = override.style;
      if (override.ranchStyleType) baseRun.ranchStyleType = override.ranchStyleType;
      if (override.chainLinkCoating) baseRun.chainLinkCoating = override.chainLinkCoating;
      if (override.chainLinkPrivacyType) baseRun.chainLinkPrivacyType = override.chainLinkPrivacyType;
      if (override.vinylSlatColor) baseRun.vinylSlatColor = override.vinylSlatColor;
      if (override.fenceColor) baseRun.fenceColor = override.fenceColor;
      if (override.railsAndPostColor) baseRun.railsAndPostColor = override.railsAndPostColor;
      if (override.picketColor) baseRun.picketColor = override.picketColor;
      if (override.slopeMode) baseRun.slopeMode = override.slopeMode;
      if (override.slopeGrade !== undefined) baseRun.slopeGrade = override.slopeGrade;
      if (override.slopeRangeLabel) baseRun.slopeRangeLabel = override.slopeRangeLabel;
    }

    return baseRun;
  });
}