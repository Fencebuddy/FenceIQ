/**
 * Bulk fix all CompanySkuMap integrity errors
 * 
 * Remaps broken mappings to correct MaterialCatalog items based on UCK match.
 * Creates audit log for each fix.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .toLowerCase()
    .trim()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { companyId, limit = 100, forceAll = false } = await req.json();
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }
    
    console.log(`[CONFIG] Batch limit: ${limit}`);

    // Load all mappings and catalog
    const mappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });

    const catalogById = new Map(catalog.map(c => [c.id, c]));
    const catalogByCanonicalKey = new Map(
      catalog.map(c => [normKey(c.canonical_key), c])
    );

    const fixes = [];
    const errors = [];
    const fixBatch = [];
    const diagnostics = {
      totalMappings: mappings.length,
      autoFixable: 0,
      noMatchingCatalog: 0,
      alreadyOk: 0,
      unfixableExamples: []
    };

    // STEP 1: Identify all fixes needed
    for (const map of mappings) {
      const mappedCatalog = catalogById.get(map.materialCatalogId);
      const expectedCatalog = catalogByCanonicalKey.get(normKey(map.uck));

      let needsFix = false;
      let reason = '';

      if (!mappedCatalog) {
        needsFix = true;
        reason = 'MAP_POINTS_TO_MISSING_CATALOG';
      } else if (normKey(mappedCatalog.canonical_key) !== normKey(map.uck)) {
        needsFix = true;
        reason = 'MAP_UCK_CATALOG_KEY_MISMATCH';
      }

      if (needsFix && expectedCatalog) {
        fixBatch.push({
          map,
          mappedCatalog,
          expectedCatalog,
          reason
        });
        diagnostics.autoFixable++;
      } else if (needsFix && !expectedCatalog) {
        errors.push({
          uck: map.uck,
          error: 'No catalog item found with matching canonical_key',
          currentCatalogId: map.materialCatalogId,
          currentCatalogName: mappedCatalog?.crm_name || '(missing)'
        });
        diagnostics.noMatchingCatalog++;
        if (diagnostics.unfixableExamples.length < 10) {
          diagnostics.unfixableExamples.push({
            uck: map.uck,
            currentName: mappedCatalog?.crm_name || '(missing)',
            reason: 'NO_CATALOG_MATCH'
          });
        }
      } else {
        diagnostics.alreadyOk++;
      }
    }

    console.log(`[BULK FIX] Analysis:`);
    console.log(`  Total mappings: ${diagnostics.totalMappings}`);
    console.log(`  Auto-fixable (has matching catalog): ${diagnostics.autoFixable}`);
    console.log(`  Unfixable (no matching catalog): ${diagnostics.noMatchingCatalog}`);
    console.log(`  Already OK: ${diagnostics.alreadyOk}`);
    console.log(`  Will process: ${Math.min(fixBatch.length, limit)} this run`);
    console.log(`[UNFIXABLE EXAMPLES]:`, JSON.stringify(diagnostics.unfixableExamples, null, 2));

    // STEP 2: Apply fixes in micro-batches (fast + safe from timeout)
    const MICRO_BATCH_SIZE = forceAll ? 20 : 5;
    const BATCH_DELAY_MS = forceAll ? 100 : 500; // Reduced delay when forcing
    const limitedBatch = forceAll ? fixBatch : fixBatch.slice(0, limit);

    for (let i = 0; i < limitedBatch.length; i += MICRO_BATCH_SIZE) {
      const microBatch = limitedBatch.slice(i, i + MICRO_BATCH_SIZE);
      
      console.log(`[BATCH ${Math.floor(i / MICRO_BATCH_SIZE) + 1}] Processing items ${i + 1}-${i + microBatch.length}/${limitedBatch.length}`);

      await Promise.all(
        microBatch.map(async ({ map, mappedCatalog, expectedCatalog, reason }) => {
          try {
            // Update mapping
            await base44.asServiceRole.entities.CompanySkuMap.update(map.id, {
              materialCatalogId: expectedCatalog.id
            });

            // Create audit log (separate call)
            await base44.asServiceRole.entities.MappingAuditLog.create({
              companyId,
              uck: map.uck,
              oldCatalogId: map.materialCatalogId,
              newCatalogId: expectedCatalog.id,
              fixType: 'CATALOG_ID_FIX',
              reason: `Auto-fix: ${reason}`,
              userId: user.id
            });

            fixes.push({
              uck: map.uck,
              oldId: map.materialCatalogId,
              oldName: mappedCatalog?.crm_name || '(missing)',
              newId: expectedCatalog.id,
              newName: expectedCatalog.crm_name,
              reason
            });
          } catch (err) {
            errors.push({
              uck: map.uck,
              error: err.message
            });
            console.error(`[ERROR] ${map.uck}:`, err.message);
          }
        })
      );

      // Delay between micro-batches
      if (i + MICRO_BATCH_SIZE < limitedBatch.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    console.log(`[COMPLETE] Fixed ${fixes.length}, Failed ${errors.length}`);

    return Response.json({
      status: 'success',
      companyId,
      diagnostics: {
        totalMappings: diagnostics.totalMappings,
        autoFixable: diagnostics.autoFixable,
        noMatchingCatalog: diagnostics.noMatchingCatalog,
        alreadyOk: diagnostics.alreadyOk,
        unfixableExamples: diagnostics.unfixableExamples
      },
      totalErrors: fixBatch.length,
      processed: limitedBatch.length,
      remaining: Math.max(0, fixBatch.length - limit),
      fixed: fixes.length,
      failed: errors.length,
      fixes: fixes.slice(0, 10),
      errors: errors.slice(0, 10)
    });

  } catch (error) {
    console.error('[fixAllMappingIntegrityErrors] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});