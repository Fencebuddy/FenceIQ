/**
 * ADVANCED CATALOG RESOLVER
 * Priority matching with guardrails for supplier catalog
 */

/**
 * Resolve takeoff line item to catalog entry with sophisticated matching
 * @param {Object} lineItem - Takeoff line item with canonical_key, lineItemName, etc.
 * @param {Array} catalog - Full MaterialCatalog array
 * @param {Object} context - Job/run context { fenceType, height_ft, materialType, usageContext }
 * @returns {Object} { resolved: boolean, catalogItem, matchType, warnings, trace }
 */
export function resolveLineItemAdvanced(lineItem, catalog, context = {}) {
  const { fenceType, height_ft, materialType, usageContext } = context;
  const canonicalKey = lineItem.canonical_key || lineItem.canonicalKey;
  const lineItemName = lineItem.lineItemName || '';
  const sku = lineItem.sku;

  // Initialize debug trace
  const trace = {
    input: {
      lineItemName,
      canonicalKey,
      sku,
      fenceType,
      height_ft,
      materialType,
      usageContext
    },
    candidates: [],
    guards: {},
    selected: null,
    reason: null
  };

  console.log('[advancedResolver] Resolving:', { canonicalKey, lineItemName, sku, context });

  // PRIORITY A: Exact SKU match
  if (sku) {
    const skuMatch = catalog.find(item => item.sku === sku);
    if (skuMatch) {
      trace.candidates.push({ item: skuMatch, method: 'SKU_EXACT', score: 100 });
      const guardCheck = checkGuardrails(skuMatch, context, trace);
      trace.guards = guardCheck;
      
      if (guardCheck.allowed) {
        trace.selected = { sku: skuMatch.sku, canonicalKey: skuMatch.material_id };
        trace.reason = `SKU exact match: ${sku}`;
        return { resolved: true, catalogItem: skuMatch, matchType: 'SKU_EXACT', warnings: [], trace };
      } else {
        trace.reason = `SKU match blocked: ${guardCheck.reason}`;
        return { 
          resolved: false, 
          catalogItem: null, 
          matchType: 'SKU_BLOCKED', 
          warnings: [`SKU match blocked: ${guardCheck.reason}`],
          trace
        };
      }
    }
  }

  // PRIORITY B: Exact canonical key match
  if (canonicalKey) {
    const canonicalMatch = catalog.find(item => 
      item.canonical_key === canonicalKey || 
      item.material_id === canonicalKey
    );
    
    if (canonicalMatch) {
      trace.candidates.push({ item: canonicalMatch, method: 'CANONICAL_EXACT', score: 95 });
      const guardCheck = checkGuardrails(canonicalMatch, context, trace);
      trace.guards = guardCheck;
      
      if (guardCheck.allowed) {
        trace.selected = { sku: canonicalMatch.sku, canonicalKey: canonicalMatch.material_id };
        trace.reason = `Canonical key exact match: ${canonicalKey}`;
        return { resolved: true, catalogItem: canonicalMatch, matchType: 'CANONICAL_EXACT', warnings: [], trace };
      } else {
        trace.reason = `Canonical match blocked: ${guardCheck.reason}`;
        return { 
          resolved: false, 
          catalogItem: null, 
          matchType: 'CANONICAL_BLOCKED', 
          warnings: [`Canonical match blocked: ${guardCheck.reason}`],
          trace
        };
      }
    }
    
    // PRIORITY B.2: Fuzzy canonical key match (strip system/color suffixes)
    const prefixMatch = catalog.find(item => {
      const itemKey = item.canonical_key || item.material_id || '';
      // Check if catalog key starts with takeoff key (e.g., vinyl_panel_privacy_6ft matches vinyl_panel_privacy_6ft_savannah_white)
      return itemKey.startsWith(canonicalKey);
    });
    
    if (prefixMatch) {
      trace.candidates.push({ item: prefixMatch, method: 'CANONICAL_PREFIX', score: 90 });
      const guardCheck = checkGuardrails(prefixMatch, context, trace);
      trace.guards = guardCheck;
      
      if (guardCheck.allowed) {
        trace.selected = { sku: prefixMatch.sku, canonicalKey: prefixMatch.material_id };
        trace.reason = `Canonical key prefix match: ${canonicalKey} → ${prefixMatch.canonical_key}`;
        return { 
          resolved: true, 
          catalogItem: prefixMatch, 
          matchType: 'CANONICAL_PREFIX', 
          warnings: [`Used prefix match: ${canonicalKey} → ${prefixMatch.canonical_key}`], 
          trace 
        };
      }
    }
  }

  // NO MATCH - FAIL LOUDLY (no fuzzy fallbacks)
  trace.reason = 'No matching catalog item found';
  trace.suggestions = getSuggestions(lineItemName, catalog, 3);
  
  return { 
    resolved: false, 
    catalogItem: null, 
    matchType: 'NO_MATCH',
    warnings: ['No catalog match found'],
    trace
  };
}

