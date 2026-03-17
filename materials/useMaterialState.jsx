/**
 * MATERIAL STATE HOOK
 * Custom hook for managing material-scoped state
 * Handles restoration and synchronization
 */

import { useEffect, useState } from 'react';
import { restoreSnapshot } from './MaterialSwitchHandler';

/**
 * Hook to manage material-scoped state restoration
 */
export function useMaterialState(job, initialFenceLines, initialTrees, initialAnnotations) {
  const [canvasKey, setCanvasKey] = useState(0);
  const [restoredState, setRestoredState] = useState(null);
  const [lastMaterial, setLastMaterial] = useState(null);
  
  useEffect(() => {
    if (!job || !job.materialType) return;
    
    // Only trigger restoration when material actually changes
    if (job.materialType !== lastMaterial) {
      console.log('Material type changed from', lastMaterial, 'to', job.materialType);
      
      // Check if we have a saved snapshot for current material
      const snapshot = restoreSnapshot(job.materialType, job);
      
      // Only restore if snapshot exists and has data
      if (snapshot && snapshot.mapState && (snapshot.mapState.fenceLines?.length > 0 || snapshot.mapState.trees?.length > 0)) {
        console.log('Restoring snapshot for', job.materialType, snapshot);
        setRestoredState(snapshot);
        
        // Force canvas remount on material change
        setCanvasKey(prev => prev + 1);
      } else {
        console.log('No snapshot to restore for', job.materialType);
        setRestoredState(null);
      }
      
      setLastMaterial(job.materialType);
    }
  }, [job?.materialType, job?.materialStates, lastMaterial]);
  
  return {
    canvasKey,
    restoredState,
    shouldRestore: !!restoredState && restoredState.materialType !== lastMaterial
  };
}

/**
 * Get active takeoff for current material
 * Guards against material mismatch
 */
export function getActiveTakeoff(job, calculatedTakeoff) {
  if (!job || !job.materialType) return null;
  
  // Check if we have a saved snapshot
  const snapshot = job.materialStates?.[job.materialType]?.takeoffSnapshot;
  
  // Prefer snapshot over calculated (for restored state)
  if (snapshot && snapshot.materialType === job.materialType) {
    return snapshot;
  }
  
  // Fallback to calculated takeoff (must match material)
  if (calculatedTakeoff && calculatedTakeoff.materialType === job.materialType) {
    return calculatedTakeoff;
  }
  
  // No valid takeoff available
  return null;
}

/**
 * Check if takeoff is valid for current material
 */
export function isTakeoffValid(takeoff, currentMaterialType) {
  if (!takeoff || !currentMaterialType) return false;
  return takeoff.materialType === currentMaterialType;
}