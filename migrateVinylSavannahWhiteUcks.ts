/**
 * TASK C: Migrate vinyl UCKs to include _savannah_white suffix
 * 
 * For companyId PrivacyFenceCo49319:
 * - Find all mapped vinyl UCKs missing _savannah_white suffix
 * - Exclude donut keys (vinyl_hardware_nodig_donut*)
 * - Create new CompanySkuMap rows with _savannah_white appended
 * - Keep old rows, mark as deprecated
 * - Collision-safe: do not overwrite existing mappings
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }
    
    const { companyId = 'PrivacyFenceCo49319', dryRun = true } = await req.json();
    
    console.log(`[migrateVinylSavannahWhiteUcks] Starting migration for company: ${companyId}, dryRun: ${dryRun}`);
    
    // Fetch all mapped CompanySkuMap rows for this company
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
      companyId,
      status: 'mapped'
    });
    
    console.log(`[migrateVinylSavannahWhiteUcks] Found ${allMappings.length} mapped rows`);
    
    // Known vinyl systems and colors
    const vinylSystems = ['savannah', 'lakeshore', 'yorktown'];
    const vinylColors = ['white', 'tan', 'khaki', 'grey', 'coastal_grey', 'cedar_tone', 'black'];
    
    /**
     * Detect if UCK already has system_color suffix
     */
    function hasSystemColorSuffix(uck) {
      const tokens = uck.split('_');
      if (tokens.length < 2) return false;
      
      const lastTwo = tokens.slice(-2);
      const lastToken = tokens[tokens.length - 1];
      const secondLastToken = tokens[tokens.length - 2];
      
      // Check if last two tokens are system_color
      if (vinylSystems.includes(secondLastToken) && vinylColors.includes(lastToken)) {
        return true;
      }
      
      return false;
    }
    
    // Filter vinyl UCKs that need migration
    const needsMigration = allMappings.filter(mapping => {
      const uck = mapping.uck;
      
      // Must start with vinyl_
      if (!uck.startsWith('vinyl_')) return false;
      
      // Exclude donut keys
      if (uck.includes('_nodig_donut')) return false;
      
      // Must not already have _savannah_white suffix
      if (uck.endsWith('_savannah_white')) return false;
      
      // CRITICAL: Skip if already has system_color suffix
      if (hasSystemColorSuffix(uck)) {
        console.log(`[migrateVinylSavannahWhiteUcks] Skipping (already has system_color): ${uck}`);
        return false;
      }
      
      return true;
    });
    
    console.log(`[migrateVinylSavannahWhiteUcks] Found ${needsMigration.length} vinyl UCKs needing migration`);
    
    const results = {
      totalChecked: allMappings.length,
      needsMigration: needsMigration.length,
      created: 0,
      skippedCollision: 0,
      deprecated: 0,
      errors: []
    };
    
    // Process in batches with delays to avoid rate limits
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 2000;
    
    for (let i = 0; i < needsMigration.length; i++) {
      const oldMapping = needsMigration[i];
      
      try {
        const oldUck = oldMapping.uck;
        const newUck = `${oldUck}_savannah_white`;
        
        console.log(`[migrateVinylSavannahWhiteUcks] [${i + 1}/${needsMigration.length}] Migrating: ${oldUck} → ${newUck}`);
        
        // Check if new UCK already exists
        const existingNew = await base44.asServiceRole.entities.CompanySkuMap.filter({
          companyId,
          uck: newUck
        });
        
        if (existingNew.length > 0) {
          console.log(`[migrateVinylSavannahWhiteUcks] ⚠️  Collision detected: ${newUck} already exists, skipping`);
          results.skippedCollision++;
          continue;
        }
        
        if (!dryRun) {
          // Create new mapping with _savannah_white suffix
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId: oldMapping.companyId,
            uck: newUck,
            uckVersion: oldMapping.uckVersion || 1,
            materialCatalogId: oldMapping.materialCatalogId,
            materialCatalogName: oldMapping.materialCatalogName,
            materialType: oldMapping.materialType,
            fenceSystem: 'savannah',
            attributes: {
              ...oldMapping.attributes,
              finish: 'white'
            },
            displayName: oldMapping.displayName,
            status: 'mapped',
            notes: `Migrated from ${oldUck} on ${new Date().toISOString()}`,
            lastSeenAt: new Date().toISOString()
          });
          
          results.created++;
          
          // Mark old mapping as deprecated (keep for audit trail)
          await base44.asServiceRole.entities.CompanySkuMap.update(oldMapping.id, {
            status: 'deprecated',
            notes: `Deprecated: Migrated to ${newUck} on ${new Date().toISOString()}`
          });
          
          results.deprecated++;
          
          // Rate limit protection: delay every BATCH_SIZE operations
          if ((i + 1) % BATCH_SIZE === 0) {
            console.log(`[migrateVinylSavannahWhiteUcks] Batch complete, waiting ${BATCH_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        } else {
          results.created++; // Dry run count
        }
        
      } catch (error) {
        console.error(`[migrateVinylSavannahWhiteUcks] Error migrating ${oldMapping.uck}:`, error);
        results.errors.push({
          uck: oldMapping.uck,
          error: error.message
        });
      }
    }
    
    console.log(`[migrateVinylSavannahWhiteUcks] Migration complete:`, results);
    
    return Response.json({
      success: true,
      dryRun,
      results,
      message: dryRun 
        ? `Dry run complete: Would create ${results.created} new mappings, deprecate ${results.deprecated} old mappings`
        : `Migration complete: Created ${results.created} new mappings, deprecated ${results.deprecated} old mappings`
    });
    
  } catch (error) {
    console.error('[migrateVinylSavannahWhiteUcks] Fatal error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});