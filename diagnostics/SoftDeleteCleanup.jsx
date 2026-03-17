/**
 * SOFT DELETE CLEANUP
 * Implements UPDATE-based cleanup when hard DELETE fails
 * Marks orphaned gates and contaminated materials as excluded
 */

import { base44 } from '@/api/base44Client';

/**
 * Soft delete orphaned gates by marking them excluded
 * Returns count of gates updated
 */
export async function softDeleteOrphanedGates(jobId, orphanedGateIds) {
  if (!orphanedGateIds || orphanedGateIds.length === 0) {
    return { updated: 0, method: 'NONE' };
  }

  try {
    // Try to mark as deleted if field exists
    let updated = 0;
    for (const gateId of orphanedGateIds) {
      try {
        await base44.entities.Gate.update(gateId, {
          notes: '[ORPHANED - EXCLUDED FROM CALCULATIONS]',
          placement: 'ORPHANED' // Mark as invalid
        });
        updated++;
      } catch (error) {
        console.error(`Failed to soft delete gate ${gateId}:`, error);
      }
    }

    return { updated, method: 'SOFT_DELETE_VIA_UPDATE' };
  } catch (error) {
    console.error('Soft delete failed:', error);
    return { updated: 0, method: 'FAILED', error: error.message };
  }
}

/**
 * Soft delete contaminated materials by marking them excluded
 * Returns count of materials updated
 */
export async function softDeleteContaminatedMaterials(jobId, contaminatedMaterialIds) {
  if (!contaminatedMaterialIds || contaminatedMaterialIds.length === 0) {
    return { updated: 0, method: 'NONE' };
  }

  try {
    let updated = 0;
    for (const materialId of contaminatedMaterialIds) {
      try {
        await base44.entities.MaterialLine.update(materialId, {
          calculationDetails: '[CONTAMINATED - EXCLUDED FROM CALCULATIONS]',
          source: 'CONTAMINATED' // Mark as invalid
        });
        updated++;
      } catch (error) {
        console.error(`Failed to soft delete material ${materialId}:`, error);
      }
    }

    return { updated, method: 'SOFT_DELETE_VIA_UPDATE' };
  } catch (error) {
    console.error('Soft delete failed:', error);
    return { updated: 0, method: 'FAILED', error: error.message };
  }
}

/**
 * Detect and soft delete all orphaned/contaminated data for a job
 */
export async function cleanupJobData(jobId, currentMaterialType) {
  const results = {
    gates: { orphaned: [], updated: 0 },
    materials: { contaminated: [], updated: 0 }
  };

  try {
    // Get all gates and runs
    const [allGates, runs] = await Promise.all([
      base44.entities.Gate.filter({ jobId }),
      base44.entities.Run.filter({ jobId })
    ]);

    // Build valid run ID map
    const validRunIds = new Set(
      runs
        .filter(r => {
          const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
          const includeInCalc = r.includeInCalculation !== false;
          const materialMatch = r.materialType === currentMaterialType;
          return status === 'new' && includeInCalc && materialMatch;
        })
        .map(r => r.id)
    );

    // Detect orphaned gates
    const orphanedGates = allGates.filter(g => 
      !g.runId || !validRunIds.has(g.runId) || g.placement === 'ORPHANED'
    );

    results.gates.orphaned = orphanedGates.map(g => ({
      id: g.id,
      runId: g.runId,
      reason: !g.runId ? 'MISSING_RUNID' : 'INVALID_RUNID'
    }));

    // Soft delete orphaned gates (excluding already marked)
    const toDelete = orphanedGates.filter(g => g.placement !== 'ORPHANED');
    if (toDelete.length > 0) {
      const deleteResult = await softDeleteOrphanedGates(
        jobId, 
        toDelete.map(g => g.id)
      );
      results.gates.updated = deleteResult.updated;
    }

    // Get all materials and detect contamination
    const allMaterials = await base44.entities.MaterialLine.filter({ jobId });
    
    const forbiddenTerms = {
      'Chain Link': ['vinyl panel', 'donut', '5x5 vinyl', 'vinyl post cap', 'aluminum gate beam (vinyl'],
      'Vinyl': ['chain link fabric', 'tension band', 'brace band', 'terminal post', 'rail end cup'],
      'Wood': ['vinyl panel', 'chain link fabric', 'aluminum panel', 'donut', 'tension band'],
      'Aluminum': ['vinyl panel', 'chain link fabric', 'donut', 'wood post', 'tension band']
    };

    const forbidden = forbiddenTerms[currentMaterialType] || [];
    const contaminated = allMaterials.filter(mat => {
      const itemName = (mat.lineItemName || '').toLowerCase();
      return forbidden.some(term => itemName.includes(term.toLowerCase())) &&
             mat.source !== 'CONTAMINATED'; // Don't re-process already marked
    });

    results.materials.contaminated = contaminated.map(m => ({
      id: m.id,
      name: m.lineItemName
    }));

    // Soft delete contaminated materials
    if (contaminated.length > 0) {
      const deleteResult = await softDeleteContaminatedMaterials(
        jobId,
        contaminated.map(m => m.id)
      );
      results.materials.updated = deleteResult.updated;
    }

  } catch (error) {
    console.error('Cleanup failed:', error);
    results.error = error.message;
  }

  return results;
}