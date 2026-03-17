/**
 * CONTEXTUAL UCK GENERATOR
 * Generates UCKs for fence system material configuration
 * 
 * FORMAT: {canonical_key}_{height}_{system_or_coating}_{color}
 * 
 * Examples:
 * - chainlink_fabric_4ft_galvanized
 * - vinyl_panel_privacy_6ft_savannah_white
 * - aluminum_panel_privacy_6ft_black
 */

import { normalizeFinish } from '@/components/materials/normalizeFinish';

/**
 * Generate contextual UCK for a material in a fence system context
 * @param {Object} params
 * @param {string} params.canonical_key - Base canonical key (e.g., 'chainlink_fabric')
 * @param {string} params.fenceType - Fence type (e.g., 'Chain Link', 'Vinyl')
 * @param {string} params.height - Height (e.g., '4ft', '6ft')
 * @param {string} params.coating - Coating (for Chain Link: 'galvanized', 'black_vinyl')
 * @param {string} params.system - System (for Vinyl: 'savannah', 'lakeshore')
 * @param {string} params.color - Color (for Vinyl/Aluminum: 'white', 'tan', 'black')
 * @returns {string} Contextual UCK
 */
export function generateContextualUck({
  canonical_key,
  fenceType,
  height,
  coating,
  system,
  color
}) {
  const tokens = [canonical_key];
  
  // Normalize height (ensure 'ft' suffix)
  const normalizedHeight = height?.replace(/['"\s]/g, '').toLowerCase();
  if (normalizedHeight && !normalizedHeight.includes('ft')) {
    tokens.push(`${normalizedHeight}ft`);
  } else if (normalizedHeight) {
    tokens.push(normalizedHeight);
  }
  
  // Add system/coating based on fence type
  if (fenceType === 'Chain Link' && coating) {
    // Use normalizeFinish to match EXACTLY what chainLinkBuilder uses
    const normalizedCoating = normalizeFinish(coating);
    tokens.push(normalizedCoating);
  } else if (fenceType === 'Vinyl') {
    // CANONICAL FORMAT: {base}_{height}_{system}_{color}
    if (system) tokens.push(normalizeToken(system));
    if (color) tokens.push(normalizeToken(color));
  } else if (fenceType === 'Aluminum') {
    if (system) tokens.push(normalizeToken(system));
    if (color) tokens.push(normalizeToken(color));
  }
  
  const uck = tokens.join('_');
  
  // TASK 1: Guard against poison format (duplicate color token)
  if (color && fenceType === 'Vinyl') {
    const normalizedColor = normalizeToken(color);
    const tokenList = uck.split('_');
    const colorCount = tokenList.filter(t => t === normalizedColor).length;
    
    if (colorCount > 1) {
      throw new Error(`POISON UCK BLOCKED: Generated UCK "${uck}" contains duplicate color token "${normalizedColor}". This violates canonical format: {base}_{height}_{system}_{color}`);
    }
  }
  
  return uck;
}

/**
 * Normalize a token to underscore format
 */
function normalizeToken(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\s\-]/g, '_')
    .replace(/['"]/g, '');
}