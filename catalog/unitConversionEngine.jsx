/**
 * UNIT CONVERSION ENGINE - STRICT ENFORCEMENT
 * Hard enforcement of unit rules with loud failures.
 * 
 * RULES:
 * 1️⃣ Rails: MUST be "stick", convert LF → ceil(LF / stick_length_ft)
 * 2️⃣ Fabric: MUST be "roll", convert LF → ceil(LF / 50)
 * 3️⃣ Tension Wire: MUST be "100lf", convert LF → ceil(LF / 100)
 * 4️⃣ Posts: MUST be "pcs" or "each", NO fractions, enforce vinyl support rules
 * 5️⃣ Fail LOUD with clear error messages
 */

/**
 * Validate and convert quantity with STRICT enforcement
 * @param {object} takeoffItem - Line item from takeoff
 * @param {object} catalogItem - Catalog item with unit rules
 * @returns {object} { valid, quantity, unit, conversionApplied, conversionDetails, errors, violation }
 */
export function validateAndConvertUnit(takeoffItem, catalogItem) {
  const takeoffQty = Number(takeoffItem.quantityCalculated ?? takeoffItem.qty ?? 0);
  const takeoffUnit = (takeoffItem.uom || takeoffItem.unit || '').toLowerCase().trim();
  const catalogUnit = (catalogItem.unit || '').toLowerCase().trim();
  const category = (catalogItem.category || '').toLowerCase();
  const subCategory = (catalogItem.sub_category || '').toLowerCase();
  const canonicalKey = takeoffItem.canonical_key || takeoffItem.canonicalKey || '';
  
  const result = {
    valid: true,
    quantity: takeoffQty,
    unit: catalogUnit,
    conversionApplied: false,
    conversionDetails: null,
    errors: [],
    violation: null
  };

  // 🚨 RULE 1: Rails MUST be STICK
  if (category === 'rail' || subCategory?.includes('rail') || canonicalKey.includes('_rail_')) {
    // HARD REQUIREMENT: Catalog unit must be "stick"
    if (catalogUnit !== 'stick') {
      result.valid = false;
      result.violation = {
        rule: 'RAIL_UNIT_ENFORCEMENT',
        expected: 'stick',
        received: catalogUnit,
        message: `Rail items MUST have unit "stick" in catalog (found: "${catalogUnit}")`
      };
      result.errors.push(result.violation.message);
      return result;
    }
    
    // Convert LF → sticks if takeoff provides LF
    if (takeoffUnit === 'lf' || takeoffUnit === 'ft' || takeoffUnit === 'linear feet') {
      const stickLength = catalogItem.stick_length_ft || 21;
      const sticksNeeded = Math.ceil(takeoffQty / stickLength);
      
      result.quantity = sticksNeeded;
      result.unit = 'stick';
      result.conversionApplied = true;
      result.conversionDetails = `✓ Converted ${takeoffQty} LF → ${sticksNeeded} sticks (${stickLength} ft/stick, rounded up)`;
      return result;
    }
    
    // If takeoff already in sticks, validate it's not fractional
    if (takeoffQty % 1 !== 0) {
      result.valid = false;
      result.violation = {
        rule: 'RAIL_FRACTIONAL_STICK',
        message: `Rails cannot have fractional stick quantities (received: ${takeoffQty})`
      };
      result.errors.push(result.violation.message);
      return result;
    }
  }

  // 🚨 RULE 2: Fabric MUST be ROLL
  if (category === 'fabric' || subCategory?.includes('fabric') || canonicalKey.includes('_fabric_')) {
    // HARD REQUIREMENT: Catalog unit must be "roll"
    if (catalogUnit !== 'roll') {
      result.valid = false;
      result.violation = {
        rule: 'FABRIC_UNIT_ENFORCEMENT',
        expected: 'roll',
        received: catalogUnit,
        message: `Fabric MUST have unit "roll" in catalog (found: "${catalogUnit}")`
      };
      result.errors.push(result.violation.message);
      return result;
    }
    
    // Convert LF → rolls if takeoff provides LF
    if (takeoffUnit === 'lf' || takeoffUnit === 'ft' || takeoffUnit === 'linear feet') {
      const rollLength = catalogItem.package_qty || 50;
      const rollsNeeded = Math.ceil(takeoffQty / rollLength);
      
      result.quantity = rollsNeeded;
      result.unit = 'roll';
      result.conversionApplied = true;
      result.conversionDetails = `✓ Converted ${takeoffQty} LF → ${rollsNeeded} rolls (${rollLength} LF/roll, rounded up)`;
      return result;
    }
    
    // If takeoff already in rolls, validate it's not fractional
    if (takeoffQty % 1 !== 0) {
      result.valid = false;
      result.violation = {
        rule: 'FABRIC_FRACTIONAL_ROLL',
        message: `Fabric cannot have fractional roll quantities (received: ${takeoffQty})`
      };
      result.errors.push(result.violation.message);
      return result;
    }
  }

  // 🚨 RULE 3: Tension Wire MUST be 100LF
  if (subCategory?.includes('tension') || 
      catalogItem.crm_name?.toLowerCase().includes('tension wire') || 
      canonicalKey.includes('tension_wire')) {
    // HARD REQUIREMENT: Catalog unit must be "100lf"
    if (catalogUnit !== '100lf') {
      result.valid = false;
      result.violation = {
        rule: 'TENSION_WIRE_UNIT_ENFORCEMENT',
        expected: '100lf',
        received: catalogUnit,
        message: `Tension wire MUST have unit "100lf" in catalog (found: "${catalogUnit}")`
      };
      result.errors.push(result.violation.message);
      return result;
    }
    
    // Convert LF → 100lf units if takeoff provides LF
    if (takeoffUnit === 'lf' || takeoffUnit === 'ft' || takeoffUnit === 'linear feet') {
      const unitsNeeded = Math.ceil(takeoffQty / 100);
      
      result.quantity = unitsNeeded;
      result.unit = '100lf';
      result.conversionApplied = true;
      result.conversionDetails = `✓ Converted ${takeoffQty} LF → ${unitsNeeded} × 100LF units (rounded up)`;
      return result;
    }
  }

  // 🚨 RULE 4: Posts MUST be PCS or EACH (no fractions)
  if (category === 'post' || subCategory?.includes('post') || canonicalKey.includes('_post_')) {
    // HARD REQUIREMENT: Catalog unit must be "pcs" or "each"
    if (catalogUnit !== 'pcs' && catalogUnit !== 'each') {
      result.valid = false;
      result.violation = {
        rule: 'POST_UNIT_ENFORCEMENT',
        expected: 'pcs or each',
        received: catalogUnit,
        message: `Posts MUST have unit "pcs" or "each" in catalog (found: "${catalogUnit}")`
      };
      result.errors.push(result.violation.message);
      return result;
    }
    
    // BLOCK fractional quantities
    if (takeoffQty % 1 !== 0) {
      result.valid = false;
      result.violation = {
        rule: 'POST_FRACTIONAL_QTY',
        message: `Posts cannot have fractional quantities (received: ${takeoffQty})`
      };
      result.errors.push(result.violation.message);
      return result;
    }
  }

  // ✅ No conversion needed - units are valid
  return result;
}

