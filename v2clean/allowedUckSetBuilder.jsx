/**
 * AllowedUCKSet Builder
 * Builds a runtime set of allowed UCKs for a company from MaterialCatalog
 * Ensures takeoff only produces canonical keys that exist in approved catalog
 */

import { normalizeAttributes } from '@/components/materials/normalizeAttributes';

/**
 * Build AllowedUCKSet from MaterialCatalog
 * @param {Array} materialCatalog - Active MaterialCatalog items
 * @param {string} companyId - Company ID (optional for filtering active_company_ids)
 * @returns {Set} Set of allowed UCK+unit combinations
 */
export function buildAllowedUckSet(materialCatalog = [], companyId = null) {
  const allowedSet = new Set();

  for (const item of materialCatalog) {
    // Check if item is active for this company
    if (companyId && item.active_company_ids?.length > 0) {
      if (!item.active_company_ids.includes(companyId)) {
        continue; // Skip items not active for this company
      }
    }

    // Skip inactive items
    if (!item.active) continue;

    // Use canonical_key as the UCK
    const uck = item.canonical_key || item.material_id;
    if (!uck) continue;

    // Unit from catalog
    const unit = item.unit || 'each';

    // Build normalized attributes from catalog item
    const attributesNormalized = normalizeAttributes({
      category: item.category,
      sub_category: item.sub_category,
      material_type: item.material_type,
      finish: item.finish,
      size: item.size,
      keywords: item.keywords
    });

    // Create key = uck + unit (unit matters for validation)
    const key = `${uck}|||${unit}|||${JSON.stringify(attributesNormalized)}`;

    allowedSet.add(key);

    console.log('[AllowedUCKSet] Added:', { uck, unit, crm_name: item.crm_name });
  }

  console.log('[AllowedUCKSet] Total allowed:', allowedSet.size);
  return allowedSet;
}

/**
 * Check if a takeoff line item is in AllowedUCKSet
 * @param {Object} lineItem - Line item from takeoff
 * @param {Set} allowedSet - AllowedUCKSet
 * @returns {Object} { allowed: boolean, reason: string, matchingKey: string }
 */
export function validateLineItemContract(lineItem, allowedSet) {
  if (!allowedSet || allowedSet.size === 0) {
    return {
      allowed: false,
      reason: 'EMPTY_ALLOWED_SET',
      message: 'No allowed UCKs configured for company'
    };
  }

  const uck = lineItem.canonical_key || lineItem.uck;
  const unit = lineItem.unit || lineItem.uom || 'each';
  
  const attributesNormalized = normalizeAttributes(
    lineItem.attributes || {}
  );

  const key = `${uck}|||${unit}|||${JSON.stringify(attributesNormalized)}`;

  if (allowedSet.has(key)) {
    return {
      allowed: true,
      reason: 'ALLOWED',
      matchingKey: key
    };
  }

  // Check partial match (uck + unit, ignoring attributes)
  const partialKey = `${uck}|||${unit}`;
  const hasPartialMatch = Array.from(allowedSet).some(k => k.startsWith(partialKey));

  if (hasPartialMatch) {
    return {
      allowed: false,
      reason: 'ATTRIBUTE_MISMATCH',
      message: `UCK + unit match but attributes mismatch: ${uck} with unit ${unit}`,
      uck,
      unit
    };
  }

  // Check if uck exists with different unit
  const hasUckWithDifferentUnit = Array.from(allowedSet).some(k => {
    const [k_uck] = k.split('|||');
    return k_uck === uck;
  });

  if (hasUckWithDifferentUnit) {
    return {
      allowed: false,
      reason: 'UNIT_MISMATCH',
      message: `UCK exists but with different unit: ${uck} requested ${unit}`,
      uck,
      unit
    };
  }

  return {
    allowed: false,
    reason: 'UCK_NOT_FOUND',
    message: `UCK not in approved catalog: ${uck}`,
    uck,
    unit
  };
}