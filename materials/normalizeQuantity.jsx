/**
 * SELF-HEALING UNIT NORMALIZATION ENGINE
 * Automatically converts takeoff engine quantities to catalog pack units
 * 
 * RULES:
 * 1. Engine unit is always an intermediate unit (EA, LF, SF)
 * 2. Catalog pack unit is always the pricing unit (ROLL, STICK, BOX, etc.)
 * 3. Unit mismatches are EXPECTED and MUST be handled automatically
 * 4. Once mapped, no warnings - just convert silently
 */

/**
 * Normalize quantity from engine units to catalog pack units
 * @param {Object} params
 * @param {number} params.qty - Quantity from takeoff engine
 * @param {string} params.engineUnit - Unit from engine (EA, LF, SF, each, lf, pcs)
 * @param {Object} params.catalogItem - MaterialCatalog record with pack metadata
 * @returns {Object} { quantity: number, unit: string, wasNormalized: boolean }
 */
export function normalizeQuantity({ qty, engineUnit, catalogItem }) {
  // Validation: catalog item must have pack metadata
  if (!catalogItem.pack_unit || !catalogItem.pack_size || !catalogItem.base_unit) {
    console.warn('[normalizeQuantity] Catalog item missing pack metadata:', catalogItem.crm_name);
    return {
      quantity: qty,
      unit: engineUnit,
      wasNormalized: false,
      warning: 'MISSING_PACK_METADATA'
    };
  }

  // Normalize engine unit to uppercase standard format
  const normalizedEngineUnit = normalizeUnitFormat(engineUnit);
  const catalogBaseUnit = catalogItem.base_unit; // Already uppercase (EA, LF, SF)

  // If units match, perform conversion
  if (normalizedEngineUnit === catalogBaseUnit) {
    const rawPackQty = qty / catalogItem.pack_size;

    // Apply rounding rule
    let finalQty;
    switch (catalogItem.rounding_rule) {
      case 'ROUND':
        finalQty = Math.round(rawPackQty);
        break;
      case 'NONE':
        finalQty = rawPackQty;
        break;
      case 'CEIL':
      default:
        finalQty = Math.ceil(rawPackQty);
        break;
    }

    return {
      quantity: finalQty,
      unit: catalogItem.pack_unit,
      wasNormalized: true,
      conversionDetails: {
        engineQty: qty,
        engineUnit: normalizedEngineUnit,
        packSize: catalogItem.pack_size,
        rawPackQty,
        roundingRule: catalogItem.rounding_rule || 'CEIL'
      }
    };
  }

  // Units don't match - pass through with warning
  console.warn('[normalizeQuantity] Unit mismatch - cannot auto-convert:', {
    engineUnit: normalizedEngineUnit,
    catalogBaseUnit,
    item: catalogItem.crm_name
  });

  return {
    quantity: qty,
    unit: engineUnit,
    wasNormalized: false,
    warning: 'UNIT_MISMATCH'
  };
}

/**
 * Normalize unit string to uppercase standard format
 * @param {string} unit - Raw unit from engine (each, EA, lf, LF, pcs, etc.)
 * @returns {string} Normalized unit (EA, LF, SF)
 */
function normalizeUnitFormat(unit) {
  if (!unit) return 'EA';
  
  const upper = unit.toUpperCase();
  
  // Map common variations
  const mapping = {
    'EACH': 'EA',
    'PCS': 'EA',
    'PIECE': 'EA',
    'PIECES': 'EA',
    'FT': 'LF',
    'FEET': 'LF',
    'LINEAR FEET': 'LF',
    'SQ FT': 'SF',
    'SQFT': 'SF',
    'SQUARE FEET': 'SF'
  };

  return mapping[upper] || upper;
}