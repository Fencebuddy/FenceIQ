import { PricingTruthError } from "./truthSetIntegrity.js";

/**
 * Accepts either percent (14) or decimal (0.14) and returns decimal.
 * Returns null if invalid.
 */
export function normalizeRateInput(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

/** Ensures 0 < rate <= 0.95 */
export function requireSafeRate(rate, fieldName) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0 || n > 0.95) {
    throw new PricingTruthError(
      "INVALID_RATE",
      `Invalid ${fieldName}. Must be > 0 and <= 0.95 (accepts percent or decimal).`,
      { fieldName, value: rate }
    );
  }
  return n;
}

export function requireNonBlankString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PricingTruthError(
      "INVALID_STRING",
      `${fieldName} is required and cannot be blank.`,
      { fieldName, value }
    );
  }
  return value.trim();
}

/**
 * Validates divisor safety against worst-case required net.
 * divisor = 1 - overhead - commission - requiredNetPct/100
 */
export function assertDivisorSafe({ overheadRate, commissionRate, requiredNetPct, minDivisor = 0.02 }) {
  const divisor = 1 - overheadRate - commissionRate - (Number(requiredNetPct) / 100);
  if (!Number.isFinite(divisor) || divisor < minDivisor) {
    throw new PricingTruthError(
      "DIVISOR_UNSAFE_CONFIG",
      "Unsafe pricing configuration: overhead + commission + required net makes divisor too small.",
      {
        divisor,
        minDivisor,
        overheadRate,
        commissionRate,
        requiredNetPct
      }
    );
  }
  return divisor;
}

/**
 * Extract worst-case required net from discount policy.
 * If missing, defaults to 30.
 */
export function getMaxRequiredNetPctFromCompany(company) {
  const byMat = company?.discountPolicy?.requiredNetAfterDiscountByMaterial;
  if (!byMat || typeof byMat !== "object") return 30;
  const vals = Object.values(byMat).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (vals.length === 0) return 30;
  return Math.max(...vals);
}