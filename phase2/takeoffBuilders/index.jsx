/**
 * TAKEOFF BUILDERS INDEX
 * Routes to material-specific builders
 */

import { buildChainLinkTakeoff } from './chainLinkBuilder';
import { buildAluminumTakeoff } from './aluminumBuilder';
import { buildVinylTakeoff } from './vinylBuilder';
import { buildWoodTakeoff } from './woodBuilder';

/**
 * Build takeoff for a specific material set
 * Routes to the appropriate builder based on fence type
 */
export function buildTakeoffForSet(takeoff_input, materialSet, catalog) {
  console.log('[buildTakeoffForSet] Building for', materialSet.fenceType, materialSet.id);
  
  if (materialSet.fenceType === 'Chain Link') {
    return buildChainLinkTakeoff(takeoff_input, materialSet);
  }
  
  if (materialSet.fenceType === 'Aluminum') {
    return buildAluminumTakeoff(takeoff_input, materialSet);
  }
  
  if (materialSet.fenceType === 'Vinyl') {
    return buildVinylTakeoff(takeoff_input, materialSet);
  }
  
  if (materialSet.fenceType === 'Wood') {
    return buildWoodTakeoff(takeoff_input, materialSet);
  }
  
  console.error('[buildTakeoffForSet] Unknown fence type:', materialSet.fenceType);
  return [];
}