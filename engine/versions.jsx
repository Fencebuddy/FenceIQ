/**
 * FENCEBUDDY V2 ENGINE — VERSION CONSTANTS
 * 
 * CONTRACT 0.1: VERSIONING LAW (HARD)
 * Every breaking change to geometry, takeoff, resolver, or pricing MUST increment these versions.
 * NO SILENT CHANGES. Snapshots store these versions and refuse to mix incompatible versions.
 */

export const ENGINE_VERSIONS = {
  // Geometry: map scale, snap thresholds, post normalization, gate snap rules
  GEOMETRY_VERSION: "v1.0",
  
  // Map scale: pixels-per-foot, world size, grid square dimensions
  MAP_SCALE_VERSION: "grid_v1",
  
  // Takeoff: UCK grammar, required parts logic, quantity calculations
  TAKEOFF_VERSION: "v1.0",
  
  // Resolver: UCK matching, unit conversion, catalog lookup
  RESOLVER_VERSION: "v2.0",
  
  // Pricing: divisor formula, margin requirements, discount stacking
  PRICING_VERSION: "v1.0", // LOCKED until explicit bump
  
  // Overall engine version
  ENGINE_VERSION: "v2.0.0"
};

/**
 * Version compatibility checker
 */
export function validateVersionCompatibility(snapshot1, snapshot2) {
  const incompatibilities = [];
  
  if (snapshot1.geometry_version !== snapshot2.geometry_version) {
    incompatibilities.push({
      type: 'GEOMETRY_VERSION_MISMATCH',
      snapshot1: snapshot1.geometry_version,
      snapshot2: snapshot2.geometry_version
    });
  }
  
  if (snapshot1.takeoff_version !== snapshot2.takeoff_version) {
    incompatibilities.push({
      type: 'TAKEOFF_VERSION_MISMATCH',
      snapshot1: snapshot1.takeoff_version,
      snapshot2: snapshot2.takeoff_version
    });
  }
  
  if (snapshot1.pricing_version !== snapshot2.pricing_version) {
    incompatibilities.push({
      type: 'PRICING_VERSION_MISMATCH',
      snapshot1: snapshot1.pricing_version,
      snapshot2: snapshot2.pricing_version
    });
  }
  
  return {
    compatible: incompatibilities.length === 0,
    incompatibilities
  };
}

/**
 * Snapshot version stamper
 */
export function stampVersions(data) {
  return {
    ...data,
    geometry_version: ENGINE_VERSIONS.GEOMETRY_VERSION,
    map_scale_version: ENGINE_VERSIONS.MAP_SCALE_VERSION,
    takeoff_version: ENGINE_VERSIONS.TAKEOFF_VERSION,
    resolver_version: ENGINE_VERSIONS.RESOLVER_VERSION,
    pricing_version: ENGINE_VERSIONS.PRICING_VERSION,
    engine_version: ENGINE_VERSIONS.ENGINE_VERSION,
    versioned_at: new Date().toISOString()
  };
}