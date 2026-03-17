// Compliance Confidence Scorer

/**
 * Score to level mapping
 */
function scoreToLevel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate job-level confidence score
 */
export function calculateJobConfidence(job, runs, mergedRules) {
  let score = 0;
  const reasons = [];
  const checklist = [];

  // 1) Parcel status/source (40 points max)
  if (job.parcel_fetch_status === 'OK' && job.parcel_source?.includes('ArcGIS')) {
    score += 40;
    reasons.push('Parcel loaded from public GIS');
  } else if (job.parcel_source === 'Manual') {
    score += 20;
    reasons.push('Property line set manually');
    checklist.push('Confirm manually drawn boundary matches legal parcel');
  } else {
    reasons.push('No parcel boundary available');
    checklist.push('Confirm property lines with survey/markers');
  }

  // 2) Jurisdiction rules (20 points max)
  if (mergedRules && job.county && job.jurisdictionName) {
    score += 20;
    reasons.push('Jurisdiction rules loaded');
  } else if (mergedRules && job.county) {
    score += 10;
    reasons.push('County rules loaded');
  } else {
    score += 5;
    reasons.push('Using default guidance only');
    checklist.push('Confirm permitting + height rules with local zoning');
  }

  // 3) Run validation (-35 points for outside, -15 for near edge)
  const runsOutside = runs.filter(r => r.validation_status === 'WARN_OUTSIDE_PARCEL');
  const runsNearEdge = runs.filter(r => r.validation_status === 'WARN_NEAR_EDGE');

  if (runsOutside.length > 0) {
    score -= 35;
    reasons.push(`${runsOutside.length} run(s) extend outside property lines`);
    checklist.push('Adjust runs or verify encroachment/ROW');
  } else if (runsNearEdge.length > 0) {
    score -= 15;
    reasons.push(`${runsNearEdge.length} run(s) near property line`);
    checklist.push('Verify boundary and ROW/easements before install');
  }

  // 4) Boundary/ROW risk (-25 high risk, -10 near)
  const runsHighRisk = runs.filter(r => r.boundary_risk_status === 'WARN_LIKELY_ROW_RISK');
  const runsNearBoundary = runs.filter(r => r.boundary_risk_status === 'WARN_NEAR_BOUNDARY');

  if (runsHighRisk.length > 0) {
    score -= 25;
    reasons.push(`${runsHighRisk.length} run(s) with high ROW/easement risk`);
    checklist.push('Verify boundary and ROW/easements before install');
  } else if (runsNearBoundary.length > 0) {
    score -= 10;
    reasons.push(`${runsNearBoundary.length} run(s) close to boundary`);
  }

  // 5) Height compliance (-20 too tall, -10 unknown)
  const runsTooTall = runs.filter(r => r.height_compliance_status === 'WARN_TOO_TALL');
  const runsUnknownZone = runs.filter(r => r.height_compliance_status === 'UNKNOWN_ZONE');

  if (runsTooTall.length > 0) {
    score -= 20;
    reasons.push(`${runsTooTall.length} run(s) exceed typical height limits`);
    checklist.push('Verify allowable height/setbacks for the yard zone');
  } else if (runsUnknownZone.length > 0) {
    score -= 10;
    reasons.push(`${runsUnknownZone.length} run(s) missing yard zone/height`);
  }

  // 6) Vision triangle (-20 conflict, -5 enabled but not set)
  const runsInTriangle = runs.filter(r => r.vision_triangle_status === 'WARN_IN_TRIANGLE');
  
  if (runsInTriangle.length > 0) {
    score -= 20;
    reasons.push('Visibility triangle conflict detected');
    checklist.push('Verify clear vision area requirements near driveway/intersection');
  } else if (job.vision_triangle_enabled && !job.vision_triangle_polygon) {
    score -= 5;
    reasons.push('Visibility triangle enabled but not defined');
  }

  // Additional contextual checks
  if (job.sidewalkDetected) {
    checklist.push('Confirm sidewalk/ROW setbacks with jurisdiction');
  }

  if (job.poolDetected) {
    checklist.push('Confirm pool barrier + gate latch requirements');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  const level = scoreToLevel(score);
  const verifyNeeded = level !== 'HIGH' || checklist.length > 0;

  return {
    confidence_level: level,
    confidence_reasons: reasons,
    verify_needed: verifyNeeded,
    verify_checklist: checklist,
    score
  };
}

/**
 * Calculate run-level confidence score
 */
export function calculateRunConfidence(run, job) {
  let score = 100;
  const reasons = [];

  // No parcel available
  if (job.parcel_fetch_status !== 'OK') {
    score -= 20;
    reasons.push('No parcel boundary for validation');
  }

  // Validation issues
  if (run.validation_status === 'WARN_OUTSIDE_PARCEL') {
    score -= 40;
    reasons.push('Run extends outside property lines');
  } else if (run.validation_status === 'WARN_NEAR_EDGE') {
    score -= 20;
    reasons.push('Run near property edge');
  }

  // Boundary risk
  if (run.boundary_risk_status === 'WARN_LIKELY_ROW_RISK') {
    score -= 25;
    reasons.push('High ROW/easement risk');
  } else if (run.boundary_risk_status === 'WARN_NEAR_BOUNDARY') {
    score -= 10;
    reasons.push('Close to boundary');
  }

  // Height compliance
  if (run.height_compliance_status === 'WARN_TOO_TALL') {
    score -= 20;
    reasons.push('Exceeds typical height limit');
  } else if (run.height_compliance_status === 'UNKNOWN_ZONE') {
    score -= 10;
    reasons.push('Yard zone not set');
  }

  // Vision triangle
  if (run.vision_triangle_status === 'WARN_IN_TRIANGLE') {
    score -= 20;
    reasons.push('Crosses visibility triangle');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  const level = scoreToLevel(score);
  const verifyNeeded = level !== 'HIGH';

  return {
    confidence_level: level,
    confidence_reasons: reasons,
    verify_needed: verifyNeeded,
    score
  };
}

/**
 * Update all runs with confidence scores
 */
export async function updateRunsConfidence(runs, job, base44) {
  for (const run of runs) {
    const confidence = calculateRunConfidence(run, job);
    
    await base44.entities.Run.update(run.id, {
      confidence_level: confidence.confidence_level,
      confidence_reasons: confidence.confidence_reasons,
      verify_needed: confidence.verify_needed
    });
  }
}