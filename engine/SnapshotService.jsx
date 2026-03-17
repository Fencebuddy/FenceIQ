/**
 * FENCEBUDDY V2 ENGINE — SNAPSHOT SERVICE
 * 
 * CONTRACT 4.2: SNAPSHOTS + INVALIDATION
 * Manage TakeoffSnapshot and JobCostSnapshot with invalidation rules
 */

import { ENGINE_VERSIONS, stampVersions, validateVersionCompatibility } from './versions';
import { generateGeometryChecksum, generateTakeoffHash, generatePricingInputHash } from './checksums';
import { base44 } from '@/api/base44Client';
import { logDiagnostic } from './diagnosticsService';

/**
 * Get or create TakeoffSnapshot
 * 
 * CONTRACT: Deduplication by geometry_checksum + takeoff_hash
 */
export async function getOrCreateTakeoffSnapshot({
  jobId,
  geometryResult,
  takeoffResult,
  variantId = 'CURRENT',
  companyId
}) {
  const geometry_checksum = geometryResult.geometry_checksum;
  const takeoff_hash = takeoffResult.takeoff_hash;
  
  // Check for existing snapshot with same checksums
  const existing = await base44.entities.TakeoffSnapshot.filter({
    jobId,
    geometry_checksum,
    takeoff_hash
  });
  
  if (existing.length > 0) {
    console.log('[SnapshotService] Reusing existing TakeoffSnapshot:', existing[0].id);
    return existing[0];
  }
  
  // Create new snapshot
  const snapshotData = stampVersions({
    jobId,
    geometry_checksum,
    takeoff_hash,
    material_type: takeoffResult.variantConfig?.materialType,
    total_lf: geometryResult.total_lf,
    line_items: takeoffResult.line_items,
    post_counts: { total: takeoffResult.post_counts || 0 },
    source: 'MAP_DRIVEN',
    locked: true,
    status: 'complete'
  });
  
  const snapshot = await base44.entities.TakeoffSnapshot.create(snapshotData);
  
  console.log('[SnapshotService] Created TakeoffSnapshot:', snapshot.id);
  
  return snapshot;
}

/**
 * Get or create JobCostSnapshot
 * 
 * CONTRACT 0.8: RETAIL ANCHOR STORAGE
 * Reuse retail anchor if takeoff_hash matches and pricing_version matches
 */
export async function getOrCreateJobCostSnapshot({
  jobId,
  takeoffSnapshot,
  pricingResult,
  scenario_tier = 'CURRENT',
  companyId
}) {
  const takeoff_hash = takeoffSnapshot.takeoff_hash;
  const pricing_input_hash = generatePricingInputHash({
    material_cost: pricingResult.pricing_breakdown.material_cost,
    total_lf: pricingResult.pricing_breakdown.total_lf,
    material_type: pricingResult.pricing_breakdown.material_type,
    labor_per_lf: pricingResult.pricing_breakdown.labor_per_lf,
    delivery_cost: pricingResult.pricing_breakdown.delivery_cost,
    tear_out_cost: pricingResult.pricing_breakdown.tear_out_cost || 0
  });
  
  // Check for existing with same takeoff_hash + pricing_version
  const existing = await base44.entities.JobCostSnapshot.filter({
    jobId,
    takeoff_snapshot_id: takeoffSnapshot.id,
    scenario_tier,
    pricing_version: ENGINE_VERSIONS.PRICING_VERSION
  });
  
  if (existing.length > 0) {
    // Check if retail anchor can be reused (CONTRACT 0.8)
    const canReuseAnchor = existing[0].retail_anchor && 
                           existing[0].pricing_input_hash === pricing_input_hash;
    
    if (canReuseAnchor) {
      console.log('[SnapshotService] Reusing retail anchor from existing snapshot');
      return existing[0];
    }
    
    // Update existing with new pricing
    const updated = await base44.entities.JobCostSnapshot.update(existing[0].id, {
      pricing_breakdown: pricingResult.pricing_breakdown,
      retail_anchor: pricingResult.retail_anchor,
      retail_anchor_source: pricingResult.retail_anchor_source,
      pricing_input_hash,
      sell_price: pricingResult.pricing_breakdown.sale_price,
      direct_cost: pricingResult.pricing_breakdown.direct_cost,
      net_margin: pricingResult.pricing_breakdown.net_margin / 100,
      material_cost: pricingResult.pricing_breakdown.material_cost,
      labor_cost: pricingResult.pricing_breakdown.labor_cost,
      delivery_cost: pricingResult.pricing_breakdown.delivery_cost
    });
    
    return updated;
  }
  
  // Create new snapshot
  const snapshotData = stampVersions({
    jobId,
    takeoff_snapshot_id: takeoffSnapshot.id,
    scenario_tier,
    pricing_breakdown: pricingResult.pricing_breakdown,
    retail_anchor: pricingResult.retail_anchor,
    retail_anchor_source: pricingResult.retail_anchor_source,
    pricing_input_hash,
    takeoff_hash,
    total_lf: takeoffSnapshot.total_lf,
    material_cost: pricingResult.pricing_breakdown.material_cost,
    labor_cost: pricingResult.pricing_breakdown.labor_cost,
    delivery_cost: pricingResult.pricing_breakdown.delivery_cost,
    direct_cost: pricingResult.pricing_breakdown.direct_cost,
    sell_price: pricingResult.pricing_breakdown.sale_price,
    net_margin: pricingResult.pricing_breakdown.net_margin / 100,
    locked: true,
    active: true,
    status: 'complete'
  });
  
  const snapshot = await base44.entities.JobCostSnapshot.create(snapshotData);
  
  console.log('[SnapshotService] Created JobCostSnapshot:', snapshot.id);
  
  return snapshot;
}

/**
 * Invalidate downstream snapshots when geometry changes
 * 
 * CONTRACT 4.2: INVALIDATION RULES
 */
export async function invalidateDownstreamSnapshots({
  jobId,
  reason = 'GEOMETRY_CHANGED'
}) {
  console.log('[SnapshotService] Invalidating downstream snapshots:', reason);
  
  // Mark job as needing recalc
  await base44.entities.Job.update(jobId, {
    active_takeoff_snapshot_id: null,
    active_pricing_snapshot_id: null,
    pricing_status: 'NEEDS_RECALC',
    map_state_hash: null
  });
  
  // Note: We don't delete snapshots (immutable history), just unlink them
  console.log('[SnapshotService] Snapshots invalidated');
}