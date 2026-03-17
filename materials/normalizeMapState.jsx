/**
 * DATA NORMALIZATION ENGINE
 * Dedupes runs, gates, and posts before takeoff calculation
 * Ensures gate dominance and data integrity
 */

const SNAP_TOLERANCE_PX = 30;

/**
 * Normalize map state before takeoff calculation
 * Removes duplicates, orphaned data, and applies gate dominance
 */
export function normalizeMapState(mapState, runs, gates) {
  const warnings = [];
  const errors = [];

  // Step 1: Dedupe runs by ID
  const runIds = new Set();
  const deduplicatedRuns = [];
  runs.forEach(run => {
    if (!run.id) {
      errors.push({ type: 'RUN_MISSING_ID', run });
      return;
    }
    if (runIds.has(run.id)) {
      warnings.push({ type: 'DUPLICATE_RUN_ID', runId: run.id });
      return;
    }
    runIds.add(run.id);
    deduplicatedRuns.push(run);
  });

  // Step 2: Dedupe gates by ID and validate runId
  const gateIds = new Set();
  const validRunIds = new Set(deduplicatedRuns.map(r => r.id));
  const deduplicatedGates = [];
  const orphanedGates = [];

  gates.forEach(gate => {
    if (!gate.id) {
      errors.push({ type: 'GATE_MISSING_ID', gate });
      return;
    }
    if (gateIds.has(gate.id)) {
      warnings.push({ type: 'DUPLICATE_GATE_ID', gateId: gate.id });
      return;
    }
    if (!gate.runId) {
      errors.push({ type: 'GATE_MISSING_RUNID', gateId: gate.id });
      orphanedGates.push(gate);
      return;
    }
    if (!validRunIds.has(gate.runId)) {
      errors.push({ type: 'GATE_INVALID_RUNID', gateId: gate.id, runId: gate.runId });
      orphanedGates.push(gate);
      return;
    }
    gateIds.add(gate.id);
    deduplicatedGates.push(gate);
  });

  // Step 3: Dedupe fence lines (if in mapState)
  let deduplicatedFenceLines = [];
  if (mapState && mapState.fenceLines) {
    const lineMap = new Map();
    mapState.fenceLines.forEach((line, idx) => {
      const key = `${line.start.x}-${line.start.y}-${line.end.x}-${line.end.y}`;
      if (!lineMap.has(key)) {
        lineMap.set(key, line);
        deduplicatedFenceLines.push(line);
      } else {
        warnings.push({ type: 'DUPLICATE_FENCE_LINE', index: idx });
      }
    });
  }

  // Step 4: Detect near-duplicate runs (same label + similar length)
  const nearDuplicates = [];
  for (let i = 0; i < deduplicatedRuns.length; i++) {
    for (let j = i + 1; j < deduplicatedRuns.length; j++) {
      const r1 = deduplicatedRuns[i];
      const r2 = deduplicatedRuns[j];
      if (r1.runLabel === r2.runLabel && Math.abs(r1.lengthLF - r2.lengthLF) < 0.5) {
        nearDuplicates.push({
          type: 'NEAR_DUPLICATE_RUNS',
          run1: r1.id,
          run2: r2.id,
          label: r1.runLabel,
          lengthDiff: Math.abs(r1.lengthLF - r2.lengthLF)
        });
      }
    }
  }
  warnings.push(...nearDuplicates);

  // Step 5: Return normalized state
  const normalized = {
    runs: deduplicatedRuns,
    gates: deduplicatedGates,
    fenceLines: deduplicatedFenceLines.length > 0 ? deduplicatedFenceLines : (mapState?.fenceLines || []),
    trees: mapState?.trees || [],
    annotations: mapState?.annotations || []
  };

  return {
    normalized,
    warnings,
    errors,
    stats: {
      runsRemoved: runs.length - deduplicatedRuns.length,
      gatesRemoved: gates.length - deduplicatedGates.length,
      orphanedGates: orphanedGates.length,
      linesRemoved: mapState?.fenceLines ? mapState.fenceLines.length - deduplicatedFenceLines.length : 0
    }
  };
}

/**
 * Validate material type scoping (no cross-material leakage)
 * Returns list of contaminating items
 */
