/**
 * CONTRACT 3: UNIT AUTHORITY (LOCKED)
 * 
 * No implicit unit conversions.
 * Must use explicit UnitConversionMap or BLOCK.
 */

export async function validateUnitAuthority({
  takeoffUnit,
  catalogUnit,
  unitConversions
}) {
  // If units match, authority is OK
  if (takeoffUnit === catalogUnit) {
    return {
      status: 'OK',
      conversion: null
    };
  }
  
  // Check for explicit conversion
  const conversionKey = `${takeoffUnit}→${catalogUnit}`;
  const conversion = unitConversions?.find(c => 
    c.from_unit === takeoffUnit && 
    c.to_unit === catalogUnit &&
    c.active
  );
  
  if (conversion) {
    return {
      status: 'OK',
      conversion: {
        from: takeoffUnit,
        to: catalogUnit,
        multiplier: conversion.multiplier,
        documented: true
      }
    };
  }
  
  // No conversion found - BLOCK
  return {
    status: 'BLOCKED',
    error: {
      code: 'UNIT_MISMATCH',
      message: `No conversion from ${takeoffUnit} to ${catalogUnit}`,
      severity: 'BLOCKING',
      actionHint: `Add unit conversion: ${takeoffUnit} → ${catalogUnit}`,
      expected: catalogUnit,
      received: takeoffUnit
    }
  };
}