/**
 * Math Sub-Run Engine
 * Automatically splits visible runs into internal calculation sub-runs based on slope changes
 * Sub-runs are HIDDEN from UI but used for accurate material calculations
 */

import { SLOPE_CONFIG, classifySlopeGrade as classifySlope } from './slopeConfig';
import { SLOPE_THRESHOLDS, getSlopeDirection } from './slopeThresholds';

/**
 * Classify slope grade into bucket - DELEGATED TO CENTRALIZED CONFIG
 */
function classifySlopeGrade(segmentDrop_ft, segmentLength_ft) {
  const label = classifySlope(segmentDrop_ft, segmentLength_ft);
  const segmentGrade = segmentLength_ft > 0 ? segmentDrop_ft / segmentLength_ft : 0;
  const segmentDrop_in = segmentDrop_ft * 12;
  
  // Map label to bucket letter (legacy compatibility)
  const bucketMap = {
    'Level': 'A',
    'Slight': 'B',
    'Moderate': 'C',
    'Heavy': 'D',
    'Extreme': 'E'
  };
  
  return { 
    bucket: bucketMap[label] || 'A', 
    label, 
    grade: segmentGrade, 
    drop_in: segmentDrop_in 
  };
}

/**
 * Generate math sub-runs from grade points or elevation data
 * @param {Object} run - The visible run object
 * @returns {Array} Array of math sub-runs (hidden from UI)
 */
