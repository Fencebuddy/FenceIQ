/**
 * Master Material Takeoff Calculator for Privacy Fence Company
 * Implements bay-based calculation logic using formal rules engine
 */

import { calculateWoodPickets, calculateBoardOnBoardExtras } from './UnifiedMaterialEngine';
import { calculateBaysFromMathSubRuns } from './slopeConfig';
import { needsLongerPosts } from './slopeThresholds';
import { 
  getEligibleRuns,
  calculatePostsForRun,
  calculateRailsForRun,
  calculateRailScrews,
  calculatePicketsForRun,
  calculateConcrete,
  calculateRollup
} from './bayRulesEngine';

export function calculateMaterials(job, runs, gates, rules) {
        const materials = [];

        // === RULE VERSIONING: Use snapshot if available ===
        const effectiveRules = (job.materialRulesSnapshot && job.materialRulesSnapshot.length > 0)
          ? job.materialRulesSnapshot
          : rules;

        // ✅ APPLY ELIGIBLE RUN FILTER
        const activeRuns = getEligibleRuns(runs);
  
  if (activeRuns.length === 0) {
    return materials;
  }
  
  // Track material sections for organization
  const materialSections = [];
  
  // Group runs by material type (each run can have different material/height/style)
  const runsByMaterial = {};
  activeRuns.forEach(run => {
    const materialType = run.materialType || job.materialType;
    if (!runsByMaterial[materialType]) {
      runsByMaterial[materialType] = [];
    }
    runsByMaterial[materialType].push(run);
  });

  // Calculate materials for each material type
  Object.entries(runsByMaterial).forEach(([materialType, materialRuns]) => {
    // Get gates for these runs (only gates on active, non-existing runs)
    const materialGates = gates.filter(g => materialRuns.some(r => r.id === g.runId));
    const NUM_GATES_SINGLE = materialGates.filter(g => g.gateType === 'Single').length;
    const NUM_GATES_DOUBLE = materialGates.filter(g => g.gateType === 'Double').length;
    
    // Calculate total LF for this material
    const TOTAL_LF = materialRuns.reduce((sum, r) => sum + (r.lengthLF || 0), 0);
    const totalGateWidth = materialGates.reduce((sum, g) => sum + parseInt(g.gateWidth), 0);
    const fenceLF = TOTAL_LF - totalGateWidth;
    
    // Get representative fence height (from first run of this material)
    const representativeRun = materialRuns[0];
    const fenceHeight = representativeRun.fenceHeight || job.fenceHeight;
    const style = representativeRun.style || job.style;
    const FENCE_HEIGHT_FT = parseInt(fenceHeight) || 6;
    
    // Create a synthetic job object for this material type
    const materialJob = {
      ...job,
      materialType: materialType,
      fenceHeight: fenceHeight,
      style: style
    };
    
    // Filter rules for this specific material type
    const applicableRules = effectiveRules.filter(r => 
      r.materialType === materialType &&
      (r.fenceHeight === 'Any' || r.fenceHeight === fenceHeight) &&
      (r.style === 'Any' || r.style === style)
    );

    // Calculate materials based on type
    let typeMaterials = [];
    if (materialType === 'Vinyl') {
      typeMaterials = calculateVinylMaterials(fenceLF, NUM_GATES_SINGLE, NUM_GATES_DOUBLE, applicableRules, materialRuns, materialGates, materialJob);
    } else if (materialType === 'Wood') {
      typeMaterials = calculateWoodMaterials(fenceLF, NUM_GATES_SINGLE, NUM_GATES_DOUBLE, applicableRules, materialGates, materialJob, materialRuns);
    } else if (materialType === 'Chain Link') {
      typeMaterials = calculateChainLinkMaterials(TOTAL_LF, NUM_GATES_SINGLE, NUM_GATES_DOUBLE, FENCE_HEIGHT_FT, applicableRules, materialRuns, materialGates, materialJob);
    } else if (materialType === 'Aluminum') {
      typeMaterials = calculateAluminumMaterials(fenceLF, NUM_GATES_SINGLE, NUM_GATES_DOUBLE, applicableRules, materialRuns, materialGates, materialJob);
    }
    
    // Add section header and materials
    if (typeMaterials.length > 0) {
      materialSections.push({
        sectionName: `${materialType} Parts`,
        materials: typeMaterials
      });
    }
  });

  // Flatten materials with section markers
  materialSections.forEach(section => {
    // Add section header as a special material
    materials.push({
      lineItemName: `__SECTION__${section.sectionName}`,
      quantity: 0,
      unit: '',
      calculationDetails: '',
      isSection: true
    });
    materials.push(...section.materials);
  });

  return materials;
}

