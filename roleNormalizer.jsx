/**
 * ROLE NORMALIZATION SERVICE
 * 
 * Purpose: Strip non-functional tokens from takeoff role strings before FenceRoleConfig lookup.
 * Goal: Eliminate silent failures from role naming drift (e.g., 5x5, 4x4 post size tokens).
 * 
 * ARCHITECTURE NOTE:
 * This is a TEMPORARY compatibility layer. Target end-state is UCK-first (no role layer).
 * Future: Takeoff → UCK → CompanySkuMap → Catalog (FenceRoleConfig deprecated).
 */

/**
 * Normalize a role string by stripping non-functional tokens
 * 
 * NON-FUNCTIONAL TOKENS (stripped):
 * - Post size descriptors: 5x5, 4x4, 6x6, 4x6
 * 
 * FUNCTIONAL TOKENS (preserved):
 * - Material type: vinyl, wood, chainlink, aluminum
 * - Height: 4ft, 5ft, 6ft, 8ft
 * - Fence system: savannah, lakeshore, yorktown
 * - Color/finish: white, black, tan, khaki, grey, galv, galvanized
 * - Post type: end, line, corner, gate
 * 
 * @param {string} role - Raw role string from takeoff engine
 * @returns {string} - Normalized role string
 * 
 * @example
 * normalizeRole('vinyl_post_end_5x5_6ft_savannah_white')
 * // Returns: 'vinyl_post_end_6ft_savannah_white'
 * 
 * normalizeRole('vinyl_post_line_4x4_5ft_savannah_black')
 * // Returns: 'vinyl_post_line_5ft_savannah_black'
 */
export function normalizeRole(role) {
  if (!role || typeof role !== 'string') {
    return role;
  }

  // Pattern: Strip post size tokens (5x5, 4x4, 6x6, 4x6)
  // These are structural descriptors that don't affect UCK resolution
  const normalized = role
    .replace(/_5x5_/g, '_')
    .replace(/_4x4_/g, '_')
    .replace(/_6x6_/g, '_')
    .replace(/_4x6_/g, '_')
    .replace(/_5x5$/g, '') // Strip trailing
    .replace(/_4x4$/g, '')
    .replace(/_6x6$/g, '')
    .replace(/_4x6$/g, '');

  return normalized;
}

/**
 * Normalize a batch of roles
 * 
 * @param {string[]} roles - Array of role strings
 * @returns {Map<string, string>} - Map of original → normalized roles
 */
export function normalizeRoles(roles) {
  const normalized = new Map();
  
  for (const role of roles) {
    normalized.set(role, normalizeRole(role));
  }
  
  return normalized;
}

/**
 * Check if a role was normalized (changed)
 * 
 * @param {string} role - Original role string
 * @returns {boolean} - True if normalization changed the role
 */
export function wasNormalized(role) {
  const normalized = normalizeRole(role);
  return role !== normalized;
}

/**
 * Get normalization debug info
 * 
 * @param {string} role - Original role string
 * @returns {object} - { original, normalized, changed, strippedTokens }
 */
export function getNormalizationDebug(role) {
  const normalized = normalizeRole(role);
  const changed = role !== normalized;
  
  // Extract what was stripped
  const strippedTokens = [];
  if (role.includes('_5x5')) strippedTokens.push('5x5');
  if (role.includes('_4x4')) strippedTokens.push('4x4');
  if (role.includes('_6x6')) strippedTokens.push('6x6');
  if (role.includes('_4x6')) strippedTokens.push('4x6');
  
  return {
    original: role,
    normalized,
    changed,
    strippedTokens
  };
}