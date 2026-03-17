/**
 * FINISH NORMALIZATION
 * Single source of truth for finish token normalization
 * 
 * Output: 'galv' | 'black_vinyl' | 'aluminized'
 * NO other strings allowed in UCKs
 */

/**
 * Normalize finish input to canonical token
 * @param {string} input - Raw finish string from any source
 * @returns {'galv' | 'black_vinyl' | 'aluminized'}
 */
export function normalizeFinish(input) {
  const s = String(input || "").toLowerCase().trim();

  if (!s) return "galv";

  // Galvanized variants
  if (s === "galv" || s.includes("galv") || s.includes("galvanized")) {
    return "galv";
  }

  // Black vinyl variants
  if (
    s === "black" ||
    s === "black_vinyl" ||
    s === "black_vinyl_coated" ||
    s.includes("black vinyl") ||
    s.includes("vinyl coated")
  ) {
    return "black_vinyl";
  }

  // Aluminized variants
  if (s === "alum" || s.includes("aluminized")) {
    return "aluminized";
  }

  // Safe default
  return "galv";
}

/**
 * Get display label for finish token
 */
export function getFinishLabel(finishToken) {
  const labels = {
    'galv': 'Galvanized',
    'black_vinyl': 'Black Vinyl Coated',
    'aluminized': 'Aluminized'
  };
  
  return labels[finishToken] || 'Galvanized';
}