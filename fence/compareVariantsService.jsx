// components/fence/compareVariantsService.js
// PATCH: Fix premium picker to canonical priority order
// PATCH: Confirm metal BEST (C) = Black Aluminum Fence

/* ----------------------------- helpers ----------------------------- */

const norm = (v) => (v ?? "").toString().trim();
const lower = (v) => norm(v).toLowerCase();

const MATERIAL = {
  VINYL: "Vinyl",
  WOOD: "Wood",
  CHAIN: "Chain Link",
  ALUM: "Aluminum",
};

const COATING = {
  GALV: "Galvanized",
  ALUM: "Aluminized",
  BLACK: "Black Vinyl Coated",
};

// Locked premium set + canonical priority order
const PREMIUM_VINYL_ORDER = ["Black", "Cedar Tone", "Coastal Grey"];

const isVinyl = (mt) => norm(mt) === MATERIAL.VINYL;
const isWood = (mt) => norm(mt) === MATERIAL.WOOD;
const isChain = (mt) => norm(mt) === MATERIAL.CHAIN || norm(mt) === "ChainLink";
const isAlum = (mt) => norm(mt) === MATERIAL.ALUM;

const isWhiteVinylColor = (color) => lower(color) === "white";
const isPremiumVinylColor = (color) =>
  PREMIUM_VINYL_ORDER.some((p) => lower(p) === lower(color));

function getFenceHeight(job, run) {
  return norm(run?.fenceHeight) || norm(job?.fenceHeight) || "6'";
}

function getStyle(job, run) {
  const s = norm(run?.style) || norm(job?.style);
  return s || undefined;
}

function getChosenMaterial(job, run) {
  const mt = norm(run?.materialType) || norm(job?.materialType) || MATERIAL.VINYL;
  if (mt === "ChainLink") return MATERIAL.CHAIN;
  return mt;
}

function getChosenVinylColor(job, run) {
  return norm(run?.fenceColor) || norm(job?.fenceColor) || "White";
}

function getChosenChainCoating(job, run) {
  return norm(run?.chainLinkCoating) || norm(job?.chainLinkCoating) || COATING.GALV;
}

/**
 * Canonical premium selection:
 * Unless one of them is chosen, BEST goes: Black -> Cedar Tone -> Coastal Grey
 * For now we default to Black (top of the order).
 * If you later want cycling, we can rotate based on run.id or a counter.
 */
function pickDefaultPremiumColor() {
  return PREMIUM_VINYL_ORDER[0]; // "Black"
}

/**
 * When chosen vinyl color is premium, BETTER must be closest non-premium.
 * Tune anytime.
 */
function closestNonPremiumVinylColor(premiumColor) {
  const c = lower(premiumColor);
  if (c === "coastal grey") return "Grey";   // standard Grey (non-premium)
  if (c === "black") return "Grey";
  if (c === "cedar tone") return "Khaki";
  return "Khaki";
}

/* --------------------------- tier builders -------------------------- */

