import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * EXECUTOR: Material Link Guardian Agent
 * Actual agent logic - validates catalog links
 */

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { companyId, triggerType, triggerRef } = payload;
    const globalDryRun = true; // SAFE DEFAULT
    
    console.log(`[MaterialLinkGuardian] Executing for ${companyId} (dryRun: ${globalDryRun})`);
    
    const violations = [];
    const suggestions = [];
    
    // CHECK: Get all active SelectionSets (PriceCatalogLine)
    const selectionSets = await base44.asServiceRole.entities.PriceCatalogLine.filter({ 
      companyId,
      active: true 
    });
    
    console.log(`[MaterialLinkGuardian] Checking ${selectionSets.length} selection sets`);
    
    // Verify each has valid catalog link
    for (const selectionSet of selectionSets) {
      if (!selectionSet.materialCatalogId) {
        violations.push({
          type: 'missing_catalog_link',
          severity: 'CRITICAL',
          selectionSetId: selectionSet.id,
          uck: selectionSet.uck,
          message: `No materialCatalogId set`
        });
        continue;
      }
      
      // Verify catalog item exists
      const catalogItems = await base44.asServiceRole.entities.MaterialCatalog.filter({ 
        id: selectionSet.materialCatalogId 
      });
      
      if (catalogItems.length === 0) {
        violations.push({
          type: 'broken_catalog_link',
          severity: 'CRITICAL',
          selectionSetId: selectionSet.id,
          uck: selectionSet.uck,
          catalogId: selectionSet.materialCatalogId,
          message: `References non-existent catalog item`
        });
        
        suggestions.push({
          type: 'fix_catalog_link',
          selectionSetId: selectionSet.id,
          confidence: 0,
          reasoning: 'Catalog item missing - manual fix required'
        });
      } else {
        const catalogItem = catalogItems[0];
        
        if (!catalogItem.active) {
          violations.push({
            type: 'inactive_catalog_link',
            severity: 'WARN',
            selectionSetId: selectionSet.id,
            uck: selectionSet.uck,
            catalogName: catalogItem.crm_name,
            message: `References inactive catalog item`
          });
        }
        
        if (!catalogItem.cost || catalogItem.cost <= 0) {
          violations.push({
            type: 'invalid_catalog_cost',
            severity: 'CRITICAL',
            selectionSetId: selectionSet.id,
            uck: selectionSet.uck,
            catalogName: catalogItem.crm_name,
            cost: catalogItem.cost,
            message: `Catalog item has invalid cost`
          });
        }
        
        if (!catalogItem.unit) {
          violations.push({
            type: 'missing_catalog_unit',
            severity: 'CRITICAL',
            selectionSetId: selectionSet.id,
            uck: selectionSet.uck,
            catalogName: catalogItem.crm_name,
            message: `Catalog item missing unit`
          });
        }
      }
    }
    
    // Create alerts (respecting dry-run mode)
    for (const violation of violations) {
      if (globalDryRun) {
        console.log(`[DRY RUN] Would create alert:`, violation);
      } else {
        await base44.asServiceRole.entities.AlertRecord.create({
          companyId,
          alertType: 'broken_catalog_link',
          severity: violation.severity,
          entityType: 'PriceCatalogLine',
          entityId: violation.selectionSetId,
          title: `Material Link Issue: ${violation.type}`,
          message: violation.message,
          detailsJson: violation,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    // Create suggestions
    for (const suggestion of suggestions) {
      if (globalDryRun) {
        console.log(`[DRY RUN] Would create suggestion:`, suggestion);
      } else {
        await base44.asServiceRole.entities.SuggestionRecord.create({
          companyId,
          suggestionType: 'fix_catalog_link',
          entityType: 'PriceCatalogLine',
          entityId: suggestion.selectionSetId,
          suggestedPatchJson: {},
          confidence: suggestion.confidence,
          status: 'OPEN',
          reasoning: suggestion.reasoning,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    // Log agent run
    await base44.asServiceRole.entities.AgentRunLog.create({
      companyId,
      agentName: 'materialLinkGuardian',
      triggerType,
      triggerEntityType: triggerRef?.split(':')[0],
      triggerEntityId: triggerRef?.split(':')[1],
      status: violations.filter(v => v.severity === 'CRITICAL').length > 0 ? 'error' : 'success',
      dryRun: globalDryRun,
      durationMs: Date.now() - startTime,
      findings: {
        selectionSetsChecked: selectionSets.length,
        violations,
        suggestions,
        criticalCount: violations.filter(v => v.severity === 'CRITICAL').length,
        warningCount: violations.filter(v => v.severity === 'WARN').length
      },
      ranAt: new Date().toISOString()
    });
    
    const status = violations.filter(v => v.severity === 'CRITICAL').length > 0 ? 'ERROR' : 
                   violations.length > 0 ? 'WARN' : 'OK';
    
    return Response.json({
      success: true,
      status,
      summary: `Checked ${selectionSets.length} sets, found ${violations.length} violations`,
      details: {
        selectionSetsChecked: selectionSets.length,
        violations,
        suggestions,
        criticalCount: violations.filter(v => v.severity === 'CRITICAL').length,
        warningCount: violations.filter(v => v.severity === 'WARN').length
      },
      dryRun: globalDryRun,
      durationMs: Date.now() - startTime
    });
    
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});