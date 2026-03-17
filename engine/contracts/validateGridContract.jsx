/**
 * CONTRACT 8: GRID IMMUTABILITY (CONTRACTUAL)
 * 
 * Map grid is computational, not decorative.
 * LOCKED VALUES - ANY DEVIATION = HARD FAIL
 */

const GRID_CONTRACT = {
  CANVAS_WIDTH_PX: 2000,
  CANVAS_HEIGHT_PX: 1500,
  GRID_SQUARE_PX: 40,
  GRID_SQUARE_FT: 10,
  PIXELS_PER_FOOT: 10, // ONLY allowed value
  SNAP_THRESHOLD_PX: 15,
  POST_OVERLAP_TOLERANCE_FT: 0.25
};

export function validateGridContract(mapScaleConfig) {
  const violations = [];
  
  if (mapScaleConfig.pixels_per_foot !== GRID_CONTRACT.PIXELS_PER_FOOT) {
    violations.push({
      code: 'GRID_CONTRACT_BROKEN',
      field: 'pixels_per_foot',
      expected: GRID_CONTRACT.PIXELS_PER_FOOT,
      received: mapScaleConfig.pixels_per_foot,
      severity: 'BLOCKING',
      message: 'Grid contract violation: pixels_per_foot must be 10'
    });
  }
  
  if (mapScaleConfig.world_width_px !== GRID_CONTRACT.CANVAS_WIDTH_PX) {
    violations.push({
      code: 'GRID_CONTRACT_BROKEN',
      field: 'world_width_px',
      expected: GRID_CONTRACT.CANVAS_WIDTH_PX,
      received: mapScaleConfig.world_width_px,
      severity: 'WARN',
      message: 'Canvas width deviates from contract'
    });
  }
  
  if (mapScaleConfig.grid_square_ft !== GRID_CONTRACT.GRID_SQUARE_FT) {
    violations.push({
      code: 'GRID_CONTRACT_BROKEN',
      field: 'grid_square_ft',
      expected: GRID_CONTRACT.GRID_SQUARE_FT,
      received: mapScaleConfig.grid_square_ft,
      severity: 'BLOCKING',
      message: 'Grid square ft must be 10'
    });
  }
  
  return {
    valid: violations.filter(v => v.severity === 'BLOCKING').length === 0,
    violations,
    contract: GRID_CONTRACT
  };
}

export { GRID_CONTRACT };