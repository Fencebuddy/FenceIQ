/**
 * Savannah Audit Resolver
 * Converts generic vinyl canonical keys to Savannah family names with pricing
 * CRITICAL: This is the ONLY way vinyl items should appear in audits
 */

import { resolveSavannahItem } from '../catalog/savannahResolver';

/**
 * Resolve vinyl lineItems to Savannah product names + costs
 * @param {Array} lineItems - Raw takeoff line items with canonical keys
 * @param {Object} job - Job object with height, color
 * @param {string} overrideColor - Optional color override (for variant pricing)
 * @param {string} overrideHeight - Optional height override (for variant pricing)
 * @returns {Array} - Enriched line items with Savannah names
 */
export function resolveSavannahLineItems(lineItems, job, overrideColor, overrideHeight) {
  if (!lineItems || lineItems.length === 0) return [];
  
  const heightFt = parseInt(overrideHeight || job.fenceHeight) || 6;
  const color = (overrideColor || job.fenceColor || 'white').toLowerCase();
  
  return lineItems.map(item => {
    // Use variant color if available, otherwise use job color
    const resolveColor = (item.variantColor || overrideColor || job.fenceColor || 'white').toLowerCase();
    const resolved = resolveSavannahFromCanonicalKey(item.canonical_key, heightFt, resolveColor);
    
    if (!resolved.valid) {
      // UNRESOLVED: Block pricing, show error
      return {
        ...item,
        savannahResolved: false,
        savannahReason: resolved.reason,
        displayName: `⚠️ ${item.lineItemName}`,
        blockPricing: true
      };
    }
    
    return {
      ...item,
      savannahResolved: true,
      savannahName: resolved.displayName,
      savannahCost: resolved.unit_cost,
      displayName: resolved.displayName,
      canonical_key: resolved.canonical_key,
      blockPricing: false
    };
  });
}

/**
 * Parse canonical key and resolve to Savannah product
 */
function resolveSavannahFromCanonicalKey(canonicalKey, heightFt, color) {
  if (!canonicalKey) {
    return { valid: false, reason: 'Missing canonical key' };
  }
  
  // PANELS
  if (canonicalKey.includes('vinyl_panel_privacy')) {
    const resolution = resolveSavannahItem({
      kind: 'panel',
      height_ft: heightFt,
      color: color
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `Savannah ${heightFt}' ${capitalizeFirst(color)} Privacy Panel`
    };
  }
  
  // POSTS
  if (canonicalKey.includes('vinyl_post_')) {
    const role = extractPostRole(canonicalKey);
    
    if (!role) {
      return { valid: false, reason: 'Cannot determine post role' };
    }
    
    const resolution = resolveSavannahItem({
      kind: 'post',
      height_ft: heightFt,
      color: color,
      role: role
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    const postLength = { 4: 7, 5: 8, 6: 9 }[heightFt];
    
    return {
      ...resolution,
      displayName: `Savannah ${heightFt}' ${capitalizeFirst(color)} ${postLength}' ${capitalizeFirst(role)} Post`
    };
  }
  
  // GATES
  if (canonicalKey.includes('vinyl_gate_')) {
    const gateType = canonicalKey.includes('_single_') ? 'single' : 'double';
    const widthMatch = canonicalKey.match(/_(4|5|6|8|10|12)ft/);
    
    if (!widthMatch) {
      return { valid: false, reason: 'Cannot extract gate width' };
    }
    
    const widthFt = parseInt(widthMatch[1]);
    
    // Map common ft widths to actual inch widths used in Savannah catalog
    const ftToInch = {
      4: 38.5,
      5: 44.5,
      6: 62.5,
      8: 38.5,
      10: 62.5,
      12: 68.5
    };
    
    const gateWidthIn = ftToInch[widthFt] || 62.5; // Default fallback
    
    const resolution = resolveSavannahItem({
      kind: 'gate',
      height_ft: heightFt,
      color: color,
      gate_type: gateType,
      gate_width_in: gateWidthIn
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `Savannah ${heightFt}' ${capitalizeFirst(color)} ${widthFt}' ${capitalizeFirst(gateType)} Gate`
    };
  }
  
  // POST CAPS
  if (canonicalKey.includes('vinyl_hardware_post_cap') || canonicalKey.includes('post_cap')) {
    const resolution = resolveSavannahItem({
      kind: 'cap',
      height_ft: heightFt,
      color: color
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    const capStyle = heightFt === 4 ? 'Federation' : 'New England';
    
    return {
      ...resolution,
      displayName: `Savannah ${heightFt}' ${capitalizeFirst(color)} ${capStyle} Cap`
    };
  }
  
  // NON-SAVANNAH ITEMS (hardware, concrete, etc.) - pass through WITHOUT Savannah flag
  // Return invalid so JobCost falls through to catalog lookup
  return {
    valid: false,
    reason: 'NOT_SAVANNAH_ITEM',
    displayName: null,
    canonical_key: canonicalKey,
    unit_cost: null
  };
}

/**
 * Extract post role from canonical key
 */
function extractPostRole(canonicalKey) {
  const roles = ['end', 'corner', 'line', 'gate', 'blank', '3-way'];
  
  for (const role of roles) {
    if (canonicalKey.includes(`_post_${role}_`) || canonicalKey.includes(`_${role}_5x5`)) {
      return role;
    }
  }
  
  return null;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}