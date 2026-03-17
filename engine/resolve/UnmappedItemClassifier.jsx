/**
 * Unmapped Item Classifier
 * Categorizes WHY an item is unmapped for better debugging
 */

/**
 * Classify unmapped item
 * @param {Object} item - Unresolved item
 * @param {Array} companySkuMap - CompanySkuMap entries
 * @param {string} companyId - Current company ID
 * @returns {Object} { category, message, details }
 */
export function classifyUnmappedItem(item, companySkuMap = [], companyId = null) {
  const uck = item.uck || item.canonical_key;
  const unit = item.unit || item.uom;

  if (!uck) {
    return {
      category: 'MISSING_UCK',
      message: 'Item has no UCK/canonical_key',
      details: { displayName: item.displayName || item.lineItemName }
    };
  }

  // Check if UCK exists in CompanySkuMap at all (across companies)
  const globalUckMatch = companySkuMap.find(m => m.uck === uck);

  if (!globalUckMatch) {
    return {
      category: 'UCK_NOT_FOUND',
      message: `UCK "${uck}" not found in any company mapping`,
      details: { uck, unit, companyId }
    };
  }

  // Check if mapping exists for this company
  const companyMatch = companySkuMap.find(
    m => m.uck === uck && m.companyId === companyId
  );

  if (!companyMatch) {
    // Mapping exists but for different company
    return {
      category: 'COMPANY_MISMATCH',
      message: `UCK mapping exists but under company "${globalUckMatch.companyId}", not "${companyId}"`,
      details: {
        uck,
        requestedCompanyId: companyId,
        mappedCompanyId: globalUckMatch.companyId,
        mappedTo: globalUckMatch.materialCatalogName
      }
    };
  }

  // Mapping exists for company - check unit match
  if (unit && companyMatch.attributes?.unit && companyMatch.attributes.unit !== unit) {
    return {
      category: 'UNIT_MISMATCH',
      message: `Unit mismatch: takeoff expects "${unit}", mapping has "${companyMatch.attributes.unit}"`,
      details: {
        uck,
        takeoffUnit: unit,
        mappedUnit: companyMatch.attributes.unit,
        mappedTo: companyMatch.materialCatalogName
      }
    };
  }

  // All checks passed - mapping exists
  return {
    category: 'MAPPED',
    message: 'Item is mapped',
    details: {
      uck,
      mappedTo: companyMatch.materialCatalogName,
      status: companyMatch.status,
      locked: companyMatch.locked || false
    }
  };
}

/**
 * Group unmapped items by category
 */
export function groupUnmappedByCategory(unmappedItems, companySkuMap = [], companyId = null) {
  const groups = {
    UNMAPPED: [],
    CONTRACT_VIOLATION: [],
    COMPANY_MISMATCH: [],
    UNIT_MISMATCH: [],
    MISSING_UCK: []
  };

  for (const item of unmappedItems) {
    const classification = classifyUnmappedItem(item, companySkuMap, companyId);
    const category = classification.category;

    if (groups[category]) {
      groups[category].push({
        item,
        classification
      });
    }
  }

  return groups;
}