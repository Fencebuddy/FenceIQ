/**
 * FENCEBUDDY UNIFIED MATERIAL ENGINE
 * 
 * ONE SOURCE OF TRUTH for all material calculations
 * Zero memory required - automatic calculation of ALL materials
 * Used for map-based AND manual entry jobs
 */

import { generateMathSubRuns, hasVaryingSlope } from './mathSubRunEngine.jsx';
import { calculateTransitionMaterials } from './transitionDetector.jsx';

// ==================== SLOPE CALCULATIONS ====================
function analyzeSlopeForRun(run) {
  // Use math sub-runs if they exist (for varying slope)
  if (run.mathSubRuns && run.mathSubRuns.length > 0) {
    const totalDrop = run.mathSubRuns.reduce((sum, sr) => sum + (sr.drop_ft || 0), 0);
    const totalLength = run.mathSubRuns.reduce((sum, sr) => sum + (sr.horizontalLen_ft || 0), 0);
    const avgGrade = totalLength > 0 ? totalDrop / totalLength : 0;
    
    return {
      horizontalFt: totalLength,
      dropFt: totalDrop,
      slopeExists: totalDrop > 0,
      slopeGrade: avgGrade,
      slopeLengthFt: totalLength,
      slopeMode: run.slopeMode || 'None',
      slopeRangeLabel: run.slopeRangeLabel || 'Level',
      needsLongPosts: totalDrop >= 1,
      variesAlongRun: hasVaryingSlope(run),
      mathSubRuns: run.mathSubRuns
    };
  }
  
  // Single slope for entire run
  const horizontalFt = run.horizontalRunFt || run.lengthLF || 0;
  const dropFt = Math.abs(run.dropFt || 0);
  const slopeExists = dropFt > 0;
  const slopeGrade = run.slopeGrade || (horizontalFt > 0 ? dropFt / horizontalFt : 0);
  const slopeRangeLabel = run.slopeRangeLabel || 'Level';
  
  // Calculate slope length (hypotenuse)
  const slopeLengthFt = slopeExists 
    ? Math.sqrt(horizontalFt * horizontalFt + dropFt * dropFt)
    : horizontalFt;
  
  // Determine slope mode
  let slopeMode = run.slopeMode || 'None';
  const materialType = run.materialType;
  
  // Vinyl Privacy ALWAYS uses Rack mode on slopes
  if (materialType === 'Vinyl' && slopeExists) {
    slopeMode = 'Rack';
  }
  
  return {
    horizontalFt,
    dropFt,
    slopeExists,
    slopeGrade,
    slopeLengthFt,
    slopeMode,
    slopeRangeLabel,
    needsLongPosts: dropFt >= 1,
    variesAlongRun: false,
    mathSubRuns: null
  };
}

function calculateAdjustedPostSpacing(baseSpacing, slopeData, materialType) {
  if (!slopeData.slopeExists) {
    return baseSpacing;
  }
  
  // If using sub-runs, calculate weighted average spacing
  if (slopeData.mathSubRuns && slopeData.mathSubRuns.length > 0) {
    let totalWeightedSpacing = 0;
    let totalLength = 0;
    
    slopeData.mathSubRuns.forEach(subRun => {
      const subRunMultiplier = getRangeMultiplier(subRun.slopeRangeLabel);
      const subRunSpacing = baseSpacing * subRunMultiplier;
      totalWeightedSpacing += subRunSpacing * subRun.horizontalLen_ft;
      totalLength += subRun.horizontalLen_ft;
    });
    
    return totalLength > 0 ? totalWeightedSpacing / totalLength : baseSpacing;
  }
  
  // Single slope for entire run
  const multiplier = getRangeMultiplier(slopeData.slopeRangeLabel);
  return baseSpacing * multiplier;
}

function getRangeMultiplier(slopeRangeLabel) {
  const rangeMultipliers = {
    'Level': 1.00,
    'Slight': 0.90,
    'Moderate': 0.85,
    'Heavy': 0.80,
    'Extreme': 0.75
  };
  return rangeMultipliers[slopeRangeLabel] || 0.85;
}

function calculateStepModePosts(baseLinePosts, slopeData) {
  if (!slopeData.slopeExists || slopeData.slopeMode !== 'Step') {
    return baseLinePosts;
  }
  
  const MAX_STEP_RISE_IN = 8;
  const dropInches = slopeData.dropFt * 12;
  const stepCount = Math.ceil(dropInches / MAX_STEP_RISE_IN);
  
  return baseLinePosts + stepCount;
}

