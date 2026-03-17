/**
 * UCK VALIDATION ASSERTION
 * 
 * Dev-only assertion to ensure FenceSystemConfig and takeoff builders 
 * generate IDENTICAL UCKs for the same material selection.
 * 
 * Prevents silent bad mappings by catching UCK drift at save time.
 */

import { generateContextualUck } from '@/components/materials/generateContextualUck';

/**
 * Validate that the UCK we're saving matches what the takeoff builder would generate
 * 
 * @param {Object} params
 * @param {string} params.canonical_key - Base canonical key
 * @param {string} params.fenceType - Fence type
 * @param {string} params.height - Height
 * @param {string} params.coating - Coating (Chain Link)
 * @param {string} params.system - System (Vinyl)
 * @param {string} params.color - Color
 * @param {string} params.generatedUck - The UCK we're about to save
 * @returns {Object} { valid: boolean, expectedUck: string, actualUck: string, mismatchTokens: string[] }
 */
export function validateUckMatch({
  canonical_key,
  fenceType,
  height,
  coating,
  system,
  color,
  generatedUck
}) {
  // Generate what the takeoff builder would create
  const expectedUck = generateContextualUck({
    canonical_key,
    fenceType,
    height,
    coating,
    system,
    color
  });
  
  const valid = expectedUck === generatedUck;
  
  if (!valid) {
    console.error('[UCK Validation] MISMATCH DETECTED:', {
      canonical_key,
      expectedUck,
      actualUck: generatedUck,
      context: { fenceType, height, coating, system, color }
    });
    
    // Identify mismatched tokens
    const expectedTokens = expectedUck.split('_');
    const actualTokens = generatedUck.split('_');
    const mismatchTokens = [];
    
    expectedTokens.forEach((token, idx) => {
      if (actualTokens[idx] !== token) {
        mismatchTokens.push(`Position ${idx}: expected "${token}" got "${actualTokens[idx] || 'MISSING'}"`);
      }
    });
    
    if (actualTokens.length !== expectedTokens.length) {
      mismatchTokens.push(`Length mismatch: expected ${expectedTokens.length} tokens, got ${actualTokens.length}`);
    }
    
    return {
      valid: false,
      expectedUck,
      actualUck: generatedUck,
      mismatchTokens
    };
  }
  
  return {
    valid: true,
    expectedUck,
    actualUck: generatedUck,
    mismatchTokens: []
  };
}

/**
 * Simulate what a takeoff builder would generate for a given material selection
 * Used for validation before saving to CompanySkuMap
 */
export function simulateTakeoffUck({
  canonical_key,
  fenceType,
  height,
  coating,
  system,
  color
}) {
  return generateContextualUck({
    canonical_key,
    fenceType,
    height,
    coating,
    system,
    color
  });
}