/**
 * Check guardrails - enforce fence type restrictions and vinyl support post rule
 */
function checkGuardrails(catalogItem, context, trace = null) {
  const { fenceType, usageContext } = context;
  
  const guardResults = {
    allowedFenceTypes: { checked: false, passed: false },
    disallowedFenceTypes: { checked: false, passed: false },
    allowedUsageContexts: { checked: false, passed: false },
    vinylSupportRule: { checked: false, passed: false, log: null }
  };

  // GUARDRAIL 1: Fence type must be in allowedFenceTypes
  if (catalogItem.allowed_fence_types && catalogItem.allowed_fence_types.length > 0) {
    guardResults.allowedFenceTypes.checked = true;
    guardResults.allowedFenceTypes.passed = catalogItem.allowed_fence_types.includes(fenceType);
    
    if (!guardResults.allowedFenceTypes.passed) {
      const reason = `Fence type '${fenceType}' not in allowedFenceTypes: ${catalogItem.allowed_fence_types.join(', ')}`;
      return { allowed: false, reason, guardResults };
    }
  }

  // GUARDRAIL 2: Fence type must NOT be in disallowedFenceTypes
  if (catalogItem.disallowed_fence_types && catalogItem.disallowed_fence_types.length > 0) {
    guardResults.disallowedFenceTypes.checked = true;
    guardResults.disallowedFenceTypes.passed = !catalogItem.disallowed_fence_types.includes(fenceType);
    
    if (!guardResults.disallowedFenceTypes.passed) {
      const reason = `Fence type '${fenceType}' is in disallowedFenceTypes: ${catalogItem.disallowed_fence_types.join(', ')}`;
      return { allowed: false, reason, guardResults };
    }
  }

  // GUARDRAIL 3: Vinyl support post rule (CRITICAL)
  // "GALV 2-1/2 x 8 x .130(40) NP" is VINYL SUPPORT ONLY
  if (catalogItem.system === 'vinyl_support' || catalogItem.component_family === 'support_post') {
    guardResults.vinylSupportRule.checked = true;
    const validUsageContexts = catalogItem.allowed_usage_contexts || [];
    
    if (validUsageContexts.length > 0) {
      guardResults.vinylSupportRule.passed = validUsageContexts.includes(usageContext);
      
      if (!guardResults.vinylSupportRule.passed) {
        const reason = `Vinyl support post requires usageContext in [${validUsageContexts.join(', ')}], got '${usageContext}'`;
        guardResults.vinylSupportRule.log = `❌ DENIED: ${reason}`;
        console.warn('[VINYL SUPPORT RULE]', reason);
        return { allowed: false, reason, guardResults };
      } else {
        guardResults.vinylSupportRule.log = `✅ ALLOWED: context '${usageContext}' is valid`;
        console.log('[VINYL SUPPORT RULE] ✅ Allowed:', usageContext);
      }
    }
  }

  // GUARDRAIL 4: Resolver guards (custom rules)
  const resolverGuards = catalogItem.resolver_guards || {};
  
  if (resolverGuards.denyIfSystemNotEqual) {
    const requiredSystem = resolverGuards.denyIfSystemNotEqual;
    if (catalogItem.system !== requiredSystem) {
      return {
        allowed: false,
        reason: `System guard requires system='${requiredSystem}', item has '${catalogItem.system}'`
      };
    }
  }

  return { allowed: true, guardResults };
}

