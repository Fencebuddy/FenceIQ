/**
 * COMPARE TAKEOFFS
 * Builds takeoffs for all 3 variants in one pass
 * Pure + deterministic
 */

import { buildVariantRuns } from "./buildVariantRuns";
import { generateVariantPostLayout } from "./comparePosts";
import { getTierA, getTierB, getTierC, buildVariantMaterialSet } from "./compareVariantsService";

/**
 * Normalize string for key matching
 */
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "_");

/**
 * Choose canonical key with color awareness
 * Prefers color-specific key if it exists in catalog
 */
function chooseCanonicalKey({ baseKey, variantMaterial, variantColor, catalogKeySet }) {
  const base = norm(baseKey);
  if (!base) return base;

  const isVinyl = String(variantMaterial || "").toLowerCase() === "vinyl";
  const color = norm(variantColor);

  // Vinyl: prefer color-specific key if it exists
  if (isVinyl && color) {
    const withColor = `${base}_${color}`;
    if (catalogKeySet?.has(withColor)) return withColor;

    // Optional support for Savannah-style
    const withSavannahColor = `${base}_savannah_${color}`;
    if (catalogKeySet?.has(withSavannahColor)) return withSavannahColor;
  }

  // Otherwise keep base (even if vinyl) — catalog is truth
  return base;
}

/**
 * Normalize all line items for a variant
 * Applies color-aware key selection before catalog lookup
 */
function normalizeVariantLineItems({ lineItems, variantMaterial, variantColor, catalogKeySet }) {
  return (lineItems || []).map((item) => {
    const nextKey = chooseCanonicalKey({
      baseKey: item.canonical_key,
      variantMaterial,
      variantColor,
      catalogKeySet
    });

    return {
      ...item,
      canonical_key: nextKey,
      variantMaterial,
      variantColor
    };
  });
}

/**
 * Deduplicate gates by ID, filter orphans
 * @param {Array} gates
 * @returns {Array} Clean gates
 */
