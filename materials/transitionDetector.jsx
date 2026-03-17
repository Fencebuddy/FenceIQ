/**
 * Transition Detector Engine
 * Automatically detects slope transitions and calculates required transition materials
 * Works with math sub-runs to prevent material shortages at grade changes
 */

/**
 * Detect transitions between math sub-runs
 * A transition exists when slope changes, severity changes, or direction flips
 */
export function detectTransitions(run) {
  if (!run.mathSubRuns || run.mathSubRuns.length <= 1) {
    return {
      hasTransitions: false,
      transitionCount: 0,
      transitions: []
    };
  }
  
  const transitions = [];
  const mathSubRuns = run.mathSubRuns;
  
  for (let i = 0; i < mathSubRuns.length - 1; i++) {
    const current = mathSubRuns[i];
    const next = mathSubRuns[i + 1];
    
    // Detect transition type
    let transitionType = null;
    
    // Type 1: Flat <-> Slope change
    if (current.slopeExists !== next.slopeExists) {
      transitionType = current.slopeExists ? 'SLOPE_TO_FLAT' : 'FLAT_TO_SLOPE';
    }
    // Type 2: Slope severity change
    else if (current.slopeExists && next.slopeExists && 
             current.slopeRangeLabel !== next.slopeRangeLabel) {
      transitionType = 'SEVERITY_CHANGE';
    }
    // Type 3: Direction flip (uphill to downhill or vice versa)
    else if (current.slopeExists && next.slopeExists) {
      const currentDir = Math.sign(current.drop_ft);
      const nextDir = Math.sign(next.drop_ft);
      if (currentDir !== nextDir && Math.abs(next.drop_ft) > 0.25) {
        transitionType = 'DIRECTION_FLIP';
      }
    }
    
    if (transitionType) {
      transitions.push({
        index: i,
        type: transitionType,
        fromLabel: current.slopeRangeLabel,
        toLabel: next.slopeRangeLabel,
        fromSlope: current.slopeExists,
        toSlope: next.slopeExists,
        position_ft: current.endDistance_ft
      });
    }
  }
  
  return {
    hasTransitions: transitions.length > 0,
    transitionCount: transitions.length,
    transitions
  };
}

/**
 * Calculate transition materials for Vinyl fences
 */
export function calculateVinylTransitionMaterials(run, transitionData) {
  const materials = [];
  
  if (!transitionData.hasTransitions) return materials;
  
  const count = transitionData.transitionCount;
  
  // Vinyl Slope Transition Allowance (extra rails/panels at grade changes)
  materials.push({
    lineItemName: 'Vinyl Slope Transition Allowance',
    quantity: count,
    unit: 'sets',
    calculationDetails: `${count} transition${count > 1 ? 's' : ''} detected (flat/slope changes)`,
    isTransition: true
  });
  
  // Rail cut kit for each transition
  materials.push({
    lineItemName: 'Vinyl Rail Cut Kit (Transition)',
    quantity: count,
    unit: 'kits',
    calculationDetails: `${count} rail set${count > 1 ? 's' : ''} for transitions`,
    isTransition: true
  });
  
  return materials;
}

/**
 * Calculate transition materials for Wood fences
 */
export function calculateWoodTransitionMaterials(run, transitionData, style) {
  const materials = [];
  
  if (!transitionData.hasTransitions) return materials;
  
  const count = transitionData.transitionCount;
  
  // Extra pickets for cut/fit at transitions
  const extraPickets = count * 10; // 10 pickets per transition for cuts
  materials.push({
    lineItemName: 'Wood Transition Cut Allowance (Pickets)',
    quantity: extraPickets,
    unit: 'pcs',
    calculationDetails: `${count} transition${count > 1 ? 's' : ''} × 10 pickets = ${extraPickets}`,
    isTransition: true
  });
  
  // Extra rail for frame transitions
  materials.push({
    lineItemName: '2x4 Transition Frame Allowance',
    quantity: count,
    unit: 'pcs',
    calculationDetails: `${count} extra 2x4${count > 1 ? 's' : ''} for transition frames`,
    isTransition: true
  });
  
  return materials;
}

/**
 * Calculate transition materials for Chain Link fences
 */
export function calculateChainLinkTransitionMaterials(run, transitionData) {
  const materials = [];
  
  if (!transitionData.hasTransitions) return materials;
  
  const count = transitionData.transitionCount;
  
  // Chain link crews often terminate fabric at grade breaks
  // Add tension bar + band sets
  materials.push({
    lineItemName: 'Chain Link Tension Bar + Band Set (Transition)',
    quantity: count,
    unit: 'sets',
    calculationDetails: `${count} transition${count > 1 ? 's' : ''} (fabric termination at grade changes)`,
    isTransition: true
  });
  
  return materials;
}

/**
 * Calculate transition materials for Aluminum fences
 */
export function calculateAluminumTransitionMaterials(run, transitionData) {
  const materials = [];
  
  if (!transitionData.hasTransitions) return materials;
  
  const count = transitionData.transitionCount;
  
  // Rack/Step transition hardware
  materials.push({
    lineItemName: 'Aluminum Rack/Step Transition Hardware',
    quantity: count,
    unit: 'kits',
    calculationDetails: `${count} transition${count > 1 ? 's' : ''} (rack adjustment hardware)`,
    isTransition: true
  });
  
  // Check for extreme slopes requiring step mode
  const extremeTransitions = transitionData.transitions.filter(t => 
    t.fromLabel === 'Extreme' || t.toLabel === 'Extreme'
  ).length;
  
  if (extremeTransitions > 0) {
    materials.push({
      lineItemName: 'Step Mode Post Allowance (Extreme Slope)',
      quantity: extremeTransitions,
      unit: 'pcs',
      calculationDetails: `${extremeTransitions} extreme slope transition${extremeTransitions > 1 ? 's' : ''} requiring step posts`,
      isTransition: true
    });
  }
  
  return materials;
}

/**
 * Main function: Calculate all transition materials for a run
 */
export function calculateTransitionMaterials(run, materialType, style) {
  const transitionData = detectTransitions(run);
  
  if (!transitionData.hasTransitions) {
    return [];
  }
  
  let materials = [];
  
  switch (materialType) {
    case 'Vinyl':
      materials = calculateVinylTransitionMaterials(run, transitionData);
      break;
    case 'Wood':
      materials = calculateWoodTransitionMaterials(run, transitionData, style);
      break;
    case 'Chain Link':
      materials = calculateChainLinkTransitionMaterials(run, transitionData);
      break;
    case 'Aluminum':
      materials = calculateAluminumTransitionMaterials(run, transitionData);
      break;
  }
  
  return materials;
}