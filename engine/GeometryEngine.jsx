/**
 * FENCEBUDDY V2 ENGINE — GEOMETRY ENGINE
 * 
 * CONTRACT 2: MAP GEOMETRY SYSTEM (LOCKED)
 * Wraps V1 geometry behavior with V2 contracts (checksums, versioning, scale config)
 */

import { ENGINE_VERSIONS } from './versions';
import { generateGeometryChecksum } from './checksums';
import { logDiagnostic } from './diagnosticsService';

/**
 * CONTRACT 2.9: GRID IMMUTABILITY
 * Get or create MapScaleConfig for a job (immutable after creation)
 */
export async function getJobMapScaleConfig(job, base44) {
  // Check if job has mapScaleConfigId
  if (job.mapScaleConfigId) {
    const config = await base44.entities.MapScaleConfig.filter({ id: job.mapScaleConfigId });
    if (config.length > 0) return config[0];
  }
  
  // Legacy jobs: create config with V1 defaults
  const legacyConfig = await base44.entities.MapScaleConfig.create({
    config_version: 'grid_v1',
    pixels_per_foot: 10,
    world_width_px: 2000,
    world_height_px: 1500,
    grid_square_px: 40,
    grid_square_ft: 10,
    snap_threshold_px: 15,
    post_overlap_tolerance_ft: 0.25,
    notes: 'Legacy V1 scale config (backfilled)'
  });
  
  // Link to job
  await base44.entities.Job.update(job.id, {
    mapScaleConfigId: legacyConfig.id
  });
  
  return legacyConfig;
}

/**
 * Compute geometry result with checksum and validation
 */
export async function computeGeometry({
  fenceLines,
  gates,
  mapScaleConfig,
  jobId,
  variantId,
  companyId
}) {
  console.log('[GeometryEngine] Computing geometry...', {
    line_count: fenceLines?.length,
    gate_count: gates?.length
  });
  
  // Validate inputs
  if (!fenceLines || fenceLines.length === 0) {
    await logDiagnostic({
      phase: 'GEOMETRY',
      severity: 'INFO',
      code: 'NO_GEOMETRY',
      message: 'No fence lines present',
      jobId,
      variantId,
      companyId
    });
    
    return {
      status: 'NO_GEOMETRY',
      fence_lines: [],
      gates: [],
      total_lf: 0,
      geometry_checksum: null,
      geometry_version: ENGINE_VERSIONS.GEOMETRY_VERSION
    };
  }
  
  // Validate scale config
  if (!mapScaleConfig || !mapScaleConfig.pixels_per_foot) {
    await logDiagnostic({
      phase: 'GEOMETRY',
      severity: 'BLOCKING',
      code: 'MISSING_SCALE_CONFIG',
      message: 'Map scale config missing or invalid',
      actionHint: 'System error - contact support',
      jobId,
      variantId,
      companyId
    });
    
    return {
      status: 'ERROR',
      error: 'Missing map scale config',
      geometry_checksum: null
    };
  }
  
  // Calculate effective lengths
  const processedLines = fenceLines.map(line => ({
    ...line,
    effective_length_ft: (line.manualLengthFt && line.manualLengthFt > 0) 
      ? line.manualLengthFt 
      : line.length || 0
  }));
  
  // Calculate total LF (only assigned, non-existing lines)
  const total_lf = processedLines
    .filter(line => line.assignedRunId && !line.isExisting)
    .reduce((sum, line) => sum + line.effective_length_ft, 0);
  
  // Generate checksum
  const geometry_checksum = generateGeometryChecksum({
    fenceLines: processedLines,
    gates,
    mapScaleConfig
  });
  
  console.log('[GeometryEngine] Geometry computed:', {
    total_lf,
    geometry_checksum,
    line_count: processedLines.length
  });
  
  return {
    status: 'VALID',
    fence_lines: processedLines,
    gates: gates || [],
    total_lf,
    geometry_checksum,
    geometry_version: ENGINE_VERSIONS.GEOMETRY_VERSION,
    map_scale_version: mapScaleConfig.config_version,
    computed_at: new Date().toISOString()
  };
}

/**
 * Validate geometry meets requirements
 */
export function validateGeometry(geometryResult) {
  const errors = [];
  
  if (!geometryResult || geometryResult.status !== 'VALID') {
    errors.push({
      code: 'INVALID_GEOMETRY',
      message: 'Geometry result is invalid or missing',
      severity: 'BLOCKING'
    });
    return { valid: false, errors };
  }
  
  if (geometryResult.total_lf <= 0) {
    errors.push({
      code: 'NO_LINEAR_FEET',
      message: 'No linear feet calculated from geometry',
      severity: 'BLOCKING',
      actionHint: 'Assign fence lines to runs and set manual lengths'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}