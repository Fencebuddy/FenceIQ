/**
 * UCK Canonicalizer
 * Transforms takeoff-generated UCKs to approved catalog UCKs via company-scoped aliases
 * Runs BEFORE resolver lookup to ensure takeoff speaks same language as catalog
 */

import { normalizeAttributes } from '@/components/materials/normalizeAttributes';

/**
 * Canonicalize line items from takeoff
 * @param {Array} lineItems - Items from takeoff
 * @param {string} companyId - Company ID
 * @param {Array} aliases - CompanyUckAlias records
 * @param {Object} companySettings - Company settings (for defaults like woodPicketProfile)
 * @returns {Array} Canonicalized line items with debug info
 */
export function canonicalizeLineItems(
  lineItems = [],
  companyId = null,
  aliases = [],
  companySettings = null
) {
  const result = [];

  for (const item of lineItems) {
    const originalUck = item.canonical_key || item.uck;
    const originalAttributes = item.attributes || {};
    let canonicalUck = originalUck;
    let patchedAttributes = { ...originalAttributes };
    let aliasApplied = null;

    if (!originalUck) {
      result.push({
        ...item,
        canonicalUck: null,
        originalUck: null,
        aliasApplied: null,
        canonicalizationReason: 'NO_UCK'
      });
      continue;
    }

    // STEP 1: Check for exact alias match
    const exactAlias = findMatchingAlias(originalUck, originalAttributes, companyId, aliases);
    if (exactAlias && exactAlias.enabled) {
      canonicalUck = exactAlias.toUck;
      if (exactAlias.toAttributesPatch) {
        patchedAttributes = { ...patchedAttributes, ...exactAlias.toAttributesPatch };
      }
      aliasApplied = { fromUck: exactAlias.fromUck, toUck: exactAlias.toUck, matched: 'exact' };
      console.log('[Canonicalizer] Alias applied (exact):', { originalUck, canonicalUck });
    }

    // STEP 2: Normalize synonyms if no exact match
    if (!aliasApplied) {
      const normalized = normalizeSynonyms(originalUck, originalAttributes);
      if (normalized.uckChanged) {
        canonicalUck = normalized.uck;
        patchedAttributes = { ...patchedAttributes, ...normalized.attributesPatch };
        aliasApplied = { fromUck: originalUck, toUck: canonicalUck, matched: 'synonym' };
        console.log('[Canonicalizer] Synonym normalized:', { originalUck, canonicalUck });
      }
    }

    // STEP 3: Apply wood picket profile default if needed
    if (originalUck?.includes('picket') && originalUck?.includes('wood')) {
      const picketsApplied = applyWoodPicketProfile(
        canonicalUck,
        originalUck,
        companySettings
      );
      if (picketsApplied.uckChanged) {
        canonicalUck = picketsApplied.uck;
        aliasApplied = {
          fromUck: originalUck,
          toUck: canonicalUck,
          matched: 'wood_picket_profile'
        };
        console.log('[Canonicalizer] Wood picket profile applied:', {
          originalUck,
          canonicalUck,
          profile: picketsApplied.profile
        });
      }
    }

    // Build normalized attributes
    const attributesNormalized = normalizeAttributes(patchedAttributes);

    // Build mapping key (same as resolver)
    const mappingKey = buildMappingKey(canonicalUck, attributesNormalized);

    result.push({
      ...item,
      canonical_key: canonicalUck, // Override with canonical UCK
      uck: canonicalUck,
      attributes: patchedAttributes,
      attributesNormalized,
      mappingKey,
      originalUck,
      aliasApplied,
      canonicalizationReason: aliasApplied ? 'ALIAS_APPLIED' : 'NO_ALIAS'
    });
  }

  console.log('[Canonicalizer] Processed:', {
    total: lineItems.length,
    aliasesApplied: result.filter(r => r.aliasApplied).length,
    unchanged: result.filter(r => !r.aliasApplied).length
  });

  return result;
}

/**
 * Find matching alias for UCK + attributes
 */
function findMatchingAlias(uck, attributes = {}, companyId, aliases = []) {
  if (!aliases || aliases.length === 0) return null;

  return aliases.find(alias => {
    // Must match company and source UCK
    if (alias.companyId !== companyId || alias.fromUck !== uck) {
      return false;
    }

    // If fromAttributesSignature is specified, must match
    if (alias.fromAttributesSignature && typeof alias.fromAttributesSignature === 'object') {
      for (const [key, value] of Object.entries(alias.fromAttributesSignature)) {
        if (attributes[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Normalize common UCK synonyms
 */
function normalizeSynonyms(uck, attributes = {}) {
  if (!uck) return { uck, uckChanged: false, attributesPatch: {} };

  let normalized = uck;
  let attributesPatch = {};
  let uckChanged = false;

  // galv/gal/galvanized synonyms
  if (normalized.match(/galv|gal(?!gate)/i)) {
    // Keep uck as-is, but normalize finish attribute
    attributesPatch.finish = 'galv';
  }

  // Size normalization: 2.5 -> 2_5in, 2-1/2 -> 2_5in
  if (normalized.match(/2\.5|2-1\/2|2½/)) {
    normalized = normalized.replace(/2\.5|2-1\/2|2½/g, '2_5in');
    uckChanged = true;
  }

  // Width normalization: x8 -> 8ft
  if (normalized.match(/x(\d+)/)) {
    normalized = normalized.replace(/x(\d+)/g, '$1ft');
    uckChanged = true;
  }

  // treated/pressure-treated
  if (normalized.match(/treated|pressure|pt/i)) {
    if (!normalized.includes('treated')) {
      normalized = normalized.replace(/pressure|pt/i, 'treated');
      uckChanged = true;
    }
    attributesPatch.finish = 'treated';
  }

  return { uck: normalized, uckChanged, attributesPatch };
}

/**
 * Apply wood picket profile (dogear vs flat)
 */
function applyWoodPicketProfile(uck, originalUck, companySettings = null) {
  // If already specifies dogear or flat, don't change
  if (uck.includes('dogear') || uck.includes('flat')) {
    return { uck, uckChanged: false, profile: null };
  }

  // Get default profile from settings
  const defaultProfile = companySettings?.defaultWoodPicketProfile || 'dogear';

  // If takes a generic picket, replace with profile-specific
  if (uck.includes('privacy_picket') || uck.includes('picket_privacy')) {
    const withProfile = uck.replace(
      /privacy_picket|picket_privacy/,
      `picket_${defaultProfile}`
    );
    return { uck: withProfile, uckChanged: true, profile: defaultProfile };
  }

  return { uck, uckChanged: false, profile: null };
}

/**
 * Build mapping key (same hash as resolver)
 */
function buildMappingKey(uck, attributesNormalized = {}) {
  if (!uck) return null;
  // Simple deterministic key for lookups
  return `${uck}|||${JSON.stringify(attributesNormalized || {})}`;
}