export function getTierA(job, run) {
   const mt = getChosenMaterial(job, run);
   const fenceHeight = getFenceHeight(job, run);
   const style = getStyle(job, run);

   // METAL ladder trigger: Chain Link OR Aluminum selected
   if (isChain(mt) || isAlum(mt)) {
     const chosenCoating = getChosenChainCoating(job, run);
     // A = Galv/Aluminized treated same tier; keep chosen baseline if applicable
     const aCoating =
       chosenCoating === COATING.ALUM || chosenCoating === COATING.GALV
         ? chosenCoating
         : COATING.GALV;

     // Map display value to token
     const coatingToken = 
       aCoating === COATING.GALV ? 'galv' :
       aCoating === COATING.ALUM ? 'aluminized' :
       aCoating === COATING.BLACK ? 'black_vinyl' :
       'galv';

     return {
       materialType: MATERIAL.CHAIN,
       chainLinkCoating: aCoating,
       coating: coatingToken,
       fenceHeight,
       ...(style ? { style } : {}),
     };
   }

  // Wood OR White Vinyl ladder: A stays same material
  if (isWood(mt)) {
    return {
      materialType: MATERIAL.WOOD,
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  if (isVinyl(mt) && isWhiteVinylColor(getChosenVinylColor(job, run))) {
    return {
      materialType: MATERIAL.WOOD,
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // Vinyl (non-white): A = White Vinyl
  return {
    materialType: MATERIAL.VINYL,
    fenceColor: "White",
    fenceHeight,
    ...(style ? { style } : {}),
  };
}

export function getTierB(job, run) {
   const mt = getChosenMaterial(job, run);
   const fenceHeight = getFenceHeight(job, run);
   const style = getStyle(job, run);

   // METAL ladder: B = Black Vinyl Coated Chain Link
   if (isChain(mt) || isAlum(mt)) {
     return {
       materialType: MATERIAL.CHAIN,
       chainLinkCoating: COATING.BLACK,
       coating: 'black_vinyl',
       fenceHeight,
       ...(style ? { style } : {}),
     };
   }

  // Wood ladder: B = Vinyl White
  if (isWood(mt)) {
    return {
      materialType: MATERIAL.VINYL,
      fenceColor: "White",
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // White Vinyl ladder: B = White Vinyl (stays vinyl)
  if (isVinyl(mt) && isWhiteVinylColor(getChosenVinylColor(job, run))) {
    return {
      materialType: MATERIAL.VINYL,
      fenceColor: "White",
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // Vinyl (non-white): B = chosen color unless chosen is premium -> closest non-premium
  const chosenColor = getChosenVinylColor(job, run);
  const bColor = isPremiumVinylColor(chosenColor)
    ? closestNonPremiumVinylColor(chosenColor)
    : chosenColor;

  return {
    materialType: MATERIAL.VINYL,
    fenceColor: bColor,
    fenceHeight,
    ...(style ? { style } : {}),
  };
}

export function getTierC(job, run) {
  const mt = getChosenMaterial(job, run);
  const fenceHeight = getFenceHeight(job, run);
  const style = getStyle(job, run);

  // ✅ METAL ladder: C = Black Aluminum Fence (confirmed)
  if (isChain(mt) || isAlum(mt)) {
    return {
      materialType: MATERIAL.ALUM,
      fenceColor: "Black",
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // Wood ladder: C = Vinyl Khaki
  if (isWood(mt)) {
    return {
      materialType: MATERIAL.VINYL,
      fenceColor: "Khaki",
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // White Vinyl ladder: C = Khaki Vinyl (stays vinyl, upgrade color)
  if (isVinyl(mt) && isWhiteVinylColor(getChosenVinylColor(job, run))) {
    return {
      materialType: MATERIAL.VINYL,
      fenceColor: "Khaki",
      fenceHeight,
      ...(style ? { style } : {}),
    };
  }

  // Vinyl (non-white):
  // Premium colors ALWAYS belong on BEST (C). If chosen is premium, C = chosen premium.
  // Otherwise C = default premium (Black) per canonical order.
  const chosenColor = getChosenVinylColor(job, run);
  const cColor = isPremiumVinylColor(chosenColor)
    ? chosenColor
    : pickDefaultPremiumColor(); // "Black" (priority)

  return {
    materialType: MATERIAL.VINYL,
    fenceColor: cColor,
    fenceHeight,
    ...(style ? { style } : {}),
  };
}

/* ---------------------------- generator ---------------------------- */

export function generateDefaultGBBVariants({ job, run }) {
  return {
    a: getTierA(job, run),
    b: getTierB(job, run),
    c: getTierC(job, run),
  };
}

/* ----------------------- materialSet builders ----------------------- */

/**
 * Build variant-specific materialSet for phase2 pipeline.
 * This is the ONLY source of truth for variant coating/finish.
 * Uses BOTH coating token (from variantConfig.coating) and display value
 * (from variantConfig.overrides.chainLinkCoating).
 * 
 * @param {string} variantKey - 'a', 'b', or 'c'
 * @param {Object} variantConfig - Tier config with { coating: token, overrides: { chainLinkCoating: display }, ... }
 * @param {Object} job - Job details
 * @param {Object} run - Run details
 * @returns {Object} Variant-specific materialSet
 */
export function buildVariantMaterialSet(variantKey, variantConfig, job, run) {
  const mt = variantConfig.materialType;
  const fenceHeight = variantConfig.fenceHeight || getFenceHeight(job, run);
  
  // Determine numeric height for consistency
  const heightMatch = fenceHeight.match(/(\d+)/);
  const heightFt = heightMatch ? parseInt(heightMatch[1]) : 6;
  const heightToken = `${heightFt}ft`;
  
  // Chain Link: Use BOTH coating token (for canonical keys) + display value (for UI)
   if (isChain(mt)) {
     // Extract coating token from variantConfig.coating (normalized: 'galv', 'aluminized', 'black_vinyl')
     const coatingToken = variantConfig.coating;
     if (!coatingToken) {
       throw new Error(
         `buildVariantMaterialSet: Chain Link variant ${variantKey} missing coating token. ` +
         `Expected variantConfig.coating to be one of: galv, aluminized, black_vinyl`
       );
     }

     // Extract display value directly from variantConfig.chainLinkCoating (NOT job defaults)
     const displayValue = variantConfig.chainLinkCoating;
     if (!displayValue) {
       throw new Error(
         `buildVariantMaterialSet: Chain Link variant ${variantKey} missing display value. ` +
         `Expected variantConfig.chainLinkCoating`
       );
     }

     return {
       materialType: 'Chain Link',
       materialTypeKey: 'chain_link',
       fenceHeight,
       fenceHeightFt: heightFt,
       heightToken,
       coating: coatingToken,  // Token for canonical keys (galv, aluminized, black_vinyl)
       chainLinkCoating: displayValue,  // Display value for UI (ONLY from variantConfig, never job defaults)
       style: variantConfig.style || undefined,
       variantKey,
       variantLabel: variantKey === 'a' ? 'Good' : variantKey === 'b' ? 'Better' : 'Best',
     };
   }
  
  // Vinyl
  if (isVinyl(mt)) {
    return {
      materialType: 'Vinyl',
      materialTypeKey: 'vinyl',
      fenceHeight,
      fenceHeightFt: heightFt,
      heightToken,
      fenceColor: variantConfig.fenceColor || undefined,
      style: variantConfig.style || undefined,
      variantKey,
      variantLabel: variantKey === 'a' ? 'Good' : variantKey === 'b' ? 'Better' : 'Best',
    };
  }
  
  // Wood
  if (isWood(mt)) {
    return {
      materialType: 'Wood',
      materialTypeKey: 'wood',
      fenceHeight,
      fenceHeightFt: heightFt,
      heightToken,
      style: variantConfig.style || undefined,
      variantKey,
      variantLabel: variantKey === 'a' ? 'Good' : variantKey === 'b' ? 'Better' : 'Best',
    };
  }
  
  // Aluminum
  if (isAlum(mt)) {
    return {
      materialType: 'Aluminum',
      materialTypeKey: 'aluminum',
      fenceHeight,
      fenceHeightFt: heightFt,
      heightToken,
      fenceColor: variantConfig.fenceColor || undefined,
      style: variantConfig.style || undefined,
      variantKey,
      variantLabel: variantKey === 'a' ? 'Good' : variantKey === 'b' ? 'Better' : 'Best',
    };
  }
  
  // Fallback
  return {
    materialType: mt,
    fenceHeight,
    fenceHeightFt: heightFt,
    heightToken,
    variantKey,
    variantLabel: variantKey === 'a' ? 'Good' : variantKey === 'b' ? 'Better' : 'Best',
  };
}

/**
 * Build all three variant materialSets at once.
 * Ensures consistency across A/B/C pipeline.
 */
export function buildAllVariantMaterialSets(job, run, variants) {
  const variantConfigs = variants || generateDefaultGBBVariants({ job, run });
  
  return {
    a: buildVariantMaterialSet('a', variantConfigs.a, job, run),
    b: buildVariantMaterialSet('b', variantConfigs.b, job, run),
    c: buildVariantMaterialSet('c', variantConfigs.c, job, run),
  };
}

/* ------------------------------ seam ------------------------------- */
/**
 * Manual overrides ALWAYS win.
 * Only fills missing tiers (a/b/c) using generator.
 */
export function ensureRunCompareVariants(run, job) {
  const existing = run?.compareVariants || {};
  const hasAll = !!(existing?.a && existing?.b && existing?.c);
  if (hasAll) return run;

  const generated = generateDefaultGBBVariants({ job, run });

  return {
    ...run,
    compareVariants: {
      a: existing?.a || generated.a,
      b: existing?.b || generated.b,
      c: existing?.c || generated.c,
    },
  };
}