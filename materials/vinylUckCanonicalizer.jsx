/**
 * VINYL UCK CANONICALIZER — Permanent Drift Elimination
 * 
 * Canonical format: vinyl_{componentTokens}_{height}_{system}_{color}
 * Global exception: vinyl_hardware_nodig_donut (no height/system/color)
 * 
 * Examples:
 * - vinyl_panel_privacy_6ft_savannah_white
 * - vinyl_post_line_5x5_6ft_savannah_white
 * - vinyl_hardware_galvanized_post_6ft_savannah_white
 * - vinyl_hardware_nodig_donut (exception)
 */

export const VINYL_HEIGHTS = ['3ft', '4ft', '5ft', '6ft', '8ft', '10ft', '12ft'];
export const VINYL_SYSTEMS = ['savannah', 'lakeshore', 'yorktown', 'new_england'];
export const VINYL_COLORS = ['white', 'tan', 'khaki', 'grey', 'coastal_grey', 'cedar_tone', 'black'];

/**
 * HEIGHT-INDEPENDENT ALLOWLIST (STRICT)
 * Components that work across all fence heights - height can be defaulted to 6ft
 */
const HEIGHT_INDEPENDENT_PATTERNS = [
  // Post caps (all types)
  /^vinyl_hardware_post_cap$/,
  /^vinyl_post_cap(?:_[a-z_]+)?$/,
  /^vinyl_cap_[a-z_]+$/,
  
  // Fasteners and brackets
  /^vinyl_hardware_.*(?:screw|bolt|bracket|fastener).*$/,
  
  // Concrete (if confirmed universal)
  /^vinyl_concrete$/,
];

/**
 * Check if component tokens match height-independent allowlist
 * @param {string[]} componentTokens
 * @returns {boolean}
 */
export function isHeightIndependent(componentTokens) {
  const componentStr = componentTokens.join('_');
  return HEIGHT_INDEPENDENT_PATTERNS.some(pattern => pattern.test(componentStr));
}

/**
 * Check if UCK is the global exception
 * @param {string} uck
 * @returns {boolean}
 */
export function isVinylGlobalException(uck) {
  return uck === 'vinyl_hardware_nodig_donut' || 
         (uck && uck.startsWith('vinyl_hardware_nodig_donut_'));
}

/**
 * Canonicalize a vinyl UCK (parser + rebuilder)
 * 
 * @param {string} uck - Original UCK
 * @param {{ system: string, color: string, height: string, context: object }} options - Options with defaults and recovery context
 * @returns {object} Canonicalized result with parsed components and notes
 */
