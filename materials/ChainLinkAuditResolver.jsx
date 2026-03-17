/**
 * Chain Link Audit Resolver
 * Converts generic chain link canonical keys to actual product names with pricing
 * CRITICAL: This is the ONLY way chain link items should appear in audits
 */

import { resolveChainLinkItem } from '../catalog/chainLinkResolver';

/**
 * Resolve chain link lineItems to product names + costs
 * @param {Array} lineItems - Raw takeoff line items with canonical keys
 * @param {Object} job - Job object with height, coating
 * @param {string} overrideCoating - Optional coating override (for variant pricing)
 * @param {string} overrideHeight - Optional height override (for variant pricing)
 * @returns {Array} - Enriched line items with chain link names
 */
export function resolveChainLinkLineItems(lineItems, job, overrideCoating, overrideHeight) {
  if (!lineItems || lineItems.length === 0) return [];
  
  const heightFt = parseInt(overrideHeight || job.fenceHeight) || 6;
  const coating = (overrideCoating || job.chainLinkCoating || 'Galvanized').toLowerCase();
  
  return lineItems.map(item => {
    // Use variant coating if available, otherwise use job coating
    const resolveCoating = (item.variantCoating || overrideCoating || job.chainLinkCoating || 'Galvanized').toLowerCase();
    const resolved = resolveChainLinkFromCanonicalKey(item.canonical_key, heightFt, resolveCoating);
    
    if (!resolved.valid) {
      // UNRESOLVED: Block pricing, show error
      return {
        ...item,
        chainLinkResolved: false,
        chainLinkReason: resolved.reason,
        displayName: `⚠️ ${item.lineItemName}`,
        blockPricing: true
      };
    }
    
    return {
      ...item,
      chainLinkResolved: true,
      chainLinkName: resolved.displayName,
      chainLinkCost: resolved.unit_cost,
      displayName: resolved.displayName,
      canonical_key: resolved.canonical_key,
      blockPricing: false
    };
  });
}

/**
 * Parse canonical key and resolve to chain link product
 */