function calculateVinylMaterials(fenceLF, singleGates, doubleGates, rules, runs, gates, job) {
  const materials = [];
  
  // Get panel width from rules (default 8)
  const panelRule = rules.find(r => r.calculationType === 'PerPanel');
  const panelWidth = panelRule?.panelWidthLF || 8;
  
  // SLOPE-AWARE BAY CALCULATION: Use mathSubRuns if available
  let BAYS = 0;
  let bayCalculationNotes = [];
  
  runs.forEach(run => {
    const bayCalc = calculateBaysFromMathSubRuns(run);
    BAYS += bayCalc.totalBays;
    if (bayCalc.usedMathSubRuns) {
      bayCalculationNotes.push(`${run.runLabel}: ${bayCalc.details}`);
    }
  });
  
  // Fallback: Standard calculation if no runs or no mathSubRuns used
  if (BAYS === 0) {
    BAYS = Math.ceil(fenceLF / panelWidth);
  }
  
  const NUM_LINE_POSTS = BAYS + 1;
  const NUM_CORNER_POSTS = runs.reduce((sum, r) => sum + (r.cornerPostCount || 0), 0);
  const NUM_TERMINAL_POSTS = runs.reduce((sum, r) => sum + (r.endPostCount || 0), 0);
  // Gate posts: Single gates = 2 posts, Double gates = 2 posts
  const NUM_GATE_POSTS = (singleGates * 2) + (doubleGates * 2);
  
  // Collect all gate widths with fence height from Gate entities
  const fenceHeight = job.fenceHeight;
  const gateItems = {};
  gates.forEach(gate => {
    const key = `${fenceHeight}x${gate.gateWidth} Vinyl Gate`;
    gateItems[key] = (gateItems[key] || 0) + 1;
  });
  
  // VINYL NO-DIG SYSTEM
  
  // Vinyl Panels
  materials.push({
    lineItemName: `${job.fenceHeight} ${job.style} Vinyl Panels`,
    quantity: BAYS,
    unit: 'pcs',
    calculationDetails: `${fenceLF} LF ÷ ${panelWidth} ft = ${BAYS} panels`
  });

  // All posts = 2.5" Galvanized Line Posts (including gate posts and end posts)
  const GalvPosts = NUM_LINE_POSTS + NUM_TERMINAL_POSTS + NUM_CORNER_POSTS + NUM_GATE_POSTS;
  materials.push({
    lineItemName: '2.5" Galvanized Line Post (Vinyl Sleeve Support)',
    quantity: GalvPosts,
    unit: 'pcs',
    calculationDetails: `${NUM_LINE_POSTS} line + ${NUM_TERMINAL_POSTS} end + ${NUM_CORNER_POSTS} corner + ${NUM_GATE_POSTS} gate = ${GalvPosts} galvanized posts`
  });

  // 5x5 Vinyl Line Posts
  materials.push({
    lineItemName: '5x5 Vinyl Line Posts',
    quantity: NUM_LINE_POSTS,
    unit: 'pcs',
    calculationDetails: `${NUM_LINE_POSTS} line posts`
  });

  // 5x5 Vinyl End Posts
  if (NUM_TERMINAL_POSTS > 0) {
    materials.push({
      lineItemName: '5x5 Vinyl End Posts',
      quantity: NUM_TERMINAL_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_TERMINAL_POSTS} terminal posts`
    });
  }

  // 5x5 Vinyl Corner Posts
  if (NUM_CORNER_POSTS > 0) {
    materials.push({
      lineItemName: '5x5 Vinyl Corner Posts',
      quantity: NUM_CORNER_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_CORNER_POSTS} corner posts`
    });
  }

  // 5x5 Vinyl Gate Posts
  if (NUM_GATE_POSTS > 0) {
    materials.push({
      lineItemName: '5x5 Vinyl Gate Posts',
      quantity: NUM_GATE_POSTS,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double gates × 2 = ${NUM_GATE_POSTS} gate posts`
    });
  }

  // Steel Horizontal Support Beams: 1 per gate
  const totalGates = singleGates + doubleGates;
  if (totalGates > 0) {
    materials.push({
      lineItemName: 'Steel Horizontal Support Beams',
      quantity: totalGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double = ${totalGates} beam${totalGates > 1 ? 's' : ''}`
    });

    // ✅ STRUCTURAL SCREWS (GATE HARDWARE + ASSEMBLY)
    const structuralScrews = totalGates * 24; // ~24 screws per gate (hinges, latch, beam mounting)
    materials.push({
      lineItemName: 'Structural Screws (Vinyl Gate Assembly)',
      quantity: structuralScrews,
      unit: 'pcs',
      calculationDetails: `${totalGates} gate${totalGates > 1 ? 's' : ''} × 24 = ${structuralScrews} screws`
    });
  }

  // Blank Posts: 1 per gate against house
  const gatesAgainstHouse = gates.filter(gate => {
    const run = runs.find(r => r.id === gate.runId);
    return run && gate.placement === 'End Of Run' && (run.startType === 'House/Structure' || run.endType === 'House/Structure');
  }).length;
  if (gatesAgainstHouse > 0) {
    materials.push({
      lineItemName: 'Blank Post (Gate Against House)',
      quantity: gatesAgainstHouse,
      unit: 'pcs',
      calculationDetails: `${gatesAgainstHouse} gate${gatesAgainstHouse > 1 ? 's' : ''} against house`
    });
  }

  // No-Dig Donuts: 2 per galvanized post
  const Donuts = GalvPosts * 2;
  materials.push({
    lineItemName: 'No-Dig Donuts (2 per Galvanized Post)',
    quantity: Donuts,
    unit: 'pcs',
    calculationDetails: `${GalvPosts} galvanized posts × 2 = ${Donuts} donuts`
  });

  // End Post Caps: 1 per terminal post
  if (NUM_TERMINAL_POSTS > 0) {
    materials.push({
      lineItemName: 'End Post Caps',
      quantity: NUM_TERMINAL_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_TERMINAL_POSTS} terminal posts`
    });
  }

  // Gate Caps: 2 per gate
  if (totalGates > 0) {
    materials.push({
      lineItemName: 'Gate Caps',
      quantity: totalGates * 2,
      unit: 'pcs',
      calculationDetails: `(${singleGates} single + ${doubleGates} double) × 2 = ${totalGates * 2}`
    });
  }

  // Add individual gate sizes
  Object.entries(gateItems).forEach(([gateName, qty]) => {
    materials.push({
      lineItemName: gateName,
      quantity: qty,
      unit: 'pcs',
      calculationDetails: `${qty} gate${qty > 1 ? 's' : ''}`
    });
  });

  // Calculate from rules
  for (const rule of rules) {
    // Skip combined post rule - using separate post types
    if (rule.lineItemName === '5x5 Vinyl End / Corner / Gate Posts') {
      continue;
    }
    
    let quantity = 0;
    let details = '';
    
    switch (rule.calculationType) {
      case 'PerPanel':
        quantity = BAYS;
        details = `CEIL(${fenceLF} LF / ${panelWidth}) = ${quantity} panels`;
        break;
        
      case 'PerPostFromPanels':
        const vinylPosts = BAYS + 1;
        if (rule.lineItemName.includes('Post Cap')) {
          quantity = vinylPosts;
          details = `${vinylPosts} vinyl sleeve posts`;
        } else if (rule.lineItemName.includes('Concrete')) {
          // Concrete only for I-Beam gate posts
          quantity = IBeamPosts * (rule.unitsPerPost || 2);
          details = `${IBeamPosts} I-beam gate posts × ${rule.unitsPerPost || 2} = ${quantity} bags`;

        } else if (rule.lineItemName.includes('5x5 Vinyl') && (rule.lineItemName.includes('End') || rule.lineItemName.includes('Corner') || rule.lineItemName.includes('Gate') || rule.lineItemName.includes('Line / Intermediate') || rule.lineItemName.includes('End / Corner / Gate'))) {
          // Skip - already added separately above
          continue;
        } else if (rule.lineItemName === '5x5 Vinyl End / Corner / Gate Posts') {
          // Skip - using separate post types
          continue;
        } else {
          quantity = vinylPosts;
          details = `${BAYS} panels + 1 = ${quantity} vinyl sleeves`;
        }
        break;
        
      case 'PerGateSingle':
        // Skip - gates are handled individually above with actual sizes
        if (rule.lineItemName.includes('Gate') && rule.lineItemName.includes('Vinyl')) continue;
        // Skip Aluminum Rail Stiffener
        if (rule.lineItemName.includes('Aluminum Rail Stiffener')) continue;
        quantity = singleGates * (rule.unitsPerGateSingle || 1);
        if (singleGates === 0) continue;
        details = `${singleGates} single gate${singleGates > 1 ? 's' : ''} × ${rule.unitsPerGateSingle || 1}`;
        break;
        
      case 'PerGateDouble':
        // Skip - gates are handled individually above with actual sizes
        if (rule.lineItemName.includes('Gate') && rule.lineItemName.includes('Vinyl')) continue;
        // Skip Aluminum Rail Stiffener
        if (rule.lineItemName.includes('Aluminum Rail Stiffener')) continue;
        quantity = doubleGates * (rule.unitsPerGateDouble || 1);
        if (doubleGates === 0) continue;
        details = `${doubleGates} double gate${doubleGates > 1 ? 's' : ''} × ${rule.unitsPerGateDouble || 1}`;
        break;
        
      case 'PerJob':
        quantity = 1;
        details = 'Per job allowance';
        break;
    }
    
    if (quantity > 0) {
      materials.push({
        lineItemName: rule.lineItemName,
        quantity: Math.ceil(quantity),
        unit: rule.unit,
        calculationDetails: details
      });
    }
  }
  
  return materials;
}

function calculateWoodMaterials(fenceLF, singleGates, doubleGates, rules, gates, job, runs) {
  const materials = [];
  const style = job.style;
  const fenceHeight = job.fenceHeight;
  
  // SLOPE-AWARE BAY CALCULATION: Use mathSubRuns if available
  let BAYS = 0;
  let bayCalculationNotes = [];
  
  runs.forEach(run => {
    const bayCalc = calculateBaysFromMathSubRuns(run);
    BAYS += bayCalc.totalBays;
    if (bayCalc.usedMathSubRuns) {
      bayCalculationNotes.push(`${run.runLabel}: ${bayCalc.details}`);
    }
  });
  
  // Fallback: Standard calculation if no runs or no mathSubRuns used
  if (BAYS === 0) {
    BAYS = Math.ceil(fenceLF / 8);
  }
  const NUM_CORNER_POSTS = runs.reduce((sum, r) => sum + (r.cornerPostCount || 0), 0);
  const NUM_END_POSTS = runs.reduce((sum, r) => sum + (r.endPostCount || 0), 0);
  const NUM_GATE_POSTS = (singleGates * 2) + (doubleGates * 2);
  
  // Calculate total gate width
  const totalGateWidthFt = gates.reduce((sum, g) => {
    const width = parseFloat(g.gateWidth?.replace(/'/g, '')) || g.gateWidth_ft || 0;
    return sum + width;
  }, 0);

  // === CRITICAL: WOOD PICKETS (ALWAYS AUTO-CALCULATED) ===
  // ✅ BAY RULES ENGINE - PICKETS
  const picketCalc = calculateWoodPickets(fenceLF, totalGateWidthFt, fenceHeight, style);

  materials.push({
    lineItemName: `${picketCalc.picketSKU} Wood Pickets`,
    quantity: picketCalc.totalPickets,
    unit: 'pcs',
    calculationDetails: `Fence: ${picketCalc.fencePickets} + Gates: ${picketCalc.gatePickets} (with 10% waste) = ${picketCalc.totalPickets} total`
  });

  // ✅ BAY RULES ENGINE - POSTS
  let postMaster8ft = 0;
  let postMaster10ft = 0;

  runs.forEach(run => {
    // Match gates by runId OR by assignedRunId (fence line assignment)
    const runGates = gates.filter(g => {
      if (g.runId === run.id) return true;
      if (run.assignedRunId && g.runId === run.assignedRunId) return true;
      return false;
    });
    const postCalc = calculatePostsForRun(run, runGates);

    // Assign to 8ft or 10ft based on slope
    if (needsLongerPosts(run)) {
      postMaster10ft += postCalc.totalPosts;
    } else {
      postMaster8ft += postCalc.totalPosts;
    }
  });
  
  if (postMaster8ft > 0) {
    materials.push({
      lineItemName: 'PostMaster 8\' Steel Post (Wood)',
      quantity: postMaster8ft,
      unit: 'pcs',
      calculationDetails: `Bay-based: ${postMaster8ft} posts (bays + 1 + gate posts)`
    });
  }

  if (postMaster10ft > 0) {
    materials.push({
      lineItemName: 'PostMaster 10\' Steel Post (Wood)',
      quantity: postMaster10ft,
      unit: 'pcs',
      calculationDetails: `Bay-based: ${postMaster10ft} posts (heavy slope runs)`
    });
  }

  // ✅ NO CONCRETE FOR POSTMASTER (DRIVEN POSTS)

  // ✅ BAY RULES ENGINE - RAILS
  let totalFenceRails = 0;
  let totalGateFrameRails = 0;
  let totalBays = 0;

  runs.forEach(run => {
    // Match gates by runId OR by assignedRunId (fence line assignment)
    const runGates = gates.filter(g => {
      if (g.runId === run.id) return true;
      if (run.assignedRunId && g.runId === run.assignedRunId) return true;
      return false;
    });
    const railCalc = calculateRailsForRun(run, runGates, style);
    totalFenceRails += railCalc.fenceRails;
    totalGateFrameRails += railCalc.gateFrameRails;
    totalBays += railCalc.totalFenceBays;
  });

  const totalRails = totalFenceRails + totalGateFrameRails;
  const railsPerBay = style === 'Board-on-Board' ? 4 : 3;

  materials.push({
    lineItemName: '2x4 Treated Rails',
    quantity: totalRails,
    unit: 'pcs',
    calculationDetails: `Fence: ${totalBays} bays × ${railsPerBay} + Gates: ${totalGateFrameRails} = ${totalRails} rails`
  });

  // ✅ BAY RULES ENGINE - FASTENERS
  const nailsPerPicket = railsPerBay * 2;
  const totalNails = picketCalc.totalPickets * nailsPerPicket;
  materials.push({
    lineItemName: '2" Galvanized Nails (Picket Install)',
    quantity: totalNails,
    unit: 'pcs',
    calculationDetails: `${picketCalc.totalPickets} pickets × ${nailsPerPicket} nails`
  });

  // ✅ BAY RULES ENGINE - RAIL SCREWS (4 PER RAIL, LOCKED)
  const screwCalc = calculateRailScrews(totalFenceRails, totalGateFrameRails);
  materials.push({
    lineItemName: '3" Deck Screws (Rail Install)',
    quantity: screwCalc.totalScrews,
    unit: 'pcs',
    calculationDetails: screwCalc.breakdown
  });

  // ✅ GATE HARDWARE MOUNTING SCREWS
  const totalGatesWood = singleGates + doubleGates;
  if (totalGatesWood > 0) {
    const hardwareScrews = totalGatesWood * 16; // ~16 screws per gate (hinges + latch)
    materials.push({
      lineItemName: '3" Deck Screws (Gate Hardware)',
      quantity: hardwareScrews,
      unit: 'pcs',
      calculationDetails: `${totalGatesWood} gate${totalGatesWood > 1 ? 's' : ''} × 16`
    });
  }

  // === BOARD-ON-BOARD EXTRAS ===
  if (style === 'Board-on-Board') {
    const extras = calculateBoardOnBoardExtras(fenceLF);
    
    materials.push({
      lineItemName: '2x6x16 Caps (Board-on-Board)',
      quantity: extras.caps_2x6x16,
      unit: 'pcs',
      calculationDetails: `${extras.sections} sections ÷ 2 = ${extras.caps_2x6x16}`
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

  // === GATE HARDWARE (ALWAYS AUTO-CALCULATED) ===
  if (singleGates > 0) {
    materials.push({
      lineItemName: 'Lock Latch 5\' Post Latch (Single Gate)',
      quantity: singleGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single gate${singleGates > 1 ? 's' : ''}`
    });
  }

  if (doubleGates > 0) {
    materials.push({
      lineItemName: 'Locklatch 4" Gate Latch (Double Gate)',
      quantity: doubleGates,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''}`
    });
    
    // Drop rods for double gates (2 per gate)
    materials.push({
      lineItemName: 'Cane Bolt / Drop Rod',
      quantity: doubleGates * 2,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''} × 2 = ${doubleGates * 2}`
    });
  }

  const totalGates = singleGates + doubleGates;
  if (totalGates > 0) {
    materials.push({
      lineItemName: 'Gate Handle',
      quantity: totalGates,
      unit: 'pcs',
      calculationDetails: `${totalGates} total gate${totalGates > 1 ? 's' : ''}`
    });
    
    // Gate hinges (2 per single gate, 4 per double gate)
    const totalHinges = (singleGates * 2) + (doubleGates * 4);
    materials.push({
      lineItemName: 'Wood Gate Hinges (Heavy Duty)',
      quantity: totalHinges,
      unit: 'pairs',
      calculationDetails: `${singleGates} single × 2 + ${doubleGates} double × 4 = ${totalHinges} pairs`
    });
  }

  // ✅ NO CONCRETE FOR POSTMASTER (DRIVEN POSTS - NOT SET IN CONCRETE)

  return materials;
}

