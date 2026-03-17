// Map-based material calculation engine
// Uses run segments and gate data from the map to calculate materials

import { calculateWoodPickets, calculateBoardOnBoardExtras } from './UnifiedMaterialEngine.jsx';
import { calculateBaysFromMathSubRuns } from './slopeConfig.jsx';

// ✅ GLOBAL CONSTANT
const MAX_BAY_LENGTH_FT = 7.5;

/**
 * Get run segments from fence lines (pure function, no window dependency)
 */
export function getRunSegmentsFromFenceLines(fenceLines) {
    if (!fenceLines || fenceLines.length === 0) {
        return [];
    }
    
    // CRITICAL: Only process new fence lines (ignore existing and unassigned visual lines)
    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        return status === 'new' && line.assignedRunId; // Must be new AND assigned to run
    });
    
    if (activeLines.length === 0) {
        return [];
    }
    
    // Group by orientation label or segment number
    const runGroups = {};
    
    activeLines.forEach((line, idx) => {
        const runKey = line.orientationLabel || `Run ${idx + 1}`;
        if (!runGroups[runKey]) {
            runGroups[runKey] = {
                runIndex: Object.keys(runGroups).length,
                run: {
                    orientationLabel: line.orientationLabel,
                    isPerimeter: line.isPerimeter || true,
                    length: 0,
                    assignedRunId: line.assignedRunId
                },
                segments: []
            };
        }
        
        // Calculate fence length (excluding gates)
        const lineLength = line.manualLengthFt || line.length || 0;
        
        // Add fence segment
        runGroups[runKey].segments.push({
            type: 'fence',
            lengthFt: lineLength,
            start: line.start,
            end: line.end
        });
        
        runGroups[runKey].run.length += lineLength;
        
        // Add gate segments if present
        if (line.gates && line.gates.length > 0) {
            line.gates.forEach(gate => {
                runGroups[runKey].segments.push({
                    type: 'gate',
                    lengthFt: gate.widthFt,
                    gate: gate
                });
            });
        }
    });
    
    return Object.values(runGroups);
}

