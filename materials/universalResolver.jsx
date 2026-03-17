/**
 * GENESIS RESOLVER - STRICT DETERMINISTIC
 * 
 * ARCHITECTURAL RULES:
 * 1. ONLY CompanySkuMap is valid data source
 * 2. NO legacy paths, NO fallbacks, NO guessing
 * 3. 3-STEP MATCH ONLY:
 *    a) locked mapping (user-selected)
 *    b) unlocked mapping (auto-discovered)
 *    c) unresolved (no match exists)
 * 4. Deterministic matching via mappingKey = hash(uck + normalized_attributes)
 * 5. Every unresolved item is returned (no creation of tracking records)
 */

import { base44 } from '@/api/base44Client';
import { normalizeQuantity } from './normalizeQuantity';
import { normalizeAttributes, computeMappingKey } from './normalizeAttributes';

export async function resolveLineItemsWithMappings({ companyId, lineItems, catalog, companySkuMap }) {
  if (!companyId) {
    throw new Error('[GenesisResolver] companyId is required');
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      lineItems: [],
      summary: {
        resolved_count: 0,
        unresolved_count: 0,
        pricing_status: 'COMPLETE',
        unresolved: []
      }
    };
  }

  console.log('[GenesisResolver] START', {
    companyId,
    lineItems: lineItems.length,
    catalog: catalog?.length || 0,
    preloadedMappings: companySkuMap?.length || 0
  });

  // Use pre-fetched CompanySkuMap (ONLY valid source)
  const allMappings = companySkuMap !== undefined 
    ? companySkuMap 
    : await base44.entities.CompanySkuMap.filter({ companyId });

  // Build lookup by mappingKey and locked status
  const mappingLookupLocked = new Map();
  const mappingLookupUnlocked = new Map();

  allMappings.forEach(m => {
    const mappingKey = m.mappingKey || computeMappingKey(m.uck, m.attributes || {});
    
    if (m.locked === true) {
      mappingLookupLocked.set(mappingKey, m);
    } else {
      mappingLookupUnlocked.set(mappingKey, m);
    }
  });

  console.log('[GenesisResolver] Mapping Lookup', {
    lockedMappings: mappingLookupLocked.size,
    unlockedMappings: mappingLookupUnlocked.size
  });

  // Build catalog lookup by ID
  const catalogLookup = new Map();
  (catalog || []).forEach(c => {
    catalogLookup.set(c.id, c);
  });

  const enrichedItems = [];
  const unresolvedList = [];
  let resolvedCount = 0;
  let unresolvedCount = 0;

  // GENESIS RESOLVER: 3-step match for each item
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    
    try {
      const uck = item.uck;
      
      if (!uck) {
        unresolvedCount++;
        unresolvedList.push({
          displayName: item.displayName || item.lineItemName || 'Unknown',
          uck: null,
          qty: item.quantityCalculated || item.qty || 0,
          reason: 'MISSING_UCK'
        });
        continue;
      }

      // Compute normalized attributes and mappingKey
      const attributesNormalized = normalizeAttributes(item.attributes || {});
      const mappingKey = computeMappingKey(uck, attributesNormalized);

      // STEP 1: Try locked mapping (user-selected, never overridden)
      let mapping = mappingLookupLocked.get(mappingKey);
      let matchType = 'locked';

      // STEP 2: Try unlocked mapping (auto-discovered)
      if (!mapping) {
        mapping = mappingLookupUnlocked.get(mappingKey);
        matchType = 'unlocked';
      }

      // STEP 3: No match = unresolved
      if (!mapping) {
        unresolvedCount++;
        unresolvedList.push({
          displayName: item.displayName || item.lineItemName || uck,
          uck,
          qty: item.quantityCalculated || item.qty || 0,
          attributes: attributesNormalized,
          mappingKey,
          reason: 'NO_MAPPING'
        });
        continue;
      }

      // Validate mapping points to valid catalog item
      if (!mapping.materialCatalogId) {
        unresolvedCount++;
        unresolvedList.push({
          displayName: item.displayName || item.lineItemName || uck,
          uck,
          qty: item.quantityCalculated || item.qty || 0,
          reason: 'BROKEN_MAPPING_NO_CATALOG_ID'
        });
        continue;
      }

      // Fetch catalog item
      const catalogItem = catalogLookup.get(mapping.materialCatalogId);
      if (!catalogItem) {
        unresolvedCount++;
        unresolvedList.push({
          displayName: item.displayName || item.lineItemName || uck,
          uck,
          qty: item.quantityCalculated || item.qty || 0,
          reason: 'BROKEN_MAPPING_DELETED_CATALOG'
        });
        continue;
      }

      // Normalize quantity
      const engineQty = item.quantityCalculated || item.qty || 0;
      const engineUnit = item.uom || item.unit || 'EA';
      
      const normalized = normalizeQuantity({
        qty: engineQty,
        engineUnit,
        catalogItem
      });

      // Calculate pricing
      const unitCost = catalogItem.cost || catalogItem.unit_cost || 0;
      const extendedCost = normalized.quantity * unitCost;

      resolvedCount++;
      enrichedItems.push({
        ...item,
        uck,
        resolved: true,
        mappingFound: true,
        mappingKey,
        matchType, // 'locked' or 'unlocked'
        quantity: normalized.quantity,
        unit: normalized.unit,
        unit_cost: unitCost,
        extended_cost: extendedCost,
        catalog_name: catalogItem.crm_name || catalogItem.name,
        catalog_id: catalogItem.id,
        mapping_id: mapping.id,
        wasNormalized: normalized.wasNormalized,
        resolverOutcome: 'RESOLVED'
      });

    } catch (error) {
      unresolvedCount++;
      console.error(`[GenesisResolver] ERROR resolving item ${i}:`, error);
      unresolvedList.push({
        displayName: item.displayName || item.lineItemName || 'Unknown',
        uck: item.uck,
        qty: item.quantityCalculated || item.qty || 0,
        reason: 'RESOLVER_ERROR',
        error: error.message
      });
    }
  }

  const pricingStatus = unresolvedCount > 0 ? 'INCOMPLETE' : 'COMPLETE';

  console.log('[GenesisResolver] COMPLETE', {
    resolved: resolvedCount,
    unresolved: unresolvedCount,
    pricingStatus
  });

  return {
    lineItems: enrichedItems,
    summary: {
      resolved_count: resolvedCount,
      unresolved_count: unresolvedCount,
      pricing_status: pricingStatus,
      unresolved: unresolvedList
    }
  };
}

/**
 * Split double gate into leaf line items for pricing (6/8/10/12 ft only)
 */
export function splitDoubleGateIntoLeaves(doubleWidthFt) {
  const splits = {
    6: 3,
    8: 4,
    10: 5,
    12: 6
  };
  
  const leafWidth = splits[doubleWidthFt];
  
  if (!leafWidth) {
    return null;
  }
  
  return { leafWidthFt: leafWidth, count: 2 };
}