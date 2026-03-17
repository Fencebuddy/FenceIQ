/**
 * TASK 4: DONUT CONSOLIDATION
 * Ensures one global donut mapping exists:
 * uck='vinyl_hardware_nodig_donut', status='mapped'
 * 
 * Deprecates all variant donut keys (vinyl_donut_*, etc) with redirects
 * 
 * Usage:
 * POST /api/functions/consolidateDonutMapping
 * {
 *   "companyId": "PrivacyFenceCo49319",
 *   "dry_run": true
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { companyId, dry_run = true } = await req.json();
    
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }
    
    console.log(`[ConsolidateDonut] Starting consolidation for companyId=${companyId}, dry_run=${dry_run}`);
    
    const CANONICAL_DONUT_UCK = 'vinyl_hardware_nodig_donut';
    
    // Find all donut-related rows
    const allRows = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    const donutRows = allRows.filter(r => 
      r.uck?.includes('donut') || 
      r.uck?.includes('no_dig') || 
      r.uck?.includes('nodig')
    );
    
    console.log(`[ConsolidateDonut] Found ${donutRows.length} donut-related rows`);
    
    // Check if canonical exists
    const canonicalRow = donutRows.find(r => r.uck === CANONICAL_DONUT_UCK && r.status === 'mapped');
    
    const variantRows = donutRows.filter(r => 
      r.uck !== CANONICAL_DONUT_UCK && 
      r.status !== 'deprecated'
    );
    
    console.log(`[ConsolidateDonut] Canonical exists: ${!!canonicalRow}`);
    console.log(`[ConsolidateDonut] Variant rows to consolidate: ${variantRows.length}`);
    
    let createdCanonical = false;
    let deprecatedCount = 0;
    let canonicalMaterialCatalogId = canonicalRow?.materialCatalogId;
    
    if (!dry_run) {
      // If canonical doesn't exist, create it using first variant's catalog ID
      if (!canonicalRow && variantRows.length > 0) {
        const sourceRow = variantRows.find(r => r.materialCatalogId) || variantRows[0];
        canonicalMaterialCatalogId = sourceRow.materialCatalogId;
        
        if (canonicalMaterialCatalogId) {
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId,
            uck: CANONICAL_DONUT_UCK,
            materialCatalogId: canonicalMaterialCatalogId,
            materialCatalogName: sourceRow.materialCatalogName,
            materialType: 'vinyl',
            displayName: 'No-Dig Donuts (Global)',
            status: 'mapped',
            attributes: {
              meta: {
                migration: 'donut_consolidation_v1',
                createdFrom: sourceRow.uck,
                consolidatedAt: new Date().toISOString()
              }
            },
            notes: 'Global donut mapping created from consolidation'
          });
          createdCanonical = true;
        }
      }
      
      // Deprecate all variants with redirect
      for (const variant of variantRows) {
        await base44.asServiceRole.entities.CompanySkuMap.update(variant.id, {
          status: 'deprecated',
          attributes: {
            redirectTo: CANONICAL_DONUT_UCK,
            meta: {
              migration: 'donut_consolidation_v1',
              reason: 'Consolidated to global donut key',
              deprecatedAt: new Date().toISOString()
            }
          },
          notes: `Deprecated: Redirects to global ${CANONICAL_DONUT_UCK}. Consolidated at ${new Date().toISOString()}`
        });
        deprecatedCount++;
      }
    }
    
    return Response.json({
      success: true,
      dry_run,
      companyId,
      canonical_uck: CANONICAL_DONUT_UCK,
      summary: {
        canonical_exists: !!canonicalRow || createdCanonical,
        canonical_created: createdCanonical,
        variants_found: variantRows.length,
        variants_deprecated: deprecatedCount
      },
      canonical_material_catalog_id: canonicalMaterialCatalogId,
      variants: variantRows.map(r => ({
        uck: r.uck,
        status: r.status,
        materialCatalogId: r.materialCatalogId
      })),
      message: dry_run 
        ? `Dry-run complete. Canonical exists: ${!!canonicalRow}. Found ${variantRows.length} variants. Set dry_run=false to execute.`
        : `✅ Consolidation complete: ${createdCanonical ? 'Created' : 'Using existing'} canonical donut. Deprecated ${deprecatedCount} variants.`
    });
    
  } catch (error) {
    console.error('[ConsolidateDonut] Error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});