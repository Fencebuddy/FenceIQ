/**
 * PRICING CONFIGURATION
 * Central source of truth for all pricing calculations
 */

export const PRICING_CONFIG = {
  // Labor & delivery
  labor_per_lf: 10,        // $10 per linear foot
  delivery_fee: 75,         // Flat delivery fee
  
  // Allocations (as percentages of sell price)
  overhead_pct: 0.14,       // 14% overhead
  commission_pct: 0.10,     // 10% sales commission
  incentive_pct: 0.10,      // 10% incentives/slippage
  target_net_pct: 0.30,     // 30% net profit target
};

/**
 * FEATURE FLAGS
 */
export const PRICING_FEATURE_FLAGS = {
  // Enable deterministic pricing engine with discount policy enforcement
  discountPolicyEnabled: true,
};

/**
 * Calculate direct cost retention rate
 * This is what percentage of sell price goes to direct costs
 * Formula: 1 - (overhead + commission + incentive + net profit)
 */
export function getRetentionRate() {
  const retention = 1 
    - PRICING_CONFIG.overhead_pct 
    - PRICING_CONFIG.commission_pct 
    - PRICING_CONFIG.incentive_pct 
    - PRICING_CONFIG.target_net_pct;
  
  if (retention <= 0) {
    throw new Error('Invalid pricing config: allocations exceed 100%');
  }
  
  return retention;
}

/**
 * Back-solve sell price from direct costs
 * Formula: Sell Price = Direct Cost / Retention Rate
 * With default config: Sell Price = Direct Cost / 0.36
 */
export function backSolveSellPrice(directCost) {
  return directCost / getRetentionRate();
}