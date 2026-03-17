/**
 * RESOLVER V2 — HELPER FUNCTIONS
 * 
 * Authority derivation and unit normalization
 */

/**
 * Color authority contract (explicit precedence):
 * 1) Variant config (selected dropdown) if applicable (vinyl/aluminum, chainlink coating)
 * 2) UCK attributes (parsed from uck) if present
 * 3) Catalog finish/color fields as fallback (never override variant choice)
 */
export function buildAuthorityForUCK({ uck, item, variant_config, catalogItem }) {
  const variantColor = variant_config?.color || null;
  const variantCoating = variant_config?.coating || null;

  // derive from takeoff item attributes if present
  const attrColor = item?.attributes?.color || item?.attributes?.finish || null;
  const catalogFinish = catalogItem?.finish || null;

  // color authority: variant wins if set
  const color =
    variantColor
      ? { source: "VARIANT_CONFIG", value: variantColor, reason: "Variant dropdown selection" }
      : attrColor
        ? { source: "UCK_ATTRIBUTES", value: attrColor, reason: "UCK/item attributes" }
        : catalogFinish
          ? { source: "CATALOG_FALLBACK", value: catalogFinish, reason: "Catalog finish fallback" }
          : { source: "NONE", value: null, reason: "No color/finish available" };

  // coating authority for chain link is effectively "finish" authority; we expose via same structure
  if (variant_config?.materialType === "Chain Link" && variantCoating) {
    // coating is a form of finish authority
    return {
      color: { source: "VARIANT_CONFIG", value: variantCoating, reason: "Chain link coating selection" },
      unit: buildUnitAuthority({ item, catalogItem })
    };
  }

  return {
    color,
    unit: buildUnitAuthority({ item, catalogItem })
  };
}

export function buildUnitAuthority({ item, catalogItem }) {
  const takeoffUnit = item?.unit || null;
  const catalogUnit = catalogItem?.unit || null;

  return {
    source: "TAKEOFF_THEN_CATALOG",
    takeoff_unit: takeoffUnit,
    catalog_unit: catalogUnit,
    normalized_unit: takeoffUnit && catalogUnit && takeoffUnit === catalogUnit ? takeoffUnit : null,
    conversionApplied: false,
    blocked: false,
    reason: "Unit must match or have an explicit conversion"
  };
}

/**
 * Unit normalization policy (Phase 1):
 * - If units match => pass through.
 * - If mismatch => BLOCK unless you have explicit conversion table (seedUnitConversions.js)
 *
 * NOTE: This intentionally prevents silent wrong costs.
 */
export function normalizeUnitsOrBlock({ takeoffQty, takeoffUnit, catalogUnit, uck }) {
  if (!takeoffUnit || !catalogUnit) {
    return {
      blocked: true,
      details: { uck, takeoffUnit, catalogUnit, reason: "Missing unit" },
      normalizedQty: null,
      normalizedUnit: null,
      authorityPatch: { blocked: true }
    };
  }

  if (takeoffUnit === catalogUnit) {
    return {
      blocked: false,
      normalizedQty: takeoffQty,
      normalizedUnit: takeoffUnit,
      authorityPatch: { normalized_unit: takeoffUnit, blocked: false }
    };
  }

  // Phase 1: hard block mismatches (until conversion table is actively used in resolver)
  return {
    blocked: true,
    details: { uck, takeoffUnit, catalogUnit, reason: "Unit mismatch (no conversion applied in Phase 1)" },
    normalizedQty: null,
    normalizedUnit: null,
    authorityPatch: { blocked: true }
  };
}

export function buildUnresolvedRecord({ item, variant_config, reason, details }) {
  return {
    uck: item.uck,
    displayName: item.displayName || item.uck,
    qty: item.qty,
    unit: item.unit,
    attributes: item.attributes || {},
    variant_context: {
      materialType: variant_config?.materialType || null,
      fenceSystem: variant_config?.fenceSystem || null,
      heightFt: variant_config?.heightFt || null,
      coating: variant_config?.coating || null,
      color: variant_config?.color || null
    },
    reason,
    details: details || null,
    // IMPORTANT: UI MUST allow full catalog picker — not constrained suggestions-only
    ui: { allowFullCatalogPick: true }
  };
}

export function buildResolvedRecord({
  item,
  mapping,
  catalogItem,
  normalizedQty,
  normalizedUnit,
  colorAuthority,
  unitAuthority
}) {
  return {
    uck: item.uck,
    qty: normalizedQty,
    unit: normalizedUnit,
    materialCatalogId: catalogItem.id,
    catalog_name: catalogItem.crm_name,
    catalog_unit_cost: catalogItem.cost,
    extended_cost: (Number(normalizedQty) || 0) * (Number(catalogItem.cost) || 0),
    mapping: {
      companyId: mapping.companyId,
      status: mapping.status,
      lastSeenAt: mapping.lastSeenAt || null
    },
    authority: {
      color: colorAuthority,
      unit: unitAuthority
    }
  };
}