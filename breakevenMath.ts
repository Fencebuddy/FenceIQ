export function safeDiv(n, d, fallback = null) {
  const nn = Number(n), dd = Number(d);
  if (!Number.isFinite(nn) || !Number.isFinite(dd) || dd === 0) return fallback;
  return nn / dd;
}

/**
 * Revenue required to cover overhead using overheadRate as the recovery lever.
 * If overheadRate is the percentage baked into revenue, then:
 * requiredRevenue = overhead / overheadRate
 */
export function requiredRevenueCentsToCoverOverhead(monthlyOverheadCents, effectiveOverheadRate) {
  const r = Number(effectiveOverheadRate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return Math.round(Number(monthlyOverheadCents) / r);
}

export function pct(n, d) {
  const v = safeDiv(n, d, 0);
  return v * 100;
}