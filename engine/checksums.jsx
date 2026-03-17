/**
 * FENCEBUDDY V2 ENGINE — CHECKSUM UTILITIES
 * 
 * Deterministic hashing for snapshot invalidation.
 * CONTRACT: Same input MUST produce same checksum.
 * 
 * Browser-compatible hashing (no crypto module)
 */

/**
 * Generate geometry checksum from fence lines, gates, and scale config
 */
export function generateGeometryChecksum({ fenceLines, gates, mapScaleConfig }) {
  // Normalize data for deterministic hashing
  const normalized = {
    scale_version: mapScaleConfig?.config_version || 'grid_v1',
    pixels_per_foot: mapScaleConfig?.pixels_per_foot || 10,
    
    lines: (fenceLines || [])
      .filter(line => line.assignedRunId) // Only include assigned lines
      .map(line => ({
        id: line.lineId,
        start_x: Math.round(line.start.x * 100) / 100, // Round to 2 decimals
        start_y: Math.round(line.start.y * 100) / 100,
        end_x: Math.round(line.end.x * 100) / 100,
        end_y: Math.round(line.end.y * 100) / 100,
        length_ft: Math.round((line.manualLengthFt || line.length) * 10) / 10,
        assigned_run: line.assignedRunId,
        is_existing: line.isExisting || false
      }))
      .sort((a, b) => a.id.localeCompare(b.id)), // Deterministic order
    
    gates: (gates || [])
      .map(gate => ({
        id: gate.id,
        run_id: gate.runId,
        width_ft: gate.gateWidth_ft,
        center_ft: Math.round(gate.gateCenterDistance_ft * 10) / 10,
        type: gate.gateType
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  };
  
  const jsonString = JSON.stringify(normalized);
  
  // Simple deterministic hash for browser (not cryptographic, just consistent)
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `geo_${Math.abs(hash).toString(16)}`;
}

/**
 * Generate takeoff hash from UCK list + quantities
 */
export function generateTakeoffHash({ lineItems, variantConfig }) {
  const normalized = {
    variant_context: {
      material_type: variantConfig?.materialType,
      fence_system: variantConfig?.fenceSystem,
      height_ft: variantConfig?.heightFt,
      color: variantConfig?.color,
      coating: variantConfig?.coating
    },
    
    items: (lineItems || [])
      .map(item => ({
        uck: item.canonical_key,
        qty: Math.round(item.quantityCalculated * 100) / 100, // Round to 2 decimals
        uom: item.uom
      }))
      .sort((a, b) => a.uck.localeCompare(b.uck)) // Deterministic order
  };
  
  const jsonString = JSON.stringify(normalized);
  
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `takeoff_${Math.abs(hash).toString(16)}`;
}

/**
 * Generate pricing input hash for retail anchor reuse
 */
export function generatePricingInputHash({ material_cost, total_lf, material_type, labor_per_lf, delivery_cost, tear_out_cost }) {
  const normalized = {
    material_cost: Math.round(material_cost * 100) / 100,
    total_lf: Math.round(total_lf * 10) / 10,
    material_type,
    labor_per_lf: Math.round(labor_per_lf * 100) / 100,
    delivery_cost: Math.round(delivery_cost * 100) / 100,
    tear_out_cost: Math.round(tear_out_cost * 100) / 100
  };
  
  const jsonString = JSON.stringify(normalized);
  
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `pricing_${Math.abs(hash).toString(16)}`;
}

/**
 * Map state hash for comparison (simpler version for map changes)
 */
export function generateMapStateHash({ fenceLines, gates }) {
  // Simplified hash for map change detection
  const data = {
    line_count: fenceLines?.length || 0,
    gate_count: gates?.length || 0,
    total_lf: (fenceLines || []).reduce((sum, l) => sum + (l.manualLengthFt || l.length || 0), 0)
  };
  
  return JSON.stringify(data);
}