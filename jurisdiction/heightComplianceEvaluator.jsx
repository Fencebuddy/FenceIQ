// Height Compliance Evaluator for Yard Zone Rules

/**
 * Parse height string to numeric feet
 */
function parseHeightToFt(heightStr) {
  if (typeof heightStr === 'number') return heightStr;
  if (!heightStr) return null;
  
  const match = heightStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Get run height (from existing field or proposed)
 */
export function getRunHeight(run) {
  // Try fenceHeight field first
  if (run.fenceHeight) {
    return parseHeightToFt(run.fenceHeight);
  }
  
  // Then proposed_height_ft
  if (run.proposed_height_ft) {
    return run.proposed_height_ft;
  }
  
  return null;
}

/**
 * Evaluate run height compliance against jurisdiction rules
 */
export function evaluateRunHeightCompliance(run, mergedRules, job) {
  // No rules available
  if (!mergedRules || !mergedRules.height_limits) {
    return {
      status: 'NO_RULES',
      maxAllowed: null,
      messages: ['Height rules not available for this jurisdiction.']
    };
  }

  // Unknown yard zone
  if (!run.yard_zone || run.yard_zone === 'UNKNOWN') {
    return {
      status: 'UNKNOWN_ZONE',
      maxAllowed: null,
      messages: ['Select a yard zone (Front/Side/Rear) to check height compliance.']
    };
  }

  // Resolve max allowed height for yard zone
  let maxAllowed = null;
  const heightLimits = mergedRules.height_limits;

  switch (run.yard_zone) {
    case 'FRONT':
      maxAllowed = heightLimits.front_yard_ft;
      break;
    case 'SIDE':
      maxAllowed = heightLimits.side_yard_ft;
      break;
    case 'REAR':
      maxAllowed = heightLimits.rear_yard_ft;
      break;
    case 'STREET_SIDE':
      if (job.cornerLot) {
        maxAllowed = heightLimits.corner_lot_street_side_ft || heightLimits.front_yard_ft;
      } else {
        // Fallback to side if somehow set on non-corner lot
        maxAllowed = heightLimits.side_yard_ft;
      }
      break;
    default:
      return {
        status: 'UNKNOWN_ZONE',
        maxAllowed: null,
        messages: ['Invalid yard zone.']
      };
  }

  // Get run height
  const runHeight = getRunHeight(run);
  
  if (runHeight === null) {
    return {
      status: 'UNKNOWN_ZONE',
      maxAllowed,
      messages: ['Set the fence height for this run to evaluate compliance.']
    };
  }

  // Compare height
  if (runHeight <= maxAllowed) {
    return {
      status: 'OK',
      maxAllowed,
      messages: []
    };
  } else {
    const messages = [
      'Run height exceeds the typical maximum for this yard zone.',
      'Verify local ordinance and required setbacks/visibility rules before install.'
    ];

    // Add visibility triangle note for front/street-side
    if (run.yard_zone === 'FRONT' || run.yard_zone === 'STREET_SIDE') {
      messages.push('Front and street-side yards may have additional visibility triangle rules near driveways/intersections.');
    }

    return {
      status: 'WARN_TOO_TALL',
      maxAllowed,
      messages
    };
  }
}

/**
 * Validate all runs height compliance
 */
export function validateAllRunsHeightCompliance(runs, mergedRules, job) {
  return runs.map(run => {
    const result = evaluateRunHeightCompliance(run, mergedRules, job);
    return {
      ...run,
      height_compliance_status: result.status,
      height_compliance_messages: result.messages,
      max_allowed_height_ft: result.maxAllowed
    };
  });
}