/**
 * VINYL UCK MIGRATION TOOL (Option A)
 * 
 * Migrates CompanySkuMap vinyl UCKs to include system+color suffix.
 * Excludes donuts (handled separately by donut consolidation).
 * 
 * NEW UCK FORMAT: vinyl_{component}_{height}_{system}_{color}
 * 
 * SAFE: Creates new rows, marks old as deprecated (no deletion).
 * IDEMPOTENT: Running twice won't create duplicates.
 * COLLISION-AWARE: Won't overwrite existing mappings.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { companyId, mode = 'dry_run', defaultSystem = 'savannah', defaultColor = 'white' } = await req.json();
    
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }
    
    console.log('[MigrateVinylUcks] Starting migration:', { companyId, mode, defaultSystem, defaultColor });
    
    // Fetch all vinyl CompanySkuMap rows
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
      companyId,
      status: 'mapped'
    });
    
    const vinylMappings = allMappings.filter(m => 
      m.uck?.startsWith('vinyl_') && 
      !m.uck?.startsWith('vinyl_hardware_nodig_donut') // Exclude donuts
    );
    
    console.log('[MigrateVinylUcks] Found vinyl mappings:', vinylMappings.length);
    
    const report = {
      scannedCount: vinylMappings.length,
      alreadyNewCount: 0,
      migratedCount: 0,
      collisionCount: 0,
      migrations: [],
      collisions: [],
      errors: []
    };
    
    for (const mapping of vinylMappings) {
      const oldUck = mapping.uck;
      
      // Check if already in new format (contains both system and color tokens)
      const tokens = oldUck.split('_');
      const hasSystem = tokens.includes(defaultSystem) || tokens.includes('lakeshore') || tokens.includes('yorktown');
      const hasColor = tokens.some(t => ['white', 'tan', 'khaki', 'grey', 'black'].includes(t));
      
      if (hasSystem && hasColor) {
        report.alreadyNewCount++;
        continue;
      }
      
      // Generate new UCK with system+color suffix
      const newUck = `${oldUck}_${defaultSystem}_${defaultColor}`;
      
      // Check for collision
      const existing = allMappings.find(m => m.uck === newUck);
      if (existing) {
        report.collisionCount++;
        if (report.collisions.length < 20) {
          report.collisions.push({
            oldUck,
            newUck,
            existingMaterialCatalogId: existing.materialCatalogId,
            attemptedMaterialCatalogId: mapping.materialCatalogId,
            collision: existing.materialCatalogId !== mapping.materialCatalogId ? 'DIFFERENT_CATALOG_ID' : 'DUPLICATE'
          });
        }
        continue;
      }
      
      // Record migration
      if (report.migrations.length < 20) {
        report.migrations.push({
          oldUck,
          newUck,
          materialCatalogId: mapping.materialCatalogId,
          catalogName: mapping.materialCatalogName
        });
      }
      
      // COMMIT MODE: Create new mapping
      if (mode === 'commit') {
        try {
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId,
            uck: newUck,
            materialCatalogId: mapping.materialCatalogId,
            materialCatalogName: mapping.materialCatalogName,
            materialType: mapping.materialType,
            fenceSystem: defaultSystem,
            status: 'mapped',
            attributes: {
              ...(mapping.attributes || {}),
              migrationMeta: {
                source: 'uck_migration_v1',
                fromUck: oldUck,
                defaultSystem,
                defaultColor,
                migratedAt: new Date().toISOString()
              }
            }
          });
          
          // Mark old row as deprecated (don't delete for rollback)
          await base44.asServiceRole.entities.CompanySkuMap.update(mapping.id, {
            notes: `[DEPRECATED] Migrated to ${newUck}`,
            attributes: {
              ...(mapping.attributes || {}),
              deprecated: true,
              deprecatedAt: new Date().toISOString()
            }
          });
          
          report.migratedCount++;
        } catch (err) {
          console.error('[MigrateVinylUcks] Error migrating:', oldUck, err);
          report.errors.push({
            oldUck,
            newUck,
            error: err.message
          });
        }
      } else {
        // Dry run - just count
        report.migratedCount++;
      }
    }
    
    // Cleanup stale unresolved rows (only in commit mode)
    let cleanupCount = 0;
    if (mode === 'commit') {
      // Get all new UCKs after migration
      const newMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
        companyId,
        status: 'mapped'
      });
      
      const mappedUcks = new Set(newMappings.map(m => m.uck));
      
      // Find and clean up stale unmapped rows
      const unmappedRows = await base44.asServiceRole.entities.CompanySkuMap.filter({
        companyId,
        status: 'unmapped'
      });
      
      for (const unmapped of unmappedRows) {
        if (mappedUcks.has(unmapped.uck)) {
          // Stale - now has mapping
          await base44.asServiceRole.entities.CompanySkuMap.delete(unmapped.id);
          cleanupCount++;
        }
      }
    }
    
    console.log('[MigrateVinylUcks] Migration complete:', report);
    
    return Response.json({
      success: true,
      mode,
      companyId,
      defaultSystem,
      defaultColor,
      report,
      cleanupCount,
      summary: `Scanned ${report.scannedCount} vinyl mappings. Already new: ${report.alreadyNewCount}. ${mode === 'commit' ? 'Migrated' : 'Would migrate'}: ${report.migratedCount}. Collisions: ${report.collisionCount}. Cleaned up: ${cleanupCount} stale unresolved rows.`
    });
    
  } catch (error) {
    console.error('[MigrateVinylUcks] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});