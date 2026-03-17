/**
 * FENCEBUDDY V2 ENGINE — PRICING ENGINE V1 LOCKED
 * 
 * CONTRACT 1: PRICING FORMULAS (LOCKED v1.0)
 * DO NOT MODIFY WITHOUT EXPLICIT PRICING_VERSION BUMP
 * 
 * Implements exact V1 pricing formulas with execution gates from Contract 0.2
 */

import { ENGINE_VERSIONS } from './versions';
import { logDiagnostic } from './diagnosticsService';

/**
 * CONTRACT 0.2: PRICING EXECUTION GATES
 * Pricing must NOT run unless ALL gates pass
 */
export function validatePricingInputs({ resolvedItems, unresolvedItems, variantId }) {
  const errors = [];
  
  // Gate 1: Must have resolved items
  if (!resolvedItems || resolvedItems.length === 0) {
    errors.push({
      code: 'NO_RESOLVED_ITEMS',
      message: 'No materials resolved from takeoff',
      severity: 'BLOCKING',
      actionHint: 'Complete material catalog mapping in Fence System Config'
    });
  }
  
  // Gate 2: No blocking unresolved items
  const blockingUnresolved = (unresolvedItems || []).filter(item => 
    !item.allow_unresolved_but_nonblocking
  );
  
  if (blockingUnresolved.length > 0) {
    errors.push({
      code: 'UNRESOLVED_ITEMS_BLOCKING',
      message: `${blockingUnresolved.length} required items not mapped to catalog`,
      severity: 'BLOCKING',
      actionHint: 'Map all required UCKs in Fence System Config',
      context: { unresolved_count: blockingUnresolved.length }
    });
  }
  
  // Gate 3: Unit authority must match
  const unitMismatches = (resolvedItems || []).filter(item => 
    item.resolution_status === 'UNIT_MISMATCH'
  );
  
  if (unitMismatches.length > 0) {
    errors.push({
      code: 'UNIT_AUTHORITY_MISMATCH',
      message: `${unitMismatches.length} items have unit conversion issues`,
      severity: 'BLOCKING',
      actionHint: 'Add unit conversions or fix catalog units',
      context: { mismatch_count: unitMismatches.length }
    });
  }
  
  // Gate 4: Color/coating authority resolved
  const colorMissing = (resolvedItems || []).filter(item => 
    item.missing_finish_attribute === true
  );
  
  if (colorMissing.length > 0) {
    errors.push({
      code: 'COLOR_AUTHORITY_MISSING',
      message: `${colorMissing.length} items missing required color/coating attributes`,
      severity: 'BLOCKING',
      actionHint: 'Ensure variant config includes all required finish attributes',
      context: { missing_count: colorMissing.length }
    });
  }
  
  return {
    canPrice: errors.length === 0,
    errors
  };
}

/**
 * Compute retail divisor (CONTRACT 1)
 */
function computeRetailDivisor({ material_type }) {
  const max_discount = 0.15;
  const overhead_rate = 0.14;
  const commission_rate = 0.10;
  
  // Material-specific required net margins at max discount
  let required_net_margin = 0.20; // Default: Vinyl, Chain Link, Aluminum
  
  if (material_type && material_type.toUpperCase() === 'WOOD') {
    required_net_margin = 0.36; // Wood requires 36%
  }
  
  const divisor = (1 - max_discount) * (1 - overhead_rate - commission_rate - required_net_margin);
  
  if (divisor <= 0) {
    throw new Error(
      `Invalid pricing parameters: divisor=${divisor.toFixed(4)} <= 0. ` +
      `Cannot guarantee required margins with current rates.`
    );
  }
  
  return { divisor, required_net_margin };
}

/**
 * Compute complete pricing breakdown (CONTRACT 1)
 * 
 * CONTRACT 0.8: RETAIL ANCHOR STORAGE
 * retail_price is computed ONCE and frozen per takeoff_hash
 */
