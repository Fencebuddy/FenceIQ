/**
 * SIMPLIFIED CATALOG RESOLVER
 * Single-company mode: Match takeoff items ONLY to items in MaterialCatalog
 * No CompanySkuMap, no multi-tenant logic
 */

/**
 * Resolve takeoff items to MaterialCatalog
 * Returns ONLY items that have exact catalog matches
 * Unmatched items are excluded from pricing (hard rule)
 */
export async function resolveTakeoffToCatalog({ base44, takeoff_items, catalog }) {
  const resolved_items = [];
  const unresolved_items = [];
  
  // Build catalog lookup by canonical_key
  const catalogByKey = new Map();
  (catalog || []).forEach(cat => {
    if (cat.canonical_key) {
      catalogByKey.set(cat.canonical_key, cat);
    }
  });
  
  // Match each takeoff item to catalog
  for (const item of takeoff_items) {
    const canonical_key = item.canonical_key || item.uck;
    
    if (!canonical_key) {
      unresolved_items.push({
        ...item,
        reason: 'NO_CANONICAL_KEY',
        message: 'Item has no canonical key'
      });
      continue;
    }
    
    const catalogItem = catalogByKey.get(canonical_key);
    
    if (!catalogItem) {
      unresolved_items.push({
        ...item,
        reason: 'NOT_IN_CATALOG',
        message: `No catalog item with canonical_key: ${canonical_key}`
      });
      continue;
    }
    
    // Unit validation - must match exactly
    const takeoffUnit = item.unit || item.uom;
    const catalogUnit = catalogItem.unit;
    
    if (takeoffUnit !== catalogUnit) {
      unresolved_items.push({
        ...item,
        reason: 'UNIT_MISMATCH',
        message: `Unit mismatch: takeoff uses '${takeoffUnit}', catalog has '${catalogUnit}'`,
        catalogItem: {
          id: catalogItem.id,
          crm_name: catalogItem.crm_name,
          unit: catalogUnit
        }
      });
      continue;
    }
    
    // Matched - create resolved record
    const qty = item.quantityCalculated || item.qty || 0;
    const unit_cost = catalogItem.cost || 0;
    const ext_cost = qty * unit_cost;
    
    resolved_items.push({
      ...item,
      catalogId: catalogItem.id,
      catalogName: catalogItem.crm_name,
      unit_cost,
      ext_cost,
      qtyUsed: qty,
      unitUsed: catalogUnit,
      catalogItem: {
        id: catalogItem.id,
        crm_name: catalogItem.crm_name,
        cost: unit_cost,
        unit: catalogUnit,
        category: catalogItem.category,
        source: 'catalog'
      }
    });
  }
  
  const pricingStatus = unresolved_items.length === 0 ? 'COMPLETE' : 'BLOCKED';
  
  return {
    pricingStatus,
    resolved_items,
    unresolved_items,
    metrics: {
      total: takeoff_items.length,
      resolved: resolved_items.length,
      unresolved: unresolved_items.length
    }
  };
}