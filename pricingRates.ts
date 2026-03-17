/**
 * pricingRates — Rate normalization + truth resolution v1.0.0
 * Rates are always decimals in core pricing: 0.14, 0.10, etc.
 */
import { requireUniqueOrNull } from "./truthSetIntegrity.js";

export function normalizeRate(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;

  // Accept percent input (14) or decimal (0.14), normalize to decimal
  return n > 1 ? n / 100 : n;
}

export function clampRateOrDefault(rate, fallback) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return fallback;
  // Safety: never allow rates to approach 100%
  if (n <= 0 || n > 0.95) return fallback;
  return n;
}

/**
 * Resolve overheadRate from OverheadSettings truth set first, then CompanySettings defaults.
 * Payload is NEVER a source (unless explicitly gated elsewhere).
 */
export async function resolveOverheadRate({ base44, companyId, company, hardFallback = 0.14 }) {
  // 1) OverheadSettings truth set snapshot (STRICT uniqueness)
  try {
    const settings = await base44.entities.OverheadSettings.filter({ companyId });

    const s = requireUniqueOrNull({
      records: settings,
      code: "OVERHEAD_SETTINGS_DUPLICATE",
      message: "Multiple OverheadSettings records found for this companyId (uniqueness violated)",
      details: { companyId }
    });

    const override = normalizeRate(s?.manualOverridePct);
    if (override != null) return { overheadRate: override, source: "overheadSettings.manualOverridePct" };

    const computed = normalizeRate(s?.computedOverheadPct);
    if (computed != null) return { overheadRate: computed, source: "overheadSettings.computedOverheadPct" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  // 2) PricingDefaults truth set (STRICT uniqueness)
  try {
    const defaults = await base44.entities.PricingDefaults.filter({ companyId });

    const d = requireUniqueOrNull({
      records: defaults,
      code: "PRICING_DEFAULTS_DUPLICATE",
      message: "Multiple PricingDefaults records found for this companyId (uniqueness violated)",
      details: { companyId }
    });

    const configured = normalizeRate(d?.defaultOverheadRate);
    if (configured != null) return { overheadRate: configured, source: "pricingDefaults.defaultOverheadRate" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  // 2) CompanySettings configurable defaults (validated in UI on write)
  const configured = normalizeRate(company?.defaultOverheadRate);
  if (configured != null) return { overheadRate: configured, source: "companySettings.defaultOverheadRate" };

  // 3) Legacy fallback (if it exists in older schema)
  const legacy = normalizeRate(company?.overheadRate ?? company?.overheadPct);
  if (legacy != null) return { overheadRate: legacy, source: "companySettings.legacyOverhead" };

  // 4) Hard fallback (emergency)
  return { overheadRate: hardFallback, source: "hardFallback" };
}

/**
 * Resolve commissionRate from PricingDefaults truth set, never payload by default.
 * (Async version with strict uniqueness enforcement)
 */
export async function resolveCommissionRate({ base44, companyId, company, hardFallback = 0.10 }) {
  // 1) PricingDefaults truth set (STRICT uniqueness)
  try {
    const defaults = await base44.entities.PricingDefaults.filter({ companyId });

    const d = requireUniqueOrNull({
      records: defaults,
      code: "PRICING_DEFAULTS_DUPLICATE",
      message: "Multiple PricingDefaults records found for this companyId (uniqueness violated)",
      details: { companyId }
    });

    const configured = normalizeRate(d?.defaultCommissionRate);
    if (configured != null) return { commissionRate: configured, source: "pricingDefaults.defaultCommissionRate" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  // 2) CompanySettings configurable defaults (legacy fallback)
  const configured = normalizeRate(company?.defaultCommissionRate);
  if (configured != null) return { commissionRate: configured, source: "companySettings.defaultCommissionRate" };

  // 3) Legacy fallback if present
  const legacy = normalizeRate(company?.commissionRate ?? company?.commissionPct);
  if (legacy != null) return { commissionRate: legacy, source: "companySettings.legacyCommission" };

  // 4) Hard fallback
  return { commissionRate: hardFallback, source: "hardFallback" };
}