/**
 * VARIANT PIPELINE ADAPTER
 * Wires variant-specific materialSets through phase2 takeoff generation.
 * Ensures Variant B coating is NEVER mutated after buildVariantMaterialSet.
 */

import { buildAllVariantMaterialSets, generateDefaultGBBVariants } from '@/components/fence/compareVariantsService';
import { getCandidateSets } from './candidateSets';
import { buildChainLinkTakeoff } from './takeoffBuilders/chainLinkBuilder';
import { buildVinylTakeoff } from './takeoffBuilders/vinylBuilder';
import { buildWoodTakeoff } from './takeoffBuilders/woodBuilder';
import { buildAluminumTakeoff } from './takeoffBuilders/aluminumBuilder';

/**
 * Build variant-specific takeoff using immutable materialSet pipeline.
 * 
 * @param {Object} takeoff_input - Base takeoff from map
 * @param {Object} job - Job details
 * @param {Object} run - Run details
 * @param {string} variantKey - 'a', 'b', or 'c'
 * @param {Object} variants - (optional) Manual variant configs; if null, auto-generate
 * @returns {Object} { lineItems, variantMaterialSet, debug }
 */
export function buildVariantTakeoff(takeoff_input, job, run, variantKey, variants = null) {
  // Build immutable variant materialSet
  const variantConfigs = variants || generateDefaultGBBVariants({ job, run });
  const allMaterialSets = buildAllVariantMaterialSets(job, run, variantConfigs);
  const variantMaterialSet = allMaterialSets[variantKey];
  
  if (!variantMaterialSet) {
    throw new Error(`Invalid variantKey: ${variantKey}`);
  }
  
  // CRITICAL: Once materialSet is created, coating is IMMUTABLE
  // No job defaults, no fallbacks, no mutations
  console.log(`[variantPipelineAdapter] Building Variant ${variantKey} (${variantMaterialSet.variantLabel})`);
  console.log(`[variantPipelineAdapter] materialSet coating:`, variantMaterialSet.coating);
  
  // Forbid coating override from job defaults
  if (variantKey === 'b' && variantMaterialSet.coating !== 'black_vinyl') {
    console.error(`[variantPipelineAdapter] VARIANT B COATING NOT BLACK_VINYL!`, {
      variantKey,
      coating: variantMaterialSet.coating,
      variantLabel: variantMaterialSet.variantLabel,
      materialType: variantMaterialSet.materialType
    });
    throw new Error(`Variant B coating pipeline FAILED: expected black_vinyl, got ${variantMaterialSet.coating}`);
  }
  
  // Determine takeoff builder based on materialSet type
  let lineItems = [];
  const isChain = variantMaterialSet.materialTypeKey === 'chain_link';
  const isVinyl = variantMaterialSet.materialTypeKey === 'vinyl';
  const isWood = variantMaterialSet.materialTypeKey === 'wood';
  const isAlum = variantMaterialSet.materialTypeKey === 'aluminum';
  
  try {
    if (isChain) {
      lineItems = buildChainLinkTakeoff(takeoff_input, variantMaterialSet);
    } else if (isVinyl) {
      lineItems = buildVinylTakeoff(takeoff_input, variantMaterialSet);
    } else if (isWood) {
      lineItems = buildWoodTakeoff(takeoff_input, variantMaterialSet);
    } else if (isAlum) {
      lineItems = buildAluminumTakeoff(takeoff_input, variantMaterialSet);
    } else {
      throw new Error(`Unknown material type: ${variantMaterialSet.materialType}`);
    }
  } catch (err) {
    console.error(`[variantPipelineAdapter] Takeoff builder failed for Variant ${variantKey}`, err);
    throw err;
  }
  
  return {
    variantKey,
    variantLabel: variantMaterialSet.variantLabel,
    lineItems,
    variantMaterialSet,
    materialType: variantMaterialSet.materialType,
    coating: variantMaterialSet.coating, // IMMUTABLE at this point
    debug: {
      buildTime: new Date().toISOString(),
      pipeline: 'variantPipelineAdapter',
      materialSetId: variantMaterialSet.id || 'unknown'
    }
  };
}

/**
 * Build all three variants in parallel (A, B, C).
 * Ensures consistent materialSet across all variants.
 * 
 * @param {Object} takeoff_input - Base takeoff
 * @param {Object} job - Job
 * @param {Object} run - Run
 * @param {Object} variants - (optional) Manual variant configs
 * @returns {Object} { a, b, c } each with lineItems, variantMaterialSet, debug
 */
export function buildAllVariantTakeoffs(takeoff_input, job, run, variants = null) {
  const result = {
    a: buildVariantTakeoff(takeoff_input, job, run, 'a', variants),
    b: buildVariantTakeoff(takeoff_input, job, run, 'b', variants),
    c: buildVariantTakeoff(takeoff_input, job, run, 'c', variants),
  };
  
  // CRITICAL SANITY CHECK: If any are chain link, B must be black_vinyl
  const bIsChain = result.b.variantMaterialSet.materialTypeKey === 'chain_link';
  if (bIsChain && result.b.coating !== 'black_vinyl') {
    console.error(`[buildAllVariantTakeoffs] CRITICAL: Variant B chain link is not black_vinyl!`, {
      coating: result.b.coating,
      expected: 'black_vinyl'
    });
    throw new Error(`Variant B coating pipeline FAILED in buildAllVariantTakeoffs`);
  }
  
  return result;
}