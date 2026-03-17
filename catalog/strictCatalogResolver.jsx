/**
 * STRICT CATALOG RESOLVER - HARD RESET VERSION
 * 
 * Resolution order (non-negotiable):
 * 1. Takeoff UCK → Exact Match in MaterialCatalog.canonical_key
 * 2. Takeoff UCK → Prefix Match (handles system/color suffixes)
 * 3. FAIL LOUDLY
 * 
 * NO fuzzy matching, NO fallbacks, NO guessing.
 */

/**
 * Resolve a single takeoff line item to catalog
 * @param {Object} lineItem - { canonical_key, lineItemName, quantityCalculated, uom }
 * @param {Array} catalog - MaterialCatalog items
 * @returns {Object} { resolved: boolean, catalogItem: object | null, matchType: string, reason: string }
 */
export function resolveLineItemStrict(lineItem, catalog) {
  const uck = lineItem.canonical_key || lineItem.canonicalKey;
  
  if (!uck) {
    return {
      resolved: false,
      catalogItem: null,
      matchType: 'NO_UCK',
      reason: 'Line item missing canonical_key'
    };
  }

  // STEP 1: Exact canonical_key match
  const exactMatch = catalog.find(item => 
    item.canonical_key === uck && item.active === true
  );

  if (exactMatch) {
    return {
      resolved: true,
      catalogItem: exactMatch,
      matchType: 'EXACT',
      reason: `Exact match: ${uck}`
    };
  }

  // STEP 2: Prefix match (handles system/color suffixes in catalog)
  // Example: takeoff has "vinyl_panel_privacy_6ft"
  //          catalog has "vinyl_panel_privacy_6ft_savannah_white"
  const prefixMatch = catalog.find(item => 
    item.canonical_key?.startsWith(uck) && item.active === true
  );

  if (prefixMatch) {
    return {
      resolved: true,
      catalogItem: prefixMatch,
      matchType: 'PREFIX',
      reason: `Prefix match: ${uck} → ${prefixMatch.canonical_key}`
    };
  }

  // STEP 3: FAIL LOUDLY
  return {
    resolved: false,
    catalogItem: null,
    matchType: 'NOT_FOUND',
    reason: `No catalog item for UCK: ${uck}`
  };
}

/**
 * Batch resolve multiple line items
 */
export function resolveLineItemsBatchStrict(lineItems, catalog) {
  const results = lineItems.map(item => ({
    lineItem: item,
    resolution: resolveLineItemStrict(item, catalog)
  }));

  const resolved = results.filter(r => r.resolution.resolved);
  const unresolved = results.filter(r => !r.resolution.resolved);

  return {
    results,
    resolved,
    unresolved,
    stats: {
      total: lineItems.length,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      resolutionRate: lineItems.length > 0 
        ? ((resolved.length / lineItems.length) * 100).toFixed(1) 
        : '0.0'
    }
  };
}