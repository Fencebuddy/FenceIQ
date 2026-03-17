import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 2: CODE TRACE FORENSICS
 * 
 * Comprehensive code path analysis showing:
 * - Flow 1: Takeoff write (where canonical_key is assigned)
 * - Flow 2: Material resolution (how canonical_key resolves to catalog)
 * - Flow 3: Pricing cost lookup (where costs are applied)
 * - CompanySkuMap usage classification
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const flows = gatherCodeTraceEvidence();

    return Response.json({
      status: 'MATERIAL_IDENTIFIER_CODE_TRACE',
      timestamp: new Date().toISOString(),
      phase: '2',
      summary: {
        conclusion: 'canonical_key is the AUTHORITATIVE identifier',
        skuInUse: false,
        companySkuMapRequired: true,
        companySkuMapMode: 'MAPPING_LAYER_ONLY'
      },
      flows: flows
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

function gatherCodeTraceEvidence() {
  return {
    // ============================================================
    // FLOW 1: TAKEOFF WRITE PATH
    // ============================================================
    flow_1_takeoff_write: {
      title: 'TAKEOFF WRITE: Where canonical_key is assigned',
      files: [
        {
          name: 'TakeoffEngine.js',
          path: 'components/engine/TakeoffEngine.js',
          function: 'buildTakeoff()',
          evidence: [
            {
              line: '140-147',
              code: 'const panelUck = generateContextualUck({...})',
              meaning: 'Generate UCK (canonical key) from variant config',
              assignedTo: 'canonical_key'
            },
            {
              line: '149-156',
              code: 'lineItems.push({ canonical_key: panelUck, ... })',
              meaning: 'WRITE canonical_key to line items array',
              fields: ['canonical_key', 'lineItemName', 'quantityCalculated', 'uom', 'source']
            },
            {
              line: '170-178',
              code: 'const postUck = generateContextualUck({...})',
              meaning: 'Generate UCK for posts'
            },
            {
              line: '180-186',
              code: 'lineItems.push({ canonical_key: postUck, ... })',
              meaning: 'WRITE post UCK to line items'
            }
          ],
          sku_reference: 'NONE - SKU NOT MENTIONED',
          companySkuMap_reference: 'NONE - NOT CONSULTED',
          result: '✅ canonical_key is PRIMARY IDENTIFIER written'
        }
      ],
      next_step: 'canonical_key is passed to SnapshotOrchestratorV2.getOrCreateTakeoffSnapshot()'
    },

    // ============================================================
    // FLOW 2: MATERIAL RESOLUTION PATH
    // ============================================================
    flow_2_material_resolution: {
      title: 'MATERIAL RESOLUTION: Resolving canonical_key to catalog',
      resolvers: [
        {
          name: 'ResolverEngine.js (V2 - STRICT)',
          path: 'components/engine/ResolverEngine.js',
          function: 'resolveMaterials()',
          logic: '3-STEP MAPPING ONLY',
          steps: [
            {
              step: 1,
              line: '49',
              code: 'const companyMappings = await base44.entities.CompanySkuMap.filter({ companyId })',
              meaning: 'FETCH CompanySkuMap (mappings of UCK→catalogId)',
              required: true
            },
            {
              step: 2,
              line: '72',
              code: 'const uck = item.uck || item.canonical_key',
              meaning: 'Extract canonical_key from takeoff item'
            },
            {
              step: 3,
              line: '75',
              code: 'const mapping = mappingsByUck[uck]',
              meaning: 'LOOKUP: canonical_key → CompanySkuMap entry',
              joinKey: 'canonical_key (called "uck" in resolver)'
            },
            {
              step: 4,
              line: '92',
              code: 'const catalogItem = catalogById[mapping.materialCatalogId]',
              meaning: 'LOOKUP: CompanySkuMap.materialCatalogId → MaterialCatalog.id',
              joinKey: 'materialCatalogId'
            }
          ],
          sku_reference: 'NONE',
          companySkuMap_reference: 'REQUIRED - line 49-75',
          fallback_order: [
            'Step 1: Check CompanySkuMap for exact UCK match',
            'Step 2: If no CompanySkuMap entry, UNRESOLVED (no fallback)',
            'Step 3: If CompanySkuMap.materialCatalogId missing, UNRESOLVED',
            'Step 4: If catalog item deleted, UNRESOLVED'
          ],
          result: '✅ canonical_key resolves via CompanySkuMap ONLY (no direct catalog lookup)'
        },
        {
          name: 'universalResolver.js (GENESIS - ALTERNATIVE)',
          path: 'components/materials/universalResolver.js',
          function: 'resolveLineItemsWithMappings()',
          logic: 'IDENTICAL 3-STEP MAPPING',
          steps: [
            {
              line: '43-46',
              code: 'const allMappings = companySkuMap !== undefined ? companySkuMap : ...',
              meaning: 'USE CompanySkuMap as ONLY valid source'
            },
            {
              line: '83',
              code: 'const uck = item.uck',
              meaning: 'Extract UCK'
            },
            {
              line: '101-122',
              code: 'let mapping = mappingLookupLocked.get(mappingKey) || mappingLookupUnlocked.get(...)',
              meaning: 'LOOKUP: UCK → CompanySkuMap (locked then unlocked)'
            },
            {
              line: '137',
              code: 'const catalogItem = catalogLookup.get(mapping.materialCatalogId)',
              meaning: 'LOOKUP: materialCatalogId → MaterialCatalog'
            }
          ],
          sku_reference: 'NONE',
          companySkuMap_reference: 'REQUIRED - line 43-137',
          architectural_rules: [
            'ONLY CompanySkuMap is valid data source',
            'NO legacy paths, NO fallbacks, NO guessing',
            '3-STEP MATCH ONLY: locked → unlocked → unresolved'
          ],
          result: '✅ IDENTICAL logic: canonical_key → CompanySkuMap → MaterialCatalog'
        }
      ],
      conclusion: 'CompanySkuMap is NOT optional - it is the REQUIRED intermediary between canonical_key and MaterialCatalog'
    },

    // ============================================================
    // FLOW 3: PRICING COST LOOKUP PATH
    // ============================================================
    flow_3_pricing: {
      title: 'PRICING: Where unit costs are fetched and applied',
      pricers: [
        {
          name: 'computeCurrentPricing.js',
          path: 'components/services/jobCost/computeCurrentPricing.js',
          function: 'computeCurrentPricing()',
          logic: 'CATALOG-ONLY (no CompanySkuMap)',
          steps: [
            {
              line: '31-37',
              code: 'const catalogByKey = {}; catalog.forEach(item => { catalogByKey[item.canonical_key] = item })',
              meaning: 'BUILD index: canonical_key → MaterialCatalog',
              uses_sku: false,
              uses_companySkuMap: false
            },
            {
              line: '51',
              code: 'const canonicalKey = lineItem.canonical_key || lineItem.canonicalKey',
              meaning: 'Extract canonical_key from line item'
            },
            {
              line: '66',
              code: 'const catalogItem = catalogByKey[canonicalKey]',
              meaning: 'DIRECT LOOKUP: canonical_key → MaterialCatalog',
              joinKey: 'canonical_key',
              NOTE: 'DOES NOT use CompanySkuMap here'
            },
            {
              line: '80-81',
              code: 'const unit_cost = catalogItem.cost; const ext_cost = Number((qty * unit_cost)...)',
              meaning: 'FETCH cost from MaterialCatalog.cost'
            }
          ],
          sku_reference: 'NONE',
          companySkuMap_reference: 'NONE (surprising!)',
          result: '⚠️ Direct canonical_key→MaterialCatalog lookup (bypasses CompanySkuMap)'
        },
        {
          name: 'pricingService.js',
          path: 'components/pricing/pricingService.js',
          function: 'priceTakeoffLineItems()',
          logic: 'CATALOG-ONLY with CatalogLinkMap fallback',
          steps: [
            {
              line: '17-26',
              code: 'for (const link of catalogLinkMaps) { linkMap.set(link.canonical_key, link.catalog_item_id) }',
              meaning: 'Build legacy CatalogLinkMap (old system)',
              uses: 'CatalogLinkMap entity'
            },
            {
              line: '45-48',
              code: 'let match = matchLineItemToCatalog({ catalogIndex, canonicalKey })',
              meaning: 'LOOKUP via catalogMatch() function'
            },
            {
              line: '51-62',
              code: 'if (!match.matched && linkMap.has(canonicalKey) { const linkedItem = catalogById.get(...) }',
              meaning: 'FALLBACK: Try CatalogLinkMap if direct match fails'
            },
            {
              line: '74-78',
              code: 'const unitCost = safeNumber(match.item?.unitCost ?? match.item?.cost ?? ...)',
              meaning: 'Fetch cost from matched catalog item'
            }
          ],
          sku_reference: 'NONE',
          companySkuMap_reference: 'NONE',
          result: '⚠️ Uses legacy CatalogLinkMap, not CompanySkuMap'
        }
      ],
      critical_finding: '❌ COST LOOKUP INCONSISTENCY: pricing engines do NOT use CompanySkuMap',
      meaning: 'They assume canonical_key directly matches MaterialCatalog.canonical_key'
    },

    // ============================================================
    // COMPANYSKUMAP USAGE AUDIT
    // ============================================================
    companySkuMap_audit: {
      title: 'CompanySkuMap: All references in codebase',
      reads: [
        {
          file: 'ResolverEngine.js',
          line: '49',
          operation: 'READ: Filter by companyId',
          mode: 'REQUIRED for resolution'
        },
        {
          file: 'universalResolver.js',
          line: '44-46',
          operation: 'READ: Preloaded or fetched',
          mode: 'REQUIRED for resolution'
        }
      ],
      writes: [
        {
          file: 'ResolverEngine.js',
          line: '214-237',
          function: 'ensureCompanySkuMap()',
          operation: 'CREATE/UPDATE mapping',
          trigger: 'Auto-discovered mappings'
        },
        {
          file: 'upsertCompanySkuMap.js',
          line: '8-43',
          function: 'upsertCompanySkuMap()',
          operation: 'CREATE/UPDATE mapping',
          trigger: 'Manual mapping creation'
        }
      ],
      classification: {
        required_for: ['Material resolution in ResolverEngine', 'Material resolution in universalResolver'],
        optional_for: ['Pricing (computeCurrentPricing uses direct catalog lookup)'],
        not_used_in: ['Takeoff generation', 'Proposal snapshot creation', 'Pricing service.js'],
        status: 'REQUIRED for correctness, but NOT used everywhere it should be'
      }
    },

    // ============================================================
    // SYNTHESIS: AUTHORITATIVE KEY CLASSIFICATION
    // ============================================================
    key_classification: {
      'canonical_key': {
        status: 'AUTHORITATIVE (PRIMARY)',
        where_used: [
          'TakeoffSnapshot.line_items[].canonical_key (WRITE)',
          'ResolverEngine lookup key (READ)',
          'universalResolver lookup key (READ)',
          'computeCurrentPricing lookup key (READ)',
          'pricingService.js lookup key (READ)'
        ],
        properties: [
          'Generated deterministically from variant config + geometry',
          'Immutable (frozen in snapshot)',
          'Never empty in live data'
        ],
        verdict: '✅ TRUE AUTHORITATIVE KEY'
      },
      'sku': {
        status: 'DEAD FIELD',
        where_used: [],
        where_not_used: [
          'NOT in TakeoffEngine',
          'NOT in ResolverEngine',
          'NOT in universalResolver',
          'NOT in computeCurrentPricing',
          'NOT in pricingService'
        ],
        verdict: '❌ NEVER READ - SAFE TO DEPRECATE'
      },
      'materialCatalogId': {
        status: 'SECONDARY (MAPPING INTERMEDIARY)',
        where_used: [
          'CompanySkuMap.materialCatalogId (points to MaterialCatalog)',
          'ResolverEngine line 92 (fetch catalog via mapping)',
          'universalResolver line 137 (fetch catalog via mapping)'
        ],
        note: 'Only meaningful when CompanySkuMap mapping exists',
        verdict: '✅ REQUIRED in CompanySkuMap but NOT primary key'
      },
      'companySkuMapId': {
        status: 'ABSENT (not used)',
        verdict: '❌ NOT USED'
      }
    },

    // ============================================================
    // CRITICAL INCONSISTENCY ALERT
    // ============================================================
    inconsistency_alert: {
      issue: 'Cost lookup bypasses CompanySkuMap',
      evidence: [
        'computeCurrentPricing.js: Direct canonical_key→catalog lookup (line 66)',
        'pricingService.js: Uses CatalogLinkMap, not CompanySkuMap (line 51-62)',
        'ResolverEngine: Uses CompanySkuMap for resolution (line 75)',
        'universalResolver: Uses CompanySkuMap for resolution (line 101-137)'
      ],
      consequence: 'If canonical_key does NOT match MaterialCatalog.canonical_key exactly, pricing will fail even if CompanySkuMap mapping exists',
      recommendation: 'Update pricing engines to use CompanySkuMap mapping for cost lookup (not just ResolverEngine)'
    }
  };
}