function applySlopeBuffer(quantity, slopeData) {
  if (!slopeData.slopeExists) {
    return quantity;
  }
  
  // If using sub-runs, calculate buffer per sub-run
  if (slopeData.mathSubRuns && slopeData.mathSubRuns.length > 0) {
    let totalBuffered = 0;
    const basePerFoot = quantity / slopeData.horizontalFt;
    
    slopeData.mathSubRuns.forEach(subRun => {
      const subRunBase = basePerFoot * subRun.horizontalLen_ft;
      if (subRun.slopeExists) {
        totalBuffered += Math.ceil(subRunBase * 1.10);
      } else {
        totalBuffered += subRunBase;
      }
    });
    
    return Math.ceil(totalBuffered);
  }
  
  // Single slope - apply +10% buffer
  return Math.ceil(quantity * 1.10);
}

// ==================== WOOD PICKET MATH (UNIVERSAL) ====================
function calculateWoodPickets(fenceLF, totalGateWidthFt, fenceHeight, style, slopeData = null) {
  // NEW FORMULA: (LF / 8) * 17 = total pickets
  const fencePickets = Math.ceil((fenceLF / 8) * 17);
  const gatePickets = Math.ceil((totalGateWidthFt / 8) * 17);
  
  const totalPickets = fencePickets + gatePickets;

  // SKU selection by height
  let picketSKU = '';
  const heightFt = parseInt(fenceHeight) || 6;
  if (heightFt <= 4) {
    picketSKU = '5/8" x 5-1/2" x 4\'';
  } else if (heightFt <= 6) {
    picketSKU = '5/8" x 5-1/2" x 6\'';
  } else {
    picketSKU = '5/8" x 5-1/2" x 8\'';
  }

  return {
    totalPickets,
    fencePickets,
    gatePickets,
    picketSKU,
    effectiveWidthIn
  };
}

// Board-on-Board extra materials (8 ft sections)
function calculateBoardOnBoardExtras(fenceLF) {
  const sections = Math.ceil(fenceLF / 8);
  
  return {
    caps_2x6x16: Math.ceil(sections / 2),
    topFrame_2x4x8: sections,
    furring_1x4x16: Math.ceil(sections / 2),
    underCap_AC2_1x4x8: sections,
    sections
  };
}

// ==================== COMPLETENESS CHECK ====================
function checkMaterialCompleteness(materials, job, runs, gates) {
  const warnings = [];
  const materialType = job.materialType;
  const totalLF = runs.reduce((sum, r) => sum + (r.lengthLF || 0), 0);
  const hasGates = gates.length > 0;
  
  // Skip check if no runs
  if (!runs || runs.length === 0 || totalLF === 0) {
    return { isComplete: true, warnings: [] };
  }

  // Wood fence completeness
  if (materialType === 'Wood' && totalLF > 0) {
    const hasPickets = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Picket') || 
        m.lineItemName.includes('picket')
      ) && !m.lineItemName.includes('Nail')
    );
    
    const hasPosts = materials.some(m => 
      m.lineItemName && m.lineItemName.includes('Post')
    );
    
    const hasRails = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Rail') || 
        m.lineItemName.includes('rail')
      )
    );
    
    const hasFasteners = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Nail') || 
        m.lineItemName.includes('Screw') ||
        m.lineItemName.includes('nail') || 
        m.lineItemName.includes('screw')
      )
    );

    if (!hasPickets) {
      warnings.push('MISSING: Wood pickets must be included');
    }
    if (!hasPosts) {
      warnings.push('MISSING: Posts required');
    }
    if (!hasRails) {
      warnings.push('MISSING: Rails required');
    }
    if (!hasFasteners) {
      warnings.push('MISSING: Fasteners (nails/screws) required');
    }
  }

  // Gate hardware completeness
  if (hasGates) {
    const hasGateLatches = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Latch') || 
        m.lineItemName.includes('latch')
      )
    );
    
    if (!hasGateLatches) {
      warnings.push('MISSING: Gate latches required');
    }
  }

  // Chain Link completeness
  if (materialType === 'Chain Link' && totalLF > 0) {
    const hasWire = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Wire') || 
        m.lineItemName.includes('Fabric')
      )
    );
    
    const hasTopRail = materials.some(m => 
      m.lineItemName && m.lineItemName.includes('Top Rail')
    );

    if (!hasWire) {
      warnings.push('MISSING: Chain link wire/fabric required');
    }
    if (!hasTopRail) {
      warnings.push('MISSING: Top rail required');
    }
  }

  // Vinyl completeness
  if (materialType === 'Vinyl' && totalLF > 0) {
    const hasPanels = materials.some(m => 
      m.lineItemName && (
        m.lineItemName.includes('Panel') || 
        m.lineItemName.includes('panel')
      )
    );
    
    const hasPosts = materials.some(m => 
      m.lineItemName && m.lineItemName.includes('Post')
    );

    if (!hasPanels) {
      warnings.push('MISSING: Vinyl panels required');
    }
    if (!hasPosts) {
      warnings.push('MISSING: Posts required');
    }
  }

  return {
    isComplete: warnings.length === 0,
    warnings
  };
}

