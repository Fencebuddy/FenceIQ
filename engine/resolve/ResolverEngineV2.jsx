/**
 * RESOLVER ENGINE V2
 * 
 * HARD RULES:
 * - FenceSystemConfig is the source of truth for "allowed" UCK contexts.
 * - CompanySkuMap is the only mapping layer (companyId + uck).
 * - MaterialCatalog is the only cost/unit source (unless contract says otherwise).
 * - Unit mismatch is not silently "fixed" unless a conversion exists.
 * 
 * Input: takeoff_items (UCKs + quantities + attributes) for ONE variant
 * Output: resolved_items + unresolved_items + authority maps + pricingStatus
 */

import { validateColorAuthority } from "../contracts/validateColorAuthority";
import { validateUnitAuthority } from "../contracts/validateUnitAuthority";

import {
  buildAuthorityForUCK,
  normalizeUnitsOrBlock,
  buildUnresolvedRecord,
  buildResolvedRecord
} from "./resolveHelpers";

/**
 * Normalize legacy vinyl donut UCKs to global format
 * Ensures backward compatibility with old takeoffs that included suffixes
 */
function normalizeDonutUck(uck) {
  if (uck && uck.startsWith('vinyl_hardware_nodig_donut_')) {
    console.log('[ResolverV2] Normalizing legacy donut UCK:', uck, '-> vinyl_hardware_nodig_donut');
    return 'vinyl_hardware_nodig_donut';
  }
  return uck;
}

export async function resolveTakeoffV2({
  base44,
  companyId,
  jobId,
  variantKey,
  takeoff_items,      // [{ uck, qty, unit, attributes, source }, ...]
  variant_config      // { materialType, fenceSystem, heightFt, coating, color, ... }
}) {
  // Normalize donut UCKs in takeoff items BEFORE fetching mappings
  const normalizedItems = (takeoff_items || []).map(item => ({
    ...item,
    uck: normalizeDonutUck(item.uck)
  }));
  
  // Fetch mapping + catalog data
  const ucks = Array.from(new Set(normalizedItems.map(x => x.uck).filter(Boolean)));

  const mappings = await base44.entities.CompanySkuMap.filter({
    companyId,
    uck: { $in: ucks }
  });

  const mappedIds = Array.from(new Set(mappings.map(m => m.materialCatalogId).filter(Boolean)));
  const catalog = mappedIds.length
    ? await base44.entities.MaterialCatalog.filter({ id: { $in: mappedIds } })
    : [];

  const catalogById = new Map(catalog.map(c => [c.id, c]));
  const mappingByUck = new Map(mappings.map(m => [m.uck, m]));

  const resolved_items = [];
  const unresolved_items = [];

  // Authority maps (explicit, returned to UI)
  const color_authority = {}; // uck -> { source, value, reason }
  const unit_authority = {};  // uck -> { source, takeoff_unit, catalog_unit, normalized_unit, conversionApplied, blocked }

  let pricingStatus = "COMPLETE";

  for (const item of normalizedItems) {
    const uck = item.uck;
    if (!uck) continue;

    // Determine authority (color/unit) BEFORE building records
    const authority = buildAuthorityForUCK({
      uck,
      item,
      variant_config,
      mapping: mappingByUck.get(uck),
      catalogItem: catalogById.get(mappingByUck.get(uck)?.materialCatalogId)
    });

    color_authority[uck] = authority.color;
    unit_authority[uck] = authority.unit;

    // Contract enforcement (hard fail -> block pricing)
    const colorCheck = validateColorAuthority({ 
      variantConfig: variant_config,
      uckAttributes: item.attributes,
      catalogItem: catalogById.get(mappingByUck.get(uck)?.materialCatalogId),
      materialType: variant_config?.materialType
    });
    
    if (!colorCheck.valid) {
      console.warn('[ResolverV2] Color authority validation failed:', colorCheck.errors);
    }

    const mapping = mappingByUck.get(uck);
    const catalogItem = mapping ? catalogById.get(mapping.materialCatalogId) : null;

    if (!mapping || mapping.status !== "mapped" || !catalogItem) {
      unresolved_items.push(
        buildUnresolvedRecord({
          item,
          variant_config,
          reason: !mapping ? "NO_MAPPING" : "MAPPING_INVALID_OR_MISSING_CATALOG"
        })
      );
      pricingStatus = "BLOCKED";
      continue;
    }

    // Unit normalization (block if mismatch + no conversion)
    const unitCheck = normalizeUnitsOrBlock({
      takeoffQty: item.qty,
      takeoffUnit: item.unit,
      catalogUnit: catalogItem.unit,
      uck
    });

    unit_authority[uck] = { ...unit_authority[uck], ...unitCheck.authorityPatch };

    if (unitCheck.blocked) {
      unresolved_items.push(
        buildUnresolvedRecord({
          item,
          variant_config,
          reason: "UNIT_MISMATCH_BLOCKED",
          details: unitCheck.details
        })
      );
      pricingStatus = "BLOCKED";
      continue;
    }

    resolved_items.push(
      buildResolvedRecord({
        item,
        mapping,
        catalogItem,
        normalizedQty: unitCheck.normalizedQty,
        normalizedUnit: unitCheck.normalizedUnit,
        colorAuthority: color_authority[uck],
        unitAuthority: unit_authority[uck]
      })
    );
  }

  return {
    pricingStatus,
    resolved_items,
    unresolved_items,
    color_authority,
    unit_authority,
    metrics: {
      total: (takeoff_items || []).length,
      resolved: resolved_items.length,
      unresolved: unresolved_items.length
    }
  };
}