export function validateMaterialScoping(takeoff, expectedMaterialType) {
  const issues = [];
  
  if (!takeoff || !takeoff.lineItems) return issues;
  
  // Define forbidden terms for each material type
  const forbiddenTerms = {
    'Chain Link': [
      'vinyl panel', 'donut', '5x5 vinyl', 'vinyl post cap', 
      'aluminum gate beam (vinyl)', 'picket', '2x4 rail',
      'no-dig', 'vinyl reinforcement'
    ],
    'Vinyl': [
      'chain link fabric', 'tension band', 'brace band', 
      'tension wire', 'top rail', 'rail end cup', 'hog ring',
      'galvanized post', 'terminal post'
    ],
    'Wood': [
      'vinyl panel', 'chain link fabric', 'aluminum panel',
      'donut', 'tension band'
    ],
    'Aluminum': [
      'vinyl panel', 'chain link fabric', 'donut', 
      'wood post', 'picket', '2x4 rail'
    ]
  };
  
  const forbidden = forbiddenTerms[expectedMaterialType] || [];
  const contaminated = [];
  
  takeoff.lineItems.forEach(item => {
    const itemName = (item.materialDescription || item.lineItemName || '').toLowerCase();
    
    // Check if item contains forbidden terms
    for (const term of forbidden) {
      if (itemName.includes(term.toLowerCase())) {
        contaminated.push({
          item: item.materialDescription || item.lineItemName,
          reason: `Contains forbidden term "${term}" for ${expectedMaterialType}`,
          quantity: item.quantityCalculated || item.quantity
        });
        break;
      }
    }
  });
  
  if (contaminated.length > 0) {
    issues.push({
      severity: 'BLOCKER',
      code: 'MATERIAL_TYPE_CONTAMINATION',
      message: `${contaminated.length} items from wrong material system detected`,
      expectedMaterialType,
      contaminatedItems: contaminated,
      autoFixable: false
    });
  }
  
  return issues;
}

/**
 * Validate takeoff eligibility
 * Returns list of issues that would block PO generation
 */
export function validateTakeoffEligibility(runs, gates, takeoff, expectedMaterialType) {
  const issues = [];

  // Check for duplicate run IDs
  const runIds = runs.map(r => r.id);
  const duplicateRunIds = runIds.filter((id, idx) => runIds.indexOf(id) !== idx);
  if (duplicateRunIds.length > 0) {
    issues.push({
      severity: 'BLOCKER',
      code: 'DUPLICATE_RUN_IDS',
      message: `Duplicate run IDs detected: ${[...new Set(duplicateRunIds)].join(', ')}`,
      autoFixable: false
    });
  }

  // Check for duplicate gate IDs
  const gateIds = gates.map(g => g.id);
  const duplicateGateIds = gateIds.filter((id, idx) => gateIds.indexOf(id) !== idx);
  if (duplicateGateIds.length > 0) {
    issues.push({
      severity: 'BLOCKER',
      code: 'DUPLICATE_GATE_IDS',
      message: `Duplicate gate IDs detected: ${[...new Set(duplicateGateIds)].join(', ')}`,
      autoFixable: false
    });
  }

  // Check for gates missing runId
  const gatesMissingRunId = gates.filter(g => !g.runId);
  if (gatesMissingRunId.length > 0) {
    issues.push({
      severity: 'BLOCKER',
      code: 'GATES_MISSING_RUNID',
      message: `${gatesMissingRunId.length} gates missing runId`,
      autoFixable: false,
      gateIds: gatesMissingRunId.map(g => g.id)
    });
  }

  // Check for gates with invalid runId
  const validRunIds = new Set(runs.map(r => r.id));
  const gatesWithInvalidRunId = gates.filter(g => g.runId && !validRunIds.has(g.runId));
  if (gatesWithInvalidRunId.length > 0) {
    issues.push({
      severity: 'BLOCKER',
      code: 'GATES_INVALID_RUNID',
      message: `${gatesWithInvalidRunId.length} gates with invalid runId`,
      autoFixable: false,
      gateIds: gatesWithInvalidRunId.map(g => g.id)
    });
  }

  // Check gate post count mismatch
  if (takeoff && takeoff.postCounts) {
    const eligibleRuns = runs.filter(r => {
      const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
      return status === 'new';
    });
    const eligibleRunIds = new Set(eligibleRuns.map(r => r.id));
    const eligibleGates = gates.filter(g => eligibleRunIds.has(g.runId));
    const expectedGatePosts = eligibleGates.length * 2;
    const actualGatePosts = takeoff.postCounts.gatePosts || 0;

    if (expectedGatePosts !== actualGatePosts) {
      issues.push({
        severity: 'WARNING',
        code: 'GATE_POST_COUNT_MISMATCH',
        message: `Expected ${expectedGatePosts} gate posts (2 per eligible gate), got ${actualGatePosts}`,
        expected: expectedGatePosts,
        actual: actualGatePosts,
        autoFixable: false
      });
    }
  }

  // Check for material type contamination
  if (takeoff && expectedMaterialType) {
    const contaminationIssues = validateMaterialScoping(takeoff, expectedMaterialType);
    issues.push(...contaminationIssues);
  }

  return issues;
}

/**
 * Dedupe array by ID field
 */
export function dedupeById(array, idField = 'id') {
  const seen = new Set();
  return array.filter(item => {
    const id = item[idField];
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}