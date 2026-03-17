/**
 * MATERIAL LINK GUARDIAN AGENT
 * MISSION: Keep MaterialCatalog ↔ SelectionSets ↔ UCK line items permanently linked
 * 
 * HARD INVARIANTS:
 * 1) Every active SelectionSet line references a valid MaterialCatalog row
 * 2) No SelectionSet line references inactive/deleted MaterialCatalog items
 * 3) MaterialCatalog items used by active sets must have cost > 0 and unit present
 */

import { base44 } from '@/api/base44Client';
import { createAlert, createSuggestion } from './AgentRunner';

export async function materialLinkGuardianAgent({
  companyId,
  triggerType,
  triggerRef,
  globalDryRun
}) {
  const violations = [];
  const suggestions = [];
  
  console.log(`[MaterialLinkGuardian] Starting check for company ${companyId}`);
  
  // CHECK 1: Get all active SelectionSets
  const selectionSets = await base44.entities.PriceCatalogLine.filter({ 
    companyId,
    active: true 
  });
  
  console.log(`[MaterialLinkGuardian] Found ${selectionSets.length} active selection sets`);
  
  // CHECK 2: Verify each selection set has valid catalog links
  for (const selectionSet of selectionSets) {
    if (!selectionSet.materialCatalogId) {
      violations.push({
        type: 'missing_catalog_link',
        severity: 'CRITICAL',
        selectionSetId: selectionSet.id,
        message: `SelectionSet ${selectionSet.uck || selectionSet.id} has no materialCatalogId`
      });
      continue;
    }
    
    // Verify the catalog item exists and is active
    const catalogItems = await base44.entities.MaterialCatalog.filter({ 
      id: selectionSet.materialCatalogId 
    });
    
    if (catalogItems.length === 0) {
      violations.push({
        type: 'broken_catalog_link',
        severity: 'CRITICAL',
        selectionSetId: selectionSet.id,
        catalogId: selectionSet.materialCatalogId,
        message: `SelectionSet ${selectionSet.uck || selectionSet.id} references non-existent catalog item ${selectionSet.materialCatalogId}`
      });
      
      // Create suggestion to fix
      suggestions.push({
        type: 'fix_catalog_link',
        selectionSetId: selectionSet.id,
        confidence: 0,
        reasoning: 'Catalog item no longer exists - manual intervention required'
      });
      
    } else {
      const catalogItem = catalogItems[0];
      
      // CHECK 3: Verify catalog item is active
      if (catalogItem.active === false) {
        violations.push({
          type: 'inactive_catalog_link',
          severity: 'WARN',
          selectionSetId: selectionSet.id,
          catalogId: catalogItem.id,
          message: `SelectionSet ${selectionSet.uck || selectionSet.id} references inactive catalog item ${catalogItem.crm_name}`
        });
      }
      
      // CHECK 4: Verify catalog item has valid cost and unit
      if (!catalogItem.cost || catalogItem.cost <= 0) {
        violations.push({
          type: 'invalid_catalog_cost',
          severity: 'CRITICAL',
          selectionSetId: selectionSet.id,
          catalogId: catalogItem.id,
          message: `Catalog item ${catalogItem.crm_name} has invalid cost (${catalogItem.cost})`
        });
      }
      
      if (!catalogItem.unit) {
        violations.push({
          type: 'missing_catalog_unit',
          severity: 'CRITICAL',
          selectionSetId: selectionSet.id,
          catalogId: catalogItem.id,
          message: `Catalog item ${catalogItem.crm_name} has no unit defined`
        });
      }
    }
  }
  
  // CREATE ALERTS FOR VIOLATIONS
  for (const violation of violations) {
    await createAlert({
      companyId,
      alertType: 'broken_catalog_link',
      severity: violation.severity,
      entityType: 'PriceCatalogLine',
      entityId: violation.selectionSetId,
      title: `Material Link Issue: ${violation.type}`,
      message: violation.message,
      detailsJson: violation
    });
  }
  
  // CREATE SUGGESTIONS
  for (const suggestion of suggestions) {
    await createSuggestion({
      companyId,
      suggestionType: 'fix_catalog_link',
      entityType: 'PriceCatalogLine',
      entityId: suggestion.selectionSetId,
      suggestedPatchJson: {},
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning
    });
  }
  
  return {
    status: violations.filter(v => v.severity === 'CRITICAL').length > 0 ? 'ERROR' : 
            violations.length > 0 ? 'WARN' : 'OK',
    summary: `Found ${violations.length} link violations, created ${suggestions.length} suggestions`,
    details: {
      selectionSetsChecked: selectionSets.length,
      violations,
      suggestions,
      criticalCount: violations.filter(v => v.severity === 'CRITICAL').length,
      warningCount: violations.filter(v => v.severity === 'WARN').length
    }
  };
}