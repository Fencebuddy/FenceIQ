/**
 * GOLDEN PATH: getOrCreateTakeoffSnapshotV2
 * 
 * SINGLE SOURCE OF TRUTH for takeoff generation
 * 
 * Rules:
 * 1. Deterministic: same inputs = same hash = reuse snapshot
 * 2. NO localStorage fallbacks
 * 3. NO legacy resolver
 * 4. Always uses current Job + Runs + Gates + FenceLines
 * 5. Generates inputHash for deduplication
 */

import { base44 } from '@/api/base44Client';
import { buildTakeoff } from '@/components/materials/canonicalTakeoffEngine';
import { logTrace, traceEntityRead, traceEntityWrite } from '@/components/tracing/flowTracer';

/**
 * Compute deterministic input hash
 */
function computeTakeoffInputHash({ job, runs, gates, fenceLines, variantKey = 'CURRENT' }) {
  const inputs = {
    variantKey,
    materialType: job.materialType,
    fenceHeight: job.fenceHeight,
    fenceColor: job.fenceColor,
    chainLinkCoating: job.chainLinkCoating,
    fenceSystem: job.fenceSystem,
    fenceLinesCount: fenceLines?.length || 0,
    runsCount: runs?.length || 0,
    gatesCount: gates?.length || 0,
    runHashes: runs?.map(r => `${r.id}:${r.materialType}:${r.fenceHeight}:${r.lengthLF}`).join('|') || '',
    gateHashes: gates?.map(g => `${g.id}:${g.gateType}:${g.gateWidth_ft}`).join('|') || ''
  };
  
  // Simple hash (in production, use crypto.subtle)
  return JSON.stringify(inputs);
}

/**
 * GET OR CREATE TAKEOFF SNAPSHOT V2
 * 
 * @returns {Promise<Object>} TakeoffSnapshot with guaranteed lineItems
 */
