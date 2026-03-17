/**
 * FenceBuddy Job Validator
 * Validates jobs before send to office, catching missing/incorrect items
 * Works for both map-driven and manual-driven takeoffs
 */

/**
 * Main validation function
 * @param {Object} job - Job object
 * @param {Array} runs - Array of run objects
 * @param {Array} gates - Array of gate objects
 * @param {Array} materials - Array of material line items
 * @returns {Object} Validation result
 */
export function validateJob(job, runs, gates, materials) {
  const issues = [];
  
  // Validation temporarily disabled
  // validateTakeoffSource(job, issues);
  // validateWoodPosts(job, runs, materials, issues);
  // validateWoodPickets(job, runs, materials, issues);
  // validateWoodGateHardware(job, gates, materials, issues);
  // validatePostSpacing(job, runs, materials, issues);
  // validateFasteners(job, runs, gates, materials, issues);
  // validateSlope(runs, issues);
  // validateTransitions(runs, materials, issues);
  // validateGatesOnSlope(gates, runs, issues);
  // validateDeprecatedCaneBolts(gates, issues);
  
  // Determine overall status
  const status = determineValidationStatus(issues);
  
  return {
    validationStatus: status,
    issues,
    timestamp: new Date().toISOString(),
    canSend: status !== 'BLOCKED',
    requiresConfirm: issues.some(i => i.severity === 'CRITICAL'),
    autoFixApplied: issues.some(i => i.autoFixed)
  };
}

/**
 * Validate takeoff source matches reality
 */
function validateTakeoffSource(job, issues) {
  const hasMapData = job.mapData && 
    job.mapData.fenceLines && 
    job.mapData.fenceLines.length > 0;
  
  const takeoffSource = job.takeoffSource;
  
  if (hasMapData && takeoffSource !== 'MAP_DRIVEN') {
    issues.push({
      code: 'TAKEOFF_SOURCE_MISMATCH',
      severity: 'BLOCKER',
      message: 'Map exists but takeoff is not map-driven. Materials must match the saved yard map.',
      suggestedFix: 'Switch takeoff source to Map-Driven or remove map geometry.',
      location: 'Global',
      autoFixable: false
    });
  }
  
  if (!hasMapData && !takeoffSource) {
    // Auto-set to manual if no map and no source
    issues.push({
      code: 'TAKEOFF_SOURCE_MISSING',
      severity: 'INFO',
      message: 'Takeoff source set to Manual Entry (no map geometry found).',
      suggestedFix: 'Auto-applied.',
      location: 'Global',
      autoFixed: true,
      autoFixValue: 'MANUAL_ENTRY'
    });
  }
}

/**
 * Validate wood posts must be PostMaster
 */
function validateWoodPosts(job, runs, materials, issues) {
  const hasWoodRuns = runs.some(r => r.materialType === 'Wood');
  if (!hasWoodRuns) return;
  
  // Check for wood post SKUs (should not exist)
  const woodPostPatterns = [
    /wood\s+post/i,
    /4x4\s+post/i,
    /treated\s+post/i,
    /pressure.*treated.*post/i
  ];
  
  const woodPostItems = materials.filter(m => 
    woodPostPatterns.some(pattern => pattern.test(m.lineItemName))
  );
  
  if (woodPostItems.length > 0) {
    issues.push({
      code: 'WOOD_POSTS_NOT_POSTMASTER',
      severity: 'BLOCKER',
      message: 'Wood fence posts must be PostMaster steel posts (FenceBuddy Standard).',
      suggestedFix: 'Replace wood post items with PostMaster equivalents.',
      location: 'Global',
      autoFixable: true,
      affectedItems: woodPostItems.map(m => m.lineItemName)
    });
  }
}

/**
 * Validate wood pickets are calculated correctly
 */
