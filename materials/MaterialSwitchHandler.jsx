/**
 * MATERIAL SWITCH HANDLER
 * Single source of truth for material switching logic
 * Handles snapshot save/restore for reversible material changes
 */

/**
 * Save current material state to snapshot
 * @param {Object} job - Current job object
 * @param {Array} fenceLines - Current fence lines
 * @param {Array} trees - Current trees
 * @param {Array} annotations - Current annotations
 * @param {Object} canvasItems - Current canvas items
 * @param {Object} takeoff - Current takeoff calculation
 * @param {Object} rendererConfig - Optional custom renderer config (otherwise uses material default)
 */
export function saveCurrentSnapshot(job, fenceLines, trees, annotations, canvasItems, takeoff, rendererConfig = null) {
  const currentMaterial = job.materialType;
  
  // Preserve run assignments on fence lines
  const linesWithAssignments = (fenceLines || []).map(line => ({
    ...line,
    assignedRunId: line.assignedRunId || null
  }));
  
  return {
    mapState: {
      fenceLines: JSON.parse(JSON.stringify(linesWithAssignments)),
      trees: JSON.parse(JSON.stringify(trees || [])),
      annotations: JSON.parse(JSON.stringify(annotations || [])),
      canvasItems: {
        gates: JSON.parse(JSON.stringify(canvasItems.gates || [])),
        doubleGates: JSON.parse(JSON.stringify(canvasItems.doubleGates || [])),
        houses: JSON.parse(JSON.stringify(canvasItems.houses || [])),
        pools: JSON.parse(JSON.stringify(canvasItems.pools || [])),
        garages: JSON.parse(JSON.stringify(canvasItems.garages || [])),
        dogs: JSON.parse(JSON.stringify(canvasItems.dogs || [])),
        driveways: JSON.parse(JSON.stringify(canvasItems.driveways || [])),
        decks: JSON.parse(JSON.stringify(canvasItems.decks || [])),
        bushes: JSON.parse(JSON.stringify(canvasItems.bushes || [])),
        porches: JSON.parse(JSON.stringify(canvasItems.porches || [])),
        grasses: JSON.parse(JSON.stringify(canvasItems.grasses || [])),
        endPosts: JSON.parse(JSON.stringify(canvasItems.endPosts || []))
      }
    },
    takeoffSnapshot: takeoff ? {
      materialType: currentMaterial,
      postCounts: takeoff.postCounts,
      lineItems: takeoff.lineItems,
      graph: takeoff.graph,
      calculatedAt: new Date().toISOString()
    } : null,
    rendererConfig: rendererConfig || getRendererConfig(currentMaterial),
    lastCalculatedAt: new Date().toISOString()
  };
}

/**
 * Restore snapshot for target material
 */
export function restoreSnapshot(materialType, job) {
  const snapshot = job.materialStates?.[materialType];
  
  if (!snapshot) {
    return null; // Return null instead of empty - let caller decide
  }
  
  return {
    materialType,
    mapState: snapshot.mapState,
    takeoffSnapshot: snapshot.takeoffSnapshot,
    rendererConfig: snapshot.rendererConfig || getRendererConfig(materialType)
  };
}

/**
 * Initialize empty snapshot for new material
 */
export function initializeEmptySnapshot(materialType) {
  return {
    mapState: {
      fenceLines: [],
      trees: [],
      annotations: [],
      canvasItems: {
        gates: [],
        doubleGates: [],
        houses: [],
        pools: [],
        garages: [],
        dogs: [],
        driveways: [],
        decks: [],
        bushes: [],
        porches: [],
        grasses: [],
        endPosts: []
      }
    },
    takeoffSnapshot: null,
    rendererConfig: getRendererConfig(materialType)
  };
}

/**
 * Get renderer config for material type
 */
export function getRendererConfig(materialType) {
  const configs = {
    'Vinyl': { 
      spacing: 8, 
      showOverlay: false,
      postSpacingLabel: '8\' Panel Width'
    },
    'Chain Link': { 
      spacing: 10, 
      showOverlay: true,
      postSpacingLabel: '10\' Line Post Spacing'
    },
    'Wood': { 
      spacing: 7.5, 
      showOverlay: false,
      postSpacingLabel: '7.5\' Max Bay Width'
    },
    'Aluminum': { 
      spacing: 6, 
      showOverlay: false,
      postSpacingLabel: '6\' Panel Width'
    }
  };
  
  return configs[materialType] || configs['Vinyl'];
}

/**
 * Main material switch handler
 * Called when user changes material at job level
 */
export async function handleJobMaterialSwitch(
  nextMaterialType, 
  currentState,
  updateJobMutation
) {
  const { 
    job, 
    fenceLines, 
    trees, 
    annotations, 
    canvasItems, 
    takeoff 
  } = currentState;
  
  const currentMaterial = job.materialType;
  
  // Don't switch if already on target material
  if (currentMaterial === nextMaterialType) {
    return { success: false, message: 'Already on this material' };
  }
  
  // Step 1: Save current snapshot
  const currentSnapshot = saveCurrentSnapshot(
    job,
    fenceLines,
    trees,
    annotations,
    canvasItems,
    takeoff
  );
  
  // Step 2: Prepare materialStates update
  const updatedMaterialStates = {
    ...(job.materialStates || {}),
    [currentMaterial]: currentSnapshot
  };
  
  // Step 3: Restore or initialize target material snapshot
  const targetSnapshot = restoreSnapshot(nextMaterialType, {
    ...job,
    materialStates: updatedMaterialStates
  });
  
  // Step 4: Update job in database
  try {
    await updateJobMutation.mutateAsync({
      id: job.id,
      data: {
        materialType: nextMaterialType,
        materialStates: updatedMaterialStates
      }
    });
    
    return {
      success: true,
      targetSnapshot,
      message: `Successfully switched to ${nextMaterialType}`
    };
  } catch (error) {
    console.error('Material switch failed:', error);
    
    // User-friendly error messages
    let errorMsg = 'Failed to switch material. Please try again.';
    if (error.message?.includes('network')) {
      errorMsg = 'Network error. Check your connection and try again.';
    } else if (error.message?.includes('permission')) {
      errorMsg = 'Permission denied. You may not have access to modify this job.';
    }
    
    return {
      success: false,
      message: errorMsg,
      error
    };
  }
}