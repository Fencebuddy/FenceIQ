/**
 * FENCEBUDDY V2 ENGINE — RESOLVER ENGINE
 * 
 * CONTRACT 3: RESOLVER + MAPPING
 * Resolve takeoff UCKs to catalog materials using CompanySkuMap
 * 
 * CONTRACT 0.4: UNIT AUTHORITY (HARD)
 * No implicit unit conversions. Use UnitConversionMap or BLOCK.
 */

import { ENGINE_VERSIONS } from './versions';
import { logDiagnostic } from './diagnosticsService';
import { base44 } from '@/api/base44Client';

/**
 * Resolve takeoff items to catalog materials
 */
export async function resolveMaterials({
  takeoffItems,
  companyId,
  variantId,
  jobId
}) {
  console.log('[ResolverEngine] Resolving materials...', {
    item_count: takeoffItems?.length,
    companyId
  });
  
  if (!takeoffItems || takeoffItems.length === 0) {
    return {
      status: 'NO_ITEMS',
      resolved_items: [],
      unresolved_items: [],
      resolution_metrics: {
        total: 0,
        resolved: 0,
        unresolved: 0,
        unit_mismatches: 0,
        mapping_rate: 0
      }
    };
  }
  
  const resolvedItems = [];
  const unresolvedItems = [];
  let unitMismatchCount = 0;
  
  // Fetch all company mappings
  const companyMappings = await base44.entities.CompanySkuMap.filter({ companyId });
  const mappingsByUck = {};
  companyMappings.forEach(m => {
    mappingsByUck[m.uck] = m;
  });
  
  // Fetch unit conversions
  const unitConversions = await base44.entities.UnitConversionMap.filter({ active: true });
  const conversionMap = {};
  unitConversions.forEach(c => {
    const key = `${c.from_unit}→${c.to_unit}`;
    conversionMap[key] = c;
  });
  
  // Fetch catalog (for pricing)
  const catalogItems = await base44.entities.MaterialCatalog.filter({ active: true });
  const catalogById = {};
  catalogItems.forEach(c => {
    catalogById[c.id] = c;
  });
  
  // Resolve each takeoff item
  for (const item of takeoffItems) {
    const uck = item.uck || item.canonical_key;
    
    // Check if mapped
    const mapping = mappingsByUck[uck];
    
    if (!mapping || mapping.status !== 'mapped') {
      // Unresolved
      unresolvedItems.push({
        canonical_key: uck,
        lineItemName: item.lineItemName,
        quantityCalculated: item.quantityCalculated,
        uom: item.uom,
        unresolved_reason: 'NOT_MAPPED',
        actionHint: 'Map this UCK in Fence System Config',
        allow_unresolved_but_nonblocking: item.allow_unresolved_but_nonblocking || false
      });
      continue;
    }
    
    // Get catalog item
    const catalogItem = catalogById[mapping.materialCatalogId];
    
    if (!catalogItem) {
      unresolvedItems.push({
        canonical_key: uck,
        lineItemName: item.lineItemName,
        quantityCalculated: item.quantityCalculated,
        uom: item.uom,
        unresolved_reason: 'CATALOG_ITEM_MISSING',
        actionHint: 'Catalog item was deleted - remap UCK',
        allow_unresolved_but_nonblocking: false
      });
      continue;
    }
    
    // CONTRACT 0.4: Unit authority check
    let finalQuantity = item.quantityCalculated;
    let unitConversionApplied = null;
    
    if (item.uom !== catalogItem.unit) {
      // Check for conversion
      const conversionKey = `${item.uom}→${catalogItem.unit}`;
      const conversion = conversionMap[conversionKey];
      
      if (!conversion) {
        // BLOCKING: No conversion exists
        unresolvedItems.push({
          canonical_key: uck,
          lineItemName: item.lineItemName,
          quantityCalculated: item.quantityCalculated,
          uom: item.uom,
          unresolved_reason: 'UNIT_MISMATCH',
          actionHint: `Add unit conversion: ${item.uom} → ${catalogItem.unit}`,
          catalog_unit: catalogItem.unit,
          takeoff_unit: item.uom,
          allow_unresolved_but_nonblocking: false,
          resolution_status: 'UNIT_MISMATCH'
        });
        unitMismatchCount++;
        continue;
      }
      
      // Apply conversion
      finalQuantity = item.quantityCalculated * conversion.multiplier;
      unitConversionApplied = {
        from: item.uom,
        to: catalogItem.unit,
        multiplier: conversion.multiplier
      };
    }
    
    // Resolved successfully
    resolvedItems.push({
      canonical_key: uck,
      lineItemName: catalogItem.crm_name || item.lineItemName,
      quantityCalculated: item.quantityCalculated,
      quantityResolved: finalQuantity,
      uom_takeoff: item.uom,
      uom_catalog: catalogItem.unit,
      unit_conversion: unitConversionApplied,
      catalog_item_id: catalogItem.id,
      unit_cost: catalogItem.cost,
      extended_cost: finalQuantity * catalogItem.cost,
      mapping_id: mapping.id,
      resolution_status: 'RESOLVED'
    });
  }
  
  // Calculate metrics
  const total = takeoffItems.length;
  const resolved = resolvedItems.length;
  const unresolved = unresolvedItems.length;
  const mappingRate = total > 0 ? (resolved / total) * 100 : 0;
  
  const resolution_metrics = {
    total,
    resolved,
    unresolved,
    unit_mismatches: unitMismatchCount,
    mapping_rate: Math.round(mappingRate * 10) / 10
  };
  
  // Log if unresolved items exist
  if (unresolved > 0) {
    await logDiagnostic({
      phase: 'RESOLVER',
      severity: 'WARN',
      code: 'UNRESOLVED_ITEMS',
      message: `${unresolved} of ${total} items unresolved`,
      actionHint: 'Complete material mappings in Fence System Config',
      deepLink: 'FenceSystemConfig',
      jobId,
      variantId,
      companyId,
      context: resolution_metrics
    });
  }
  
  // Generate takeoff hash
  const takeoff_hash = generateTakeoffHash({
    lineItems: takeoffItems,
    variantConfig
  });
  
  console.log('[ResolverEngine] Resolution complete:', resolution_metrics);
  
  return {
    status: 'COMPLETE',
    resolved_items: resolvedItems,
    unresolved_items: unresolvedItems,
    resolution_metrics,
    takeoff_hash,
    resolver_version: ENGINE_VERSIONS.RESOLVER_VERSION,
    computed_at: new Date().toISOString()
  };
}

/**
 * Get or create CompanySkuMap entry
 * 
 * CONTRACT 3.3: "Once mapped, stays mapped"
 */
export async function ensureCompanySkuMap({ companyId, uck, materialCatalogId, materialCatalogName }) {
  // Check if exists
  const existing = await base44.entities.CompanySkuMap.filter({ companyId, uck });
  
  if (existing.length > 0) {
    // Update lastSeenAt
    await base44.entities.CompanySkuMap.update(existing[0].id, {
      lastSeenAt: new Date().toISOString()
    });
    return existing[0];
  }
  
  // Create new mapping
  const mapping = await base44.entities.CompanySkuMap.create({
    companyId,
    uck,
    uckVersion: 1,
    materialCatalogId,
    materialCatalogName,
    status: materialCatalogId ? 'mapped' : 'unmapped',
    lastSeenAt: new Date().toISOString()
  });
  
  return mapping;
}