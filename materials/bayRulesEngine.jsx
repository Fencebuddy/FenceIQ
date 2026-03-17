/**
 * FenceBuddy Bay Rules Engine v1.0.0
 * Formal implementation of bay-based material calculations
 */

// ✅ GLOBALS
const MAX_BAY_LENGTH_FT = 7.5;
const RAILS_PER_BAY = 3;
const RAIL_SCREWS_PER_RAIL = 4;
const DEFAULT_GATE_FRAME_RAILS_SINGLE = 3;
const DEFAULT_GATE_FRAME_RAILS_DOUBLE = 6;

/**
 * ✅ ELIGIBILITY FILTER
 * Returns only runs that should be included in takeoff
 */
export function getEligibleRuns(runs) {
  return runs.filter(run => {
    // Status must be 'new'
    const status = run.runStatus || (run.isExisting ? 'existing' : 'new');
    if (status !== 'new') return false;
    
    // Must have valid length
    if (!run.lengthLF || run.lengthLF <= 0) return false;
    
    // Must not be explicitly excluded
    if (run.includeInCalculation === false) return false;
    
    // Must have fence system assigned (material type)
    if (!run.materialType) return false;
    
    // Must be visible and not deleted (if these fields exist)
    if (run.isDeleted === true) return false;
    if (run.isVisible === false) return false;
    if (run.isHelper === true) return false;
    if (run.isBoundary === true) return false;
    if (run.isTemp === true) return false;
    
    return true;
  });
}

/**
 * ✅ RUN SEGMENTATION
 * Splits run into fence segments and gate segments
 */
