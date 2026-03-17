/**
 * VERSIONED CLEANUP ENGINE
 * Implements version-based gate/material rebuild
 * Eliminates need for unreliable delete_entities
 */

import { base44 } from '@/api/base44Client';
import { normalizeMapState } from '@/components/materials/normalizeMapState';
import { buildTakeoff } from '@/components/materials/canonicalTakeoffEngine';

/**
 * Generate new version string
 */
function generateVersion() {
  return `v${Date.now()}`;
}

/**
 * Rebuild gates from map with new version
 * Source of truth: mapData fenceLines + runs
 * Orphans are marked but included
 */
export async function rebuildGatesFromMap(jobId, job, runs) {
  const newVersion = generateVersion();
  
  try {
    // Get map data
    const mapData = job.mapData || {};
    const fenceLines = mapData.fenceLines || [];
    
    // Normalize and validate
    const normalized = normalizeMapState(
      { fenceLines, trees: mapData.trees || [], annotations: mapData.mapAnnotations || [] },
      runs,
      []
    );
    
    // Build valid run ID map
    const validRunIds = new Set(
      runs
        .filter(r => {
          const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
          const includeInCalc = r.includeInCalculation !== false;
          return status === 'new' && includeInCalc;
        })
        .map(r => r.id)
    );
    
    // Extract canvas gates
    const canvasGates = [
      ...(mapData.gates || []),
      ...(mapData.doubleGates || [])
    ];
    
    let gatesWritten = 0;
    let orphansWritten = 0;
    
    // Rebuild each gate with new version
    for (const canvasGate of canvasGates) {
      if (!canvasGate.runId) continue;
      
      const isOrphan = !validRunIds.has(canvasGate.runId);
      const orphanReason = isOrphan ? 'INVALID_RUNID' : null;
      
      // Determine gate type and width
      const gateType = canvasGate.gateType || (canvasGate.widthFt && canvasGate.widthFt >= 8 ? 'Double' : 'Single');
      const widthFt = canvasGate.widthFt || canvasGate.gateWidth_ft || 4;
      
      try {
        await base44.entities.Gate.create({
          jobId,
          runId: canvasGate.runId,
          gateType,
          gateWidth: `${widthFt}'`,
          gateWidth_ft: widthFt,
          gateCenterDistance_ft: canvasGate.centerDistance_ft || canvasGate.gateCenterDistance_ft || 0,
          placement: canvasGate.placement || 'In-line',
          version: newVersion,
          isOrphan,
          orphanReason,
          notes: isOrphan ? `[ORPHAN: ${orphanReason}]` : null
        });
        
        if (isOrphan) {
          orphansWritten++;
        } else {
          gatesWritten++;
        }
      } catch (error) {
        console.error('Failed to create gate:', error);
      }
    }
    
    // Update job active version
    await base44.entities.Job.update(jobId, {
      activeGateVersion: newVersion
    });
    
    return {
      success: true,
      newVersion,
      gatesWritten,
      orphansWritten,
      totalWritten: gatesWritten + orphansWritten
    };
  } catch (error) {
    console.error('Gate rebuild failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Rebuild materials from takeoff with new version
 * Source of truth: buildTakeoff() canonical engine
 */
export async function rebuildMaterialsFromTakeoff(jobId, job, runs, gates, fenceLines) {
  const newVersion = generateVersion();
  
  try {
    // Build canonical takeoff
    const takeoff = buildTakeoff(job, fenceLines, runs, gates);
    
    let materialsWritten = 0;
    
    // Write each line item with new version
    for (const item of takeoff.lineItems) {
      try {
        await base44.entities.MaterialLine.create({
          jobId,
          lineItemName: item.materialDescription || item.lineItemName,
          calculatedQty: item.quantityCalculated || item.quantity || 0,
          unit: item.uom || item.unit,
          calculationDetails: item.notes || item.calculationDetails || '',
          runLabel: item.runLabel || 'Overall',
          source: 'map',
          version: newVersion,
          materialType: job.materialType
        });
        materialsWritten++;
      } catch (error) {
        console.error('Failed to create material:', error);
      }
    }
    
    // Update job active version
    await base44.entities.Job.update(jobId, {
      activeMaterialVersion: newVersion
    });
    
    return {
      success: true,
      newVersion,
      materialsWritten
    };
  } catch (error) {
    console.error('Material rebuild failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Full rebuild: gates + materials
 */
export async function rebuildJobData(jobId) {
  try {
    // Fetch current job data
    const [job] = await base44.entities.Job.filter({ id: jobId });
    if (!job) {
      return { success: false, error: 'Job not found' };
    }
    
    // Fetch runs and current gates
    const [runs, allGates] = await Promise.all([
      base44.entities.Run.filter({ jobId }),
      base44.entities.Gate.filter({ jobId })
    ]);
    
    // Get fence lines from map
    const fenceLines = job.mapData?.fenceLines || [];
    
    // Rebuild gates
    const gateResult = await rebuildGatesFromMap(jobId, job, runs);
    
    // Fetch newly created gates for material calculation
    const newGates = await base44.entities.Gate.filter({ 
      jobId, 
      version: gateResult.newVersion 
    });
    
    // Rebuild materials
    const materialResult = await rebuildMaterialsFromTakeoff(
      jobId, 
      job, 
      runs, 
      newGates.filter(g => !g.isOrphan), 
      fenceLines
    );
    
    return {
      success: true,
      gates: gateResult,
      materials: materialResult
    };
  } catch (error) {
    console.error('Full rebuild failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}