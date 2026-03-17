/**
 * CANDIDATE SETS FOR PHASE 2
 * Defines material ladders for Good/Better/Best ranking
 */

import { resolveFenceHeight, heightToCanonical } from './heightNormalizer';

/**
 * Infer need from material type
 */
export function inferNeedFromMaterialType(materialType) {
  const mt = (materialType || "").toLowerCase();
  if (mt.includes("vinyl")) return "privacy";
  if (mt.includes("wood")) return "wood";
  if (mt.includes("chain")) return "metal";
  if (mt.includes("aluminum")) return "metal";
  return "metal";
}

function heightString(heightFt) {
  const h = Number(heightFt || 6);
  return `${h}'`; // matches buildTakeoffFromModel adapter expectation
}

function titleCase(s) {
  if (!s) return s;
  const lower = String(s).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Returns candidate sets for Phase 2.
 * Each candidate is a real fence system takeoff rebuilt from the SAME mapModel.
 * 
 * VARIANT-SPECIFIC: Requires materialSet parameter.
 * Never reads job defaults for coating/material once materialSet exists.
 * 
 * @param {Object} options - { need, baseMaterialType, heightFt, woodStyle, run, job, materialSet }
 *   - materialSet: REQUIRED - immutable variant-specific material properties
 *   - run (optional): Run object with fenceHeight (takes priority)
 *   - job (optional): Job object with fenceHeight (fallback)
 *   - heightFt (optional): Direct height override (lowest priority)
 */
export function getCandidateSets({ need, baseMaterialType, heightFt, woodStyle, run, job, materialSet }) {
  if (!materialSet) {
    throw new Error("Phase2 getCandidateSets missing materialSet (variant material required)");
  }
  // Resolve height with priority: run > job > heightFt > default
  const heightResolved = run || job 
    ? resolveFenceHeight(run, job)
    : { numeric: heightFt || 6, canonical: heightToCanonical(heightFt || 6) };
  
  const fenceHeight = heightString(heightResolved.numeric);
  const heightToken = heightResolved.canonical; // "4ft", "5ft", "6ft", etc.
  const style = titleCase(woodStyle || "Privacy");
  
  console.log(`[getCandidateSets] need=${need}, heightResolved=${heightResolved.numeric}ft (token: ${heightToken}), run.id=${run?.id}, job.id=${job?.id}`);

  if (need === "privacy") {
    return [
      {
        setId: `VY_${heightToken}_WHITE`,
        materialType: "Vinyl",
        overrides: { fenceHeight, fenceColor: "White" },
        heightToken, // Pass height token for consistency
      },
      {
        setId: `VY_${heightToken}_COLORED`,
        materialType: "Vinyl",
        overrides: { fenceHeight, fenceColor: "Colored" },
        heightToken, // Pass height token for consistency
      },
    ];
  }

  if (need === "metal") {
    return [
      // GOOD: Galvanized Chain Link
      {
        setId: `CL_${heightToken}_GALV`,
        materialType: "Chain Link",
        overrides: { fenceHeight, chainLinkCoating: "Galvanized" },
        coating: "galv", // Explicit coating for takeoff builder
        heightToken, // Pass height token for fabric canonical generation
      },
      // BETTER: Black Vinyl Coated Chain Link
      {
        setId: `CL_${heightToken}_BLACK`,
        materialType: "Chain Link",
        overrides: { fenceHeight, chainLinkCoating: "Black Vinyl Coated" },
        coating: "black_vinyl", // Explicit coating for takeoff builder (NOT galv)
        heightToken, // Pass height token for fabric canonical generation
      },
      // BEST: Aluminized Chain Link
      {
        setId: `CL_${heightToken}_ALUMINIZED`,
        materialType: "Chain Link",
        overrides: { fenceHeight, chainLinkCoating: "Aluminized" },
        coating: "aluminized", // Explicit coating for takeoff builder
        heightToken, // Pass height token for fabric canonical generation
      },
      // Alternative BEST: Aluminum Fence
      {
        setId: `AL_${heightToken}`,
        materialType: "Aluminum",
        overrides: { fenceHeight }, // spacing 6' handled by aluminum builder
        heightToken, // Pass height token for consistency
      },
    ];
  }

  // need === "wood"
  return [
    // GOOD baseline = Galv Chain Link
    {
      setId: `CL_${heightToken}_GALV`,
      materialType: "Chain Link",
      overrides: { fenceHeight, chainLinkCoating: "Galvanized" },
      coating: "galv", // Explicit coating for takeoff builder
      heightToken, // Pass height token for fabric canonical generation
    },
    // BETTER = Wood (chosen style)
    {
      setId: `WD_${heightToken}_${String(style).toUpperCase()}`,
      materialType: "Wood",
      overrides: { fenceHeight, style }, // your adapter uses job.style
      heightToken, // Pass height token for consistency
    },
    // BEST = Vinyl privacy (your explicit rule)
    {
      setId: `VY_${heightToken}_WHITE`,
      materialType: "Vinyl",
      overrides: { fenceHeight, fenceColor: "White" },
      heightToken, // Pass height token for consistency
    },
  ];
}

/**
 * Legacy function for backward compatibility
 */
export function getCandidateSetsForNeed(baseMaterial, heightFt) {
  const need = inferNeedFromMaterialType(baseMaterial);
  return getCandidateSets({ need, baseMaterialType: baseMaterial, heightFt });
}