export function dedupGatesById(gates) {
  const seen = new Set();
  const out = [];
  for (const g of (gates || [])) {
    if (!g?.id) continue;
    if (g.isOrphan) continue;
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

/**
 * Build comparison takeoffs for all 3 variants (STEP 3-4)
 * Follows reset plan: Each variant gets its own posts + takeoff.
 * NO reuse, NO sharing, NO mutation.
 * 
 * @param {Object} params
 * @param {Object} params.job - Job object (base, not variant-modified)
 * @param {Array} params.fenceLines - Fence lines with geometry
 * @param {Array} params.runs - Runs (may have compareVariants field)
 * @param {Array} params.gates - Raw gates from DB
 * @param {number} params.pixelsPerFt - Map scale
 * @param {Function} params.generatePostLayout - Post layout engine
 * @param {Function} params.buildTakeoff - Takeoff builder (materials + posts)
 * @param {Array} params.catalog - Material catalog for key matching
 * @returns {Object} { a: {...}, b: {...}, c: {...} } with full V1 shape (lineItems, postCounts, total_lf, etc.)
 */
export function buildComparisonTakeoffs({
  job,
  fenceLines,
  runs,
  gates,
  pixelsPerFt,
  generatePostLayout,
  buildTakeoff,
  catalog
}) {
  const gatesClean = dedupGatesById(gates);
  const variants = ["a", "b", "c"];
  const out = {};

  // Build catalog key set ONCE before loop for all color-aware key matching
  const catalogKeySet = new Set((catalog || []).map(c => norm(c.canonical_key || '')));

  // ✅ STEP 2 DIAGNOSTIC: What does catalog actually contain?
  const allKeys = [...catalogKeySet];
  console.log("[CATALOG INSPECTION] Total keys:", allKeys.length);
  console.log("[CATALOG] sample vinyl keys:", allKeys.filter(k => k.startsWith("vinyl_")).slice(0, 50));
  console.log("[CATALOG] counts:", {
    vinyl: allKeys.filter(k => k.startsWith("vinyl_")).length,
    chainlink: allKeys.filter(k => k.startsWith("chainlink_")).length,
    aluminum: allKeys.filter(k => k.startsWith("aluminum_")).length,
    wood: allKeys.filter(k => k.startsWith("wood_")).length,
  });

  for (const key of variants) {
    // STEP 3: Build variant runs with material overrides
    let runsVariant = buildVariantRuns({ runs, job, variantKey: key });
    
    // STEP 3.5: BUILD VARIANT MATERIALSET (Phase 2 source of truth)
    // This ensures coating tokens (e.g., 'black_vinyl') are explicitly set, NOT derived from job defaults
    const tierFn = key === 'a' ? getTierA : key === 'b' ? getTierB : getTierC;
    const variantConfig = tierFn(job, runsVariant[0]); // Get tier config for this variant
    const variantMaterialSet = buildVariantMaterialSet(key, variantConfig, job, runsVariant[0]);
    
    // Log materialSet for diagnosis
    console.log(`[compareTakeoffs] Variant ${key} materialSet:`, {
      materialType: variantMaterialSet.materialType,
      coating: variantMaterialSet.coating,
      chainLinkCoating: variantMaterialSet.chainLinkCoating
    });

    // STEP 5: Determine variant material + color context EARLY
    const variantMaterial = runsVariant[0]?.materialType || job.materialType;

    // Only use variant color from the run itself
    let variantColor = runsVariant[0]?.fenceColor || runsVariant[0]?.chainLinkCoating || "";

    // For vinyl, enforce a safe default (never allow wood color to leak)
    if (String(variantMaterial).toLowerCase() === "vinyl" && !variantColor) {
      variantColor = "white";
    }

    // ✅ DIAGNOSTIC: Confirm variant inputs before takeoff
    console.log("VARIANT CHECK", key, {
      material: runsVariant[0]?.materialType,
      fenceColor: runsVariant[0]?.fenceColor,
      chainLinkCoating: runsVariant[0]?.chainLinkCoating,
      derivedMaterial: variantMaterial,
      derivedColor: variantColor
    });

    // ✅ CRITICAL: Normalize run colors BEFORE buildTakeoff() uses them
    // This prevents wood colors (pine, cedar) from leaking into vinyl gate/post keys
    runsVariant = runsVariant.map(run => ({
      ...run,
      fenceColor: String(variantMaterial).toLowerCase() === "vinyl" ? variantColor : run.fenceColor
    }));

    // STEP 3 CRITICAL: Generate POSTS per variant (not shared)
    const layoutVariant = generateVariantPostLayout({
      generatePostLayout,
      fenceLines,
      runsVariant,
      gatesClean,
      pixelsPerFt
    });
    const postsVariant = layoutVariant?.posts || [];

    // STEP 4: Build takeoff (true V1 call, one per variant, with isVariant=true to infer material)
     // CRITICAL: Pass variantMaterialSet so builder uses variant coating, NOT job defaults
     const takeoff = buildTakeoff(job, fenceLines, runsVariant, gatesClean, postsVariant, true, { variantMaterialSet });

    // ✅ DIAGNOSTIC: Log takeoff canonical keys
    console.log(`[TAKEOFF ${key}] canonical keys:`, (takeoff?.lineItems || []).map(li => li.canonical_key));
    console.log(`[TAKEOFF ${key}] missing/invalid keys:`, (takeoff?.lineItems || []).filter(li => !li.canonical_key || li.canonical_key === "INVALID_CANONICAL_KEY"));

    // ✅ Normalize canonical keys BEFORE anyone renders/looks up catalog items
    const normalizedLineItems = normalizeVariantLineItems({
      lineItems: takeoff?.lineItems || [],
      variantMaterial,
      variantColor,
      catalogKeySet
    });

    // ✅ Ensure the returned takeoff carries normalized keys
    const takeoffNormalized = {
      ...takeoff,
      lineItems: normalizedLineItems
    };

    // ✅ DIAGNOSTIC: Verify no wood colors leaked into vinyl keys
    if (String(variantMaterial).toLowerCase() === 'vinyl') {
      const badKeys = (normalizedLineItems || []).filter(i =>
        /_pine\b|_cedar\b|_redwood\b/.test(String(i.canonical_key || ""))
      );
      if (badKeys.length > 0) {
        console.warn("❌ VINYL KEYS STILL CONTAIN WOOD COLORS", {
          variant: key,
          variantColor,
          badKeys: badKeys.map(i => i.canonical_key)
        });
      } else {
        console.log("✅ VINYL KEYS CLEAN (NO WOOD COLORS)", { variant: key, variantColor });
      }
    }

    out[key] = {
      variantKey: key,
      lineItems: normalizedLineItems,
      postCounts: takeoffNormalized?.postCounts || {},
      total_lf: takeoffNormalized?.total_lf || takeoffNormalized?.metrics?.total_lf || 0,
      graph: takeoffNormalized?.graph || null,
      runs: runsVariant,            // Store variant runs
      posts: postsVariant || [],    // Store variant posts
      variantMaterial,
      variantColor,
      variantMaterialSet,           // CRITICAL: Store Phase 2 variant material set (immutable, no fallbacks)
      timestamp: new Date().toISOString()
    };
    }

    return out;
    }