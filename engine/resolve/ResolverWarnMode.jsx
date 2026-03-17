/**
 * V2 RESOLVER ENGINE - WARN MODE
 * 
 * Resolution strategy that continues pricing even with broken mappings.
 * Emits high-signal integrity errors/warnings without blocking field flow.
 * 
 * Version: 2026-01-31-warnmode
 */

import { normKey, buildKeyIndex, buildKeyMultiIndex } from '../../services/keyNormalizer';

const RESOLVER_VERSION = '2026-01-31-warnmode';

/**
 * Resolve takeoff items with integrity checking
 * 
 * @returns {
 *   pricingStatus: 'COMPLETE' | 'WARN' | 'INCOMPLETE',
 *   resolved: [],
 *   unresolved: [],
 *   invalidResolved: [],
 *   counts: { unresolved, integrityErrors, warnings, invalidResolved },
 *   meta: { resolverVersion, companyId, itemCount, catalogUniverse }
 * }
 */
export async function resolveWithIntegrity({
  base44,
  companyId,
  takeoffItems,
  companySettings = null
}) {
  console.log(`[V2_RESOLVER] version=${RESOLVER_VERSION} company=${companyId} items=${takeoffItems?.length || 0}`);
  
  // Determine catalog universe
  const useCompanyCatalog = companySettings?.useCompanyCatalog || false;
  const catalogUniverse = useCompanyCatalog ? 'company' : 'global';
  
  console.log(`[V2_RESOLVER] universe=${catalogUniverse}`);
  
  // Bulk load catalog and mappings (NO awaits in loops)
  const catalogFilter = useCompanyCatalog ? { companyId } : {};
  const rawCatalog = await base44.entities.MaterialCatalog.filter({ ...catalogFilter, active: true });
  const catalog = Array.isArray(rawCatalog) ? rawCatalog : (rawCatalog?.data || rawCatalog?.items || []);
  
  const rawMappings = await base44.entities.CompanySkuMap.filter({ companyId, status: 'mapped' });
  const mappings = Array.isArray(rawMappings) ? rawMappings : (rawMappings?.data || rawMappings?.items || []);
  
  // Build indexes
  const catalogById = new Map(catalog.map(c => [c.id, c]));
  const catalogByCanonicalKey = buildKeyIndex(catalog, 'canonical_key');
  const mapsByUck = buildKeyMultiIndex(mappings, 'uck');
  
  const resolved = [];
  const unresolved = [];
  const invalidResolved = [];
  let integrityErrorCount = 0;
  let warningCount = 0;
  
  for (const item of takeoffItems || []) {
    const uckRaw = item.uck || item.canonical_key || item.role;
    if (!uckRaw) {
      unresolved.push({
        uck: null,
        reason: 'MISSING_UCK',
        item: { ...item }
      });
      continue;
    }
    
    const uckKey = normKey(uckRaw);
    const integrityErrors = [];
    const warnings = [];
    
    // STEP 1: Try CompanySkuMap resolution
    const mapsForUck = mapsByUck.get(uckKey) || [];
    
    if (mapsForUck.length > 0) {
      // Check for duplicates
      if (mapsForUck.length > 1) {
        integrityErrors.push({
          code: 'DUPLICATE_MAPS',
          message: `${mapsForUck.length} mappings found for UCK ${uckRaw}`,
          severity: 'ERROR'
        });
        integrityErrorCount++;
      }
      
      // Choose deterministic winner (newest updatedAt, else stable sort)
      const chosenMap = mapsForUck.sort((a, b) => {
        const aTime = new Date(a.updated_date || a.updatedAt || 0).getTime();
        const bTime = new Date(b.updated_date || b.updatedAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime; // Newest first
        return (a.materialCatalogId || '').localeCompare(b.materialCatalogId || ''); // Stable sort
      })[0];
      
      const mappedCatalog = catalogById.get(chosenMap.materialCatalogId);
      const expectedCatalog = catalogByCanonicalKey.get(uckKey);
      
      // Integrity checks
      if (!mappedCatalog) {
        integrityErrors.push({
          code: 'MAP_POINTS_TO_MISSING_CATALOG',
          message: `Mapping points to missing catalog ID: ${chosenMap.materialCatalogId}`,
          severity: 'ERROR'
        });
        integrityErrorCount++;
        
        // Try to resolve via expected catalog as fallback
        if (expectedCatalog) {
          warnings.push({
            code: 'FALLBACK_TO_EXPECTED_CATALOG',
            message: 'Using expected catalog as fallback',
            severity: 'WARN'
          });
          warningCount++;
          
          const result = buildResolvedRecord({
            item,
            uckRaw,
            catalog: expectedCatalog,
            map: chosenMap,
            resolutionSource: 'catalog_direct',
            integrityErrors,
            warnings
          });
          
          if (isValidResolved(result)) {
            resolved.push(result);
          } else {
            invalidResolved.push(result);
          }
        } else {
          unresolved.push({
            uck: uckRaw,
            reason: 'MAP_POINTS_TO_MISSING_CATALOG',
            integrityErrors,
            warnings,
            item: { ...item }
          });
        }
        continue;
      }
      
      // Check UCK/canonical_key mismatch
      if (normKey(mappedCatalog.canonical_key) !== uckKey) {
        integrityErrors.push({
          code: 'MAP_UCK_CATALOG_KEY_MISMATCH',
          message: `Map UCK '${uckRaw}' ≠ Catalog canonical_key '${mappedCatalog.canonical_key}'`,
          severity: 'ERROR'
        });
        integrityErrorCount++;
      }
      
      // Suggest fix if expected catalog exists and differs
      let suggestedFix = null;
      if (expectedCatalog && expectedCatalog.id !== mappedCatalog.id) {
        suggestedFix = {
          oldCatalogId: mappedCatalog.id,
          newCatalogId: expectedCatalog.id,
          oldName: mappedCatalog.crm_name,
          newName: expectedCatalog.crm_name,
          reason: 'canonical_key matches UCK'
        };
      }
      
      // Check cost
      if ((!mappedCatalog.cost || mappedCatalog.cost === 0) && !uckRaw.startsWith('fee_')) {
        integrityErrors.push({
          code: 'ZERO_OR_MISSING_COST',
          message: `Catalog item has zero/missing cost`,
          severity: 'ERROR'
        });
        integrityErrorCount++;
      }
      
      // Check unit
      if (!mappedCatalog.unit) {
        integrityErrors.push({
          code: 'MISSING_UNIT',
          message: 'Catalog item missing unit',
          severity: 'ERROR'
        });
        integrityErrorCount++;
      }
      
      // Material type heuristic mismatch (warn only)
      if (chosenMap.materialType && mappedCatalog.material_type) {
        if (normKey(chosenMap.materialType) !== normKey(mappedCatalog.material_type)) {
          warnings.push({
            code: 'MATERIAL_TYPE_MISMATCH',
            message: `Map materialType '${chosenMap.materialType}' ≠ Catalog '${mappedCatalog.material_type}'`,
            severity: 'WARN'
          });
          warningCount++;
        }
      }
      
      const result = buildResolvedRecord({
        item,
        uckRaw,
        catalog: mappedCatalog,
        map: chosenMap,
        resolutionSource: 'company_map',
        integrityErrors,
        warnings,
        suggestedFix
      });
      
      if (isValidResolved(result)) {
        resolved.push(result);
      } else {
        invalidResolved.push(result);
      }
      
    } else {
      // STEP 2: Try direct catalog lookup (fallback)
      const catalog = catalogByCanonicalKey.get(uckKey);
      
      if (catalog) {
        // Warn if company requires CompanySkuMap
        if (companySettings?.useCompanySkuMap) {
          warnings.push({
            code: 'BYPASSED_COMPANY_MAP',
            message: 'Resolved directly from catalog, bypassing CompanySkuMap',
            severity: 'WARN'
          });
          warningCount++;
        }
        
        const result = buildResolvedRecord({
          item,
          uckRaw,
          catalog,
          map: null,
          resolutionSource: 'catalog_direct',
          integrityErrors: [],
          warnings
        });
        
        if (isValidResolved(result)) {
          resolved.push(result);
        } else {
          invalidResolved.push(result);
        }
      } else {
        // Unresolved
        unresolved.push({
          uck: uckRaw,
          reason: 'NO_MAPPING_OR_CATALOG',
          candidatesTried: ['company_map', 'catalog_direct'],
          item: { ...item }
        });
      }
    }
  }
  
  // Determine pricing status
  let pricingStatus = 'COMPLETE';
  if (unresolved.length > 0) {
    pricingStatus = 'INCOMPLETE';
  } else if (integrityErrorCount > 0 || warningCount > 0 || invalidResolved.length > 0) {
    pricingStatus = 'WARN';
  }
  
  return {
    pricingStatus,
    resolved,
    unresolved,
    invalidResolved,
    counts: {
      unresolved: unresolved.length,
      integrityErrors: integrityErrorCount,
      warnings: warningCount,
      invalidResolved: invalidResolved.length
    },
    meta: {
      resolverVersion: RESOLVER_VERSION,
      companyId,
      itemCount: takeoffItems?.length || 0,
      catalogUniverse
    }
  };
}

/**
 * Build resolved record with all required fields
 */
function buildResolvedRecord({ item, uckRaw, catalog, map, resolutionSource, integrityErrors, warnings, suggestedFix }) {
  const unitUsed = map?.unitOverride || catalog.unit;
  const qtyUsed = (item.qty || item.quantityCalculated || 0) * (map?.conversionFactor || 1);
  const costEach = catalog.cost || 0;
  const extCost = qtyUsed * costEach;
  
  // Check for unit mismatch
  if (item.unit && item.unit !== unitUsed) {
    warnings.push({
      code: 'UNIT_MISMATCH_TAKEOFF_VS_USED',
      message: `Takeoff unit '${item.unit}' ≠ used unit '${unitUsed}'`,
      severity: 'WARN'
    });
  }
  
  return {
    uck: uckRaw,
    catalogId: catalog.id,
    catalogCanonicalKey: catalog.canonical_key,
    catalogName: catalog.crm_name,
    costEach,
    unitUsed,
    qtyUsed,
    extCost,
    resolutionSource,
    integrityErrors: integrityErrors || [],
    warnings: warnings || [],
    suggestedFix,
    // Pass through takeoff fields
    lineItemName: item.lineItemName || item.displayName,
    notes: item.notes,
    runLabel: item.runLabel
  };
}

/**
 * Check if resolved item is valid (can be priced)
 */
function isValidResolved(resolved) {
  if (!resolved.qtyUsed || resolved.qtyUsed <= 0 || isNaN(resolved.qtyUsed)) return false;
  if (!resolved.unitUsed) return false;
  if ((!resolved.costEach || resolved.costEach === 0) && !resolved.uck.startsWith('fee_')) return false;
  return true;
}