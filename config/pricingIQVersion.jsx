/**
 * Pricing IQ Version Lock
 * 
 * ⚠️ DO NOT MODIFY WITHOUT EXPLICIT v2 VERSIONING
 * 
 * Pricing IQ v1.0 locked after successful field validation (Tests #1–#3).
 * All pricing formulas, metrics, and definitions are frozen as of 2026-01-19.
 * 
 * Any changes to pricing logic, margin calculations, discount behavior, 
 * or metric definitions require a new major version (v2.0).
 */

export const PRICING_IQ_VERSION = "v1.0";
export const PRICING_IQ_STATUS = "LOCKED";
export const PRICING_IQ_LOCKED_AT = "2026-01-19";

/**
 * Frozen Metric Definitions (v1.0)
 * 
 * These definitions are authoritative and must not be reinterpreted:
 * 
 * - Price Integrity: % of sold jobs at model price
 * - Override Rate: Override jobs ÷ total sold jobs
 * - Avg Upsell: Avg of positive deltas only per override
 * - Upsell Delta: Sum of positive deltas only
 * - Net Margin: Calculated from actual agreed price
 * - Net Reliability: Margin stability across sold jobs
 */

export const FROZEN_METRICS = {
  PRICE_INTEGRITY: "% of sold jobs at model price",
  OVERRIDE_RATE: "Override jobs ÷ total sold jobs",
  AVG_UPSELL: "Avg of positive deltas only per override",
  UPSELL_DELTA: "Sum of positive deltas only",
  NET_MARGIN: "Calculated from actual agreed price",
  NET_RELIABILITY: "Margin stability across sold jobs"
};

/**
 * Frozen Pricing Components (v1.0)
 * 
 * DO NOT MODIFY:
 * - Direct Cost logic (materials, labor, delivery, tear-out split)
 * - Retail price calculation
 * - Discount bands
 * - Override logic (presentation-screen only)
 * - Margin targets (gross + net)
 */