export function canonicalizeVinylUck(uck, options = {}) {
  const defaultSystem = options.system || 'savannah';
  const defaultColor = options.color || 'white';
  const context = options.context || {};

  // Handle global exception
  if (isVinylGlobalException(uck)) {
    return {
      canonicalUck: 'vinyl_hardware_nodig_donut',
      parsed: {
        componentTokens: ['hardware', 'nodig', 'donut'],
        height: null,
        system: null,
        color: null,
        isGlobalException: true
      },
      notes: {
        detectedFormat: 'global_exception',
        fixesApplied: [],
        confidence: 'CERTAIN'
      }
    };
  }

  if (!uck || !uck.startsWith('vinyl_')) {
    return {
      canonicalUck: null,
      parsed: null,
      notes: {
        detectedFormat: 'invalid',
        fixesApplied: [],
        confidence: 'NONE',
        error: 'Not a vinyl UCK'
      }
    };
  }

  const tokens = uck.split('_').slice(1);
  const fixesApplied = [];

  if (tokens.length < 1) {
    return {
      canonicalUck: null,
      parsed: null,
      notes: {
        detectedFormat: 'too_short',
        fixesApplied: [],
        confidence: 'NONE',
        error: 'Too few tokens'
      }
    };
  }

  // CRITICAL: Find HEIGHT (MUST exist, or allowlist match)
  let heightIndex = tokens.findIndex(t => VINYL_HEIGHTS.includes(t));
  let recoveredHeight = null;
  let heightIndependentApplied = false;
  
  if (heightIndex === -1) {
    // Attempt height recovery from context
    if (context.attributes?.height) {
      recoveredHeight = context.attributes.height;
      heightIndex = tokens.length;
      fixesApplied.push(`Recovered height from metadata: ${recoveredHeight}`);
    } else {
      // Check if component matches height-independent allowlist
      if (isHeightIndependent(tokens)) {
        recoveredHeight = '6ft';
        heightIndex = tokens.length;
        heightIndependentApplied = true;
        fixesApplied.push('Applied default height 6ft (height-independent component)');
      }
    }
  }
  
  if (heightIndex === -1 && !recoveredHeight) {
    return {
      canonicalUck: null,
      parsed: {
        componentTokens: tokens,
        height: null,
        system: null,
        color: null,
        isGlobalException: false,
        heightIndependent: false
      },
      notes: {
        detectedFormat: 'missing_height',
        fixesApplied: [],
        confidence: 'NONE',
        blockedReason: 'height_missing',
        error: 'BLOCKED_MISSING_HEIGHT: No height token found and component not in allowlist'
      }
    };
  }

  const height = recoveredHeight || tokens[heightIndex];
  const componentTokens = tokens.slice(0, heightIndex);

  // Find SYSTEM (after height)
  const tokensAfterHeight = tokens.slice(heightIndex + 1);
  const systemIndex = tokensAfterHeight.findIndex(t => VINYL_SYSTEMS.includes(t));
  let system = systemIndex !== -1 ? tokensAfterHeight[systemIndex] : defaultSystem;

  if (systemIndex === -1) {
    fixesApplied.push(`Inserted default system: ${defaultSystem}`);
  }

  // Find COLOR (after system or at end, support multi-token colors)
  const tokensAfterSystem = systemIndex !== -1 
    ? tokensAfterHeight.slice(systemIndex + 1) 
    : tokensAfterHeight;

  // Detect multi-token colors (coastal_grey, cedar_tone)
  // Scan from end backwards for longest valid color phrase
  let color = defaultColor;
  let colorTokensConsumed = 0;
  
  for (let i = tokensAfterSystem.length - 1; i >= 0; i--) {
    const possibleColorPhrase = tokensAfterSystem.slice(i).join('_');
    if (VINYL_COLORS.includes(possibleColorPhrase)) {
      color = possibleColorPhrase;
      colorTokensConsumed = tokensAfterSystem.length - i;
      
      // Check if there are extra color tokens before this one (duplicates)
      const tokensBefore = tokensAfterSystem.slice(0, i);
      const extraColorsBefore = tokensBefore.filter(t => VINYL_COLORS.includes(t));
      if (extraColorsBefore.length > 0) {
        fixesApplied.push(`Removed duplicate color token(s): ${extraColorsBefore.join(', ')}`);
      }
      
      break;
    }
  }

  if (colorTokensConsumed === 0) {
    fixesApplied.push(`Inserted default color: ${defaultColor}`);
  }

  // Build canonical
  const canonicalUck = `vinyl_${componentTokens.join('_')}_${height}_${system}_${color}`;
  const changed = canonicalUck !== uck;

  if (changed && fixesApplied.length === 0) {
    fixesApplied.push('Token reordering');
  }

  return {
    canonicalUck,
    parsed: {
      componentTokens,
      height,
      system,
      color,
      isGlobalException: false,
      heightIndependent: heightIndependentApplied
    },
    notes: {
      detectedFormat: 'deterministic',
      fixesApplied: fixesApplied.length > 0 ? fixesApplied : ['Already canonical'],
      confidence: changed ? 'HIGH' : 'CERTAIN',
      heightIndependent: heightIndependentApplied
    }
  };
}