/**
 * CONTRACT 1: PRICING EXECUTION GATES (HARD)
 * 
 * Pricing MUST NOT execute unless ALL gates pass
 */

export function validatePricingGates({
  geometry_checksum,
  takeoff_hash,
  takeoffStatus,
  unresolved_items,
  unitAuthority,
  retail_anchor
}) {
  const blockedReasons = [];
  
  // Gate 1: geometry_checksum exists
  if (!geometry_checksum) {
    blockedReasons.push({
      code: 'MISSING_GEOMETRY_CHECKSUM',
      message: 'Geometry checksum not computed',
      severity: 'BLOCKING',
      actionHint: 'Save map and ensure geometry is valid'
    });
  }
  
  // Gate 2: takeoff_hash exists
  if (!takeoff_hash) {
    blockedReasons.push({
      code: 'MISSING_TAKEOFF_HASH',
      message: 'Takeoff hash not computed',
      severity: 'BLOCKING',
      actionHint: 'Rebuild takeoff from current geometry'
    });
  }
  
  // Gate 3: takeoff status is COMPLETE
  if (takeoffStatus !== 'COMPLETE') {
    blockedReasons.push({
      code: 'INCOMPLETE_TAKEOFF',
      message: `Takeoff status: ${takeoffStatus}`,
      severity: 'BLOCKING',
      actionHint: 'Fix takeoff errors before pricing'
    });
  }
  
  // Gate 4: no unresolved items
  if (unresolved_items && unresolved_items.length > 0) {
    blockedReasons.push({
      code: 'UNRESOLVED_ITEMS',
      message: `${unresolved_items.length} items not mapped to catalog`,
      severity: 'BLOCKING',
      actionHint: 'Map all items in Fence System Config'
    });
  }
  
  // Gate 5: unit authority not blocked
  if (unitAuthority === 'BLOCKED') {
    blockedReasons.push({
      code: 'UNIT_AUTHORITY_BLOCKED',
      message: 'Unit conversion conflicts detected',
      severity: 'BLOCKING',
      actionHint: 'Add unit conversions or fix catalog units'
    });
  }
  
  return {
    canPrice: blockedReasons.length === 0,
    blockedReasons
  };
}