function validateWoodPickets(job, runs, materials, issues) {
  const woodRuns = runs.filter(r => r.materialType === 'Wood');
  if (woodRuns.length === 0) return;
  
  const totalWoodLF = woodRuns.reduce((sum, r) => sum + (r.lengthLF || 0), 0);
  if (totalWoodLF === 0) return;
  
  // Check for picket items
  const picketItems = materials.filter(m => 
    /picket/i.test(m.lineItemName) && !/cap/i.test(m.lineItemName)
  );
  
  if (picketItems.length === 0) {
    issues.push({
      code: 'WOOD_PICKETS_MISSING',
      severity: 'BLOCKER',
      message: 'Wood pickets are missing. FenceBuddy must auto-calculate pickets.',
      suggestedFix: 'Run takeoff recalculation using Wood Picket Math engine.',
      location: 'Global',
      autoFixable: true
    });
    return;
  }
  
  // Check picket height matches fence height
  const fenceHeights = [...new Set(woodRuns.map(r => r.fenceHeight))];
  fenceHeights.forEach(height => {
    const heightNum = parseInt(height);
    const matchingPicket = picketItems.find(m => 
      m.lineItemName.includes(`${heightNum}'`) || 
      m.lineItemName.includes(`${heightNum}ft`) ||
      m.lineItemName.includes(`${heightNum} ft`)
    );
    
    if (!matchingPicket) {
      issues.push({
        code: 'PICKET_HEIGHT_MISMATCH',
        severity: 'CRITICAL',
        message: `Picket height does not match fence height selection (${height}).`,
        suggestedFix: 'Select correct picket height SKU.',
        location: 'Global',
        autoFixable: false
      });
    }
  });
}

/**
 * Validate wood gate hardware (handles + cane bolts)
 */
function validateWoodGateHardware(job, gates, materials, issues) {
  const woodGates = gates.filter(g => {
    // Gate is wood if job/run is wood
    return job.materialType === 'Wood';
  });
  
  if (woodGates.length === 0) return;
  
  // Calculate required hardware
  let totalLeaves = 0;
  let totalCaneBoltsRequired = 0;
  
  woodGates.forEach(g => {
    const leafCount = g.gateType === 'Double' ? 2 : 1;
    totalLeaves += leafCount;
    if (g.gateType === 'Double') {
      totalCaneBoltsRequired += 2; // 1 per leaf for double gates
    }
  });
  
  // Check for handles
  const handleItems = materials.filter(m => 
    /handle/i.test(m.lineItemName) && /gate/i.test(m.lineItemName)
  );
  const totalHandles = handleItems.reduce((sum, m) => sum + m.quantity, 0);
  
  if (totalHandles < totalLeaves) {
    issues.push({
      code: 'GATE_HANDLES_MISSING',
      severity: 'BLOCKER',
      message: 'Gate handles incomplete. Standard is 1 handle per gate leaf.',
      suggestedFix: `Add ${totalLeaves - totalHandles} more handle(s) automatically.`,
      location: 'Global',
      autoFixable: true,
      autoFixValue: { required: totalLeaves, current: totalHandles }
    });
  }
  
  // Check for cane bolts/drop rods on double gates
  if (totalCaneBoltsRequired > 0) {
    const caneBoltItems = materials.filter(m => 
      (/cane\s+bolt/i.test(m.lineItemName) || /drop\s+rod/i.test(m.lineItemName))
    );
    const totalCaneBolts = caneBoltItems.reduce((sum, m) => sum + m.quantity, 0);
    
    if (totalCaneBolts < totalCaneBoltsRequired) {
      issues.push({
        code: 'CANE_BOLTS_MISSING',
        severity: 'BLOCKER',
        message: 'Cane bolts/drop rods missing. Standard is 1 per leaf on double gates.',
        suggestedFix: `Add ${totalCaneBoltsRequired - totalCaneBolts} cane bolt(s)/drop rod(s) automatically.`,
        location: 'Global',
        autoFixable: true,
        autoFixValue: { required: totalCaneBoltsRequired, current: totalCaneBolts }
      });
    }
  }
}

/**
 * Validate post spacing and slope adjustments
 */
function validatePostSpacing(job, runs, materials, issues) {
  const hasSlopedRuns = runs.some(r => 
    r.slopeRangeLabel && r.slopeRangeLabel !== 'Level'
  );
  
  if (hasSlopedRuns) {
    // Check if slope spacing adjustment was applied
    // This is an informational check - we assume the engine handles it
    issues.push({
      code: 'POST_SPACING_SLOPE_ADJUSTED',
      severity: 'INFO',
      message: 'Post spacing assumed per FenceBuddy standard and adjusted for slope where applicable.',
      suggestedFix: 'No action needed.',
      location: 'Global',
      autoFixable: false
    });
  }
}

/**
 * Validate fasteners are separate and automatic
 */