function calculateChainLinkMaterials(TOTAL_LF, singleGates, doubleGates, fenceHeightFt, rules, runs, gates, job) {
  const materials = [];
  const fenceHeight = job.fenceHeight;
  
  // Get total gate width to calculate fence LF (TOTAL_LF includes gates)
  const totalGateWidthFt = gates.reduce((sum, g) => {
    const width = parseFloat(g.gateWidth?.replace(/'/g, '')) || 0;
    return sum + width;
  }, 0);
  const fenceLF = TOTAL_LF - totalGateWidthFt;
  
  // Line Posts: 1 every 10 feet of FENCE (not including gate width)
  const LinePosts = Math.ceil(fenceLF / 10);
  const NUM_CORNER_POSTS = runs.reduce((sum, r) => sum + (r.cornerPostCount || 0), 0);
  const NUM_END_POSTS = runs.reduce((sum, r) => sum + (r.endPostCount || 0), 0);
  
  // Gate posts: 2 per gate (one on each side)
  const NUM_GATE_POSTS = (singleGates * 2) + (doubleGates * 2);
  const totalTerminalPosts = NUM_END_POSTS + NUM_GATE_POSTS + NUM_CORNER_POSTS;

  // Galvanized Line Posts
  materials.push({
    lineItemName: 'Galvanized Line Posts',
    quantity: LinePosts,
    unit: 'pcs',
    calculationDetails: `CEIL(${fenceLF} fence LF / 10) = ${LinePosts} line posts (gate width excluded)`
  });

  // Loop Caps: 1 per line post
  materials.push({
    lineItemName: 'Loop Caps',
    quantity: LinePosts,
    unit: 'pcs',
    calculationDetails: `${LinePosts} line posts`
  });

  // End Post Caps: 1 per terminal/corner/gate post
  if (totalTerminalPosts > 0) {
    materials.push({
      lineItemName: 'End Post Caps',
      quantity: totalTerminalPosts,
      unit: 'pcs',
      calculationDetails: `${NUM_END_POSTS} end + ${NUM_CORNER_POSTS} corner + ${NUM_GATE_POSTS} gate = ${totalTerminalPosts} posts`
    });
  }

  // Gate Caps: Single gates need 2 caps (1 per post), Double gates need 4 caps (2 per post for 2 posts)
  const totalGates = singleGates + doubleGates;
  if (totalGates > 0) {
    const totalGateCaps = (singleGates * 2) + (doubleGates * 4);
    materials.push({
      lineItemName: 'Gate Caps',
      quantity: totalGateCaps,
      unit: 'pcs',
      calculationDetails: `${singleGates} single × 2 + ${doubleGates} double × 4 = ${totalGateCaps} caps`
    });
  }

  // Gate Latches
  if (singleGates > 0) {
    materials.push({
      lineItemName: 'Chain Link Gate Latch (Single)',
      quantity: singleGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single gate${singleGates > 1 ? 's' : ''}`
    });
  }

  if (doubleGates > 0) {
    materials.push({
      lineItemName: 'Chain Link Gate Latch (Double)',
      quantity: doubleGates,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''}`
    });
  }

  // Cane Bolts for double gates (2 per double gate)
  if (doubleGates > 0) {
    materials.push({
      lineItemName: 'Cane Bolt',
      quantity: doubleGates * 2,
      unit: 'pcs',
      calculationDetails: `${doubleGates} double gate${doubleGates > 1 ? 's' : ''} × 2 = ${doubleGates * 2} cane bolts`
    });
  }

  // ✅ STRUCTURAL SCREWS (GATE HARDWARE MOUNTING)
  if (totalGates > 0) {
    const structuralScrews = totalGates * 12; // ~12 screws per gate (latch + hardware mounting)
    materials.push({
      lineItemName: 'Structural Screws (Chain Link Gate Hardware)',
      quantity: structuralScrews,
      unit: 'pcs',
      calculationDetails: `${totalGates} gate${totalGates > 1 ? 's' : ''} × 12 = ${structuralScrews} screws`
    });
  }

  // Add individual gate sizes from Gate entities
  const gateItems = {};
  gates.forEach(gate => {
    const key = `${fenceHeight}x${gate.gateWidth} Chain Link Gate`;
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
  
  // Terminal/End/Corner/Gate Posts
  if (NUM_END_POSTS > 0) {
    materials.push({
      lineItemName: 'Chain Link End Posts',
      quantity: NUM_END_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_END_POSTS} end posts`
    });
  }
  
  if (NUM_CORNER_POSTS > 0) {
    materials.push({
      lineItemName: 'Chain Link Corner Posts',
      quantity: NUM_CORNER_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_CORNER_POSTS} corner posts`
    });
  }
  
  if (NUM_GATE_POSTS > 0) {
    materials.push({
      lineItemName: 'Chain Link Gate Posts',
      quantity: NUM_GATE_POSTS,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double gates × 2 = ${NUM_GATE_POSTS} gate posts`
    });
  }
  
  // Height-based tension bands
  let TBAND_per_terminal = 3; // 4' default
  if (fenceHeightFt === 5) TBAND_per_terminal = 4;
  if (fenceHeightFt === 6) TBAND_per_terminal = 5;
  
  // Hardware calculations per terminal post
  // Each terminal post gets: 1 tension bar, tension bands (height-based), 2 brace bands, 1 rail cup, ~5 carriage bolts
  const TB_per_terminal = 1;
  const BRB_per_terminal = 2;     // 1 for top rail, 1 for bottom tension wire
  const RC_per_terminal = 1;
  const CB_per_terminal = 5;
  
  // Corner posts get DOUBLE hardware (serving two fence lines)
  const TOTAL_TENSION_BARS = totalTerminalPosts + NUM_CORNER_POSTS;
  const TOTAL_TENSION_BANDS = (totalTerminalPosts * TBAND_per_terminal) + (NUM_CORNER_POSTS * TBAND_per_terminal);
  const TOTAL_BRACE_BANDS = (totalTerminalPosts * BRB_per_terminal) + (NUM_CORNER_POSTS * BRB_per_terminal);
  const TOTAL_RAIL_CUPS = totalTerminalPosts + NUM_CORNER_POSTS;
  const TOTAL_CARRIAGE_BOLTS = Math.ceil((totalTerminalPosts + NUM_CORNER_POSTS) * CB_per_terminal * 1.25);
  
  // Add hardware materials (only if we have posts that need them)
  if (TOTAL_TENSION_BARS > 0) {
    materials.push({
      lineItemName: 'Tension Bars',
      quantity: TOTAL_TENSION_BARS,
      unit: 'pcs',
      calculationDetails: `${totalTerminalPosts} terminal posts + ${NUM_CORNER_POSTS} corners = ${TOTAL_TENSION_BARS}`
    });
  }
  
  if (TOTAL_TENSION_BANDS > 0) {
    materials.push({
      lineItemName: 'Tension Bands',
      quantity: TOTAL_TENSION_BANDS,
      unit: 'pcs',
      calculationDetails: `${totalTerminalPosts} posts × ${TBAND_per_terminal} + ${NUM_CORNER_POSTS} corners × ${TBAND_per_terminal} = ${TOTAL_TENSION_BANDS} for ${fenceHeightFt}' fence`
    });
  }
  
  if (TOTAL_BRACE_BANDS > 0) {
    materials.push({
      lineItemName: 'Brace Bands',
      quantity: TOTAL_BRACE_BANDS,
      unit: 'pcs',
      calculationDetails: `${totalTerminalPosts} posts × 2 + ${NUM_CORNER_POSTS} corners × 2 = ${TOTAL_BRACE_BANDS} (top rail & bottom wire)`
    });
  }
  
  if (TOTAL_RAIL_CUPS > 0) {
    materials.push({
      lineItemName: 'Rail End Cups',
      quantity: TOTAL_RAIL_CUPS,
      unit: 'pcs',
      calculationDetails: `${totalTerminalPosts} terminal posts + ${NUM_CORNER_POSTS} corners = ${TOTAL_RAIL_CUPS}`
    });
  }
  
  if (TOTAL_CARRIAGE_BOLTS > 0) {
    materials.push({
      lineItemName: 'Carriage Bolts & Nuts',
      quantity: TOTAL_CARRIAGE_BOLTS,
      unit: 'pcs',
      calculationDetails: `${totalTerminalPosts + NUM_CORNER_POSTS} posts × 5 + 25% allowance = ${TOTAL_CARRIAGE_BOLTS}`
    });
  }
  
  // Chain Link Wire: Calculate in 50-foot rolls
  const wireRolls = Math.ceil(TOTAL_LF / 50);
  materials.push({
    lineItemName: `${fenceHeight} Chain Link Wire`,
    quantity: wireRolls,
    unit: 'rolls',
    calculationDetails: `${TOTAL_LF} LF ÷ 50 ft per roll = ${wireRolls} rolls`
  });

  // Top Rail: Calculate in 21-foot sticks
  const topRailSticks = Math.ceil(TOTAL_LF / 21);
  materials.push({
    lineItemName: 'Top Rail',
    quantity: topRailSticks,
    unit: 'sticks',
    calculationDetails: `${TOTAL_LF} LF ÷ 21 ft per stick = ${topRailSticks} sticks`
  });

  // Bottom Tension Wire: Standard on all chain link fences, calculate in 500-foot coils
  const tensionWireCoils = Math.ceil(TOTAL_LF / 500);
  materials.push({
    lineItemName: 'Bottom Tension Wire',
    quantity: tensionWireCoils,
    unit: 'coils',
    calculationDetails: `${TOTAL_LF} LF ÷ 500 ft per coil = ${tensionWireCoils} coil${tensionWireCoils > 1 ? 's' : ''}`
  });

  // Calculate from rules
  for (const rule of rules) {
    // Skip Top Rail and Wire rules - we calculate them above
    if (rule.lineItemName === 'Top Rail' || rule.lineItemName.includes('Chain Link Wire')) {
      continue;
    }
    
    let quantity = 0;
    let details = '';
    
    switch (rule.calculationType) {
      case 'PerLF':
        if (rule.lfPerUnit === 1) {
          quantity = TOTAL_LF;
          details = `${TOTAL_LF} LF`;
        } else if (rule.lfPerUnit === 10) {
          quantity = LinePosts;
          details = `CEIL(${TOTAL_LF} / 10) = ${quantity} line posts`;
        } else {
          quantity = Math.ceil(TOTAL_LF / (rule.lfPerUnit || 1));
          details = `CEIL(${TOTAL_LF} / ${rule.lfPerUnit}) = ${quantity}`;
        }
        break;
        
      case 'PerTerminalPost':
        quantity = totalTerminalPosts;
        details = `${NUM_END_POSTS} end + ${NUM_GATE_POSTS} gate + ${NUM_CORNER_POSTS} corner = ${quantity}`;
        break;
        
      case 'PerCornerPost':
        quantity = NUM_CORNER_POSTS;
        details = `${NUM_CORNER_POSTS} corner posts`;
        break;
        
      case 'PerGateSingle':
        quantity = singleGates * (rule.unitsPerGateSingle || 1);
        if (singleGates === 0) continue;
        details = `${singleGates} single gate${singleGates > 1 ? 's' : ''}`;
        break;
        
      case 'PerGateDouble':
        quantity = doubleGates * (rule.unitsPerGateDouble || 1);
        if (doubleGates === 0) continue;
        details = `${doubleGates} double gate${doubleGates > 1 ? 's' : ''}`;
        break;
        
      case 'PerJob':
        // Skip hardware items that are already calculated above
        if (rule.lineItemName === 'Tension Bars' || 
            rule.lineItemName === 'Tension Bands' || 
            rule.lineItemName === 'Brace Bands' ||
            rule.lineItemName === 'Carriage Bolts & Nuts' ||
            rule.lineItemName === 'Terminal/Corner/Gate Posts – Chain Link') {
          continue;
        }
        quantity = 1;
        details = 'Per job allowance';
        break;
    }
    
    if (quantity > 0) {
      materials.push({
        lineItemName: rule.lineItemName,
        quantity: Math.ceil(quantity),
        unit: rule.unit,
        calculationDetails: details
      });
    }
  }
  
  return materials;
}

function calculateAluminumMaterials(fenceLF, singleGates, doubleGates, rules, runs, gates, job) {
  const materials = [];
  
  // Aluminum panels are typically 6' wide (fence LF already excludes gates)
  const panelWidth = 6;
  const Panels = Math.ceil(fenceLF / panelWidth);
  const NUM_LINE_POSTS = Panels + 1 + runs.length; // +1 per run for shorter bays
  const NUM_CORNER_POSTS = runs.reduce((sum, r) => sum + (r.cornerPostCount || 0), 0);
  const NUM_END_POSTS = runs.reduce((sum, r) => sum + (r.endPostCount || 0), 0);
  // Gate posts: Single gates = 2 posts, Double gates = 2 posts
  const NUM_GATE_POSTS = (singleGates * 2) + (doubleGates * 2);

  // Aluminum Line Posts
  materials.push({
    lineItemName: 'Aluminum Line Posts',
    quantity: NUM_LINE_POSTS,
    unit: 'pcs',
    calculationDetails: `${Panels} panels + 1 + ${runs.length} extra (1 per run for shorter bays) = ${NUM_LINE_POSTS} line posts`
  });

  // Aluminum End Posts (2 per run - one on each side)
  if (NUM_END_POSTS > 0) {
    materials.push({
      lineItemName: 'Aluminum End Posts',
      quantity: NUM_END_POSTS,
      unit: 'pcs',
      calculationDetails: `${runs.length} runs × 2 = ${NUM_END_POSTS} end posts`
    });
  }

  // Aluminum Corner Posts
  if (NUM_CORNER_POSTS > 0) {
    materials.push({
      lineItemName: 'Aluminum Corner Posts',
      quantity: NUM_CORNER_POSTS,
      unit: 'pcs',
      calculationDetails: `${NUM_CORNER_POSTS} corner posts`
    });
  }

  // Aluminum Gate Posts
  if (NUM_GATE_POSTS > 0) {
    materials.push({
      lineItemName: 'Aluminum Gate Posts',
      quantity: NUM_GATE_POSTS,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double gates × 2 = ${NUM_GATE_POSTS} gate posts`
    });
  }

  // Aluminum Post Caps: 1 per post (all post types always get caps)
  const TOTAL_POSTS = NUM_LINE_POSTS + NUM_END_POSTS + NUM_CORNER_POSTS + NUM_GATE_POSTS;
  materials.push({
    lineItemName: 'Aluminum Post Caps',
    quantity: TOTAL_POSTS,
    unit: 'pcs',
    calculationDetails: `1 per post: ${NUM_LINE_POSTS} line + ${NUM_END_POSTS} end + ${NUM_CORNER_POSTS} corner + ${NUM_GATE_POSTS} gate = ${TOTAL_POSTS} caps`
  });

  // Collect all gate widths with fence height and style from Gate entities
  const fenceHeight = job.fenceHeight;
  const style = job.style;
  const gateItems = {};
  gates.forEach(gate => {
    const key = `${fenceHeight}x${gate.gateWidth} ${style} Aluminum Gate`;
    gateItems[key] = (gateItems[key] || 0) + 1;
  });

  // Add individual gate sizes
  Object.entries(gateItems).forEach(([gateName, qty]) => {
    materials.push({
      lineItemName: gateName,
      quantity: qty,
      unit: 'pcs',
      calculationDetails: `${qty} gate${qty > 1 ? 's' : ''}`
    });
  });

  // D&D Magna Latch for all gates
  const totalGates = singleGates + doubleGates;
  if (totalGates > 0) {
    materials.push({
      lineItemName: 'D&D Magna Latch',
      quantity: totalGates,
      unit: 'pcs',
      calculationDetails: `${singleGates} single + ${doubleGates} double = ${totalGates} gate${totalGates > 1 ? 's' : ''}`
    });

    // ✅ STRUCTURAL SCREWS (GATE HARDWARE + ASSEMBLY)
    const structuralScrews = totalGates * 20; // ~20 screws per gate (hinges, latch, assembly)
    materials.push({
      lineItemName: 'Structural Screws (Aluminum Gate Assembly)',
      quantity: structuralScrews,
      unit: 'pcs',
      calculationDetails: `${totalGates} gate${totalGates > 1 ? 's' : ''} × 20 = ${structuralScrews} screws`
    });
  }

  // Calculate from rules
  for (const rule of rules) {
    // Skip the old "Aluminum Line/Intermediate Post" rule entirely
    if (rule.lineItemName === 'Aluminum Line/Intermediate Post') {
      continue;
    }
    
    let quantity = 0;
    let details = '';
    
    switch (rule.calculationType) {
      case 'PerPanel':
        quantity = Panels;
        details = `CEIL(${fenceLF} LF / ${panelWidth}) = ${quantity} panels`;
        break;
        
      case 'PerPostFromPanels':
        // Skip aluminum post items - already calculated separately above
        if (rule.lineItemName.includes('Aluminum Line Posts') ||
            rule.lineItemName.includes('Aluminum End Posts') ||
            rule.lineItemName.includes('Aluminum Corner Posts') ||
            rule.lineItemName.includes('Aluminum Gate Posts') ||
            rule.lineItemName.includes('Aluminum Post Caps') ||
            rule.lineItemName.includes('Aluminum End/Corner/Gate Posts')) {
          continue;
        }
        if (rule.lineItemName.includes('Concrete')) {
          const totalPosts = NUM_LINE_POSTS + NUM_END_POSTS + NUM_CORNER_POSTS + NUM_GATE_POSTS;
          quantity = totalPosts * (rule.unitsPerPost || 1);
          details = `${totalPosts} posts × ${rule.unitsPerPost || 1} = ${quantity} bags`;
        } else {
          quantity = NUM_LINE_POSTS;
          details = `${Panels} panels + 1 = ${quantity} posts`;
        }
        break;
        
      case 'PerGateSingle':
        // Skip aluminum gates - handled individually with specific sizes above
        if (rule.lineItemName.includes('Aluminum Gate') && !rule.lineItemName.includes('D&D')) continue;
        quantity = singleGates * (rule.unitsPerGateSingle || 1);
        if (singleGates === 0) continue;
        details = `${singleGates} single gate${singleGates > 1 ? 's' : ''}`;
        break;
        
      case 'PerGateDouble':
        // Skip aluminum gates - handled individually with specific sizes above
        if (rule.lineItemName.includes('Aluminum Gate') && !rule.lineItemName.includes('D&D')) continue;
        quantity = doubleGates * (rule.unitsPerGateDouble || 1);
        if (doubleGates === 0) continue;
        details = `${doubleGates} double gate${doubleGates > 1 ? 's' : ''}`;
        break;
        
      case 'PerJob':
        // Skip combined aluminum post rule - using separate posts now
        if (rule.lineItemName === 'Aluminum End/Corner/Gate Posts') {
          continue;
        }
        quantity = 1;
        details = 'Per job allowance';
        break;
    }
    
    if (quantity > 0) {
      materials.push({
        lineItemName: rule.lineItemName,
        quantity: Math.ceil(quantity),
        unit: rule.unit,
        calculationDetails: details
      });
    }
  }
  
  return materials;
}