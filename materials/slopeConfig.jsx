/**
 * FenceBuddy Slope Configuration - SINGLE SOURCE OF TRUTH
 * All slope thresholds, classification rules, and adjustment factors
 * Used by: RunForm, mathSubRunEngine, gateSlopeAnalyzer, validation, materials
 */

export const SLOPE_CONFIG = {
  // === CORE DETECTION THRESHOLDS ===
  slopeExistsDropFtThreshold: 0.05,     // 0.6" - minimum drop to consider slope present
  gateAdvisoryGradeThreshold: 0.02,     // 2% grade - gate placement advisory trigger
  directionFlipDropThreshold: 0.30,     // 3.6" - significant direction change (uphill/downhill)
  
  // === SLOPE CLASSIFICATION BUCKETS ===
  bucketRules: {
    levelMaxDropIn: 6,                  // <= 6" drop = Level
    levelMaxGrade: 0.02,                // < 2% grade = Level
    slightMaxGrade: 0.05,               // < 5% grade = Slight
    moderateMaxGrade: 0.10,             // < 10% grade = Moderate
    heavyMaxGrade: 0.15,                // < 15% grade = Heavy
    // else Extreme
  },
  
  // === POST SPACING OPTIMIZATION ===
  // Tighten spacing only where slope exists (using mathSubRuns)
  postSpacingMultipliers: {
    Level: 1.00,                        // 8' spacing (no adjustment)
    Slight: 0.90,                       // 7.2' spacing (10% tighter)
    Moderate: 0.85,                     // 6.8' spacing (15% tighter)
    Heavy: 0.80,                        // 6.4' spacing (20% tighter)
    Extreme: 0.75,                      // 6' spacing (25% tighter)
  },
  
  // === BASE SPACING BY MATERIAL ===
  baseSpacing: {
    Vinyl: 8,                           // 8' panel width
    Wood: 8,                            // 8' bay standard
    Aluminum: 6,                        // 6' panel width
    'Chain Link': 10,                   // 10' line post spacing
  },
  
  // === WASTE/BUFFER FACTORS ===
  woodSlopeWasteFactor: 1.10,           // +10% for pickets/rails on slope
  gateWasteFactor: 1.10,                // +10% for gate hardware on slope
  
  // === VINYL RACK ENFORCEMENT ===
  vinylRackThreshold: 0.05,             // Vinyl MUST use Rack mode if drop >= 0.6"
};

/**
 * Helper: Check if slope exists using centralized threshold
 */
export function slopeExists(run, mathSubRuns = null) {
  const config = SLOPE_CONFIG;
  
  // Check 1: dropFt directly
  if (run.dropFt != null && run.dropFt >= config.slopeExistsDropFtThreshold) {
    return true;
  }
  
  // Check 2: elevations
  if (run.startElevation != null && run.endElevation != null) {
    const dropFt = Math.abs(run.endElevation - run.startElevation);
    if (dropFt >= config.slopeExistsDropFtThreshold) {
      return true;
    }
  }
  
  // Check 3: mathSubRuns (any non-Level segment)
  if (mathSubRuns && mathSubRuns.length > 0) {
    return mathSubRuns.some(sr => sr.slopeRangeLabel !== 'Level');
  }
  
  // Check 4: gradePoints (significant elevation change)
  if (run.gradePoints && run.gradePoints.length >= 2) {
    for (let i = 1; i < run.gradePoints.length; i++) {
      const dropFt = Math.abs(run.gradePoints[i].elevationFt - run.gradePoints[i - 1].elevationFt);
      if (dropFt >= config.slopeExistsDropFtThreshold) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Helper: Classify slope grade into bucket
 */
export function classifySlopeGrade(dropFt, horizontalRunFt) {
  const config = SLOPE_CONFIG;
  
  if (!dropFt || !horizontalRunFt || horizontalRunFt === 0) {
    return 'Level';
  }
  
  const dropInches = dropFt * 12;
  const slopeGrade = dropFt / horizontalRunFt;
  
  // Level: <= 6" drop AND < 2% grade
  if (dropInches <= config.bucketRules.levelMaxDropIn && slopeGrade < config.bucketRules.levelMaxGrade) {
    return 'Level';
  }
  
  // Slight: < 5% grade
  if (slopeGrade < config.bucketRules.slightMaxGrade) {
    return 'Slight';
  }
  
  // Moderate: < 10% grade
  if (slopeGrade < config.bucketRules.moderateMaxGrade) {
    return 'Moderate';
  }
  
  // Heavy: < 15% grade
  if (slopeGrade < config.bucketRules.heavyMaxGrade) {
    return 'Heavy';
  }
  
  // Extreme: >= 15% grade
  return 'Extreme';
}

/**
 * Helper: Get effective post spacing for a slope severity
 */
export function getEffectiveSpacing(materialType, slopeRangeLabel) {
  const config = SLOPE_CONFIG;
  const baseSpacing = config.baseSpacing[materialType] || 8;
  const multiplier = config.postSpacingMultipliers[slopeRangeLabel] || 1.0;
  return baseSpacing * multiplier;
}

/**
 * Calculate bays for a run using mathSubRuns (slope-aware spacing)
 * Returns: { totalBays, details }
 */
export function calculateBaysFromMathSubRuns(run) {
  const config = SLOPE_CONFIG;
  const materialType = run.materialType || 'Vinyl';
  const baseSpacing = config.baseSpacing[materialType] || 8;
  
  // No mathSubRuns or all Level: use standard spacing
  if (!run.mathSubRuns || run.mathSubRuns.length === 0) {
    const standardBays = Math.ceil(run.lengthLF / baseSpacing);
    return {
      totalBays: standardBays,
      details: `Standard spacing: ${baseSpacing}' = ${standardBays} bays`,
      baseSpacing,
      usedMathSubRuns: false
    };
  }
  
  // Check if all subruns are Level
  const allLevel = run.mathSubRuns.every(sr => sr.slopeRangeLabel === 'Level');
  if (allLevel) {
    const standardBays = Math.ceil(run.lengthLF / baseSpacing);
    return {
      totalBays: standardBays,
      details: `All level: ${baseSpacing}' spacing = ${standardBays} bays`,
      baseSpacing,
      usedMathSubRuns: false
    };
  }
  
  // Calculate bays per subrun with adjusted spacing
  let totalBays = 0;
  const subrunDetails = [];
  
  run.mathSubRuns.forEach(sr => {
    const multiplier = config.postSpacingMultipliers[sr.slopeRangeLabel] || 1.0;
    const effectiveSpacing = baseSpacing * multiplier;
    const segmentBays = Math.ceil(sr.horizontalLen_ft / effectiveSpacing);
    
    totalBays += segmentBays;
    subrunDetails.push({
      range: sr.slopeRangeLabel,
      length: sr.horizontalLen_ft,
      spacing: effectiveSpacing.toFixed(1),
      bays: segmentBays
    });
  });
  
  return {
    totalBays,
    details: `Slope-adjusted: ${subrunDetails.map(d => `${d.range}@${d.spacing}'`).join(', ')} = ${totalBays} bays`,
    baseSpacing,
    usedMathSubRuns: true,
    subrunDetails
  };
}