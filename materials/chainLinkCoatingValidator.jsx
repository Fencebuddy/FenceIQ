/**
 * Chain Link Coating Validator
 * Strict validation of coating tokens vs display values
 * Bidirectional mapping ensures consistency
 */

// Canonical token names (used in canonical keys, database, internal logic)
export const COATING_TOKENS = {
  GALV: 'galv',
  ALUMINIZED: 'aluminized',
  BLACK_VINYL: 'black_vinyl'
};

// Display values (shown to users, stored in overrides.chainLinkCoating)
export const COATING_DISPLAY = {
  GALV: 'Galvanized',
  ALUMINIZED: 'Aluminized',
  BLACK_VINYL: 'Black Vinyl Coated'
};

// Bidirectional mapping
const TOKEN_TO_DISPLAY = {
  [COATING_TOKENS.GALV]: COATING_DISPLAY.GALV,
  [COATING_TOKENS.ALUMINIZED]: COATING_DISPLAY.ALUMINIZED,
  [COATING_TOKENS.BLACK_VINYL]: COATING_DISPLAY.BLACK_VINYL
};

const DISPLAY_TO_TOKEN = {
  [COATING_DISPLAY.GALV]: COATING_TOKENS.GALV,
  [COATING_DISPLAY.ALUMINIZED]: COATING_TOKENS.ALUMINIZED,
  [COATING_DISPLAY.BLACK_VINYL]: COATING_TOKENS.BLACK_VINYL
};

/**
 * Validate and map display value → token
 * Throws if invalid
 */
export function displayToToken(displayValue) {
  if (!displayValue) {
    throw new Error('Chain link coating display value cannot be empty');
  }
  
  const token = DISPLAY_TO_TOKEN[displayValue];
  if (!token) {
    throw new Error(
      `Invalid chain link coating display value: "${displayValue}". ` +
      `Must be one of: ${Object.keys(DISPLAY_TO_TOKEN).join(', ')}`
    );
  }
  
  return token;
}

/**
 * Validate and map token → display
 * Throws if invalid
 */
export function tokenToDisplay(token) {
  if (!token) {
    throw new Error('Chain link coating token cannot be empty');
  }
  
  const display = TOKEN_TO_DISPLAY[token];
  if (!display) {
    throw new Error(
      `Invalid chain link coating token: "${token}". ` +
      `Must be one of: ${Object.keys(TOKEN_TO_DISPLAY).join(', ')}`
    );
  }
  
  return display;
}

/**
 * Validate that token and display are consistent
 * Throws if mismatch
 */
export function validateTokenDisplayPair(token, display) {
  if (!token || !display) {
    throw new Error('Chain link coating: both token and display value required');
  }
  
  const expectedDisplay = TOKEN_TO_DISPLAY[token];
  if (!expectedDisplay) {
    throw new Error(
      `Invalid token "${token}". Must be one of: ${Object.keys(TOKEN_TO_DISPLAY).join(', ')}`
    );
  }
  
  if (expectedDisplay !== display) {
    throw new Error(
      `Chain link coating mismatch: token "${token}" maps to "${expectedDisplay}", ` +
      `but display value is "${display}"`
    );
  }
}

/**
 * Validate entire variant config for chain link
 * Returns { token, display } if valid
 * Throws with clear message if invalid
 */
export function validateChainLinkVariant(variantConfig) {
  if (!variantConfig) {
    throw new Error('Chain link variant config required');
  }

  // Get token (may be in variantConfig.coating directly)
  const token = variantConfig.coating;
  if (!token) {
    throw new Error(
      'Chain link variant missing coating token. ' +
      'Expected variantConfig.coating to be one of: galv, aluminized, black_vinyl'
    );
  }

  // Get display value (should be in overrides.chainLinkCoating)
  const display = variantConfig.overrides?.chainLinkCoating || 
                  variantConfig.chainLinkCoating;
  if (!display) {
    throw new Error(
      'Chain link variant missing display value. ' +
      'Expected overrides.chainLinkCoating or chainLinkCoating'
    );
  }

  // Validate and throw clear error if mismatch
  try {
    validateTokenDisplayPair(token, display);
  } catch (err) {
    throw new Error(
      `Chain link variant validation failed: ${err.message}. ` +
      `Got: token="${token}", display="${display}"`
    );
  }

  return { token, display };
}