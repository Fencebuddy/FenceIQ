/**
 * V2 SUPPLIER COST OVERLAY
 * 
 * Resolves supplier-mapped costs for canonical keys.
 * ONLY active when CompanySettings.supplierMappingEnabled = true.
 * 
 * ⚠️ DOES NOT CHANGE:
 * - Canonical keys
 * - Takeoff quantities
 * - Pricing formulas
 * - Resolver logic for unmapped items
 */

import { base44 } from "@/api/base44Client";

/**
 * Batch-fetch all supplier material maps for a company (for performance)
 * Returns a Map: canonical_group_key → best mapping
 */
export async function getSupplierCostOverlayMap(companyId) {
    if (!companyId) return new Map();

    try {
        // Fetch all active mappings for this company
        const allMaps = await base44.entities.SupplierMaterialMap.filter({
            companyId,
            active: true
        });

        // Fetch default supplier
        const suppliers = await base44.entities.Supplier.filter({
            companyId,
            active: true,
            isDefault: true
        });
        const defaultSupplier = suppliers[0];

        // Build map: canonical_group_key → best mapping
        const overlayMap = new Map();

        // Group by canonical_group_key
        const grouped = {};
        allMaps.forEach(map => {
            if (!grouped[map.canonical_group_key]) {
                grouped[map.canonical_group_key] = [];
            }
            grouped[map.canonical_group_key].push(map);
        });

        // For each group, pick best mapping
        Object.entries(grouped).forEach(([groupKey, maps]) => {
            // Priority 1: isDefaultForGroup = true (pick most recent)
            const defaultMaps = maps.filter(m => m.isDefaultForGroup);
            if (defaultMaps.length > 0) {
                // Pick most recently updated
                const best = defaultMaps.sort((a, b) => 
                    new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
                )[0];
                overlayMap.set(groupKey, {
                    unit_cost: best.unit_cost,
                    supplierSku: best.supplierSku,
                    supplierDescription: best.supplierDescription,
                    supplierId: best.supplierId,
                    source: 'supplier_map_default'
                });
                return;
            }

            // Priority 2: Default supplier mapping (if exists)
            if (defaultSupplier) {
                const defaultSupplierMaps = maps.filter(m => m.supplierId === defaultSupplier.id);
                if (defaultSupplierMaps.length > 0) {
                    const best = defaultSupplierMaps.sort((a, b) => 
                        new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
                    )[0];
                    overlayMap.set(groupKey, {
                        unit_cost: best.unit_cost,
                        supplierSku: best.supplierSku,
                        supplierDescription: best.supplierDescription,
                        supplierId: best.supplierId,
                        source: 'supplier_map_fallback'
                    });
                    return;
                }
            }

            // No valid mapping found for this group
        });

        return overlayMap;
    } catch (error) {
        console.error('[supplierCostOverlay] Failed to fetch mappings:', error);
        return new Map();
    }
}

/**
 * Get canonical_group_key from canonical_key
 * For now, canonical_group_key = canonical_key (1:1 mapping)
 * Future: could map multiple keys to same group
 */
export function getCanonicalGroupKey(canonical_key) {
    if (!canonical_key) return null;
    
    // Phase 1: 1:1 mapping (no grouping yet)
    // canonical_group_key is the same as canonical_key
    return canonical_key;
}

/**
 * Apply supplier cost overlay to resolved line items
 * ONLY when supplierMappingEnabled = true
 * 
 * @param {Array} lineItems - Resolved line items from pricing engine
 * @param {string} companyId - Company ID
 * @param {boolean} supplierMappingEnabled - Feature flag
 * @returns {Promise<Array>} Line items with supplier costs applied (if available)
 */
export async function applySupplierCostOverlay(lineItems, companyId, supplierMappingEnabled) {
    // If feature disabled, return items unchanged
    if (!supplierMappingEnabled || !companyId) {
        return lineItems.map(item => ({
            ...item,
            cost_source: item.cost_source || 'v1_default'
        }));
    }

    try {
        // Batch fetch all supplier mappings once
        const overlayMap = await getSupplierCostOverlayMap(companyId);

        // Apply overlay to each line item
        const overlaidItems = lineItems.map(item => {
            // Get canonical group key
            const groupKey = getCanonicalGroupKey(item.canonical_key || item.canonicalKey);
            
            if (!groupKey) {
                return {
                    ...item,
                    cost_source: item.cost_source || 'v1_default'
                };
            }

            // Check if supplier mapping exists
            const overlay = overlayMap.get(groupKey);
            
            if (overlay && overlay.unit_cost !== undefined) {
                // OVERLAY: Use supplier cost instead of V1 cost
                const extCost = (item.quantityCalculated || 0) * overlay.unit_cost;
                
                return {
                    ...item,
                    unit_cost: overlay.unit_cost,
                    ext_cost: extCost,
                    supplierSku: overlay.supplierSku,
                    supplierDescription: overlay.supplierDescription,
                    cost_source: 'supplier_map',
                    cost_source_detail: overlay.source,
                    v1_unit_cost: item.unit_cost, // Preserve original for comparison
                    v1_ext_cost: item.ext_cost
                };
            } else {
                // No overlay found - keep V1 cost
                return {
                    ...item,
                    cost_source: item.cost_source || 'v1_catalog'
                };
            }
        });

        return overlaidItems;
    } catch (error) {
        console.error('[supplierCostOverlay] Failed to apply overlay:', error);
        // On error, return items unchanged
        return lineItems.map(item => ({
            ...item,
            cost_source: 'v1_default_error'
        }));
    }
}

/**
 * Compute metrics for supplier cost overlay usage
 */
export function computeSupplierOverlayMetrics(lineItems) {
    const supplierMapped = lineItems.filter(item => item.cost_source === 'supplier_map');
    const v1Fallback = lineItems.filter(item => item.cost_source !== 'supplier_map');
    
    return {
        total_items: lineItems.length,
        supplier_mapped_count: supplierMapped.length,
        v1_fallback_count: v1Fallback.length,
        supplier_mapped_pct: lineItems.length > 0 
            ? (supplierMapped.length / lineItems.length) * 100 
            : 0
    };
}