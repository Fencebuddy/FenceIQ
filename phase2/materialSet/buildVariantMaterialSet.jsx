/**
 * BUILD VARIANT MATERIALSET
 * Single source of truth for variant-specific material properties.
 * 
 * Input: { job, variantKey, runsVariant }
 * Output: materialSet object for all phase2 builders
 * 
 * RULES:
 * - Variant B chain link → ALWAYS coating = 'black_vinyl'
 * - Variant A chain link → ALWAYS coating = 'galvanized'
 * - Variant C → Aluminum with black finish
 * - Never read job.chainLinkCoating for Variant B
 * - Never read job.materialType as fallback if variant is explicit
 */

export function buildVariantMaterialSet({ job, variantKey, runsVariant }) {
  if (!variantKey || !['a', 'b', 'c'].includes(variantKey)) {
    throw new Error(`buildVariantMaterialSet: invalid variantKey "${variantKey}"`);
  }
  
  if (!runsVariant) {
    throw new Error(`buildVariantMaterialSet: runsVariant required for variant ${variantKey}`);
  }

  const materialType = runsVariant.materialType || job?.materialType || 'Vinyl';
  const normalizedMT = normalizeMatType(materialType);

  const fenceHeight = runsVariant.fenceHeight || job?.fenceHeight || "6'";
  const heightFt = extractHeightFt(fenceHeight);
  const heightToken = `${heightFt}ft`;

  // Determine coating based on variant and material type
  let coating = null;
  let finish = null;

  if (isChainLink(normalizedMT)) {
    // Chain Link: Variant-specific coating RULES
    if (variantKey === 'b') {
      // CRITICAL: Variant B is ALWAYS black vinyl
      coating = 'black_vinyl';
      finish = 'black_vinyl_coated';
    } else if (variantKey === 'a') {
      // Variant A: Galvanized (or Aluminized if specified)
      const configCoating = runsVariant.chainLinkCoating || job?.chainLinkCoating || 'Galvanized';
      if (configCoating.toLowerCase().includes('aluminized')) {
        coating = 'aluminized';
        finish = 'aluminized';
      } else {
        coating = 'galvanized';
        finish = 'galvanized';
      }
    } else if (variantKey === 'c') {
      // Variant C: Aluminized chain link
      coating = 'aluminized';
      finish = 'aluminized';
    }
  } else if (isAluminum(normalizedMT)) {
    // Aluminum: C variant black, A/B stay vinyl
    if (variantKey === 'c') {
      coating = null; // Aluminum doesn't use coating
      finish = 'black';
    }
  } else if (isVinyl(normalizedMT)) {
    // Vinyl: Use fence color
    const color = runsVariant.fenceColor || job?.fenceColor || 'White';
    return {
      variantKey,
      materialType: 'Vinyl',
      materialTypeKey: 'vinyl',
      fenceHeight,
      heightFt,
      heightToken,
      fenceColor: color,
      style: runsVariant.style || job?.style,
      source: 'variant'
    };
  } else if (isWood(normalizedMT)) {
    // Wood: Style-based
    return {
      variantKey,
      materialType: 'Wood',
      materialTypeKey: 'wood',
      fenceHeight,
      heightFt,
      heightToken,
      style: runsVariant.style || job?.style,
      source: 'variant'
    };
  }

  // Return materialSet for Chain Link or Aluminum
  return {
    variantKey,
    materialType: normalizedMT,
    materialTypeKey: toMaterialKey(normalizedMT),
    fenceHeight,
    heightFt,
    heightToken,
    coating,
    finish,
    source: 'variant'
  };
}

/**
 * Extract numeric height in feet from string like "4'", "4", "4ft"
 */
function extractHeightFt(heightStr) {
  if (typeof heightStr === 'number') return heightStr;
  
  const match = String(heightStr).match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if ([3, 4, 5, 6, 8, 10, 12].includes(num)) return num;
  }
  
  // Fallback
  return 6;
}

/**
 * Normalize material type to consistent naming
 */
function normalizeMatType(mt) {
  if (!mt) return 'Vinyl';
  
  const lower = mt.toString().toLowerCase();
  if (lower.includes('chain')) return 'Chain Link';
  if (lower.includes('alum')) return 'Aluminum';
  if (lower.includes('vinyl')) return 'Vinyl';
  if (lower.includes('wood')) return 'Wood';
  
  return 'Vinyl';
}

function isChainLink(mt) {
  return normalizeMatType(mt) === 'Chain Link';
}

function isAluminum(mt) {
  return normalizeMatType(mt) === 'Aluminum';
}

function isVinyl(mt) {
  return normalizeMatType(mt) === 'Vinyl';
}

function isWood(mt) {
  return normalizeMatType(mt) === 'Wood';
}

function toMaterialKey(mt) {
  const normalized = normalizeMatType(mt);
  if (normalized === 'Chain Link') return 'chain_link';
  if (normalized === 'Aluminum') return 'aluminum';
  if (normalized === 'Vinyl') return 'vinyl';
  if (normalized === 'Wood') return 'wood';
  return 'unknown';
}