export function calculateMapMaterials(fenceLines, materialRules) {
    const materials = [];
    
    // Get all run segments (browser fallback if needed)
    let allSegments = [];
    if (typeof window !== 'undefined' && window.getAllRunSegments) {
        allSegments = window.getAllRunSegments();
    } else {
        allSegments = getRunSegmentsFromFenceLines(fenceLines);
    }
    
    if (allSegments.length === 0) {
        return materials;
    }
    
    // Process each run
    allSegments.forEach(({ runIndex, run, segments }) => {
        if (!run.isPerimeter) return; // Only process perimeter runs for now
        
        const runLabel = run.orientationLabel || `Run ${runIndex + 1}`;
        
        // Calculate fence LF (excluding gates)
        const fenceLF = segments
            .filter(s => s.type === 'fence')
            .reduce((sum, s) => sum + s.lengthFt, 0);
        
        // Count gates
        const gateSegments = segments.filter(s => s.type === 'gate');
        const singleGates = gateSegments.filter(s => s.gate.widthFt === 4);
        const doubleGates = gateSegments.filter(s => s.gate.widthFt === 8);
        
        if (fenceLF < 0.1 && gateSegments.length === 0) return;
        
        // Get material type, height, style from job (we'll need these passed in later)
        // For now, using placeholder values - this will be enhanced
        const materialType = 'Vinyl'; // Will come from job/run data
        const fenceHeight = '6\''; // Will come from job/run data
        const style = 'Privacy'; // Will come from job/run data
        
        // Add fence LF line item
        if (fenceLF > 0) {
            materials.push({
                runLabel,
                materialDescription: `${fenceHeight} ${materialType} ${style} Fence`,
                quantityCalculated: Math.round(fenceLF * 10) / 10,
                uom: 'LF',
                notes: `Fence length from map: ${fenceLF.toFixed(1)} ft`,
                source: 'map',
                runIndex
            });
        }
        
        // Calculate materials based on fence type
        if (materialType === 'Vinyl' && fenceLF > 0) {
            const panelWidth = 8;
            const panels = Math.ceil(fenceLF / panelWidth);
            
            materials.push({
                runLabel,
                materialDescription: `${fenceHeight} Vinyl Panel`,
                quantityCalculated: panels,
                uom: 'pcs',
                notes: `${panels} panels for ${fenceLF.toFixed(1)} LF fence`,
                source: 'map',
                runIndex
            });
            
            // Line posts (one per panel plus one)
            materials.push({
                runLabel,
                materialDescription: 'Line Post',
                quantityCalculated: panels + 1,
                uom: 'pcs',
                notes: `Posts for ${panels} panels`,
                source: 'map',
                runIndex
            });
            
            // Post caps
            materials.push({
                runLabel,
                materialDescription: 'Post Cap',
                quantityCalculated: panels + 1,
                uom: 'pcs',
                notes: `Caps for ${panels + 1} posts`,
                source: 'map',
                runIndex
            });
        } else if (materialType === 'Chain Link' && fenceLF > 0) {
            const rollLength = 50;
            const rolls = Math.ceil(fenceLF / rollLength);
            
            materials.push({
                runLabel,
                materialDescription: `${fenceHeight} Chain Link Fabric`,
                quantityCalculated: rolls,
                uom: 'rolls',
                notes: `${rolls} rolls for ${fenceLF.toFixed(1)} LF`,
                source: 'map',
                runIndex
            });
            
            // Line posts (every 10 feet)
            const linePosts = Math.ceil(fenceLF / 10);
            materials.push({
                runLabel,
                materialDescription: 'Line Post',
                quantityCalculated: linePosts,
                uom: 'pcs',
                notes: `Posts every 10 ft`,
                source: 'map',
                runIndex
            });
        } else if (materialType === 'Wood' && fenceLF > 0) {
            const bayWidth = 8;
            const bays = Math.ceil(fenceLF / bayWidth);
            
            materials.push({
                runLabel,
                materialDescription: 'Steel Post',
                quantityCalculated: bays + 1,
                uom: 'pcs',
                notes: `Posts for ${bays} bays`,
                source: 'map',
                runIndex
            });
            
            const railsPerBay = 3;
            materials.push({
                runLabel,
                materialDescription: 'Treated Rail',
                quantityCalculated: bays * railsPerBay,
                uom: 'pcs',
                notes: `${railsPerBay} rails per bay`,
                source: 'map',
                runIndex
            });
        }
        
        // Add gate items
        if (singleGates.length > 0) {
            materials.push({
                runLabel,
                materialDescription: `4' Single Gate`,
                quantityCalculated: singleGates.length,
                uom: 'pcs',
                notes: `${singleGates.length} gate(s) from map`,
                source: 'map',
                runIndex
            });
        }
        
        if (doubleGates.length > 0) {
            materials.push({
                runLabel,
                materialDescription: `8' Double Gate`,
                quantityCalculated: doubleGates.length,
                uom: 'pcs',
                notes: `${doubleGates.length} gate(s) from map`,
                source: 'map',
                runIndex
            });
        }
    });
    
    return materials;
}

// CANONICAL POST COUNTING - Import from new engine
import { buildTakeoff } from './canonicalTakeoffEngine';

// Legacy wrapper for compatibility
function computeVinylPostCounts(fenceLines, runs, gates) {
    const job = { materialType: 'Vinyl' }; // Minimal job object
    const takeoff = buildTakeoff(job, fenceLines, runs, gates);
    return takeoff.postCounts;
}

// REMOVED: Old geometry analysis - now using graph-based canonical engine

