/**
 * HEIGHT NORMALIZER
 * Converts various fence height formats to canonical tokens
 * Handles: "4", 4, "4'", "4ft", "4 ft" → "4ft" token
 */

/**
 * Normalize fence height to numeric feet value
 * @param {string|number} heightInput - Height in various formats
 * @returns {number} Height in feet (e.g., 4, 5, 6, 8, 10, 12)
 */
export function normalizeHeightToNumber(heightInput) {
  if (!heightInput) return 6; // Default fallback

  const str = String(heightInput).trim().toLowerCase();
  
  // Remove common suffixes: ft, f, ', foot, feet, etc.
  const cleaned = str
    .replace(/\s*(ft|f|foot|feet|')\s*$/i, '')
    .trim();
  
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? num : 6;
}

/**
 * Convert numeric height to canonical token for canonical keys
 * @param {number} heightNum - Height in feet (e.g., 4, 5, 6)
 * @returns {string} Canonical token (e.g., "4ft", "5ft", "6ft")
 */
export function heightToCanonical(heightNum) {
  const num = normalizeHeightToNumber(heightNum);
  return `${Math.round(num)}ft`;
}

/**
 * Resolve fence height with priority:
 * 1. run.fenceHeight (preferred)
 * 2. job.fenceHeight (fallback)
 * 3. 6ft (default)
 * Returns both numeric and canonical forms
 */
export function resolveFenceHeight(run, job) {
  let heightStr = run?.fenceHeight || job?.fenceHeight || "6'";
  const heightNum = normalizeHeightToNumber(heightStr);
  const canonical = heightToCanonical(heightNum);
  
  return {
    numeric: heightNum,
    canonical, // "4ft", "5ft", "6ft", etc.
    original: heightStr
  };
}