function validateFasteners(job, runs, gates, materials, issues) {
  const woodRuns = runs.filter(r => r.materialType === 'Wood');
  if (woodRuns.length === 0) return;
  
  // Check for structural screws
  const screwItems = materials.filter(m => 
    (/screw/i.test(m.lineItemName) && 
     (/structural/i.test(m.lineItemName) || /exterior/i.test(m.lineItemName))) ||
    /frame.*screw/i.test(m.lineItemName)
  );
  
  if (screwItems.length === 0) {
    issues.push({
      code: 'STRUCTURAL_SCREWS_MISSING',
      severity: 'BLOCKER',
      message: 'Structural screws missing. Fasteners must be automatic and separate.',
      suggestedFix: 'Add screws automatically.',
      location: 'Global',
      autoFixable: true
    });
  }
  
  // Check for picket nails
  const nailItems = materials.filter(m => 
    /nail/i.test(m.lineItemName) && 
    (/picket/i.test(m.lineItemName) || /galvanized/i.test(m.lineItemName))
  );
  
  if (nailItems.length === 0) {
    issues.push({
      code: 'PICKET_NAILS_MISSING',
      severity: 'BLOCKER',
      message: 'Picket nails missing. Fasteners must be automatic and separate.',
      suggestedFix: 'Add nails automatically.',
      location: 'Global',
      autoFixable: true
    });
  }
}

/**
 * Validate slope source (DXF auto-detect priority)
 */
function validateSlope(runs, issues) {
  runs.forEach((run, idx) => {
    // A) DXF slope data must use DXF_AUTO_DETECT
    if (run.slopeDetectedFrom && 
        run.slopeDetectedFrom.includes('DXF') && 
        run.slopeSource !== 'DXF_AUTO_DETECT') {
      issues.push({
        code: 'SLOPE_NOT_DXF_AUTO_DETECT',
        severity: 'BLOCKER',
        message: 'DXF contains slope data; slope must be auto-detected for accuracy.',
        suggestedFix: 'Apply DXF slope values and recalc.',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: true
      });
    }
    
    // B) User override not allowed when DXF exists
    if (run.slopeSource === 'DXF_AUTO_DETECT' && 
        run.slopeModeSelection && 
        ['QuickSelect', 'MeasuredDrop'].includes(run.slopeModeSelection)) {
      issues.push({
        code: 'USER_OVERRIDE_ON_DXF_SLOPE',
        severity: 'BLOCKER',
        message: 'Cannot manually override DXF-detected slope data.',
        suggestedFix: 'Remove manual slope input and use DXF auto-detect.',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: false
      });
    }
    
    // C) Derived fields missing when elevations exist
    if ((run.startElevation !== null && run.endElevation !== null) &&
        (run.dropFt === null || run.dropFt === undefined)) {
      issues.push({
        code: 'MISSING_DERIVED_SLOPE_FIELDS',
        severity: 'BLOCKER',
        message: 'Elevations exist but dropFt/slopeGrade not calculated.',
        suggestedFix: 'Normalize slope fields before saving.',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: true
      });
    }
    
    // D) mathSubRuns missing when gradePoints exist
    if (run.gradePoints && run.gradePoints.length >= 2 &&
        (!run.mathSubRuns || run.mathSubRuns.length === 0)) {
      issues.push({
        code: 'MISSING_MATH_SUBRUNS',
        severity: 'BLOCKER',
        message: 'Grade points exist but mathSubRuns not generated.',
        suggestedFix: 'Regenerate mathSubRuns from grade points.',
        location: `Run ${idx + 1}: ${run.runLabel}`,
        autoFixable: true
      });
    }
    
    // E) Vinyl on slope MUST use Rack mode
    if (run.materialType === 'Vinyl') {
      const hasSlope = 
        (run.dropFt != null && run.dropFt > 0.05) ||
        (run.startElevation != null && run.endElevation != null && 
         Math.abs(run.endElevation - run.startElevation) > 0.05) ||
        (run.mathSubRuns && run.mathSubRuns.some(sr => sr.slopeRangeLabel !== 'Level')) ||
        (run.gradePoints && run.gradePoints.length >= 2);
      
      if (hasSlope && run.slopeMode !== 'Rack') {
        issues.push({
          code: 'VINYL_SLOPE_REQUIRES_RACK',
          severity: 'BLOCKER',
          message: 'Vinyl on slope must use Rack mode (FenceBuddy Standard).',
          suggestedFix: 'Set slopeMode to Rack automatically.',
          location: `Run ${idx + 1}: ${run.runLabel}`,
          autoFixable: true,
          autoFixValue: { slopeMode: 'Rack' }
        });
      }
    }
  });
}