// ==================== UNIFIED CALCULATION FUNCTION ====================
function calculateMaterialsUnified(job, runs, gates, rules) {
  const materials = [];
  
  // Group runs by material type
  const runsByMaterial = {};
  runs.forEach(run => {
    const materialType = run.materialType || job.materialType;
    if (!runsByMaterial[materialType]) {
      runsByMaterial[materialType] = [];
    }
    runsByMaterial[materialType].push(run);
  });

  // Calculate materials for each material type
  Object.entries(runsByMaterial).forEach(([materialType, materialRuns]) => {
    // Get gates for these runs
    const materialGates = gates.filter(g => materialRuns.some(r => r.id === g.runId));
    const NUM_GATES_SINGLE = materialGates.filter(g => g.gateType === 'Single').length;
    const NUM_GATES_DOUBLE = materialGates.filter(g => g.gateType === 'Double').length;
    
    // Calculate total LF and gate width for this material
    const TOTAL_LF = materialRuns.reduce((sum, r) => sum + (r.lengthLF || 0), 0);
    const totalGateWidthFt = materialGates.reduce((sum, g) => {
      const width = parseFloat(g.gateWidth?.replace(/'/g, '')) || 0;
      return sum + width;
    }, 0);
    const fenceLF = TOTAL_LF - totalGateWidthFt;
    
    // Get representative fence specs
    const representativeRun = materialRuns[0];
    const fenceHeight = representativeRun.fenceHeight || job.fenceHeight;
    const style = representativeRun.style || job.style;
    const FENCE_HEIGHT_FT = parseInt(fenceHeight) || 6;
    
    // Create synthetic job object
    const materialJob = {
      ...job,
      materialType,
      fenceHeight,
      style
    };
    
    // Filter rules
    const applicableRules = rules.filter(r => 
      r.materialType === materialType &&
      (r.fenceHeight === 'Any' || r.fenceHeight === fenceHeight) &&
      (r.style === 'Any' || r.style === style)
    );

    // Add section header
    materials.push({
      lineItemName: `__SECTION__${materialType} Parts`,
      quantity: 0,
      unit: '',
      calculationDetails: '',
      isSection: true
    });

    // Calculate by material type
    if (materialType === 'Wood') {
      const woodMaterials = calculateWoodMaterialsComplete(
        fenceLF, 
        totalGateWidthFt,
        NUM_GATES_SINGLE, 
        NUM_GATES_DOUBLE, 
        applicableRules, 
        materialGates, 
        materialJob, 
        materialRuns
      );
      materials.push(...woodMaterials);
    } else if (materialType === 'Vinyl') {
      const vinylMaterials = calculateVinylMaterialsComplete(
        fenceLF, 
        NUM_GATES_SINGLE, 
        NUM_GATES_DOUBLE, 
        applicableRules, 
        materialRuns, 
        materialGates, 
        materialJob
      );
      materials.push(...vinylMaterials);
    } else if (materialType === 'Chain Link') {
      const chainLinkMaterials = calculateChainLinkMaterialsComplete(
        TOTAL_LF, 
        NUM_GATES_SINGLE, 
        NUM_GATES_DOUBLE, 
        FENCE_HEIGHT_FT, 
        applicableRules, 
        materialRuns, 
        materialGates, 
        materialJob
      );
      materials.push(...chainLinkMaterials);
    } else if (materialType === 'Aluminum') {
      const aluminumMaterials = calculateAluminumMaterialsComplete(
        fenceLF, 
        NUM_GATES_SINGLE, 
        NUM_GATES_DOUBLE, 
        applicableRules, 
        materialRuns, 
        materialGates, 
        materialJob
      );
      materials.push(...aluminumMaterials);
    }
  });

  return materials;
}

// ==================== WOOD MATERIALS (COMPLETE) ====================
function calculateWoodMaterialsComplete(fenceLF, totalGateWidthFt, singleGates, doubleGates, rules, gates, job, runs) {
  const materials = [];
  const style = job.style;
  const fenceHeight = job.fenceHeight;
  
  // Analyze slope across all runs
  const slopeData = runs.map(r => analyzeSlopeForRun(r));
  const hasSlope = slopeData.some(s => s.slopeExists);
  const combinedSlope = hasSlope ? slopeData.find(s => s.slopeExists) : { slopeExists: false };
  
  // Base post spacing for wood (FENCEBUDDY STANDARD)
  const BASE_SPACING = 8; // 8 ft on center for wood
  const adjustedSpacing = calculateAdjustedPostSpacing(BASE_SPACING, combinedSlope, 'Wood');
  
  // Calculate bays with adjusted spacing
  const BAYS = Math.ceil(fenceLF / adjustedSpacing);
  let NUM_LINE_POSTS = BAYS + 1;
  
  // Apply step mode adjustment if needed
  NUM_LINE_POSTS = calculateStepModePosts(NUM_LINE_POSTS, combinedSlope);
  
  const NUM_CORNER_POSTS = runs.reduce((sum, r) => sum + (r.cornerPostCount || 0), 0);
  const NUM_END_POSTS = runs.reduce((sum, r) => sum + (r.endPostCount || 0), 0);
  const NUM_GATE_POSTS = (singleGates * 2) + (doubleGates * 2);
  
  // Count long posts needed
  const longPostCount = combinedSlope.needsLongPosts ? (NUM_END_POSTS + NUM_GATE_POSTS + 1) : 0;
  
  // === CRITICAL: WOOD PICKETS (ALWAYS CALCULATED WITH SLOPE) ===
  const picketCalc = calculateWoodPickets(fenceLF, totalGateWidthFt, fenceHeight, style, combinedSlope);
  
  materials.push({
    lineItemName: `${picketCalc.picketSKU} Wood Pickets`,
    quantity: picketCalc.totalPickets,
    unit: 'pcs',
    calculationDetails: `Fence: ${picketCalc.fencePickets} + Gates: ${picketCalc.gatePickets} (with 10% waste) = ${picketCalc.totalPickets} total pickets`
  });
  
  // === POSTMASTER GATE POSTS (WOOD STANDARD) ===
  if (NUM_GATE_POSTS > 0) {
    materials.push({
      lineItemName: 'PostMaster Steel Gate Posts',
      quantity: NUM_GATE_POSTS,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double × 2 = ${NUM_GATE_POSTS} gate posts (PostMaster standard for wood gates ≤5' wide)`
    });
  }

  // === POSTS (NON-GATE) ===
  materials.push({
    lineItemName: '4x4 Wood Line Posts',
    quantity: NUM_LINE_POSTS,
    unit: 'pcs',
    calculationDetails: `${BAYS} bays + 1 = ${NUM_LINE_POSTS} line posts`
  });
  
  if (NUM_END_POSTS > 0) {
    materials.push({
      lineItemName: '4x4 Wood End Posts',
      quantity: NUM_END_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_END_POSTS} end posts`
    });
  }
  
  if (NUM_CORNER_POSTS > 0) {
    materials.push({
      lineItemName: '4x4 Wood Corner Posts',
      quantity: NUM_CORNER_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_CORNER_POSTS} corner posts`
    });
  }

  // === RAILS (WITH SLOPE BUFFER) ===
  let railsPerBay = 3; // default
  if (style === 'Board-on-Board') {
    railsPerBay = 4;
  }
  
  let totalRails = BAYS * railsPerBay;
  totalRails = applySlopeBuffer(totalRails, combinedSlope);
  
  const slopeNote = combinedSlope.slopeExists ? ' +10% slope' : '';
  materials.push({
    lineItemName: '2x4 Treated Rails',
    quantity: totalRails,
    unit: 'pcs',
    calculationDetails: `${BAYS} bays × ${railsPerBay} = ${totalRails}${slopeNote}`
  });

  // === FASTENERS (AUTOMATIC - SEPARATE SECTION) ===
  // A. PICKET NAILS (all pickets including gate pickets)
  const nailsPerPicket = railsPerBay * 2;
  let totalPicketNails = picketCalc.totalPickets * nailsPerPicket;
  totalPicketNails = applySlopeBuffer(totalPicketNails, combinedSlope);

  materials.push({
    lineItemName: '2" Galvanized Nails (Picket Install)',
    quantity: totalPicketNails,
    unit: 'pcs',
    calculationDetails: `${picketCalc.totalPickets} pickets × ${nailsPerPicket}${slopeNote}`
  });

  // B. RAIL SCREWS (rails to posts)
  let totalRailScrews = totalRails * 4; // 4 screws per rail
  totalRailScrews = applySlopeBuffer(totalRailScrews, combinedSlope);

  materials.push({
    lineItemName: '3" Deck Screws (Rail Install)',
    quantity: totalRailScrews,
    unit: 'pcs',
    calculationDetails: `${totalRails} rails × 4${slopeNote}`
  });

  // C. GATE FRAME SCREWS (separate if gates exist)
  if (singleGates > 0 || doubleGates > 0) {
    const gateFrameScrews = (singleGates * 40) + (doubleGates * 80);
    materials.push({
      lineItemName: '3" Deck Screws (Gate Frame Assembly)',
      quantity: gateFrameScrews,
      unit: 'pcs',
      calculationDetails: `${singleGates} single × 40 + ${doubleGates} double × 80`
    });
  }

  // === BOARD-ON-BOARD EXTRAS ===
  if (style === 'Board-on-Board') {
    const extras = calculateBoardOnBoardExtras(fenceLF);
    
    materials.push({
      lineItemName: '2x6x16 Caps (Board-on-Board)',
      quantity: extras.caps_2x6x16,
      unit: 'pcs',
      calculationDetails: `${extras.sections} sections ÷ 2 = ${extras.caps_2x6x16} caps`
    });
    
    materials.push({
      lineItemName: '2x4x8 Top Frame (Board-on-Board)',
      quantity: extras.topFrame_2x4x8,
      unit: 'pcs',
      calculationDetails: `1 per section = ${extras.topFrame_2x4x8}`
    });
    
    materials.push({
      lineItemName: '1x4x16 Furring (Board-on-Board)',
      quantity: extras.furring_1x4x16,
      unit: 'pcs',
      calculationDetails: `${extras.sections} sections ÷ 2 = ${extras.furring_1x4x16}`
    });
    
    materials.push({
      lineItemName: '1x4x8 AC2 Under Cap (Board-on-Board)',
      quantity: extras.underCap_AC2_1x4x8,
      unit: 'pcs',
      calculationDetails: `1 per section = ${extras.underCap_AC2_1x4x8}`
    });
  }

  // === GATES ===
  const gateItems = {};
  gates.forEach(gate => {
    const key = `${fenceHeight}x${gate.gateWidth} Wood Gate`;
    gateItems[key] = (gateItems[key] || 0) + 1;
  });

  Object.entries(gateItems).forEach(([gateName, qty]) => {
    materials.push({
      lineItemName: gateName,
      quantity: qty,
      unit: 'pcs',
      calculationDetails: `${qty} gate${qty > 1 ? 's' : ''}`
    });
  });

  // === GATE HARDWARE (ENFORCED STANDARD) ===
  // Single Gates: 1 handle per gate
  if (singleGates > 0) {
    materials.push({
      lineItemName: 'Lock Latch 5\' Post Latch (Single Gate)',
      quantity: singleGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single gate${singleGates > 1 ? 's' : ''}`
    });
    
    materials.push({
      lineItemName: 'Gate Handle',
      quantity: singleGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single gate${singleGates > 1 ? 's' : ''} (1 per gate)`
    });
  }

  // Double Gates: 2 handles + 2 cane bolts (one per leaf)
  if (doubleGates > 0) {
    materials.push({
      lineItemName: 'Locklatch 4" Gate Latch (Double Gate)',
      quantity: doubleGates,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''}`
    });
    
    materials.push({
      lineItemName: 'Gate Handle',
      quantity: doubleGates * 2,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''} × 2 leaves = ${doubleGates * 2} handles`
    });
    
    materials.push({
      lineItemName: 'Cane Bolt / Drop Rod (Wood Gate)',
      quantity: doubleGates * 2,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''} × 2 leaves = ${doubleGates * 2} cane bolts (REQUIRED)`
    });
  }

  // === LONG POST ALLOWANCE (SLOPE SAFETY) ===
  if (longPostCount > 0) {
    materials.push({
      lineItemName: 'Long Post Allowance (Extra Length)',
      quantity: longPostCount,
      unit: 'pcs',
      calculationDetails: `${longPostCount} posts need extra length for ${combinedSlope.dropFt.toFixed(1)}' drop`
    });
  }

  // === CONCRETE ===
  const totalPosts = NUM_LINE_POSTS + NUM_END_POSTS + NUM_CORNER_POSTS + NUM_GATE_POSTS;
  const concreteBags = totalPosts * 2;
  materials.push({
    lineItemName: 'Concrete (50lb bags)',
    quantity: concreteBags,
    unit: 'bags',
    calculationDetails: `${totalPosts} posts × 2 = ${concreteBags} bags`
  });
  
  // === TRANSITION MATERIALS (AUTO-DETECTED) ===
  runs.forEach(run => {
    const transitionMaterials = calculateTransitionMaterials(run, 'Wood', style);
    materials.push(...transitionMaterials);
  });
  
  // === SLOPE SUMMARY ===
  if (combinedSlope.slopeExists) {
    const slopeNote = combinedSlope.variesAlongRun 
      ? `Slope varies along run | Avg: ${combinedSlope.dropFt.toFixed(1)}' drop | Mode: ${combinedSlope.slopeMode} | Spacing: ${adjustedSpacing.toFixed(1)}' | +10% buffer applied`
      : `Slope: ${combinedSlope.dropFt.toFixed(1)}' drop | Mode: ${combinedSlope.slopeMode} | Spacing: ${adjustedSpacing.toFixed(1)}' | +10% buffer applied`;
    
    materials.unshift({
      lineItemName: '__SLOPE_INFO__',
      quantity: 0,
      unit: '',
      calculationDetails: slopeNote,
      isInfo: true
    });
  }
  
  // === POST SPACING NOTE ===
  materials.unshift({
    lineItemName: '__POST_SPACING_NOTE__',
    quantity: 0,
    unit: '',
    calculationDetails: `Post spacing: ${BASE_SPACING}' on center (FenceBuddy standard, adjusted for slope where applicable)`,
    isInfo: true
  });

  return materials;
}