// Enhanced version that uses actual job and run data
// NOW USES CANONICAL TAKEOFF ENGINE
export function calculateMapMaterialsWithJobData(job, fenceLines, runs = [], gates = []) {
    const materials = [];
    
    // CRITICAL: Filter out existing runs (visual only) and existing fence lines
    const activeRuns = runs.filter(r => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        return status === 'new';
    });
    
    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        return status === 'new' && line.assignedRunId; // Must be new AND assigned to run
    });
    
    if (activeLines.length === 0) {
        return materials;
    }
    
    // Get all run segments with gates from canvas
    let allSegments = [];
    if (typeof window !== 'undefined' && window.getAllRunSegments) {
        allSegments = window.getAllRunSegments();
    } else {
        allSegments = getRunSegmentsFromFenceLines(activeLines);
    }
    
    console.log('MAP MATERIALS: allSegments from canvas:', allSegments);
    
    if (allSegments.length === 0 || !job) {
        return materials;
    }
    
    // USE CANONICAL TAKEOFF ENGINE
    const takeoff = buildTakeoff(job, fenceLines, runs, gates);
    const postCounts = takeoff.postCounts;
    
    console.log('CANONICAL TAKEOFF POST COUNTS:', postCounts);
    
    // Track totals across all runs for summary items
    let totalSingleGates = 0;
    let totalDoubleGates = 0;
    let totalPosts = 0;
    let totalGalvanizedPosts = 0;
    let totalDonuts = 0;
    let totalAluminumBeams = 0;
    
    // Process each run
    allSegments.forEach(({ runIndex, run, segments }) => {
        const runLabel = run.orientationLabel || `Run ${runIndex + 1}`;
        
        // Calculate fence LF (excluding gates)
        const fenceLF = segments
            .filter(s => s.type === 'fence')
            .reduce((sum, s) => sum + s.lengthFt, 0);
        
        // Count gates (flexible width detection)
        const gateSegments = segments.filter(s => s.type === 'gate');
        const singleGates = gateSegments.filter(s => s.gate.widthFt <= 6);
        const doubleGates = gateSegments.filter(s => s.gate.widthFt > 6);
        
        if (fenceLF < 0.1 && gateSegments.length === 0) return;
        
        // CRITICAL FIX: Find assigned run from fence line data
        let manualRun = null;

        // Get assignedRunId from the actual fence line
        const fenceLine = fenceLines.find((_, idx) => idx === runIndex);
        if (fenceLine?.assignedRunId) {
            manualRun = activeRuns.find(r => r.id === fenceLine.assignedRunId);
        }

        // Fallback: try run.assignedRunId from segment metadata
        if (!manualRun && run.assignedRunId) {
            manualRun = activeRuns.find(r => r.id === run.assignedRunId);
        }

        // Fallback: match by label
        if (!manualRun) {
            manualRun = activeRuns.find(r => r.runLabel === runLabel);
        }

        // CRITICAL: Skip if no active run found (existing/removed runs filtered out)
        if (!manualRun) {
            return;
        }
        
        // Use manual run data if available, otherwise fall back to job data
        const materialType = manualRun?.materialType || job.materialType || 'Vinyl';
        const fenceHeight = manualRun?.fenceHeight || job.fenceHeight || '6\'';
        const style = manualRun?.style || job.style || 'Privacy';
        
        // Update run label if manual run is assigned
        const displayLabel = manualRun ? manualRun.runLabel : runLabel;
        
        // Add fence LF line item
        if (fenceLF > 0) {
            materials.push({
                runLabel: displayLabel,
                materialDescription: `${fenceHeight} ${materialType} ${style} Fence`,
                quantityCalculated: Math.round(fenceLF * 10) / 10,
                uom: 'LF',
                notes: `Fence length from map: ${fenceLF.toFixed(1)} ft${manualRun ? ' (Run: ' + manualRun.runLabel + ')' : ''}`,
                source: 'map',
                runIndex
            });
        }
        
        // Calculate materials based on fence type
        if (materialType === 'Vinyl' && fenceLF > 0) {
            const baseSpacing = 8;

            // CORRECT: Calculate panels based on spaces between posts (per segment)
            const fenceSegments = segments.filter(s => s.type === 'fence');
            let totalPanels = 0;

            fenceSegments.forEach(segment => {
                const segmentPanels = Math.ceil(segment.lengthFt / baseSpacing);
                totalPanels += segmentPanels;
            });

            let bayCalculationNote = fenceSegments.length > 1 ? ` (${fenceSegments.length} segments)` : '';
            if (manualRun && manualRun.mathSubRuns && manualRun.mathSubRuns.length > 0) {
                bayCalculationNote += ' (slope-adjusted)';
            }

            // Vinyl Panels ONLY - posts handled at Overall level via canonical engine
            materials.push({
                runLabel: displayLabel,
                materialDescription: `${fenceHeight} ${style} Vinyl Panels`,
                quantityCalculated: totalPanels,
                uom: 'pcs',
                notes: `${totalPanels} panels for ${fenceLF.toFixed(1)} LF fence${bayCalculationNote}`,
                source: 'map',
                runIndex
            });
        } else if (materialType === 'Chain Link' && fenceLF > 0) {
            // CHAIN LINK: Fence LF line item (map source)
            materials.push({
                runLabel: displayLabel,
                materialDescription: `${fenceHeight} Chain Link Fence`,
                quantityCalculated: Math.round(fenceLF * 10) / 10,
                uom: 'LF',
                notes: `Fence length from map: ${fenceLF.toFixed(1)} ft`,
                source: 'map',
                runIndex
            });
            
            // NOTE: Chain Link hardware (fabric, rails, ties, posts) is calculated once at job level via canonical takeoff
            // This avoids double-counting and ensures consistent calculations
        } else if (materialType === 'Wood' && fenceLF > 0) {
            // WOOD: Fence LF line item (map source)
            materials.push({
                runLabel: displayLabel,
                materialDescription: `${fenceHeight} Wood Fence`,
                quantityCalculated: Math.round(fenceLF * 10) / 10,
                uom: 'LF',
                notes: `Fence length from map: ${fenceLF.toFixed(1)} ft`,
                source: 'map',
                runIndex
            });
            
            // NOTE: Wood hardware (posts, rails, pickets, nails, screws) is calculated once at job level via canonical takeoff
            // This avoids double-counting and ensures consistent calculations
        } else if (materialType === 'Aluminum' && fenceLF > 0) {
            const sectionWidth = 6;
            const sections = Math.ceil(fenceLF / sectionWidth);
            const posts = sections + 1;
            totalPosts += posts;
            
            // Aluminum Sections/Panels
            materials.push({
                runLabel: displayLabel,
                materialDescription: `${fenceHeight} Aluminum Section`,
                quantityCalculated: sections,
                uom: 'pcs',
                notes: `${sections} sections for ${fenceLF.toFixed(1)} LF (6 ft panels)`,
                source: 'map',
                runIndex
            });
            
            // Aluminum Line Posts
            materials.push({
                runLabel: displayLabel,
                materialDescription: 'Aluminum Line Posts',
                quantityCalculated: posts,
                uom: 'pcs',
                notes: `Posts for ${sections} sections`,
                source: 'map',
                runIndex
            });
            
            // Aluminum Post Caps
            materials.push({
                runLabel: displayLabel,
                materialDescription: 'Aluminum Post Caps',
                quantityCalculated: posts,
                uom: 'pcs',
                notes: `One cap per post`,
                source: 'map',
                runIndex
            });
        }
        
        // Add gate items and track totals - SEPARATE RUN LABEL FOR GATES
        const gateRunLabel = `${displayLabel} - Gates`;
        
        if (singleGates.length > 0) {
            totalSingleGates += singleGates.length;
            materials.push({
                runLabel: gateRunLabel,
                materialDescription: `${fenceHeight}x4' ${materialType} Single Gate`,
                quantityCalculated: singleGates.length,
                uom: 'pcs',
                notes: `${singleGates.length} single gate(s) from map`,
                source: 'map',
                runIndex
            });
            
            // Gate posts for single gates
            if (materialType === 'Vinyl') {
                const gatePostCount = singleGates.length * 2;
                totalAluminumBeams += gatePostCount;
                
                // Aluminum Gate Beam (1 per gate post)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Aluminum Gate Beam (Vinyl Gate Post Reinforcement)',
                    quantityCalculated: gatePostCount,
                    uom: 'pcs',
                    notes: `${singleGates.length} single gate × 2 posts = ${gatePostCount} beams`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Chain Link') {
                // Chain Link Gate Frame
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Chain Link Gate Frame',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `${singleGates.length} single gate frame${singleGates.length > 1 ? 's' : ''}`,
                    source: 'map',
                    runIndex
                });
                
                // Gate Hinges (2 per single gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Hinges',
                    quantityCalculated: singleGates.length * 2,
                    uom: 'pcs',
                    notes: `${singleGates.length} single gate${singleGates.length > 1 ? 's' : ''} × 2 hinges = ${singleGates.length * 2}`,
                    source: 'map',
                    runIndex
                });
                
                // Gate Caps
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Caps',
                    quantityCalculated: singleGates.length * 2,
                    uom: 'pcs',
                    notes: `${singleGates.length} single gate × 2 = ${singleGates.length * 2} caps`,
                    source: 'map',
                    runIndex
                });
            }
            
            // Gate latch and hardware for single gates
            if (materialType === 'Vinyl') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Vinyl Gate Latch',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `One latch per single gate`,
                    source: 'map',
                    runIndex
                });
                
                // Vinyl gate hinges (1 pair per gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Vinyl Gate Hinges',
                    quantityCalculated: singleGates.length,
                    uom: 'pairs',
                    notes: `${singleGates.length} gate${singleGates.length > 1 ? 's' : ''} × 1 pair`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Wood') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Lock Latch 5\' Post Latch (Single Gate)',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `One latch per single gate`,
                    source: 'map',
                    runIndex
                });
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Handle',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `One handle per gate`,
                    source: 'map',
                    runIndex
                });
                
                // Wood gate hinges (1 pair per gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Wood Gate Hinges (Heavy Duty)',
                    quantityCalculated: singleGates.length,
                    uom: 'pairs',
                    notes: `${singleGates.length} gate${singleGates.length > 1 ? 's' : ''} × 1 pair`,
                    source: 'map',
                    runIndex
                });
                
                // Gate frame rails for wood single gates (5 rails per gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: '2x4 Gate Frame Rails',
                    quantityCalculated: singleGates.length * 5,
                    uom: 'pcs',
                    notes: `${singleGates.length} single gates × 5 rails = ${singleGates.length * 5}`,
                    source: 'map',
                    runIndex
                });
                
                // Rail screws for single gate rails
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Rail Screws (Gate)',
                    quantityCalculated: singleGates.length * 5 * 4,
                    uom: 'pcs',
                    notes: `${singleGates.length * 5} gate rails × 4 screws = ${singleGates.length * 5 * 4}`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Chain Link') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Chain Link Gate Latch (Single)',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `One latch per single gate`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Aluminum') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'D&D Magna Latch',
                    quantityCalculated: singleGates.length,
                    uom: 'pcs',
                    notes: `One latch per single gate`,
                    source: 'map',
                    runIndex
                });
                
                // Aluminum gate hinges (1 pair per gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Aluminum Gate Hinges',
                    quantityCalculated: singleGates.length,
                    uom: 'pairs',
                    notes: `${singleGates.length} gate${singleGates.length > 1 ? 's' : ''} × 1 pair`,
                    source: 'map',
                    runIndex
                });
            }
        }
        
        if (doubleGates.length > 0) {
            totalDoubleGates += doubleGates.length;
            materials.push({
                runLabel: gateRunLabel,
                materialDescription: `${fenceHeight}x8' ${materialType} Double Gate`,
                quantityCalculated: doubleGates.length,
                uom: 'pcs',
                notes: `${doubleGates.length} double gate(s) from map`,
                source: 'map',
                runIndex
            });

            // Gate posts for double gates
            if (materialType === 'Vinyl') {
                const gatePostCount = doubleGates.length * 2;
                totalAluminumBeams += gatePostCount;

                // Aluminum Gate Beam (1 per gate post)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Aluminum Gate Beam (Vinyl Gate Post Reinforcement)',
                    quantityCalculated: gatePostCount,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gate × 2 posts = ${gatePostCount} beams`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Chain Link') {
                // Chain Link Gate Frames (2 per double gate - one per leaf)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Chain Link Gate Frame',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gate${doubleGates.length > 1 ? 's' : ''} × 2 frames (1 per leaf) = ${doubleGates.length * 2}`,
                    source: 'map',
                    runIndex
                });
                
                // Gate Hinges (4 per double gate - 2 per leaf)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Hinges',
                    quantityCalculated: doubleGates.length * 4,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gate${doubleGates.length > 1 ? 's' : ''} × 4 hinges (2 per leaf) = ${doubleGates.length * 4}`,
                    source: 'map',
                    runIndex
                });
                
                // Gate Caps
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Caps',
                    quantityCalculated: doubleGates.length * 4,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gate × 4 = ${doubleGates.length * 4} caps`,
                    source: 'map',
                    runIndex
                });
            }
            
            // Gate latch and hardware for double gates
            if (materialType === 'Vinyl') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Vinyl Gate Latch',
                    quantityCalculated: doubleGates.length,
                    uom: 'pcs',
                    notes: `One latch per double gate`,
                    source: 'map',
                    runIndex
                });
                
                // Vinyl double gate hinges (2 pairs per double gate - 1 pair per leaf)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Vinyl Gate Hinges',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pairs',
                    notes: `${doubleGates.length} double gate${doubleGates.length > 1 ? 's' : ''} × 2 pairs`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Wood') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Locklatch 4" Gate Latch (Double Gate)',
                    quantityCalculated: doubleGates.length,
                    uom: 'pcs',
                    notes: `One latch per double gate`,
                    source: 'map',
                    runIndex
                });
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Gate Handle',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pcs',
                    notes: `${doubleGates.length} gates × 2 handles = ${doubleGates.length * 2}`,
                    source: 'map',
                    runIndex
                });
                
                // Wood double gate hinges (2 pairs per double gate - 1 pair per leaf)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Wood Gate Hinges (Heavy Duty)',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pairs',
                    notes: `${doubleGates.length} gate${doubleGates.length > 1 ? 's' : ''} × 2 pairs`,
                    source: 'map',
                    runIndex
                });
                
                // Gate frame rails for wood double gates (5 rails per leaf = 10 rails per double gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: '2x4 Gate Frame Rails',
                    quantityCalculated: doubleGates.length * 10,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gates × 10 rails (5 per leaf) = ${doubleGates.length * 10}`,
                    source: 'map',
                    runIndex
                });
                
                // Rail screws for double gate rails
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Rail Screws (Gate)',
                    quantityCalculated: doubleGates.length * 10 * 4,
                    uom: 'pcs',
                    notes: `${doubleGates.length * 10} gate rails × 4 screws = ${doubleGates.length * 10 * 4}`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Chain Link') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Chain Link Gate Latch (Double)',
                    quantityCalculated: doubleGates.length,
                    uom: 'pcs',
                    notes: `One latch per double gate`,
                    source: 'map',
                    runIndex
                });
                
                // Cane Bolts / Drop Rods (2 per double gate - one per inactive leaf)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Cane Bolt / Drop Rod',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gate${doubleGates.length > 1 ? 's' : ''} × 2 = ${doubleGates.length * 2}`,
                    source: 'map',
                    runIndex
                });
            } else if (materialType === 'Aluminum') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'D&D Magna Latch',
                    quantityCalculated: doubleGates.length,
                    uom: 'pcs',
                    notes: `One latch per double gate`,
                    source: 'map',
                    runIndex
                });
                
                // Aluminum double gate hinges (2 pairs per double gate)
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Aluminum Gate Hinges',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pairs',
                    notes: `${doubleGates.length} gate${doubleGates.length > 1 ? 's' : ''} × 2 pairs`,
                    source: 'map',
                    runIndex
                });
            }
            
            // Cane bolts for double gates (non-chain link materials only - chain link handled separately)
            if (materialType !== 'Chain Link') {
                materials.push({
                    runLabel: gateRunLabel,
                    materialDescription: 'Cane Bolt / Drop Rod',
                    quantityCalculated: doubleGates.length * 2,
                    uom: 'pcs',
                    notes: `${doubleGates.length} double gates × 2 (one per leaf) = ${doubleGates.length * 2}`,
                    source: 'map',
                    runIndex
                });
            }
        }
    });
    
    // Add posts - ONLY ONCE for entire perimeter
    const materialType = job.materialType || 'Vinyl';
    const fenceHeightFt = parseInt(job.fenceHeight) || 6;

    // VINYL POST MATERIALS - All from canonical takeoff
    if (materialType === 'Vinyl' && postCounts.totalVinylPosts > 0) {
        // Galvanized posts = line + corner + end (NOT gate posts)
        const totalGalvanizedPosts = postCounts.linePosts + postCounts.cornerPosts + postCounts.endPosts;

        materials.push({
            runLabel: 'Overall',
            materialDescription: '2.5" Galvanized Posts (All Vinyl Post Reinforcement)',
            quantityCalculated: totalGalvanizedPosts,
            uom: 'pcs',
            notes: `${postCounts.linePosts} line + ${postCounts.cornerPosts} corner + ${postCounts.endPosts} end = ${totalGalvanizedPosts} galvanized posts`,
            source: 'map',
            runIndex: -1
        });

        // No-Dig Donuts (2 per galvanized post)
        materials.push({
            runLabel: 'Overall',
            materialDescription: 'No-Dig Donuts (2 per Galvanized Post)',
            quantityCalculated: totalGalvanizedPosts * 2,
            uom: 'pcs',
            notes: `${totalGalvanizedPosts} galvanized posts × 2 = ${totalGalvanizedPosts * 2} donuts`,
            source: 'map',
            runIndex: -1
        });

        // Vinyl sleeves - separate counts for corner/end and line posts
        const cornerAndEndPosts = postCounts.cornerPosts + postCounts.endPosts;
        if (cornerAndEndPosts > 0) {
            materials.push({
                runLabel: 'Overall',
                materialDescription: '5x5 Vinyl Corner/End Posts',
                quantityCalculated: cornerAndEndPosts,
                uom: 'pcs',
                notes: `${postCounts.cornerPosts} corner + ${postCounts.endPosts} end = ${cornerAndEndPosts} vinyl sleeves`,
                source: 'map',
                runIndex: -1
            });
        }

        if (postCounts.linePosts > 0) {
            materials.push({
                runLabel: 'Overall',
                materialDescription: '5x5 Vinyl Line Posts',
                quantityCalculated: postCounts.linePosts,
                uom: 'pcs',
                notes: `${postCounts.linePosts} line posts from canonical takeoff`,
                source: 'map',
                runIndex: -1
            });
        }

        // Vinyl Post Caps (excludes gate posts)
        materials.push({
            runLabel: 'Overall',
            materialDescription: 'Vinyl Post Caps',
            quantityCalculated: totalGalvanizedPosts,
            uom: 'pcs',
            notes: `Caps for ${totalGalvanizedPosts} vinyl posts (excludes ${postCounts.gatePosts} gate posts)`,
            source: 'map',
            runIndex: -1
        });
    }

    if (postCounts.cornerPosts > 0 || postCounts.endPosts > 0 || totalSingleGates > 0 || totalDoubleGates > 0) {
        // For Chain Link: terminal posts include corners + ends + gate posts
        const totalGatePosts = (totalSingleGates + totalDoubleGates) * 2;
        const totalTerminalPosts = postCounts.cornerPosts + postCounts.endPosts + totalGatePosts;

        if (materialType === 'Chain Link') {
            // Terminal Posts (corners + ends + gate posts - same post type)
            const terminalPostNote = totalGatePosts > 0 
                ? `${postCounts.cornerPosts} corners + ${postCounts.endPosts} ends + ${totalGatePosts} gate posts (${totalSingleGates + totalDoubleGates} gates × 2) = ${totalTerminalPosts} terminal posts`
                : `${postCounts.cornerPosts} corners + ${postCounts.endPosts} ends = ${totalTerminalPosts} terminal posts`;
            
            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Terminal Posts – Chain Link',
                quantityCalculated: totalTerminalPosts,
                uom: 'pcs',
                notes: terminalPostNote,
                source: 'map',
                runIndex: -1
            });
            
            // Terminal Post Caps (1 per terminal post)
            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Terminal Post Caps',
                quantityCalculated: totalTerminalPosts,
                uom: 'pcs',
                notes: `${totalTerminalPosts} caps (1 per terminal post)`,
                source: 'map',
                runIndex: -1
            });
            
            // Tension bands (height-based) - ALL terminal posts receive same quantity
            // Formula: Tension Bands per Terminal = Fence Height in Feet
            const tensionBandsPerTerminal = fenceHeightFt;
            const totalTensionBands = totalTerminalPosts * tensionBandsPerTerminal;

            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Tension Bands',
                quantityCalculated: totalTensionBands,
                uom: 'pcs',
                notes: `${totalTerminalPosts} terminal posts × ${tensionBandsPerTerminal} bands (${fenceHeightFt}' fence) = ${totalTensionBands}`,
                source: 'map',
                runIndex: -1
            });
            
            // Tension Bars (height-specific)
            const tensionBarSize = fenceHeightFt <= 4 ? "4'" : fenceHeightFt === 5 ? "5'" : "6'";
            materials.push({
                runLabel: 'Overall',
                materialDescription: `Tension Bars (${tensionBarSize})`,
                quantityCalculated: totalTerminalPosts,
                uom: 'pcs',
                notes: `${totalTerminalPosts} terminal posts × 1 = ${totalTerminalPosts} bars (${tensionBarSize} for ${fenceHeightFt}' fence)`,
                source: 'map',
                runIndex: -1
            });
            
            // Brace Bands - ALL terminal posts receive 2 bands
            // Formula: 2 per terminal post (for top rail cup and bottom brace)
            const totalBraceBands = totalTerminalPosts * 2;

            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Brace Bands',
                quantityCalculated: totalBraceBands,
                uom: 'pcs',
                notes: `${totalTerminalPosts} terminal posts × 2 bands = ${totalBraceBands}`,
                source: 'map',
                runIndex: -1
            });
            
            // Rail End Cups - exactly 1 per terminal post
            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Rail End Cups',
                quantityCalculated: totalTerminalPosts,
                uom: 'pcs',
                notes: `${totalTerminalPosts} terminal posts × 1 cup = ${totalTerminalPosts}`,
                source: 'map',
                runIndex: -1
            });
            
            // Carriage Bolts
            const boltQty = Math.ceil(totalTerminalPosts * 5 * 1.25);
            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Carriage Bolts & Nuts',
                quantityCalculated: boltQty,
                uom: 'pcs',
                notes: `${totalTerminalPosts} terminal posts × 5 + 25% = ${boltQty}`,
                source: 'map',
                runIndex: -1
            });
        } else if (materialType === 'Aluminum' && postCounts.cornerPosts > 0) {
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Aluminum Corner Posts',
                    quantityCalculated: postCounts.cornerPosts,
                    uom: 'pcs',
                    notes: `${postCounts.cornerPosts} corner(s) detected`,
                    source: 'map',
                    runIndex: -1
                });
                
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Aluminum Post Caps',
                    quantityCalculated: postCounts.cornerPosts,
                    uom: 'pcs',
                    notes: `Caps for corner posts`,
                    source: 'map',
                    runIndex: -1
                });
                
            } else if (materialType === 'Wood' && postCounts.cornerPosts > 0) {
                // Wood
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Steel Corner Post',
                    quantityCalculated: postCounts.cornerPosts,
                    uom: 'pcs',
                    notes: `${postCounts.cornerPosts} corner(s) detected`,
                    source: 'map',
                    runIndex: -1
                });
            }
        


        if (postCounts.endPosts > 0) {
            if (materialType === 'Aluminum') {
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Aluminum End Posts',
                    quantityCalculated: postCounts.endPosts,
                    uom: 'pcs',
                    notes: `${postCounts.endPosts} end post(s) detected`,
                    source: 'map',
                    runIndex: -1
                });
                
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Aluminum Post Caps',
                    quantityCalculated: postCounts.endPosts,
                    uom: 'pcs',
                    notes: `Caps for end posts`,
                    source: 'map',
                    runIndex: -1
                });
                
            } else if (materialType === 'Wood') {
                // Wood
                materials.push({
                    runLabel: 'Overall',
                    materialDescription: 'Steel End Post',
                    quantityCalculated: postCounts.endPosts,
                    uom: 'pcs',
                    notes: `${postCounts.endPosts} end post(s) detected`,
                    source: 'map',
                    runIndex: -1
                });
            }
        }
    }
    
    // ALUMINUM: Quick Crete for all aluminum posts (corners, ends, line posts, gate posts)
    if (materialType === 'Aluminum') {
        const totalAluminumPosts = (postCounts.cornerPosts || 0) + (postCounts.endPosts || 0) + (postCounts.linePosts || 0) + (postCounts.gatePosts || 0);
        if (totalAluminumPosts > 0) {
            materials.push({
                runLabel: 'Overall',
                materialDescription: 'Quick Crete 60lb Bags',
                quantityCalculated: totalAluminumPosts * 2,
                uom: 'bags',
                notes: `${totalAluminumPosts} aluminum posts × 2 bags = ${totalAluminumPosts * 2} bags`,
                source: 'map',
                runIndex: -1
            });
        }
    }
    
    // VINYL: Quick Crete for gate aluminum I-beams only
    if (materialType === 'Vinyl' && totalAluminumBeams > 0) {
        materials.push({
            runLabel: 'Overall',
            materialDescription: 'Quick Crete 60lb Bags',
            quantityCalculated: totalAluminumBeams * 2,
            uom: 'bags',
            notes: `${totalAluminumBeams} aluminum I-beams (vinyl gate posts) × 2 bags = ${totalAluminumBeams * 2} bags`,
            source: 'map',
            runIndex: -1
        });
    }
    
    // TAKEOFF AUDIT BLOCK - Add to materials for verification
    if (materialType === 'Vinyl') {
        materials.push({
            runLabel: '__AUDIT__',
            materialDescription: '📊 TAKEOFF AUDIT',
            quantityCalculated: 0,
            uom: '',
            notes: `End: ${postCounts.endPosts} | Corner: ${postCounts.cornerPosts} | Line: ${postCounts.linePosts} | Gate: ${postCounts.gatePosts} | TOTAL VINYL: ${postCounts.totalVinylPosts}`,
            source: 'audit',
            runIndex: -2
        });
        
        materials.push({
            runLabel: '__AUDIT__',
            materialDescription: '🔧 POST MATERIALS',
            quantityCalculated: 0,
            uom: '',
            notes: `Galvanized: ${totalGalvanizedPosts} | Donuts: ${totalDonuts} | Aluminum Beams: ${totalAluminumBeams}`,
            source: 'audit',
            runIndex: -2
        });
        
        // Validation check
        if (totalGalvanizedPosts > postCounts.totalVinylPosts) {
            materials.push({
                runLabel: '__AUDIT__',
                materialDescription: '❌ ERROR',
                quantityCalculated: 0,
                uom: '',
                notes: `GALVANIZED POSTS (${totalGalvanizedPosts}) EXCEED TOTAL VINYL POSTS (${postCounts.totalVinylPosts})`,
                source: 'audit',
                runIndex: -2
            });
        }
        
        if (totalDonuts / 2 > postCounts.totalVinylPosts) {
            materials.push({
                runLabel: '__AUDIT__',
                materialDescription: '❌ ERROR',
                quantityCalculated: 0,
                uom: '',
                notes: `DONUTS/2 (${totalDonuts / 2}) EXCEED TOTAL VINYL POSTS (${postCounts.totalVinylPosts})`,
                source: 'audit',
                runIndex: -2
            });
        }
    }
    
    return materials;
}