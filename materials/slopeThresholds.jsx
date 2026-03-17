/**
 * FenceBuddy Slope Thresholds Configuration
 * Centralized threshold values to prevent drift across modules
 */

export const SLOPE_THRESHOLDS = {
  // Slope existence detection
  SLOPE_EXISTS_FT: 0.05, // 0.6 inches - ignore noise below this
  
  // Gate placement advisory
  GATE_ON_SLOPE_GRADE: 0.02, // 2% grade triggers advisory
  
  // Direction flip detection (for sub-run splitting)
  DIRECTION_FLIP_FT: 0.3, // 3.6 inches - minimum drop to consider direction change meaningful
  
  // Post length upgrade (wood PostMaster)
  POST_UPGRADE_DROP_FT: 3.0, // 3 feet total drop triggers 10' posts
  
  // Slope classification buckets (grade percentages)
  LEVEL_MAX_GRADE: 0.02, // < 2%
  SLIGHT_MAX_GRADE: 0.05, // 2-5%
  MODERATE_MAX_GRADE: 0.10, // 5-10%
  HEAVY_MAX_GRADE: 0.15, // 10-15%
  // Extreme is > 15%
  
  // Level classification by drop (alternative criterion)
  LEVEL_MAX_DROP_INCHES: 6, // <= 6 inches is level regardless of grade
};

/**
 * Check if slope exists (meaningful drop)
 */
export function slopeExists(dropFt) {
  return Math.abs(dropFt) > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT;
}

/**
 * Check if direction flip is meaningful
 */
export function isSignificantDirectionFlip(prevSignedDrop, currSignedDrop) {
  const prevDir = Math.sign(prevSignedDrop);
  const currDir = Math.sign(currSignedDrop);
  
  // Direction changed AND at least one drop is meaningful
  return prevDir !== currDir && 
         (Math.abs(currSignedDrop) >= SLOPE_THRESHOLDS.DIRECTION_FLIP_FT ||
          Math.abs(prevSignedDrop) >= SLOPE_THRESHOLDS.DIRECTION_FLIP_FT);
}

/**
 * Determine slope direction label
 */
export function getSlopeDirection(signedDropFt) {
  if (Math.abs(signedDropFt) < SLOPE_THRESHOLDS.SLOPE_EXISTS_FT) return 'Flat';
  return signedDropFt > 0 ? 'Up' : 'Down';
}

/**
 * Check if run needs longer posts (Heavy/Extreme or configured threshold)
 */
export function needsLongerPosts(run, config = {}) {
  const upgradeOnAnySlope = config.UpgradePostsWhenAnySlope || false;
  
  // Global upgrade flag
  if (upgradeOnAnySlope && run.dropFt > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT) {
    return true;
  }
  
  // Severity-based: Heavy or Extreme
  if (run.mathSubRuns && run.mathSubRuns.length > 0) {
    const hasSteep = run.mathSubRuns.some(sr => 
      sr.slopeRangeLabel === 'Heavy' || sr.slopeRangeLabel === 'Extreme'
    );
    if (hasSteep) return true;
  }
  
  // Total drop threshold
  if (run.dropFt >= SLOPE_THRESHOLDS.POST_UPGRADE_DROP_FT) {
    return true;
  }
  
  return false;
}

/**
 * SINGLE SOURCE OF TRUTH: Check if slope exists on a run
 * Returns TRUE if slope detected from ANY source
 */
export function runHasSlope(run) {
  // Source 1: Direct dropFt measurement
  if (run.dropFt != null && run.dropFt > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT) {
    return true;
  }
  
  // Source 2: Start/End elevations
  if (run.startElevation != null && run.endElevation != null) {
    const drop = Math.abs(run.endElevation - run.startElevation);
    if (drop > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT) {
      return true;
    }
  }
  
  // Source 3: Math sub-runs with non-level slopes
  if (run.mathSubRuns && run.mathSubRuns.length > 0) {
    const hasSlope = run.mathSubRuns.some(sr => 
      sr.slopeRangeLabel && sr.slopeRangeLabel !== 'Level'
    );
    if (hasSlope) return true;
  }
  
  // Source 4: Grade points with meaningful drops
  if (run.gradePoints && run.gradePoints.length >= 2) {
    for (let i = 0; i < run.gradePoints.length - 1; i++) {
      const drop = Math.abs(run.gradePoints[i + 1].elevationFt - run.gradePoints[i].elevationFt);
      if (drop > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT) {
        return true;
      }
    }
  }
  
  return false;
}