export async function getOrCreateTakeoffSnapshotV2({ 
  jobId, 
  variantKey = 'CURRENT',
  traceId = null,
  forceRebuild = false
}) {
  const startTime = Date.now();
  const entityReads = [];
  const entityWrites = [];
  const fallbacksUsed = [];
  
  try {
    // Step 1: Load Job
    const jobs = await base44.entities.Job.filter({ id: jobId });
    const job = jobs[0];
    entityReads.push(traceEntityRead('Job', { id: jobId }, jobs.length));
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    // Step 2: Load Runs
    const runs = await base44.entities.Run.filter({ 
      jobId, 
      includeInCalculation: true 
    });
    entityReads.push(traceEntityRead('Run', { jobId }, runs.length));
    
    // Step 3: Load Gates
    const gates = await base44.entities.Gate.filter({ jobId });
    entityReads.push(traceEntityRead('Gate', { jobId }, gates.length));
    
    // Step 4: Extract FenceLines
    const fenceLines = job.mapData?.fenceLines || [];
    
    // Step 5: Compute input hash
    const inputHash = computeTakeoffInputHash({ 
      job, 
      runs, 
      gates, 
      fenceLines, 
      variantKey 
    });
    
    // Step 6: Check for existing snapshot with same hash
    if (!forceRebuild) {
      const existingSnapshots = await base44.entities.TakeoffSnapshot.filter({
        jobId,
        map_state_hash: inputHash
      });
      entityReads.push(traceEntityRead('TakeoffSnapshot', { jobId, map_state_hash: inputHash }, existingSnapshots.length));
      
      if (existingSnapshots.length > 0) {
        const snapshot = existingSnapshots[0];
        
        // Log trace
        await logTrace({
          traceId,
          jobId,
          pageName: 'TakeoffService',
          stepName: 'TAKEOFF_SNAPSHOT_REUSE',
          functionName: 'getOrCreateTakeoffSnapshotV2',
          inputHashes: { inputHash },
          sourcesUsed: [
            { type: 'snapshot', name: 'TakeoffSnapshot', id: snapshot.id }
          ],
          fallbacksUsed: [],
          outputSummary: {
            snapshotId: snapshot.id,
            lineItemsCount: snapshot.line_items?.length || 0,
            totalLF: snapshot.total_lf,
            reused: true
          },
          entityReads,
          entityWrites: [],
          durationMs: Date.now() - startTime
        });
        
        console.log('[GoldenPath] ✓ Reusing existing TakeoffSnapshot:', snapshot.id);
        return snapshot;
      }
    }
    
    // Step 7: Build takeoff (deterministic)
    console.log('[GoldenPath] Building new takeoff...');
    const takeoffResult = buildTakeoff(job, fenceLines, runs, gates, []);
    
    // Step 8: Create new snapshot
    const snapshotData = {
      jobId,
      map_state_hash: inputHash,
      material_type: job.materialType,
      total_lf: fenceLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0),
      line_items: takeoffResult.lineItems.map(item => ({
        canonical_key: item.canonical_key,
        uck: item.uck,
        lineItemName: item.lineItemName,
        quantityCalculated: item.quantityCalculated,
        uom: item.uom,
        notes: item.notes,
        source: 'map_driven'
      })),
      post_counts: takeoffResult.postCounts || {},
      run_breakdown: runs.map(r => ({
        runId: r.id,
        runLabel: r.runLabel,
        lengthLF: r.lengthLF,
        materialType: r.materialType,
        fenceHeight: r.fenceHeight
      })),
      gates_list: gates.map(g => ({
        gateId: g.id,
        gateType: g.gateType,
        gateWidth_ft: g.gateWidth_ft,
        runId: g.runId
      })),
      locked: true,
      source: 'MAP_DRIVEN',
      status: 'complete',
      takeoff_input: {
        version: 'v2_golden_path',
        variantKey,
        materialType: job.materialType,
        fenceHeight: job.fenceHeight,
        fenceColor: job.fenceColor,
        chainLinkCoating: job.chainLinkCoating,
        fenceSystem: job.fenceSystem
      }
    };
    
    const newSnapshot = await base44.entities.TakeoffSnapshot.create(snapshotData);
    entityWrites.push(traceEntityWrite('TakeoffSnapshot', 'create', newSnapshot.id, snapshotData));
    
    // Step 9: Update Job reference
    await base44.entities.Job.update(jobId, {
      active_takeoff_snapshot_id: newSnapshot.id,
      map_state_hash: inputHash
    });
    entityWrites.push(traceEntityWrite('Job', 'update', jobId, { 
      active_takeoff_snapshot_id: newSnapshot.id 
    }));
    
    // Log trace
    await logTrace({
      traceId,
      jobId,
      pageName: 'TakeoffService',
      stepName: 'TAKEOFF_SNAPSHOT_CREATE',
      functionName: 'getOrCreateTakeoffSnapshotV2',
      inputHashes: { inputHash },
      sourcesUsed: [
        { type: 'entity', name: 'Job', id: jobId },
        { type: 'entity', name: 'Run', id: 'multiple', query: { jobId } },
        { type: 'entity', name: 'Gate', id: 'multiple', query: { jobId } },
        { type: 'rebuild', name: 'buildTakeoff' }
      ],
      fallbacksUsed,
      outputSummary: {
        snapshotId: newSnapshot.id,
        lineItemsCount: newSnapshot.line_items.length,
        totalLF: newSnapshot.total_lf,
        created: true
      },
      entityReads,
      entityWrites,
      durationMs: Date.now() - startTime
    });
    
    console.log('[GoldenPath] ✓ Created new TakeoffSnapshot:', newSnapshot.id);
    return newSnapshot;
    
  } catch (error) {
    // Log error trace
    await logTrace({
      traceId,
      jobId,
      pageName: 'TakeoffService',
      stepName: 'TAKEOFF_SNAPSHOT_ERROR',
      functionName: 'getOrCreateTakeoffSnapshotV2',
      sourcesUsed: [],
      fallbacksUsed,
      outputSummary: {},
      entityReads,
      entityWrites,
      errorOccurred: true,
      errorMessage: error.message,
      durationMs: Date.now() - startTime
    });
    
    throw error;
  }
}