/**
 * Get top N suggestions for unmatched item
 */
function getSuggestions(lineItemName, catalog, limit = 3) {
  if (!lineItemName) return [];
  
  const searchTerm = lineItemName.toLowerCase();
  const scored = catalog.map(item => {
    const itemName = (item.crm_name || '').toLowerCase();
    let score = 0;
    
    // Exact substring match
    if (itemName.includes(searchTerm)) score += 50;
    
    // Word overlap
    const searchWords = searchTerm.split(/\s+/);
    const itemWords = itemName.split(/\s+/);
    const overlap = searchWords.filter(w => itemWords.includes(w)).length;
    score += overlap * 10;
    
    return { item, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      name: s.item.crm_name,
      sku: s.item.sku,
      score: s.score
    }));
}

/**
 * Select best match from multiple candidates using context
 */
function selectBestMatch(matches, context) {
  if (matches.length === 1) return matches[0];

  const { fenceType, height_ft, materialType } = context;

  // Score each match
  const scored = matches.map(item => {
    let score = 0;

    // Prefer exact fence type match
    if (item.allowed_fence_types && item.allowed_fence_types.includes(fenceType)) {
      score += 10;
    }

    // Prefer height match
    const itemHeight = item.attributes?.height_ft;
    if (itemHeight && height_ft && itemHeight === height_ft) {
      score += 5;
    }

    // Prefer system match
    if (item.system === materialType?.toLowerCase()) {
      score += 3;
    }

    return { item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].item;
}

/**
 * Infer component family from canonical key or line item name
 */
function inferComponentFamily(canonicalKey, lineItemName) {
  const key = (canonicalKey || '').toLowerCase();
  const name = (lineItemName || '').toLowerCase();

  if (key.includes('fabric') || name.includes('fabric')) return 'fabric';
  if (key.includes('rail_top') || name.includes('top rail')) return 'rail_top';
  if (key.includes('post_line') || name.includes('line post')) return 'post_line';
  if (key.includes('post_terminal') || name.includes('terminal post') || name.includes('end post') || name.includes('corner post')) return 'post_terminal';
  if (key.includes('tension_bar') || name.includes('tension bar')) return 'tension_bar';
  if (key.includes('tension_band') || name.includes('tension band')) return 'tension_band';
  if (key.includes('brace_band') || name.includes('brace band')) return 'brace_band';
  if (key.includes('loop_cap') || name.includes('loop cap')) return 'loop_cap';
  if (key.includes('dome_cap') || name.includes('dome cap')) return 'dome_cap';
  if (key.includes('gate') && !key.includes('hinge')) return 'gate';
  if (key.includes('panel')) return 'panel';
  if (key.includes('cap')) return 'cap';
  
  return 'misc';
}

/**
 * Batch resolve multiple line items
 */
export function resolveLineItemsBatch(lineItems, catalog, context) {
  const results = lineItems.map(item => ({
    lineItem: item,
    resolution: resolveLineItemAdvanced(item, catalog, context)
  }));

  const resolved = results.filter(r => r.resolution.resolved);
  const unresolved = results.filter(r => !r.resolution.resolved);

  return {
    results,
    resolved,
    unresolved,
    stats: {
      total: lineItems.length,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      resolutionRate: ((resolved.length / lineItems.length) * 100).toFixed(1)
    }
  };
}