function resolveChainLinkFromCanonicalKey(canonicalKey, heightFt, coating) {
  if (!canonicalKey) {
    return { valid: false, reason: 'Missing canonical key' };
  }
  
  // Normalize 'misc' to 'hardware' for backwards compatibility
  const normalizedKey = canonicalKey.replace('chainlink_misc_', 'chainlink_hardware_');
  
  const coatingPrefix = getCoatingPrefix(coating);
  
  // FABRIC
  if (normalizedKey.includes('chainlink_fabric_')) {
    const resolution = resolveChainLinkItem({
      kind: 'fabric',
      height_ft: heightFt,
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${heightFt}' Chain Link Fabric (${capitalizeFirst(coating)}) - 50ft Roll`
    };
  }
  
  // POSTS
  if (normalizedKey.includes('chainlink_post_')) {
    const role = extractPostRole(normalizedKey);
    
    if (!role) {
      return { valid: false, reason: 'Cannot determine post role' };
    }
    
    const resolution = resolveChainLinkItem({
      kind: 'post',
      height_ft: heightFt,
      coating: coating,
      role: role
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    const postHeight = { 4: 8, 5: 8, 6: 10 }[heightFt] || 10;
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} ${capitalizeFirst(role)} Post ${postHeight}ft (${heightFt}' fence)`
    };
  }
  
  // TOP RAIL
  if (normalizedKey.includes('chainlink_rail_top')) {
    const resolution = resolveChainLinkItem({
      kind: 'rail',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Top Rail 1-3/8in - 21ft Stick`
    };
  }
  
  // GATES
  if (normalizedKey.includes('chainlink_gate_')) {
    const gateType = normalizedKey.includes('_single_') ? 'single' : 'double';
    const widthMatch = normalizedKey.match(/_(4|5|6|8|10|12)ft/);
    
    if (!widthMatch) {
      return { valid: false, reason: 'Cannot extract gate width' };
    }
    
    const widthFt = parseInt(widthMatch[1]);
    
    const resolution = resolveChainLinkItem({
      kind: 'gate',
      height_ft: heightFt,
      coating: coating,
      gate_type: gateType,
      gate_width_ft: widthFt
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${heightFt}' x ${widthFt}' Chain Link Gate (${capitalizeFirst(gateType)})`
    };
  }
  
  // HARDWARE - Loop Caps
  if (normalizedKey.includes('chainlink_hardware_loop_cap')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'loop_cap',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Loop Cap 1-5/8in (Line)`
    };
  }
  
  // HARDWARE - Dome Caps
  if (normalizedKey.includes('chainlink_hardware_dome_cap')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'dome_cap',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Dome Cap 2-1/2in (Terminal)`
    };
  }
  
  // HARDWARE - Tension Bands
  if (normalizedKey.includes('chainlink_hardware_tension_band')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'tension_band',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Tension Band 2-1/2in`
    };
  }
  
  // HARDWARE - Brace Bands
  if (normalizedKey.includes('chainlink_hardware_brace_band')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'brace_band',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Brace Band 2-1/2in`
    };
  }
  
  // HARDWARE - Tension Bars
  if (normalizedKey.includes('chainlink_hardware_tension_bar')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'tension_bar',
      height_ft: heightFt,
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    const barLength = { 4: 48, 5: 60, 6: 72 }[heightFt] || 72;
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Tension Bar ${barLength}in (${heightFt}ft)`
    };
  }
  
  // HARDWARE - Fence Ties
  if (normalizedKey.includes('chainlink_hardware_fence_tie')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'fence_tie',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `Chain Link Fence Tie (${capitalizeFirst(coating)}) 9ga x 6-1/2in`
    };
  }
  
  // HARDWARE - Gate Hardware
  if (normalizedKey.includes('chainlink_hardware_gate_hinge')) {
    return {
      valid: true,
      displayName: 'Gate Hinges (pair) - Chain Link',
      unit_cost: 12.00,
      canonical_key: normalizedKey
    };
  }
  
  if (normalizedKey.includes('chainlink_hardware_gate_latch')) {
    return {
      valid: true,
      displayName: 'Pool Gate Latch (Chain Link)',
      unit_cost: 25.00,
      canonical_key: normalizedKey
    };
  }
  
  if (normalizedKey.includes('chainlink_hardware_gate_cap')) {
    return {
      valid: true,
      displayName: 'Gate Caps - Chain Link',
      unit_cost: 1.50,
      canonical_key: normalizedKey
    };
  }
  
  if (normalizedKey.includes('chainlink_hardware_cane_bolt')) {
    return {
      valid: true,
      displayName: 'Cane Bolts (double gates)',
      unit_cost: 12.00,
      canonical_key: normalizedKey
    };
  }
  
  // HARDWARE - Tension Wire
  if (normalizedKey.includes('chainlink_hardware_tension_wire')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'tension_wire',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `${coatingPrefix} Tension Wire (Bottom) - 100ft Roll`
    };
  }
  
  // HARDWARE - Carriage Bolts
  if (normalizedKey.includes('chainlink_hardware_carriage_bolt')) {
    const resolution = resolveChainLinkItem({
      kind: 'hardware',
      hardware_type: 'carriage_bolt',
      coating: coating
    });
    
    if (!resolution.valid) {
      return resolution;
    }
    
    return {
      ...resolution,
      displayName: `Carriage Bolt 5/16 x 1-1/4 (${capitalizeFirst(coating === 'black vinyl coated' ? 'Black' : 'Galv')})`
    };
  }
  
  // NON-CHAINLINK ITEMS (concrete, etc.) - pass through WITHOUT chain link flag
  return {
    valid: false,
    reason: 'NOT_CHAINLINK_ITEM',
    displayName: null,
    canonical_key: normalizedKey,
    unit_cost: null
  };
}

/**
 * Extract post role from canonical key
 */
function extractPostRole(canonicalKey) {
  const roles = ['line', 'terminal', 'end', 'corner'];
  
  for (const role of roles) {
    if (canonicalKey.includes(`_post_${role}`)) {
      return role;
    }
  }
  
  return null;
}

/**
 * Get coating prefix for display
 */
function getCoatingPrefix(coating) {
  if (!coating) return 'GALV';
  
  const coatingLower = coating.toLowerCase();
  if (coatingLower.includes('black') || coatingLower.includes('vinyl')) return 'BLK';
  if (coatingLower.includes('aluminized')) return 'ALUM';
  return 'GALV';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}