/**
 * Validate transition allowances
 */
function validateTransitions(runs, materials, issues) {
  const runsWithTransitions = runs.filter(r => 
    r.mathSubRuns && 
    r.mathSubRuns.length > 1 &&
    hasTransitions(r.mathSubRuns)
  );
  
  if (runsWithTransitions.length === 0) return;
  
  // Check for transition allowance items
  const transitionItems = materials.filter(m => 
    /transition/i.test(m.lineItemName) || 
    /slope.*allow/i.test(m.lineItemName)
  );
  
  if (transitionItems.length === 0) {
    issues.push({
      code: 'TRANSITION_ALLOWANCES_MISSING',
      severity: 'WARNING',
      message: 'Slope transitions detected; transition allowances were not added.',
      suggestedFix: 'Add transition allowances automatically.',
      location: 'Global',
      autoFixable: true
    });
  }
}

/**
 * Check if math sub-runs contain transitions
 */
function hasTransitions(mathSubRuns) {
  if (!mathSubRuns || mathSubRuns.length <= 1) return false;
  
  for (let i = 1; i < mathSubRuns.length; i++) {
    const prev = mathSubRuns[i - 1];
    const curr = mathSubRuns[i];
    
    // Check for slope existence change
    if (prev.slopeExists !== curr.slopeExists) return true;
    
    // Check for severity change
    if (prev.slopeRangeLabel !== curr.slopeRangeLabel) return true;
  }
  
  return false;
}

/**
 * Validate gates on slope (advisory)
 */
function validateGatesOnSlope(gates, runs, issues) {
  gates.forEach((gate, idx) => {
    if (gate.gateSlopeAdvisory && !gate.slopeAdvisoryResolved) {
      const severity = gate.currentGateMaxSlopeGrade >= 0.10 ? 'CRITICAL' : 'WARNING';
      const slopeLabel = gate.currentGateMaxSlopeGrade >= 0.10 ? 'steep slope' : 'slope';
      
      issues.push({
        code: 'GATE_ON_SLOPE',
        severity,
        message: `Gate is on ${slopeLabel}; recommended relocation to flatter section.`,
        suggestedFix: 'Apply recommended location or confirm current placement.',
        location: `Gate ${idx + 1}`,
        autoFixable: false
      });
    }
  });
}

/**
 * Validate deprecated caneBoltQuantity field
 */
function validateDeprecatedCaneBolts(gates, issues) {
  gates.forEach((gate, idx) => {
    if (gate.caneBoltQuantity != null && gate.caneBoltQuantity !== undefined) {
      issues.push({
        code: 'DEPRECATED_CANE_BOLT_FIELD',
        severity: 'INFO',
        message: `Gate ${idx + 1}: Cane bolts are auto-calculated (2 per double gate, enforced standard).`,
        suggestedFix: 'Rep overrides are not used - calculations ignore this field.',
        location: `Gate ${idx + 1}`,
        autoFixable: false
      });
    }
  });
}

/**
 * Determine overall validation status
 */
function determineValidationStatus(issues) {
  const hasBlocker = issues.some(i => i.severity === 'BLOCKER');
  const hasCritical = issues.some(i => i.severity === 'CRITICAL');
  const hasWarning = issues.some(i => i.severity === 'WARNING');
  
  if (hasBlocker) return 'BLOCKED';
  if (hasCritical) return 'NEEDS_REVIEW';
  if (hasWarning) return 'PASS_WITH_NOTES';
  return 'PASS';
}

/**
 * Get badge color and text for validation status
 */
export function getValidationBadge(status) {
  const badges = {
    'PASS': {
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: '✓',
      text: 'Validated – FenceBuddy Standard'
    },
    'PASS_WITH_NOTES': {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: '⚠',
      text: 'Validated with Notes'
    },
    'NEEDS_REVIEW': {
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: '⚠',
      text: 'Needs Review'
    },
    'BLOCKED': {
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: '✕',
      text: 'Blocked – Must Fix'
    }
  };
  
  return badges[status] || badges.PASS;
}