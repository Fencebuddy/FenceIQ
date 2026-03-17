/**
 * Gate Slope Analyzer
 * Detects if gates are placed in sloped zones and recommends flatter locations
 */

/**
 * Analyze gate placement on slope
 * @param {Object} gate - Gate object with width and center distance
 * @param {Object} run - Run object with mathSubRuns
 * @returns {Object} Analysis result with advisory if needed
 */
export function analyzeGateSlopePlacement(gate, run) {
  // If no math sub-runs exist, gate is fine
  if (!run.mathSubRuns || run.mathSubRuns.length === 0) {
    return {
      isSloped: false,
      advisory: false
    };
  }
  
  // Use numeric gate width (gateWidth_ft), fallback to parsing string for legacy data
  const gateWidthFt = gate.gateWidth_ft || parseFloat(gate.gateWidth?.replace(/'/g, '')) || 0;
  const gateCenterFt = gate.gateCenterDistance_ft || (run.lengthLF / 2); // Default to mid-run if not set
  
  // Calculate gate span
  const gateSpanStart = gateCenterFt - (gateWidthFt / 2);
  const gateSpanEnd = gateCenterFt + (gateWidthFt / 2);
  
  // Find intersecting sub-runs
  const intersectingSubRuns = run.mathSubRuns.filter(sr => {
    return !(sr.endDistance_ft < gateSpanStart || sr.startDistance_ft > gateSpanEnd);
  });
  
  if (intersectingSubRuns.length === 0) {
    return {
      isSloped: false,
      advisory: false
    };
  }
  
  // Calculate gate slope metrics
  const gateMaxSlopeGrade = Math.max(...intersectingSubRuns.map(sr => sr.slopeGrade || 0));
  const gateSlopeRangeLabel = getHighestSeverityLabel(intersectingSubRuns.map(sr => sr.slopeRangeLabel));
  
  // Define if gate is sloped (>2% grade)
  const gateIsSloped = gateMaxSlopeGrade >= 0.02;
  
  if (!gateIsSloped) {
    return {
      isSloped: false,
      advisory: false,
      currentMaxGrade: gateMaxSlopeGrade,
      currentSlopeLabel: gateSlopeRangeLabel
    };
  }
  
  // Search for better location
  const recommendation = findFlattest20ftWindow(
    gateCenterFt,
    gateWidthFt,
    run.mathSubRuns,
    run.lengthLF
  );
  
  // Determine if relocation is recommended
  const gradeDelta = gateMaxSlopeGrade - recommendation.maxGrade;
  const shouldRecommend = gradeDelta >= 0.02 || 
    (getSeverityRank(gateSlopeRangeLabel) >= 3 && getSeverityRank(recommendation.slopeLabel) <= 2);
  
  if (!shouldRecommend) {
    return {
      isSloped: true,
      advisory: false,
      currentMaxGrade: gateMaxSlopeGrade,
      currentSlopeLabel: gateSlopeRangeLabel
    };
  }
  
  return {
    isSloped: true,
    advisory: true,
    currentMaxGrade: gateMaxSlopeGrade,
    currentSlopeLabel: gateSlopeRangeLabel,
    recommendedCenter_ft: recommendation.centerFt,
    recommendedMaxGrade: recommendation.maxGrade,
    recommendedSlopeLabel: recommendation.slopeLabel,
    isExtreme: getSeverityRank(gateSlopeRangeLabel) >= 4 // Heavy or Extreme
  };
}

/**
 * Find the flattest location within 20ft window
 */
function findFlattest20ftWindow(currentCenter, gateWidth, mathSubRuns, runLength) {
  const searchStart = Math.max(gateWidth / 2, currentCenter - 10);
  const searchEnd = Math.min(runLength - (gateWidth / 2), currentCenter + 10);
  
  let bestCandidate = {
    centerFt: currentCenter,
    maxGrade: Infinity,
    slopeLabel: 'Extreme'
  };
  
  // Test candidates every 1 ft
  for (let c = searchStart; c <= searchEnd; c += 1) {
    const spanStart = c - (gateWidth / 2);
    const spanEnd = c + (gateWidth / 2);
    
    // Find intersecting sub-runs
    const intersecting = mathSubRuns.filter(sr => {
      return !(sr.endDistance_ft < spanStart || sr.startDistance_ft > spanEnd);
    });
    
    if (intersecting.length === 0) continue;
    
    const maxGrade = Math.max(...intersecting.map(sr => sr.slopeGrade || 0));
    const slopeLabel = getHighestSeverityLabel(intersecting.map(sr => sr.slopeRangeLabel));
    
    // Check if better (flatter)
    if (maxGrade < bestCandidate.maxGrade) {
      bestCandidate = {
        centerFt: c,
        maxGrade,
        slopeLabel
      };
    } else if (maxGrade === bestCandidate.maxGrade) {
      // Tie - choose closer to original
      const distToCurrent = Math.abs(c - currentCenter);
      const distBestToCurrent = Math.abs(bestCandidate.centerFt - currentCenter);
      if (distToCurrent < distBestToCurrent) {
        bestCandidate = {
          centerFt: c,
          maxGrade,
          slopeLabel
        };
      }
    }
  }
  
  return bestCandidate;
}

/**
 * Get highest severity label from array
 */
function getHighestSeverityLabel(labels) {
  const severityMap = {
    'Level': 1,
    'Slight': 2,
    'Moderate': 3,
    'Heavy': 4,
    'Extreme': 5
  };
  
  let highest = 'Level';
  let highestRank = 0;
  
  labels.forEach(label => {
    const rank = severityMap[label] || 0;
    if (rank > highestRank) {
      highestRank = rank;
      highest = label;
    }
  });
  
  return highest;
}

/**
 * Get severity rank (1-5)
 */
function getSeverityRank(label) {
  const severityMap = {
    'Level': 1,
    'Slight': 2,
    'Moderate': 3,
    'Heavy': 4,
    'Extreme': 5
  };
  return severityMap[label] || 0;
}