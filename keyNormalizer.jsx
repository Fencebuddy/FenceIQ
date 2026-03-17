/**
 * KEY NORMALIZATION UTILITY
 * 
 * Single source of truth for UCK/canonical_key comparison.
 * MUST be used everywhere keys are compared or indexed.
 */

/**
 * Normalize a key for deterministic comparison
 * - Lowercases
 * - Trims whitespace
 * - Collapses repeated underscores (__ → _)
 * 
 * @param {string} key - Raw key string
 * @returns {string} - Normalized key
 * 
 * @example
 * normKey('Vinyl_Post__End') // 'vinyl_post_end'
 * normKey('  vinyl_post_end  ') // 'vinyl_post_end'
 */
export function normKey(key) {
  if (!key || typeof key !== 'string') {
    return '';
  }
  
  return key
    .toLowerCase()
    .trim()
    .replace(/_+/g, '_') // Collapse repeated underscores
    .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}

/**
 * Compare two keys for equality (normalized)
 */
export function keysEqual(key1, key2) {
  return normKey(key1) === normKey(key2);
}

/**
 * Build a normalized key index from array
 * @returns Map<normalizedKey, item>
 */
export function buildKeyIndex(items, keyField = 'canonical_key') {
  const index = new Map();
  for (const item of items) {
    const key = normKey(item[keyField]);
    if (key) {
      index.set(key, item);
    }
  }
  return index;
}

/**
 * Build a normalized key multi-index (allows duplicates)
 * @returns Map<normalizedKey, item[]>
 */
export function buildKeyMultiIndex(items, keyField = 'uck') {
  const index = new Map();
  for (const item of items) {
    const key = normKey(item[keyField]);
    if (key) {
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(item);
    }
  }
  return index;
}