/**
 * Validate catalog items for unit correctness (admin validation)
 * @param {array} catalogItems - Array of catalog items
 * @returns {object} { valid, errors: [{item, violations}] }
 */
export function validateCatalogUnits(catalogItems) {
  const errors = [];
  
  for (const item of catalogItems) {
    const category = (item.category || '').toLowerCase();
    const subCategory = (item.sub_category || '').toLowerCase();
    const unit = (item.unit || '').toLowerCase().trim();
    const violations = [];
    
    // Check rails
    if (category === 'rail' || subCategory?.includes('rail')) {
      if (unit !== 'stick') {
        violations.push({
          rule: 'RAIL_UNIT_ENFORCEMENT',
          expected: 'stick',
          received: unit,
          fix: 'Change unit to "stick" and add stick_length_ft'
        });
      }
      if (!item.stick_length_ft) {
        violations.push({
          rule: 'RAIL_MISSING_LENGTH',
          field: 'stick_length_ft',
          fix: 'Add stick_length_ft (typically 21)'
        });
      }
    }
    
    // Check fabric
    if (category === 'fabric' || subCategory?.includes('fabric')) {
      if (unit !== 'roll') {
        violations.push({
          rule: 'FABRIC_UNIT_ENFORCEMENT',
          expected: 'roll',
          received: unit,
          fix: 'Change unit to "roll" and add package_qty'
        });
      }
      if (!item.package_qty) {
        violations.push({
          rule: 'FABRIC_MISSING_PACKAGE_QTY',
          field: 'package_qty',
          fix: 'Add package_qty (typically 50 for LF per roll)'
        });
      }
    }
    
    // Check tension wire
    if (subCategory?.includes('tension') || item.crm_name?.toLowerCase().includes('tension wire')) {
      if (unit !== '100lf') {
        violations.push({
          rule: 'TENSION_WIRE_UNIT_ENFORCEMENT',
          expected: '100lf',
          received: unit,
          fix: 'Change unit to "100lf"'
        });
      }
    }
    
    // Check posts
    if (category === 'post' || subCategory?.includes('post')) {
      if (unit !== 'pcs' && unit !== 'each') {
        violations.push({
          rule: 'POST_UNIT_ENFORCEMENT',
          expected: 'pcs or each',
          received: unit,
          fix: 'Change unit to "pcs" or "each"'
        });
      }
    }
    
    if (violations.length > 0) {
      errors.push({
        item: {
          id: item.id,
          crm_name: item.crm_name,
          sku: item.sku,
          category: item.category,
          sub_category: item.sub_category,
          unit: item.unit
        },
        violations
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    totalItems: catalogItems.length,
    errorsCount: errors.length,
    errors
  };
}