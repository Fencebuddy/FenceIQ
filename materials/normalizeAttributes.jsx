/**
 * NORMALIZE ATTRIBUTES
 * 
 * Ensures consistent mapping keys across variants and deterministic resolver behavior
 * 
 * Rules:
 * 1. Sort keys alphabetically
 * 2. Lowercase all keys and string values
 * 3. Trim whitespace
 * 4. Consistent unit representations (ft → feet, etc.)
 */

export function normalizeAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }

  const normalized = {};
  const keys = Object.keys(attributes).sort();

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    const value = attributes[key];

    normalized[normalizedKey] = normalizeValue(value);
  }

  return normalized;
}

/**
 * Normalize attribute key
 */
export function normalizeKey(key) {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

/**
 * Normalize attribute value
 */
export function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    let normalized = value.toLowerCase().trim();

    // Unit normalization
    normalized = normalized
      .replace(/\bfeet\b/g, 'ft')
      .replace(/\binches\b/g, 'in')
      .replace(/\binchs\b/g, 'in')
      .replace(/\byards\b/g, 'yd')
      .replace(/\bgallon\b/g, 'gal')
      .replace(/\bpounds\b/g, 'lbs')
      .replace(/\bwhite\b/g, 'white')
      .replace(/\bblack\b/g, 'black')
      .replace(/\bgrey\b/g, 'gray')
      .replace(/\bgray\b/g, 'gray')
      .replace(/\bgalv\b/g, 'galvanized')
      .replace(/\baluminized\b/g, 'aluminized');

    return normalized;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return value;
}

/**
 * Compute mapping key hash
 */
export function computeMappingKey(uck, attributes) {
  const normalized = normalizeAttributes(attributes);
  const combined = { uck, attributes: normalized };

  // Simple hash (in production use crypto.subtle)
  const json = JSON.stringify(combined);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Check if two attribute sets are equivalent (after normalization)
 */
export function attributesEqual(attrs1, attrs2) {
  const norm1 = normalizeAttributes(attrs1);
  const norm2 = normalizeAttributes(attrs2);

  const json1 = JSON.stringify(norm1);
  const json2 = JSON.stringify(norm2);

  return json1 === json2;
}