export async function computePricing({
  material_cost,
  total_lf,
  labor_per_lf = 10,
  delivery_cost = 75,
  tear_out_cost = 0,
  discount_percentage = 0,
  material_type = null,
  retail_anchor_override = null,
  variantId = null,
  companyId = null
}) {
  console.log('[PricingEngineV1Locked] INPUT:', { 
    material_cost, 
    total_lf, 
    material_type, 
    retail_anchor_override 
  });
  
  // STEP 1: Compute direct costs
  const labor_cost = (total_lf * labor_per_lf) + tear_out_cost;
  const direct_cost = material_cost + labor_cost + delivery_cost;
  
  // STEP 2: Compute or reuse retail anchor
  let retail_price;
  let retail_anchor_source;
  let divisor_used;
  let required_net_margin;
  
  if (retail_anchor_override !== null && retail_anchor_override !== undefined) {
    // Reuse frozen retail anchor (CONTRACT 0.8)
    retail_price = retail_anchor_override;
    retail_anchor_source = 'restored_from_snapshot';
    console.log('[PricingEngineV1Locked] REUSING retail anchor:', retail_price);
  } else {
    // Compute new retail anchor
    const divisorResult = computeRetailDivisor({ material_type });
    divisor_used = divisorResult.divisor;
    required_net_margin = divisorResult.required_net_margin;
    
    retail_price = direct_cost / divisor_used;
    retail_anchor_source = 'computed';
    
    console.log('[PricingEngineV1Locked] COMPUTED retail anchor:', retail_price, 'divisor:', divisor_used);
  }
  
  // STEP 3: Compute sale price with discount
  const sale_price = retail_price * (1 - discount_percentage);
  
  // STEP 4: Compute allocations (based on SALE PRICE)
  const overhead = sale_price * 0.14;
  const commission = sale_price * 0.10;
  
  // STEP 5: Compute job cost and profit
  const total_job_cost = direct_cost + overhead + commission;
  const net_profit = sale_price - total_job_cost;
  const net_margin = sale_price > 0 ? net_profit / sale_price : 0;
  
  // STEP 6: Validation (dev mode)
  if (process.env.NODE_ENV !== 'production') {
    // At max discount, verify net margin meets requirements
    if (Math.abs(discount_percentage - 0.15) < 0.001) {
      const expectedMargin = material_type?.toUpperCase() === 'WOOD' ? 0.36 : 0.20;
      if (net_margin < expectedMargin - 0.001) {
        console.warn(
          `⚠️ PRICING VALIDATION FAILED: ${material_type} net margin at 15% discount: ` +
          `${(net_margin * 100).toFixed(1)}%, expected >= ${(expectedMargin * 100).toFixed(0)}%`
        );
        
        // Log diagnostic
        await logDiagnostic({
          phase: 'PRICING',
          severity: 'WARN',
          code: 'NET_MARGIN_BELOW_TARGET',
          message: `Net margin ${(net_margin * 100).toFixed(1)}% below target ${(expectedMargin * 100).toFixed(0)}%`,
          variantId,
          companyId,
          context: { material_type, net_margin, expected: expectedMargin }
        });
      }
    }
  }
  
  // STEP 7: Return breakdown
  return {
    // Direct costs
    material_cost,
    labor_cost,
    delivery_cost,
    tear_out_cost,
    direct_cost,
    
    // Retail anchor (frozen)
    retail_price,
    retail_anchor_source,
    
    // Allocations
    overhead,
    commission,
    total_job_cost,
    
    // Sale pricing
    discount_percentage,
    discount_amount: retail_price - sale_price,
    sale_price,
    
    // Profit metrics
    net_profit,
    net_margin: net_margin * 100, // Convert to percentage
    
    // Metadata
    divisor_used,
    required_net_margin,
    material_type,
    labor_per_lf,
    total_lf,
    
    // Version stamp
    pricing_version: ENGINE_VERSIONS.PRICING_VERSION,
    computed_at: new Date().toISOString()
  };
}

/**
 * Validate pricing meets requirements
 */
export function validatePricingOutput(pricing) {
  const warnings = [];
  
  // Check net margin at max discount
  if (Math.abs(pricing.discount_percentage - 0.15) < 0.001) {
    const expectedMargin = pricing.material_type?.toUpperCase() === 'WOOD' ? 36 : 20;
    if (pricing.net_margin < expectedMargin - 0.1) {
      warnings.push({
        code: 'NET_MARGIN_BELOW_TARGET',
        message: `Net margin ${pricing.net_margin.toFixed(1)}% below ${expectedMargin}% at max discount`,
        severity: 'WARN'
      });
    }
  }
  
  // Check at 0% discount
  if (pricing.discount_percentage === 0) {
    const expectedMargin = pricing.material_type?.toUpperCase() === 'WOOD' ? 50 : 32;
    if (Math.abs(pricing.net_margin - expectedMargin) > 2) {
      warnings.push({
        code: 'NET_MARGIN_DEVIATION',
        message: `Net margin ${pricing.net_margin.toFixed(1)}% deviates from expected ${expectedMargin}% at 0% discount`,
        severity: 'INFO'
      });
    }
  }
  
  return warnings;
}