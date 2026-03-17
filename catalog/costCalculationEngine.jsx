/**
 * COST CALCULATION ENGINE
 * Single source of truth for material cost calculations
 * Uses Material Catalog as authoritative pricing source
 */

/**
 * Calculate job cost from takeoff and material catalog
 * @param {Object} takeoff - From canonicalTakeoffEngine
 * @param {Array} catalog - MaterialCatalog records
 * @param {Object} job - Job data
 * @returns {Object} { totalCost, lineItemCosts, unmappedItems, laborCost, feesCost }
 */
export function calculateJobCost(takeoff, catalog, job) {
    const lineItemCosts = [];
    const unmappedItems = [];
    let totalMaterialCost = 0;
    let laborCost = 0;
    let feesCost = 0;

    // Build mapping index for fast lookup
    const catalogMap = {};
    catalog.forEach(item => {
        if (!item.active) return;
        
        // Map by fencebuddy_mapping (preferred)
        if (item.fencebuddy_mapping) {
            catalogMap[item.fencebuddy_mapping.toLowerCase()] = item;
        }
        // Also map by crm_name (fallback)
        catalogMap[item.crm_name.toLowerCase()] = item;
    });

    // Process each takeoff line item
    takeoff.lineItems?.forEach(lineItem => {
        const lookupKey = lineItem.lineItemName?.toLowerCase() || '';
        const catalogItem = catalogMap[lookupKey];

        if (catalogItem) {
            // Found mapping - calculate cost
            const quantity = lineItem.quantityCalculated || lineItem.quantity || 0;
            const unitCost = catalogItem.cost || 0;
            const lineCost = quantity * unitCost;

            lineItemCosts.push({
                lineItemName: lineItem.lineItemName,
                quantity,
                unit: catalogItem.unit,
                unitCost,
                lineCost,
                catalogId: catalogItem.id,
                notes: lineItem.notes
            });

            // Categorize cost
            if (catalogItem.category === 'labor') {
                laborCost += lineCost;
            } else if (catalogItem.category === 'fee') {
                feesCost += lineCost;
            } else {
                totalMaterialCost += lineCost;
            }
        } else {
            // No mapping found
            unmappedItems.push({
                lineItemName: lineItem.lineItemName,
                quantity: lineItem.quantityCalculated || lineItem.quantity || 0,
                unit: lineItem.uom || lineItem.unit || 'pcs'
            });
        }
    });

    const totalCost = totalMaterialCost + laborCost + feesCost;

    return {
        totalCost,
        totalMaterialCost,
        laborCost,
        feesCost,
        lineItemCosts,
        unmappedItems,
        mappingRate: ((lineItemCosts.length / (lineItemCosts.length + unmappedItems.length)) * 100).toFixed(1)
    };
}

/**
 * Calculate pricing scenarios (Good/Better/Best)
 * CRITICAL: Uses SAME geometry, DIFFERENT material sets
 * @param {Object} job - Job data
 * @param {Object} takeoff - Canonical takeoff
 * @param {Array} catalog - Material catalog
 * @returns {Array} [good, better, best] scenarios
 */
export function calculatePricingScenarios(job, takeoff, catalog) {
    // Filter catalog to active items only
    const activeCatalog = catalog.filter(c => c.active);

    // Get base cost calculation
    const baseCost = calculateJobCost(takeoff, activeCatalog, job);

    // Define material quality tiers for each type
    const materialTiers = {
        vinyl: {
            good: ['Emblem', 'SAVANNAH'],
            better: ['Lakeshore', 'Stevens'],
            best: ['Pembrook', 'ANDREW']
        },
        chain_link: {
            good: ['GALV', 'Galv'],
            better: ['ALUMINIZED', 'Alum'],
            best: ['BLK', 'Black Vinyl Coated']
        },
        wood: {
            good: ['Pine', 'Pressure Treated'],
            better: ['Cedar'],
            best: ['Composite', 'Trex']
        },
        aluminum: {
            good: ['Standard'],
            better: ['Premium'],
            best: ['Commercial']
        }
    };

    // Get material type for job
    const materialType = job.materialType?.toLowerCase() || 'vinyl';
    const tiers = materialTiers[materialType] || materialTiers.vinyl;

    // Build scenarios by swapping catalog items
    const scenarios = ['good', 'better', 'best'].map(tier => {
        // Filter catalog to tier-specific items
        const tierCatalog = activeCatalog.filter(item => {
            if (!item.crm_name) return false;
            
            // Check if item belongs to this tier
            const tierBrands = tiers[tier] || [];
            return tierBrands.some(brand => 
                item.crm_name.toLowerCase().includes(brand.toLowerCase())
            );
        });

        // If no tier-specific items, use full catalog
        const catalogToUse = tierCatalog.length > 0 ? tierCatalog : activeCatalog;

        // Calculate cost with tier catalog
        const cost = calculateJobCost(takeoff, catalogToUse, job);

        // Apply markup to get sell price
        const markup = job.internalPricing?.targetNetProfitPct || 0.30;
        const sellPrice = cost.totalCost * (1 + markup);

        return {
            tier,
            tierLabel: tier.charAt(0).toUpperCase() + tier.slice(1),
            totalCost: cost.totalCost,
            sellPrice,
            markup,
            lineItemCosts: cost.lineItemCosts,
            unmappedItems: cost.unmappedItems
        };
    });

    return scenarios;
}

/**
 * Get labor and fee costs from catalog
 * @param {Array} catalog - Material catalog
 * @returns {Object} { laborPerLF, deliveryFee, dumpFee }
 */
export function getLaborAndFees(catalog) {
    const activeCatalog = catalog.filter(c => c.active);

    const laborItem = activeCatalog.find(c => 
        c.category === 'labor' && c.crm_name.toLowerCase().includes('labor')
    );
    const deliveryItem = activeCatalog.find(c => 
        c.category === 'fee' && c.crm_name.toLowerCase().includes('delivery')
    );
    const dumpItem = activeCatalog.find(c => 
        c.category === 'fee' && c.crm_name.toLowerCase().includes('dump')
    );

    return {
        laborPerLF: laborItem?.cost || 10,
        deliveryFee: deliveryItem?.cost || 250,
        dumpFee: dumpItem?.cost || 60
    };
}