// ==================== VINYL MATERIALS (STUB - REUSE EXISTING) ====================
function calculateVinylMaterialsComplete(fenceLF, singleGates, doubleGates, rules, runs, gates, job) {
  const materials = [];
  
  // Add transition materials for all runs
  runs.forEach(run => {
    const transitionMaterials = calculateTransitionMaterials(run, 'Vinyl', job.style);
    materials.push(...transitionMaterials);
  });
  
  return materials;
}

// ==================== CHAIN LINK MATERIALS (STUB - REUSE EXISTING) ====================
function calculateChainLinkMaterialsComplete(totalLF, singleGates, doubleGates, fenceHeightFt, rules, runs, gates, job) {
  const materials = [];
  
  // Add transition materials for all runs
  runs.forEach(run => {
    const transitionMaterials = calculateTransitionMaterials(run, 'Chain Link', job.style);
    materials.push(...transitionMaterials);
  });
  
  return materials;
}

// ==================== ALUMINUM MATERIALS (STUB - REUSE EXISTING) ====================
function calculateAluminumMaterialsComplete(fenceLF, singleGates, doubleGates, rules, runs, gates, job) {
  const materials = [];
  
  // Add transition materials for all runs
  runs.forEach(run => {
    const transitionMaterials = calculateTransitionMaterials(run, 'Aluminum', job.style);
    materials.push(...transitionMaterials);
  });
  
  return materials;
}

export default calculateMaterialsUnified;

export {
  calculateMaterialsUnified,
  calculateWoodPickets,
  calculateBoardOnBoardExtras,
  checkMaterialCompleteness,
  analyzeSlopeForRun,
  calculateAdjustedPostSpacing,
  applySlopeBuffer
};