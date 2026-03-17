/**
 * ADMIN TOOL: Canonical Vinyl UCK Repair
 * 
 * Repairs all vinyl UCKs in CompanySkuMap to canonical format.
 * Dry-run first, then commit with idempotent behavior.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VINYL_HEIGHTS = ['3ft', '4ft', '5ft', '6ft', '8ft', '10ft', '12ft'];
const VINYL_SYSTEMS = ['savannah', 'lakeshore', 'yorktown', 'new_england'];
const VINYL_COLORS = ['white', 'tan', 'khaki', 'grey', 'coastal_grey', 'cedar_tone', 'black'];

// HEIGHT-INDEPENDENT ALLOWLIST (STRICT)
const HEIGHT_INDEPENDENT_PATTERNS = [
  /^(?:hardware_)?post_cap$/,
  /^cap_[a-z_]+$/,
  /^hardware_.*(?:screw|bolt|bracket|fastener).*$/,
  /^concrete$/,
];

function isHeightIndependent(componentTokens) {
  const componentStr = componentTokens.join('_');
  return HEIGHT_INDEPENDENT_PATTERNS.some(pattern => pattern.test(componentStr));
}

function isVinylGlobalException(uck) {
  return uck === 'vinyl_hardware_nodig_donut' || 
         (uck && uck.startsWith('vinyl_hardware_nodig_donut_'));
}

function canonicalizeVinylUck(uck, options = {}) {
  const defaultSystem = options.system || 'savannah';
  const defaultColor = options.color || 'white';
  const context = options.context || {};

  if (isVinylGlobalException(uck)) {
    return {
      canonicalUck: 'vinyl_hardware_nodig_donut',
      isGlobalException: true,
      fixesApplied: []
    };
  }

  if (!uck || !uck.startsWith('vinyl_')) {
    return { canonicalUck: null, error: 'Not a vinyl UCK' };
  }

  const tokens = uck.split('_').slice(1);
  const fixesApplied = [];

  let heightIndex = tokens.findIndex(t => VINYL_HEIGHTS.includes(t));
  let recoveredHeight = null;
  let heightIndependent = false;
  
  if (heightIndex === -1) {
    // Attempt recovery from context metadata
    if (context.attributes?.height) {
      recoveredHeight = context.attributes.height;
      heightIndex = tokens.length;
      fixesApplied.push(`Recovered height from metadata: ${recoveredHeight}`);
    } else {
      // Check if component matches height-independent allowlist
      if (isHeightIndependent(tokens)) {
        recoveredHeight = '6ft';
        heightIndex = tokens.length;
        heightIndependent = true;
        fixesApplied.push('Applied default height 6ft (height-independent component)');
      }
    }
  }
  
  if (heightIndex === -1 && !recoveredHeight) {
    return { 
      canonicalUck: null, 
      error: 'BLOCKED_MISSING_HEIGHT: No height token found and component not in allowlist',
      blockedReason: 'height_missing',
      uck: uck,
      metadata: context
    };
  }

  const height = recoveredHeight || tokens[heightIndex];
  const componentTokens = tokens.slice(0, heightIndex);

  const tokensAfterHeight = tokens.slice(heightIndex + 1);
  const systemIndex = tokensAfterHeight.findIndex(t => VINYL_SYSTEMS.includes(t));
  const system = systemIndex !== -1 ? tokensAfterHeight[systemIndex] : defaultSystem;

  if (systemIndex === -1) {
    fixesApplied.push(`Inserted default system: ${defaultSystem}`);
  }

  const tokensAfterSystem = systemIndex !== -1 
    ? tokensAfterHeight.slice(systemIndex + 1) 
    : tokensAfterHeight;

  let color = defaultColor;
  let colorTokensConsumed = 0;
  
  for (let i = tokensAfterSystem.length - 1; i >= 0; i--) {
    const possibleColorPhrase = tokensAfterSystem.slice(i).join('_');
    if (VINYL_COLORS.includes(possibleColorPhrase)) {
      color = possibleColorPhrase;
      colorTokensConsumed = tokensAfterSystem.length - i;
      break;
    }
  }

  if (colorTokensConsumed === 0) {
    fixesApplied.push(`Inserted default color: ${defaultColor}`);
  }

  const canonicalUck = `vinyl_${componentTokens.join('_')}_${height}_${system}_${color}`;

  return {
    canonicalUck,
    isGlobalException: false,
    heightIndependent,
    fixesApplied: fixesApplied.length > 0 ? fixesApplied : ['Already canonical']
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { companyId = 'PrivacyFenceCo49319', mode = 'dry_run' } = await req.json();
    const dryRun = mode === 'dry_run';
    
    console.log(`[CanonicalVinylUckRepair] Starting ${mode} for company: ${companyId}`);
    
    const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
      companyId,
      status: 'mapped'
    });
    
    const results = {
      totalScanned: allMappings.length,
      canonicalAlreadyCount: 0,
      canRepairCount: 0,
      defaultHeightAppliedCount: 0,
      missingHeightCount: 0,
      blockedMissingHeight: [],
      collisionCount: 0,
      repaired: 0,
      errors: [],
      sampleTransformations: [],
      sampleDefaultHeightApplied: [],
      sampleCollisions: []
    };
    
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 4000;
    let batchCount = 0;
    let queryCount = 0;

    // First pass: analyze all repairs WITHOUT collision checks (fast dry-run)
    const repairsNeeded = [];
    
    for (let i = 0; i < allMappings.length; i++) {
      const mapping = allMappings[i];
      const uck = mapping.uck;
      
      if (!uck.startsWith('vinyl_')) continue;
      
      const repair = canonicalizeVinylUck(uck, { context: mapping });
      
      if (repair.error) {
        if (repair.blockedReason === 'height_missing') {
          results.missingHeightCount++;
          // Store blocked rows for admin action
          if (results.blockedMissingHeight.length < 50) {
            results.blockedMissingHeight.push({
              mappingId: mapping.id,
              uck,
              displayName: mapping.displayName,
              materialCatalogId: mapping.materialCatalogId,
              attributes: mapping.attributes
            });
          }
        }
        results.errors.push({ uck, error: repair.error, blockedReason: repair.blockedReason });
        continue;
      }
      
      if (repair.canonicalUck === uck) {
        results.canonicalAlreadyCount++;
        continue;
      }
      
      // Track if default height was applied
      if (repair.heightIndependent) {
        results.defaultHeightAppliedCount++;
        if (results.sampleDefaultHeightApplied.length < 20) {
          results.sampleDefaultHeightApplied.push({
            original: uck,
            canonical: repair.canonicalUck,
            componentTokens: tokens.slice(0, tokens.findIndex(t => VINYL_HEIGHTS.includes(t))).join('_'),
            fixesApplied: repair.fixesApplied
          });
        }
      }
      
      results.canRepairCount++;
      
      if (results.sampleTransformations.length < 20) {
        results.sampleTransformations.push({
          original: uck,
          canonical: repair.canonicalUck,
          heightIndependent: repair.heightIndependent || false,
          fixesApplied: repair.fixesApplied
        });
      }
      
      repairsNeeded.push({ mapping, repair });
    }
    
    // Second pass (only if commit): check collisions and perform repairs with batching
    if (!dryRun && repairsNeeded.length > 0) {
      console.log(`[CanonicalVinylUckRepair] Checking collisions for ${repairsNeeded.length} repairs...`);
      
      for (const { mapping, repair } of repairsNeeded) {
        queryCount++;
        if (queryCount % BATCH_SIZE === 0) {
          console.log(`[CanonicalVinylUckRepair] Query batch (${queryCount}), delaying...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
        
        // Check for collision
        const existingCanonical = await base44.asServiceRole.entities.CompanySkuMap.filter({
          companyId,
          uck: repair.canonicalUck
        });
        
        if (existingCanonical.length > 0) {
          results.collisionCount++;
          if (results.sampleCollisions.length < 20) {
            results.sampleCollisions.push({
              original: mapping.uck,
              wouldBecome: repair.canonicalUck,
              existingId: existingCanonical[0].id
            });
          }
          continue;
        }
        
        try {
          // Create canonical mapping
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId: mapping.companyId,
            uck: repair.canonicalUck,
            uckVersion: mapping.uckVersion || 1,
            materialCatalogId: mapping.materialCatalogId,
            materialCatalogName: mapping.materialCatalogName,
            materialType: mapping.materialType,
            fenceSystem: mapping.fenceSystem || 'savannah',
            attributes: {
              ...mapping.attributes,
              height_independent: repair.heightIndependent || false,
              height_default_used: repair.heightIndependent ? '6ft' : undefined,
              meta: {
                source: 'vinyl_canonical_repair_v1',
                fromUck: mapping.uck,
                fixesApplied: repair.fixesApplied,
                heightIndependent: repair.heightIndependent || false,
                migratedAt: new Date().toISOString()
              }
            },
            displayName: mapping.displayName,
            status: 'mapped',
            notes: `Canonical form of ${mapping.uck}`,
            lastSeenAt: new Date().toISOString()
          });
          
          // Mark old row as deprecated
          await base44.asServiceRole.entities.CompanySkuMap.update(mapping.id, {
            status: 'deprecated',
            notes: `Deprecated: Use canonical ${repair.canonicalUck}`
          });
          
          results.repaired++;
          batchCount++;
          
          if (batchCount % BATCH_SIZE === 0) {
            console.log(`[CanonicalVinylUckRepair] Batch complete (${results.repaired}/${results.canRepairCount}), waiting...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
          
        } catch (error) {
          console.error(`[CanonicalVinylUckRepair] Error repairing ${mapping.uck}:`, error.message);
          results.errors.push({ uck: mapping.uck, error: error.message });
        }
      }
    }
    
    // Cleanup: Mark unresolved rows as resolved where canonical now exists
    if (!dryRun && results.repaired > 0) {
      try {
        const unresolved = await base44.asServiceRole.entities.CompanySkuMap.filter({
          companyId,
          status: 'unmapped'
        });
        
        for (const row of unresolved) {
          const repair = canonicalizeVinylUck(row.uck);
          if (repair.canonicalUck) {
            const canonicalExists = await base44.asServiceRole.entities.CompanySkuMap.filter({
              companyId,
              uck: repair.canonicalUck,
              status: 'mapped'
            });
            
            if (canonicalExists.length > 0) {
              await base44.asServiceRole.entities.CompanySkuMap.delete(row.id);
              console.log(`[CanonicalVinylUckRepair] Cleaned up unresolved row: ${row.uck}`);
            }
          }
        }
      } catch (error) {
        console.log(`[CanonicalVinylUckRepair] Cleanup warning:`, error.message);
      }
    }
    
    console.log(`[CanonicalVinylUckRepair] Complete:`, results);
    
    return Response.json({
      success: true,
      mode,
      results,
      message: dryRun 
        ? `Dry-run: ${results.canonicalAlreadyCount} canonical, ${results.canRepairCount} repairable (${results.defaultHeightAppliedCount} with default height), ${results.collisionCount} collisions, ${results.missingHeightCount} blockers`
        : `Commit: Repaired ${results.repaired} UCKs (${results.defaultHeightAppliedCount} height-independent, ${results.collisionCount} collisions skipped, ${results.errors.length} errors)`
    });
    
  } catch (error) {
    console.error('[CanonicalVinylUckRepair] Fatal error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});