export function segmentRun(run, gates) {
  const runLengthFt = run.lengthLF;
  // Match gates by runId OR by assignedRunId (fence line assignment)
  const runGates = gates.filter(g => {
    if (g.runId === run.id) return true;
    if (run.assignedRunId && g.runId === run.assignedRunId) return true;
    return false;
  });
  
  if (runGates.length === 0) {
    return {
      fenceSegments: [{ start: 0, end: runLengthFt, lengthFt: runLengthFt }],
      gateSegments: []
    };
  }
  
  // Build gate intervals
  const gateIntervals = runGates.map(gate => {
    const widthFt = gate.gateWidth_ft || parseFloat(gate.gateWidth?.replace(/'/g, '')) || 0;
    const centerFt = gate.gateCenterDistance_ft || (runLengthFt / 2);
    const start = Math.max(0, centerFt - widthFt / 2);
    const end = Math.min(runLengthFt, centerFt + widthFt / 2);
    return { start, end, widthFt: end - start, gate };
  }).sort((a, b) => a.start - b.start);
  
  // Build fence and gate segments
  const fenceSegments = [];
  const gateSegments = [];
  let currentPos = 0;
  
  gateIntervals.forEach(interval => {
    // Fence segment before this gate
    if (interval.start > currentPos) {
      fenceSegments.push({
        start: currentPos,
        end: interval.start,
        lengthFt: interval.start - currentPos
      });
    }
    
    // Gate segment
    gateSegments.push({
      start: interval.start,
      end: interval.end,
      lengthFt: interval.widthFt,
      gate: interval.gate
    });
    
    currentPos = interval.end;
  });
  
  // Final fence segment after last gate
  if (currentPos < runLengthFt) {
    fenceSegments.push({
      start: currentPos,
      end: runLengthFt,
      lengthFt: runLengthFt - currentPos
    });
  }
  
  return { fenceSegments, gateSegments };
}

/**
 * ✅ BAY CALCULATION
 * Returns bay count for a fence segment
 */
export function calculateBaysForSegment(segmentLengthFt) {
  if (segmentLengthFt <= 0) return 0;
  return Math.ceil(segmentLengthFt / MAX_BAY_LENGTH_FT);
}

/**
 * ✅ POST CALCULATION (BAY-BASED)
 * Returns posts needed for a run with proper bay logic
 */
export function calculatePostsForRun(run, gates) {
  const { fenceSegments, gateSegments } = segmentRun(run, gates);
  
  // End posts: 2 per run
  const endPosts = 2;
  
  // Gate posts: 2 per gate opening
  const gatePosts = gateSegments.length * 2;
  
  // Line posts: Based on bays in fence spans
  // A fence span is a segment between structural posts
  // Each span needs (bays - 1) additional posts
  let linePosts = 0;
  fenceSegments.forEach(segment => {
    const bays = calculateBaysForSegment(segment.lengthFt);
    linePosts += Math.max(0, bays - 1);
  });
  
  const totalPosts = endPosts + gatePosts + linePosts;
  
  return {
    endPosts,
    gatePosts,
    linePosts,
    totalPosts,
    breakdown: `${endPosts} end + ${gatePosts} gate + ${linePosts} line = ${totalPosts}`
  };
}

/**
 * ✅ RAIL CALCULATION (BAY-BASED)
 * Returns rails needed for a run
 */
export function calculateRailsForRun(run, gates, style = 'Privacy') {
  const { fenceSegments, gateSegments } = segmentRun(run, gates);
  
  // Calculate total fence bays
  let totalFenceBays = 0;
  fenceSegments.forEach(segment => {
    totalFenceBays += calculateBaysForSegment(segment.lengthFt);
  });
  
  // Rails per bay (3 standard, 4 for Board-on-Board)
  const railsPerBay = style === 'Board-on-Board' ? 4 : RAILS_PER_BAY;
  const fenceRails = totalFenceBays * railsPerBay;
  
  // Gate frame rails (counted separately)
  let gateFrameRails = 0;
  gateSegments.forEach(segment => {
    if (segment.gate.frameRailsCount) {
      gateFrameRails += segment.gate.frameRailsCount;
    } else {
      // Default based on gate type
      const gateType = segment.gate.gateType || 'Single';
      gateFrameRails += gateType === 'Double' ? DEFAULT_GATE_FRAME_RAILS_DOUBLE : DEFAULT_GATE_FRAME_RAILS_SINGLE;
    }
  });
  
  return {
    fenceRails,
    gateFrameRails,
    totalRails: fenceRails + gateFrameRails,
    totalFenceBays,
    breakdown: `${totalFenceBays} bays × ${railsPerBay} + ${gateFrameRails} gate = ${fenceRails + gateFrameRails}`
  };
}

/**
 * ✅ RAIL SCREW CALCULATION (LOCKED)
 * 4 screws per rail (fence + gate frame)
 */
export function calculateRailScrews(fenceRails, gateFrameRails) {
  const totalRails = fenceRails + gateFrameRails;
  const totalScrews = totalRails * RAIL_SCREWS_PER_RAIL;
  
  return {
    totalScrews,
    breakdown: `${totalRails} rails × ${RAIL_SCREWS_PER_RAIL} = ${totalScrews}`
  };
}

/**
 * ✅ PICKET CALCULATION (NO-GAP)
 * Based on fence footage only (excludes gate openings)
 */
export function calculatePicketsForRun(run, gates, picketWidthIn = 5.5) {
  const { fenceSegments } = segmentRun(run, gates);
  
  const fenceFootageFt = fenceSegments.reduce((sum, seg) => sum + seg.lengthFt, 0);
  const fenceFootageIn = fenceFootageFt * 12;
  const picketCount = Math.ceil(fenceFootageIn / picketWidthIn);
  
  return {
    fenceFootageFt,
    picketCount,
    breakdown: `${fenceFootageFt.toFixed(1)} ft × 12 ÷ ${picketWidthIn} = ${picketCount}`
  };
}

/**
 * ✅ POSTMASTER SYSTEM CHECK
 * Returns true if system uses driven posts (no concrete)
 */
export function isPostMasterSystem(materialType) {
  return materialType === 'Wood'; // PostMaster is default for Wood
}

/**
 * ✅ CONCRETE CALCULATION
 * Returns 0 for PostMaster, otherwise 2 bags per post
 */
export function calculateConcrete(totalPosts, materialType) {
  if (isPostMasterSystem(materialType)) {
    return {
      bags: 0,
      breakdown: 'PostMaster driven posts - no concrete required'
    };
  }
  
  const bags = totalPosts * 2;
  return {
    bags,
    breakdown: `${totalPosts} posts × 2 = ${bags} bags`
  };
}

/**
 * ✅ ROLLUP CALCULATION
 * Aggregates all runs into final totals
 */
export function calculateRollup(eligibleRuns, allGates, materialType, style) {
  let totalFenceFootageFt = 0;
  let totalPosts = 0;
  let totalFenceRails = 0;
  let totalGateFrameRails = 0;
  let totalPickets = 0;
  let totalConcreteBags = 0;
  
  const runDetails = [];
  
  eligibleRuns.forEach(run => {
    // Match gates by runId OR by assignedRunId (fence line assignment)
    const runGates = allGates.filter(g => {
      if (g.runId === run.id) return true;
      if (run.assignedRunId && g.runId === run.assignedRunId) return true;
      return false;
    });
    
    // Posts
    const posts = calculatePostsForRun(run, runGates);
    totalPosts += posts.totalPosts;
    
    // Rails
    const rails = calculateRailsForRun(run, runGates, style);
    totalFenceRails += rails.fenceRails;
    totalGateFrameRails += rails.gateFrameRails;
    
    // Pickets
    const pickets = calculatePicketsForRun(run, runGates);
    totalFenceFootageFt += pickets.fenceFootageFt;
    totalPickets += pickets.picketCount;
    
    runDetails.push({
      runId: run.id,
      runLabel: run.runLabel,
      posts: posts.totalPosts,
      bays: rails.totalFenceBays,
      rails: rails.totalRails,
      pickets: pickets.picketCount,
      fenceFootageFt: pickets.fenceFootageFt
    });
  });
  
  // Concrete
  const concrete = calculateConcrete(totalPosts, materialType);
  totalConcreteBags = concrete.bags;
  
  // Rail screws
  const railScrews = calculateRailScrews(totalFenceRails, totalGateFrameRails);
  
  return {
    fenceFootageFt: totalFenceFootageFt,
    postCount: totalPosts,
    railCount: totalFenceRails,
    gateFrameRailCount: totalGateFrameRails,
    railScrewCount: railScrews.totalScrews,
    picketCount: totalPickets,
    concreteBags: totalConcreteBags,
    runDetails
  };
}