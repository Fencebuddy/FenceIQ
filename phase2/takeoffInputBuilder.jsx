/**
 * TAKEOFF INPUT BUILDER
 * Builds compact map model for Phase 2 multi-material scenario generation
 */

/**
 * Build takeoff_input from job state (map, runs, gates)
 * This is the authoritative map geometry for rebuilding takeoffs in different materials
 */
export function buildTakeoffInput(job, runs, gates) {
  const takeoff_input = {
    version: 'map_model_v1',
    total_lf: job.totalLF || 0,
    runs: runs.map(run => ({
      runId: run.id,
      label: run.runLabel,
      length_lf: run.lengthLF || 0,
      height_ft: parseFloat(run.fenceHeight) || 6,
      gates: gates
        .filter(g => g.runId === run.id)
        .map(g => ({
          gateId: g.id,
          type: g.gateType,
          width_ft: g.gateWidth_ft || 0
        }))
    })),
    constraints: {
      pool_detected: job.poolDetected || false,
      privacy_required: runs.some(r => r.style?.includes('Privacy')),
      corner_lot: job.cornerLot || false
    }
  };
  
  return takeoff_input;
}

/**
 * Temporary bridge: build takeoff_input from existing TakeoffSnapshot
 * Used for migrating old snapshots that don't have takeoff_input yet
 */
export function buildFromTakeoffSnapshot(snapshot) {
  if (snapshot.takeoff_input) {
    return snapshot.takeoff_input; // Already has it
  }
  
  // Reconstruct from run_breakdown
  const runs = (snapshot.run_breakdown || []).map(run => ({
    runId: run.runId || run.id,
    label: run.runLabel || run.label,
    length_lf: run.lengthLF || run.length_lf || 0,
    height_ft: parseFloat(run.fenceHeight) || 6,
    gates: []
  }));
  
  // Add gates if available
  if (snapshot.gates_list) {
    snapshot.gates_list.forEach(gate => {
      const run = runs.find(r => r.runId === gate.runId);
      if (run) {
        run.gates.push({
          gateId: gate.id,
          type: gate.gateType,
          width_ft: gate.gateWidth_ft || 0
        });
      }
    });
  }
  
  return {
    version: 'map_model_v1',
    total_lf: snapshot.total_lf || 0,
    runs,
    constraints: {}
  };
}