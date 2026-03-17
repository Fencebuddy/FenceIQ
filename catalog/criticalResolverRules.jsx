/**
 * CRITICAL RESOLVER RULES
 * Enforce business-critical matching logic that must never regress
 */

/**
 * Test vinyl support post rule
 * Rule: If material=vinyl and support_needed=true → must use vinyl_support_post_galv_2_5in_10ft
 */
export function testVinylSupportPostRule(catalogItem, context) {
  const { materialType, usageContext } = context;
  
  if (materialType?.toLowerCase() === 'vinyl' && usageContext === 'vinyl_support') {
    const expectedKey = 'vinyl_support_post_galv_2_5in_10ft';
    const actualKey = catalogItem.canonical_key || catalogItem.material_id;
    
    return {
      passed: actualKey === expectedKey,
      rule: 'VINYL_SUPPORT_POST_10FT',
      expected: expectedKey,
      actual: actualKey,
      message: actualKey === expectedKey 
        ? '✓ Vinyl support post correctly matched to 10ft galv post'
        : `✗ Vinyl support should use ${expectedKey}, got ${actualKey}`
    };
  }
  
  return { passed: true, rule: 'VINYL_SUPPORT_POST_10FT', message: 'Rule not applicable' };
}

/**
 * Test chain link terminal post rule for 4'/5' galv
 * Rule: If material=chain_link and finish=galv and height in [4,5] and node_type in [end,corner,gate]
 *       → must use chainlink_post_terminal_galv_2_5in_8ft (NOT vinyl support)
 */
export function testChainLinkTerminalPostRule(catalogItem, context) {
  const { materialType, fenceType, height_ft, usageContext } = context;
  
  const isChainLink = materialType?.toLowerCase() === 'chain_link' || fenceType?.toLowerCase() === 'chain link';
  const isGalv = catalogItem.finish === 'galv';
  const isShortFence = height_ft <= 5;
  const isTerminal = ['end', 'corner', 'gate', 'terminal'].some(type => 
    usageContext?.toLowerCase().includes(type)
  );
  
  if (isChainLink && isGalv && isShortFence && isTerminal) {
    const expectedKey = 'chainlink_post_terminal_galv_2_5in_8ft';
    const actualKey = catalogItem.canonical_key || catalogItem.material_id;
    
    // CRITICAL: Must NOT use vinyl support post
    const isWrongPost = actualKey?.includes('vinyl_support');
    
    return {
      passed: actualKey === expectedKey && !isWrongPost,
      rule: 'CHAINLINK_TERMINAL_8FT_GALV',
      expected: expectedKey,
      actual: actualKey,
      message: actualKey === expectedKey 
        ? '✓ Chain link terminal correctly matched to 8ft galv post (GALV 2-1/2" x 8\' x 16ga-SPS)'
        : `✗ Chain link 4\'/5\' galv terminal should use ${expectedKey}, got ${actualKey}${isWrongPost ? ' (WRONG: using vinyl support post!)' : ''}`
    };
  }
  
  return { passed: true, rule: 'CHAINLINK_TERMINAL_8FT_GALV', message: 'Rule not applicable' };
}

/**
 * Run all critical resolver rules on a matched catalog item
 * @param {Object} catalogItem - Matched catalog item
 * @param {Object} context - Resolver context (materialType, height_ft, usageContext, etc.)
 * @returns {Object} { allPassed, results }
 */
export function runCriticalResolverTests(catalogItem, context) {
  const results = [
    testVinylSupportPostRule(catalogItem, context),
    testChainLinkTerminalPostRule(catalogItem, context)
  ];
  
  const allPassed = results.every(r => r.passed);
  const failures = results.filter(r => !r.passed && r.rule);
  
  return {
    allPassed,
    results,
    failures,
    summary: allPassed 
      ? '✓ All critical rules passed'
      : `✗ ${failures.length} critical rule(s) failed`
  };
}