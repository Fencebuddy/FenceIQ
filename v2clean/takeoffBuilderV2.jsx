/**
 * CLEAN TAKEOFF BUILDER V2
 * 
 * INPUT: map geometry (posts, gates) + runs (dimensions) + compareVariants overrides
 * FLOW: post normalization → gate logic → UCK resolution → catalog lookup
 * OUTPUT: resolved materials with pricing per variant (A/B/C)
 */

import { base44 } from '@/api/base44Client';

/**
 * Build takeoff for single variant
 * @param {Object} variant - { materialType, height, color, coating, fenceSystem }
 * @param {number} totalLF - total linear feet from map
 * @param {number} postCount - number of posts
 * @param {Array} gates - gate objects
 * @returns {Array} line items with UCK + qty
 */
export function buildVariantTakeoff(variant, totalLF, postCount, gates = []) {
  const items = [];
  const { materialType, height, color, coating } = variant;

  // Normalize height to string (e.g., 6 → "6ft")
  const heightStr = typeof height === 'string' ? height : `${height}ft`;
  
  // Normalize color: remove spaces, convert to lowercase
  const normalizeColor = (c) => {
    if (!c) return 'white';
    return c.replace(/\s+/g, '_').toLowerCase();
  };
  const normalizedColor = normalizeColor(color);

  // 1. POSTS
  if (materialType === 'vinyl') {
    // Vinyl: white/tan/khaki color variants
    items.push(
      {
        displayName: `Vinyl ${heightStr} Line Posts`,
        uck: `vinyl_post_line_${parseInt(height)}_${normalizedColor}`,
        qty: Math.max(0, postCount - gates.length * 2), // subtract gate posts
        unit: 'each'
      },
      {
        displayName: `Vinyl ${heightStr} Corner Posts`,
        uck: `vinyl_post_corner_${parseInt(height)}_${normalizedColor}`,
        qty: 2, // assume 2 corners
        unit: 'each'
      },
      {
        displayName: `Vinyl ${heightStr} Privacy Panels`,
        uck: `vinyl_panel_privacy_${parseInt(height)}_${normalizedColor}`,
        qty: Math.ceil(totalLF / 6), // panels are ~6ft wide
        unit: 'each'
      },
      {
        displayName: `Vinyl Top Rail`,
        uck: `vinyl_rail_top_${parseInt(height)}_${normalizedColor}`,
        qty: Math.ceil(totalLF / 21), // 21ft rails
        unit: 'each'
      }
    );
  } else if (materialType === 'chain_link') {
    // Normalize coating: remove spaces, convert to lowercase
    const normalizedCoating = coating ? coating.toLowerCase().replace(/\s+/g, '_') : 'galv';
    items.push(
      {
        displayName: `Chain Link ${heightStr} Posts`,
        uck: `chainlink_post_${parseInt(height)}_${normalizedCoating}`,
        qty: postCount,
        unit: 'each'
      },
      {
        displayName: `Chain Link ${heightStr} Fabric (50ft roll)`,
        uck: `chainlink_fabric_${parseInt(height)}_${normalizedCoating}_50ft`,
        qty: Math.ceil(totalLF / 50),
        unit: 'roll'
      },
      {
        displayName: `Chain Link Top Rail`,
        uck: `chainlink_rail_top_${parseInt(height)}_${normalizedCoating}`,
        qty: Math.ceil(totalLF / 21),
        unit: 'each'
      }
    );
  } else if (materialType === 'aluminum') {
    items.push(
      {
        displayName: `Aluminum ${heightStr} Posts`,
        uck: `aluminum_post_${parseInt(height)}_black`,
        qty: postCount,
        unit: 'each'
      },
      {
        displayName: `Aluminum ${heightStr} Panels`,
        uck: `aluminum_panel_${parseInt(height)}_black`,
        qty: Math.ceil(totalLF / 6),
        unit: 'each'
      },
      {
        displayName: `Aluminum Top Rail`,
        uck: `aluminum_rail_top_${parseInt(height)}_black`,
        qty: Math.ceil(totalLF / 21),
        unit: 'each'
      }
    );
  }

  // 2. GATES
  for (const gate of gates) {
    const gateWidth = gate.gateWidth_ft || gate.gateWidth;
    if (gate.gateType === 'Single') {
      items.push({
        displayName: `Single Gate ${gateWidth}ft`,
        uck: `gate_single_${gateWidth}`,
        qty: 1,
        unit: 'each'
      });
    } else if (gate.gateType === 'Double') {
      items.push({
        displayName: `Double Gate ${gateWidth}ft`,
        uck: `gate_double_${gateWidth}`,
        qty: 1,
        unit: 'each'
      });
    }
  }

  // 3. HARDWARE (always add)
  const hardwareUck = materialType === 'vinyl' 
    ? 'vinyl_hardware_kit'
    : materialType === 'chain_link'
    ? 'chainlink_hardware_kit'
    : 'aluminum_hardware_kit';

  items.push({
    displayName: 'Hardware Kit',
    uck: hardwareUck,
    qty: 1,
    unit: 'kit'
  });

  // 4. LABOR
  items.push({
    displayName: 'Labor',
    uck: 'labor_lf',
    qty: totalLF,
    unit: 'lf'
  });

  return items;
}

/**
 * Resolve line items against CompanySkuMap + MaterialCatalog
 * Returns resolved items with unit costs
 */
export async function resolveLineItems(companyId, lineItems, catalog, companySkuMap) {
  if (!companyId || !Array.isArray(lineItems)) {
    return { resolved: [], unresolved: [], summary: {} };
  }

  // Build lookups
  const catalogByUck = new Map();
  (catalog || []).forEach(c => {
    if (c.canonical_key) catalogByUck.set(c.canonical_key, c);
  });

  const mapsByUck = new Map();
  (companySkuMap || []).forEach(m => {
    if (m.uck) mapsByUck.set(m.uck, m);
  });

  const resolved = [];
  const unresolved = [];

  for (const item of lineItems) {
    const uck = item.uck;
    if (!uck) {
      unresolved.push({ ...item, reason: 'NO_UCK' });
      continue;
    }

    // Try CompanySkuMap first
    const companyMap = mapsByUck.get(uck);
    const catalogItem = catalogByUck.get(uck);

    if (!catalogItem) {
      unresolved.push({ ...item, reason: 'CATALOG_NOT_FOUND' });
      continue;
    }

    resolved.push({
      ...item,
      unit_cost: catalogItem.cost || 0,
      catalog_id: catalogItem.id,
      extended_cost: (item.qty || 0) * (catalogItem.cost || 0)
    });
  }

  return {
    resolved,
    unresolved,
    summary: {
      resolved_count: resolved.length,
      unresolved_count: unresolved.length
    }
  };
}