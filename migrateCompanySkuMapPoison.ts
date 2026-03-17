/**
 * TASK 3: MIGRATE CompanySkuMap UCKS (ALL STATUSES)
 * Canonicalizes poison vinyl UCKs in CompanySkuMap (all status: mapped/unmapped/deprecated)
 * Also fixes missing-height 5x5 posts
 * 
 * POISON FORMAT: ..._{height}_{color}_{system}_{color}
 * CANONICAL FORMAT: ..._{height}_{system}_{color}
 * 
 * MISSING HEIGHT FIX:
 * vinyl_post_end_5x5_white_savannah_white -> vinyl_post_end_5x5_6ft_savannah_white
 * 
 * Usage:
 * POST /api/functions/migrateCompanySkuMapPoison
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
    
    console.log(`[MigrateCompanySkuMapPoison] Starting migration for companyId=${companyId}, dry_run=${dry_run}`);
    
    // Fetch all vinyl rows (any status)
    const allRows = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    const vinylRows = allRows.filter(m => m.uck?.startsWith('vinyl_'));
    
    console.log(`[MigrateCompanySkuMapPoison] Found ${vinylRows.length} vinyl rows`);
    
    const migrations = [];
    const skipped = [];
    
    for (const row of vinylRows) {
      const uck = row.uck;
      
      // Skip hardware items (global keys)
      if (uck.includes('_hardware_')) {
        skipped.push({ uck, reason: 'Global hardware key' });
        continue;
      }
      
      const tokens = uck.split('_');
      const colorCandidates = ['white', 'tan', 'khaki', 'grey', 'black'];
      const systemTokens = ['savannah', 'lakeshore', 'yorktown'];
      
      let canonicalUck = uck;
      let fixApplied = [];
      
      // Fix 1: Remove duplicate color token (poison)
      const foundColors = tokens.filter(t => colorCandidates.includes(t));
      if (foundColors.length > 1) {
        const systemIdx = tokens.findIndex(t => systemTokens.includes(t));
        
        if (systemIdx > 0) {
          const colorBeforeSystem = tokens.slice(0, systemIdx).findIndex((t) => colorCandidates.includes(t));
          
          if (colorBeforeSystem >= 0) {
            const newTokens = [
              ...tokens.slice(0, colorBeforeSystem),
              ...tokens.slice(colorBeforeSystem + 1)
            ];
            canonicalUck = newTokens.join('_');
            fixApplied.push('REMOVED_DUPLICATE_COLOR');
          }
        }
      }
      
      // Fix 2: Add missing height for 5x5 posts
      if (canonicalUck.includes('_post_') && canonicalUck.includes('_5x5_')) {
        const updatedTokens = canonicalUck.split('_');
        const postIdx = updatedTokens.indexOf('post');
        const fiveByFiveIdx = updatedTokens.indexOf('5x5');
        
        if (postIdx >= 0 && fiveByFiveIdx === postIdx + 2) {
          // Check if height is missing (no {digit}ft after 5x5)
          const nextToken = updatedTokens[fiveByFiveIdx + 1];
          if (nextToken && !nextToken.match(/^\d+ft$/)) {
            // Insert 6ft default
            updatedTokens.splice(fiveByFiveIdx + 1, 0, '6ft');
            canonicalUck = updatedTokens.join('_');
            fixApplied.push('ADDED_MISSING_6FT_HEIGHT');
          }
        }
      }
      
      if (canonicalUck === uck) {
        skipped.push({ uck, reason: 'Already canonical' });
        continue;
      }
      
      migrations.push({
        id: row.id,
        fromUck: uck,
        toUck: canonicalUck,
        fixApplied,
        currentStatus: row.status,
        materialCatalogId: row.materialCatalogId,
        action: 'UPDATE_UCK'
      });
    }
    
    console.log(`[MigrateCompanySkuMapPoison] Detected ${migrations.length} poison UCKs`);
    
    // Execute migrations
    let updatedCount = 0;
    let createdCount = 0;
    let deprecatedCount = 0;
    const collisions = [];
    
    if (!dry_run) {
      for (const migration of migrations) {
        // Check for collision
        const existingCanonical = await base44.asServiceRole.entities.CompanySkuMap.filter({
          companyId,
          uck: migration.toUck
        });
        
        const canonicalExists = existingCanonical.some(r => r.id !== migration.id && r.status === 'mapped');
        
        if (canonicalExists) {
          // Collision - deprecate poison row with redirect
          collisions.push({
            fromUck: migration.fromUck,
            toUck: migration.toUck,
            action: 'DEPRECATED_WITH_REDIRECT'
          });
          
          await base44.asServiceRole.entities.CompanySkuMap.update(migration.id, {
            status: 'deprecated',
            attributes: {
              redirectTo: migration.toUck,
              meta: {
                migration: 'companyskumap_poison_repair_v1',
                fromUck: migration.fromUck,
                reason: 'Collision with canonical UCK',
                migratedAt: new Date().toISOString()
              }
            },
            notes: `Deprecated: Redirects to canonical ${migration.toUck}. Migrated at ${new Date().toISOString()}`
          });
          deprecatedCount++;
        } else {
          // No collision - update UCK in place
          await base44.asServiceRole.entities.CompanySkuMap.update(migration.id, {
            uck: migration.toUck,
            attributes: {
              meta: {
                migration: 'companyskumap_poison_repair_v1',
                fromUck: migration.fromUck,
                fixApplied: migration.fixApplied,
                migratedAt: new Date().toISOString()
              }
            },
            notes: `Migrated from ${migration.fromUck} on ${new Date().toISOString()}`
          });
          updatedCount++;
        }
      }
    }
    
    return Response.json({
      success: true,
      dry_run,
      companyId,
      summary: {
        total_vinyl_rows: vinylRows.length,
        poison_detected: migrations.length,
        skipped: skipped.length,
        updated: updatedCount,
        deprecated_collisions: deprecatedCount,
        total_collisions: collisions.length
      },
      migrations: migrations.slice(0, 20),
      collisions,
      skipped: skipped.slice(0, 10),
      message: dry_run 
        ? `Dry-run complete. Found ${migrations.length} poison UCKs. Set dry_run=false to execute.`
        : `✅ Migration complete: ${updatedCount} updated, ${deprecatedCount} deprecated.`
    });
    
  } catch (error) {
    console.error('[MigrateCompanySkuMapPoison] Error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});