export function generateMathSubRuns(run) {
  // No sub-runs if no slope data exists
  if (!run.gradePoints || run.gradePoints.length < 2) {
    // Check if we have start/end elevation
    if (run.startElevation !== undefined && run.endElevation !== undefined && 
        run.startElevation !== null && run.endElevation !== null) {
      // Single sub-run from start/end elevation
      const signedDrop = run.endElevation - run.startElevation;
      const dropFt = Math.abs(signedDrop);
      const horizontalLen = run.horizontalRunFt || run.lengthLF;
      const grade = horizontalLen > 0 ? dropFt / horizontalLen : 0;
      const classification = classifySlopeGrade(dropFt, horizontalLen);
      const direction = getSlopeDirection(signedDrop);
      
      return [{
        startDistance_ft: 0,
        endDistance_ft: horizontalLen,
        horizontalLen_ft: horizontalLen,
        signedDrop_ft: signedDrop,
        drop_ft: dropFt,
        slopeGrade: grade,
        slopeRangeLabel: classification.label,
        slopeDirection: direction,
        slopeExists: dropFt > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT
      }];
    }
    
    // No slope data - return empty or single level sub-run
    return [];
  }
  
  const gradePoints = [...run.gradePoints].sort((a, b) => a.distanceFt - b.distanceFt);
  
  // Add start point if not present
  if (gradePoints[0].distanceFt > 0) {
    gradePoints.unshift({
      distanceFt: 0,
      elevationFt: run.startElevation || gradePoints[0].elevationFt
    });
  }
  
  // Add end point if not present
  const totalLength = run.horizontalRunFt || run.lengthLF;
  if (gradePoints[gradePoints.length - 1].distanceFt < totalLength) {
    gradePoints.push({
      distanceFt: totalLength,
      elevationFt: run.endElevation || gradePoints[gradePoints.length - 1].elevationFt
    });
  }
  
  // Create segments between grade points
  const segments = [];
  for (let i = 0; i < gradePoints.length - 1; i++) {
    const start = gradePoints[i];
    const end = gradePoints[i + 1];
    
    const segmentLength = end.distanceFt - start.distanceFt;
    const signedDrop = end.elevationFt - start.elevationFt; // SIGNED
    const segmentDrop = Math.abs(signedDrop); // ABSOLUTE
    const direction = getSlopeDirection(signedDrop);
    
    const classification = classifySlopeGrade(segmentDrop, segmentLength);
    
    segments.push({
      startDistance_ft: start.distanceFt,
      endDistance_ft: end.distanceFt,
      horizontalLen_ft: segmentLength,
      signedDrop_ft: signedDrop,
      drop_ft: segmentDrop,
      slopeGrade: classification.grade,
      slopeRangeLabel: classification.label,
      slopeExists: segmentDrop > SLOPE_THRESHOLDS.SLOPE_EXISTS_FT,
      slopeDirection: direction,
      bucket: classification.bucket
    });
  }
  
  // Merge adjacent segments with same bucket and direction
  const mathSubRuns = [];
  let currentSubRun = { ...segments[0] };
  
  for (let i = 1; i < segments.length; i++) {
    const prevSeg = segments[i - 1];
    const currSeg = segments[i];
    
    // Check if bucket changed
    const bucketChanged = prevSeg.bucket !== currSeg.bucket;
    
    // Check if direction flipped significantly
    const directionFlipped = prevSeg.slopeDirection !== currSeg.slopeDirection && 
                             (Math.abs(currSeg.signedDrop_ft) >= SLOPE_THRESHOLDS.DIRECTION_FLIP_FT ||
                              Math.abs(prevSeg.signedDrop_ft) >= SLOPE_THRESHOLDS.DIRECTION_FLIP_FT);
    
    if (bucketChanged || directionFlipped) {
      // Complete current sub-run - keep slopeDirection
      delete currentSubRun.bucket;
      mathSubRuns.push(currentSubRun);
      
      // Start new sub-run
      currentSubRun = { ...currSeg };
    } else {
      // Merge into current sub-run
      currentSubRun.endDistance_ft = currSeg.endDistance_ft;
      currentSubRun.horizontalLen_ft += currSeg.horizontalLen_ft;
      currentSubRun.signedDrop_ft += currSeg.signedDrop_ft;
      currentSubRun.drop_ft += currSeg.drop_ft;
      currentSubRun.slopeGrade = currentSubRun.horizontalLen_ft > 0 ? 
        currentSubRun.drop_ft / currentSubRun.horizontalLen_ft : 0;
      
      // Re-classify merged sub-run
      const newClassification = classifySlopeGrade(currentSubRun.drop_ft, currentSubRun.horizontalLen_ft);
      currentSubRun.slopeRangeLabel = newClassification.label;
      currentSubRun.bucket = newClassification.bucket;
      
      // Update direction based on net signed drop
      currentSubRun.slopeDirection = getSlopeDirection(currentSubRun.signedDrop_ft);
    }
  }
  
  // Add final sub-run - keep slopeDirection
  delete currentSubRun.bucket;
  mathSubRuns.push(currentSubRun);
  
  return mathSubRuns;
}

/**
 * Check if a run has varying slope (multiple sub-runs with different slopes)
 */
export function hasVaryingSlope(run) {
  if (!run.mathSubRuns || run.mathSubRuns.length <= 1) return false;
  
  const uniqueRanges = new Set(run.mathSubRuns.map(sr => sr.slopeRangeLabel));
  return uniqueRanges.size > 1;
}

/**
 * Get dominant slope for display (most common range across sub-runs)
 */
export function getDominantSlope(run) {
  if (!run.mathSubRuns || run.mathSubRuns.length === 0) {
    return run.slopeRangeLabel || 'Level';
  }
  
  // Count by range and weighted by length
  const rangeLengths = {};
  run.mathSubRuns.forEach(sr => {
    const range = sr.slopeRangeLabel || 'Level';
    rangeLengths[range] = (rangeLengths[range] || 0) + sr.horizontalLen_ft;
  });
  
  // Return range with most length
  let maxLength = 0;
  let dominantRange = 'Level';
  Object.entries(rangeLengths).forEach(([range, length]) => {
    if (length > maxLength) {
      maxLength = length;
      dominantRange = range;
    }
  });
  
  return dominantRange;
}