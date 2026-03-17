/**
 * CLEAN PRICING SERVICE V2
 * 
 * Direct calculation: resolved materials + overhead/margin → GBB pricing
 */

/**
 * Compute GBB pricing from resolved line items
 * @param {Array} resolvedItems - items with unit_cost + qty
 * @param {Object} margins - { gross_margin_pct, overhead_pct, commission_pct, net_margin_pct }
 * @returns {Object} pricing breakdown
 */
export function computeGBBPricing(resolvedItems, margins = {}) {
  const {
    gross_margin_pct = 0.45,
    overhead_pct = 0.14,
    commission_pct = 0.10,
    net_margin_pct = 0.30
  } = margins;

  // Calculate direct cost
  let materialCost = 0;
  let laborCost = 0;

  for (const item of resolvedItems) {
    const extCost = item.extended_cost || 0;
    
    if (item.uck === 'labor_lf') {
      laborCost += extCost;
    } else {
      materialCost += extCost;
    }
  }

  const directCost = materialCost + laborCost;

  // Back-solve retail price from desired margin
  // retail = directCost / (1 - net_margin_pct)
  const retailPrice = directCost / (1 - net_margin_pct);

  // Allocate retail price
  const netProfit = retailPrice * net_margin_pct;
  const overhead = retailPrice * overhead_pct;
  const commission = retailPrice * commission_pct;
  const gross = retailPrice - netProfit;

  return {
    material_cost: materialCost,
    labor_cost: laborCost,
    direct_cost: directCost,
    retail_price: Math.round(retailPrice * 100) / 100,
    overhead,
    commission,
    net_profit: netProfit,
    gross_margin_pct: Math.round((gross / retailPrice) * 100)
  };
}

/**
 * Build GBB pricing tiers (Good/Better/Best)
 * Standard: A=ChainLink, B=Vinyl, C=Aluminum
 */
export function buildGBBTiers(variantA_resolved, variantB_resolved, variantC_resolved, margins) {
  const priceA = computeGBBPricing(variantA_resolved, margins);
  const priceB = computeGBBPricing(variantB_resolved, margins);
  const priceC = computeGBBPricing(variantC_resolved, margins);

  return {
    good: {
      tier: 'GOOD',
      material: 'Chain Link',
      retail_price: priceA.retail_price,
      pricing: priceA
    },
    better: {
      tier: 'BETTER',
      material: 'Vinyl',
      retail_price: priceB.retail_price,
      pricing: priceB
    },
    best: {
      tier: 'BEST',
      material: 'Aluminum',
      retail_price: priceC.retail_price,
      pricing: priceC
    }
  };
}