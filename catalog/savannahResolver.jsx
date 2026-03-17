/**
 * Savannah Family Vinyl Resolver
 * Single source of truth for Savannah item resolution, pricing, and pricing blocking.
 */

// -------------------------
// SAVANNAH CRM NAME MATCHING (ALL MATERIALS)
// -------------------------

const SAVANNAH_COLORS = ["white", "tan", "khaki", "grey", "gray", "black"];
const SAVANNAH_COLOR_CANON = {
  gray: "grey"
};

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/["'']/g, "")     // remove quotes
    .replace(/[^\w\s.-]/g, " ") // kill weird punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function detectSavannahColor(normalized) {
  // Prefer explicit known color words; keep "grey" canonical.
  for (const c of SAVANNAH_COLORS) {
    const re = new RegExp(`\\b${c}\\b`, "i");
    if (re.test(normalized)) return SAVANNAH_COLOR_CANON[c] || c;
  }
  return null;
}

function hasSavannahSignal(normalized) {
  // We treat "savannah" as strongest signal, but also accept
  // "new england" / "federation" caps etc if your existing resolver does.
  return /\bsavannah\b/i.test(normalized);
}

function parseFeet(s) {
  // captures: 6', 6 ft, 6-foot, 6ft
  const m = s.match(/\b(\d{1,2})\s*(?:ft|foot|feet|')\b/i);
  return m ? Number(m[1]) : null;
}

function parseInches(s) {
  // captures: 44.5", 38.5 in, 62.5-inch
  const m = s.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:in|inch|inches|")\b/i);
  return m ? Number(m[1]) : null;
}

function parseGateWidthHeight(normalized) {
  // Common CRM gate formats:
  // 6' x 44.5"
  // 6H x 44.5W
  // 4'H X 62.5"W
  // 50"x6' (width x height) for pre-assembled gates
  // 68.5" double gate
  const feet = normalized.match(/(\d{1,2})\s*(?:h|')\b/i); // height in feet
  const inchesAny = normalized.match(/(\d{1,3}(?:\.\d+)?)\s*(?:w|")\b/i); // width in inches

  // Try explicit H/W tokens first
  const hFt = normalized.match(/\b(\d{1,2})\s*h\b/i);
  const wIn = normalized.match(/\b(\d{1,3}(?:\.\d+)?)\s*w\b/i);

  if (hFt && wIn) {
    return { height_ft: Number(hFt[1]), width_in: Number(wIn[1]) };
  }

  // Try x patterns: "6' x 44.5""
  const x1 = normalized.match(/\b(\d{1,2})\s*(?:ft|')\s*x\s*(\d{1,3}(?:\.\d+)?)\s*(?:in|")\b/i);
  if (x1) return { height_ft: Number(x1[1]), width_in: Number(x1[2]) };

  // Try reverse: "50\"x6'" (width inches x height feet)
  const x2 = normalized.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:in|")\s*x\s*(\d{1,2})\s*(?:ft|')\b/i);
  if (x2) return { height_ft: Number(x2[2]), width_in: Number(x2[1]) };

  // Last-resort: if we see one feet number and one inches number
  if (feet && inchesAny) {
    return { height_ft: Number(feet[1]), width_in: Number(inchesAny[1]) };
  }

  return null;
}

function roundToNearestSavannahGateWidthIn(widthIn) {
  // Your known gate widths:
  // 38.5, 44.5, 62.5, 68.5
  // We do a small tolerance match.
  const candidates = [38.5, 44.5, 62.5, 68.5];
  let best = null;
  let bestDiff = Infinity;

  for (const c of candidates) {
    const diff = Math.abs(c - Number(widthIn));
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }

  if (bestDiff <= 1.0) return best; // 1" tolerance
  return null;
}

function parsePostSpec(normalized) {
  // Examples:
  // "5x5 vinyl end post – 8' (grey)"
  // "line post 5x5x105"
  // "corner post 5x5x108"
  // "3-way post"
  // We'll return: { role: line|end|corner|gate|blank|3way, size: "5x5", height_ft: 7|8|9, height_in: 105|108 }
  const size = normalized.match(/\b(\d)\s*x\s*(\d)\b/i) ? `${RegExp.$1}x${RegExp.$2}` : null;

  const role =
    /\bcorner\b/i.test(normalized) ? "corner" :
    /\bend\b/i.test(normalized) ? "end" :
    /\bline\b/i.test(normalized) ? "line" :
    /\bgate\b/i.test(normalized) ? "gate" :
    /\b3[-\s]?way\b/i.test(normalized) ? "3way" :
    /\bblank\b/i.test(normalized) ? "blank" :
    null;

  // Height in feet if present
  const height_ft = parseFeet(normalized);

  // Height inches patterns like 105" / 108in
  const height_in = (() => {
    const m = normalized.match(/\b(\d{2,3})\s*(?:in|")\b/i);
    return m ? Number(m[1]) : null;
  })();

  return { role, size, height_ft, height_in };
}

function isLikelyGate(normalized) {
  return /\bgate\b/i.test(normalized);
}

function isLikelyPanel(normalized) {
  return /\bpanel\b|\bsection\b|\bprivacy\b/i.test(normalized);
}

function isLikelyPost(normalized) {
  return /\bpost\b/i.test(normalized);
}

function isLikelyCap(normalized) {
  return /\bcap\b/i.test(normalized);
}

function isLikelyHardware(normalized) {
  return /\bhinge\b|\blatch\b|\bbracket\b|\brail\b|\bdonut\b|\binsert\b|\bstiffener\b/i.test(normalized);
}

/**
 * CRM → Canonical key builder (ALL Savannah materials)
 * Outputs { valid, canonical_key, reason } before pricing
 */
export function canonicalizeSavannahFromCrmName(crmNameRaw) {
  const normalized = normalizeText(crmNameRaw);

  // If it doesn't look Savannah-related, bail early.
  const color = detectSavannahColor(normalized) || "white"; // default safe
  const colorSuffix = `_savannah_${color}`;

  // ---- GATES ----
  if (isLikelyGate(normalized)) {
    // FT-based gates: "12' vinyl gate (double)" etc
    const heightFt = parseFeet(normalized) || null;

    // Determine single/double
    const isDouble =
      /\bdouble\b/i.test(normalized) ||
      /\bdual\b/i.test(normalized);

    // If CRM says "10' Vinyl Gate (Double)" we treat width as feet
    const widthFt = (() => {
      // Look for width ft in string even if height is also ft
      // Common "10' Vinyl Gate (Double)" => widthFt = 10
      const all = [...normalized.matchAll(/\b(\d{1,2})\s*(?:ft|')\b/gi)].map(m => Number(m[1]));
      if (!all.length) return null;
      // If it contains "x" with inches, use the other parser
      if (/\bx\b/i.test(normalized) && /"/.test(normalized)) return null;
      // Heuristic: for "10' double gate", first ft token is width
      // If only one ft token, that's width
      if (all.length === 1) return all[0];
      // If multiple, prefer the larger as width for gates
      return Math.max(...all);
    })();

    // Inch-based gates: "6' x 44.5" single gate"
    const dims = parseGateWidthHeight(normalized);
    if (dims?.height_ft && dims?.width_in) {
      const w = roundToNearestSavannahGateWidthIn(dims.width_in);
      if (!w) {
        return { valid: false, reason: `Unrecognized Savannah gate width inches: ${dims.width_in}` };
      }

      // Your existing key style uses 44in/68in rounded
      // We'll convert 44.5->44, 68.5->68, 62.5->62, 38.5->38
      const widthToken = Math.round(w);

      // Decide single vs double from width bucket OR explicit token
      const kind = (isDouble || w >= 68.0) ? "double" : "single";

      return {
        valid: true,
        canonical_key: `vinyl_gate_${kind}_${dims.height_ft}ft_${widthToken}in_savannah_${color}`,
        reason: `Savannah gate (inch width normalized ${w}")`
      };
    }

    // FT-based gates (new add-on path you asked for)
    if (heightFt && widthFt) {
      const kind = isDouble ? "double" : "single";
      return {
        valid: true,
        canonical_key: `vinyl_gate_${kind}_${heightFt}ft_${widthFt}ft_savannah_${color}`,
        reason: "Savannah gate (ft-based)"
      };
    }

    return { valid: false, reason: "Gate detected but could not parse height/width" };
  }

  // ---- PANELS ----
  if (isLikelyPanel(normalized)) {
    // Typical: "Savannah 6' x 8' Vinyl Privacy Panel"
    const heightFt = parseFeet(normalized);
    const widthFt = (() => {
      // Try to find "x 8" ft
      const m = normalized.match(/\bx\s*(\d{1,2})\s*(?:ft|')\b/i);
      return m ? Number(m[1]) : null;
    })();

    if (!heightFt) {
      return { valid: false, reason: `Panel detected but could not parse height ft` };
    }

    // privacy panels only for now (matches your existing keys)
    return {
      valid: true,
      canonical_key: `vinyl_panel_privacy_${heightFt}ft_savannah_${color}`,
      reason: "Savannah privacy panel"
    };
  }

  // ---- POSTS ----
  if (isLikelyPost(normalized)) {
    const spec = parsePostSpec(normalized);

    // Default Savannah posts are 5x5 (your catalog)
    const size = spec.size || "5x5";

    // Prefer explicit feet height, else infer from 105/108in if present
    const heightFt = spec.height_ft || (spec.height_in ? Math.round(spec.height_in / 12) : null);

    if (!spec.role || !heightFt) {
      return { valid: false, reason: `Post detected but missing role/height. role=${spec.role}, heightFt=${heightFt}` };
    }

    return {
      valid: true,
      canonical_key: `vinyl_post_${spec.role}_${size}_${heightFt}ft_savannah_${color}`,
      reason: "Savannah post"
    };
  }

  // ---- CAPS ----
  if (isLikelyCap(normalized)) {
    // Examples: "New England 5x5 Vinyl Post Cap (Grey)" / "Federation 5x5 Vinyl Post Cap"
    const size = normalized.match(/\b5\s*x\s*5\b/i) ? "5x5" : "5x5";

    // If you want "style" encoded:
    const style =
      /\bnew england\b/i.test(normalized) ? "new_england" :
      /\bfederation\b/i.test(normalized) ? "federation" :
      /\bexternal\b/i.test(normalized) ? "external" :
      /\bflat\b/i.test(normalized) ? "flat" :
      "savannah";

    return {
      valid: true,
      canonical_key: `vinyl_post_cap_${style}_${size}_${color}`,
      reason: "Vinyl post cap"
    };
  }

  // ---- HARDWARE ----
  if (isLikelyHardware(normalized)) {
    // A few high-value Savannah hardware items you already use
    if (/\blocklatch\b/i.test(normalized)) {
      const sizeIn = parseInches(normalized); // 4 or 5 maybe
      if (sizeIn) {
        return {
          valid: true,
          canonical_key: `vinyl_hardware_locklatch_${Math.round(sizeIn)}in`,
          reason: "Locklatch"
        };
      }
      // fallback
      return { valid: true, canonical_key: `vinyl_hardware_locklatch`, reason: "Locklatch (size unknown)" };
    }

    if (/\bdonut\b|\bno dig\b/i.test(normalized)) {
      return { valid: true, canonical_key: `vinyl_hardware_nodig_donut`, reason: "No-dig donut" };
    }

    if (/\bgate hinge\b|\bhinges\b/i.test(normalized)) {
      return { valid: true, canonical_key: `vinyl_hardware_gate_hinge_set`, reason: "Vinyl gate hinge set" };
    }

    if (/\bpost stiffener\b|\binsert\b/i.test(normalized)) {
      return { valid: true, canonical_key: `vinyl_hardware_post_insert_aluminum_5in`, reason: "Aluminum post insert/stiffener" };
    }

    if (/\bbracket\b/i.test(normalized)) {
      return { valid: true, canonical_key: `vinyl_hardware_brackets`, reason: "Vinyl brackets" };
    }
  }

  // If it contains Savannah but we couldn't map it, return unknown
  if (hasSavannahSignal(normalized)) {
    return { valid: false, reason: `Savannah item not recognized: "${crmNameRaw}"` };
  }

  return { valid: false, reason: "Not a Savannah item" };
}

const SAVANNAH_SPEC = {
  family: "savannah",
  material: "vinyl",
  style: "privacy",
  default_color: "white",
  supported_heights_ft: [4, 5, 6],
  supported_colors: ["white", "tan", "khaki", "grey", "black"],
  post_roles: ["line", "end", "corner", "blank", "3-way"]
};

const POST_LENGTHS = {
  4: 7,
  5: 8,
  6: 9
};

const POST_COSTS = {
  white: { "7ft": 25.74, "8ft": 42.15, "9ft": 46.10 },
  tan: { "7ft": 25.74, "8ft": 42.15, "9ft": 46.10 },
  khaki: { "7ft": 40.23, "8ft": 45.98, "9ft": 47.99 },
  grey: { "7ft": 52.99, "8ft": 52.99, "9ft": 52.99 },
  black: { "7ft": 59.99, "8ft": 59.99, "9ft": 59.99 }
};

const PANEL_COSTS = {
  4: { white: 128.60, tan: 128.60, khaki: 140.29, grey: 249.99, black: 329.99 },
  5: { white: 142.75, tan: 142.75, khaki: 155.73, grey: 249.99, black: 329.99 },
  6: { white: 158.61, tan: 158.61, khaki: 167.99, grey: 249.99, black: 329.99 }
};

const GATES_SINGLE = {
  white: {
    "38.5": { "4": 474.00, "5": 474.00, "6": 474.00 },
    "44.5": { "4": 478.80, "5": 478.80, "6": 478.80 },
    "62.5": { "4": 477.65, "5": 503.44, "6": 545.99 },
    "68.5": { "4": 486.29, "5": 511.93, "6": 551.99 }
  },
  khaki: {
    "38.5": { "4": 474.00, "5": 474.00, "6": 474.00 },
    "44.5": { "4": 478.80, "5": 478.80, "6": 478.80 },
    "62.5": { "4": 477.65, "5": 503.44, "6": 545.99 },
    "68.5": { "4": 486.29, "5": 511.93, "6": 551.99 }
  },
  grey: {
    "38.5": { "4": 520.00, "5": 520.00, "6": 520.00 },
    "44.5": { "4": 530.00, "5": 530.00, "6": 530.00 },
    "62.5": { "4": 540.00, "5": 540.00, "6": 540.00 },
    "68.5": { "4": 550.00, "5": 550.00, "6": 550.00 }
  },
  black: {
    "38.5": { "4": 585.99, "5": 585.99, "6": 585.99 },
    "44.5": { "4": 589.99, "5": 589.99, "6": 589.99 },
    "62.5": { "4": 599.99, "5": 599.99, "6": 599.99 },
    "68.5": { "4": 599.99, "5": 599.99, "6": 599.99 }
  }
};

const GATES_DOUBLE = {
  white: {
    "38.5": { "4": 935.41, "5": 1017.60, "6": 1017.60 },
    "44.5": { "4": 1020.00, "5": 1020.00, "6": 1020.00 },
    "62.5": { "4": 969.43, "5": 1020.99, "6": 1103.99 },
    "68.5": { "4": 986.70, "5": 1038.00, "6": 1115.99 }
  },
  khaki: {
    "38.5": { "4": 935.41, "5": 1017.60, "6": 1007.99 },
    "44.5": { "4": 1020.00, "5": 1020.00, "6": 1015.19 },
    "62.5": { "4": 969.43, "5": 1020.99, "6": 1103.99 },
    "68.5": { "4": 986.70, "5": 1038.00, "6": 1115.99 }
  },
  grey: {
    "38.5": { "4": 1040.00, "5": 1040.00, "6": 1040.00 },
    "44.5": { "4": 1060.00, "5": 1060.00, "6": 1060.00 },
    "62.5": { "4": 1080.00, "5": 1080.00, "6": 1080.00 },
    "68.5": { "4": 1100.00, "5": 1100.00, "6": 1100.00 }
  },
  black: {
    "38.5": { "4": 1179.99, "5": 1179.99, "6": 1179.99 },
    "44.5": { "4": 1189.99, "5": 1189.99, "6": 1189.99 },
    "62.5": { "4": 1199.99, "5": 1199.99, "6": 1199.99 },
    "68.5": { "4": 1199.99, "5": 1199.99, "6": 1199.99 }
  }
};

const CAPS = {
  "4": { 
    default: "federation", 
    cost: { white: 7.50, tan: 7.50, khaki: 7.50, grey: 5.99, black: 5.49 }
  },
  "5": { 
    default: "new_england", 
    cost: { white: 8.09, tan: 8.09, khaki: 8.09, grey: 12.99, black: 5.49 }
  },
  "6": { 
    default: "new_england", 
    cost: { white: 8.09, tan: 8.09, khaki: 8.10, grey: 12.99, black: 5.49 }
  }
};

/**
 * Resolve a Savannah item to canonical key + unit cost
 * @param {Object} params
 * @param {string} params.kind - 'panel' | 'post' | 'gate' | 'cap'
 * @param {number} params.height_ft - 4 | 5 | 6
 * @param {string} params.color - 'white' | 'tan' | 'khaki' | 'grey'
 * @param {string} params.role - post role: 'line' | 'end' | 'corner' | 'blank' | '3-way'
 * @param {string} params.gate_type - 'single' | 'double'
 * @param {number} params.gate_width_in - gate width in inches (38.5, 44.5, 62.5, 68.5)
 * @param {string} params.canonical_key - pre-computed canonical key (optional)
 * @param {string} params.crm_name - CRM name for pattern matching (optional)
 * @returns {Object} { canonical_key, unit_cost, valid }
 */
export function resolveSavannahItem({
  kind,
  height_ft,
  color = SAVANNAH_SPEC.default_color,
  role,
  gate_type,
  gate_width_in,
  canonical_key,
  crm_name
} = {}) {
  // NEW: CRM name pattern matching (ALL Savannah materials)
  if (!canonical_key && crm_name) {
    const c = canonicalizeSavannahFromCrmName(crm_name);
    if (c.valid) {
      canonical_key = c.canonical_key;
    } else if (c.reason && /\bSavannah\b/i.test(String(crm_name))) {
      // If it *claims* Savannah but failed, return the reason loudly
      return {
        valid: false,
        canonical_key: null,
        unit_cost: null,
        reason: c.reason
      };
    }
  }
  // Validate height
  if (!SAVANNAH_SPEC.supported_heights_ft.includes(height_ft)) {
    return {
      valid: false,
      reason: `Unsupported height: ${height_ft}ft (supported: ${SAVANNAH_SPEC.supported_heights_ft.join(', ')})`,
      canonical_key: null,
      unit_cost: null
    };
  }

  // Validate color with fallback
  let resolvedColor = color;
  if (!SAVANNAH_SPEC.supported_colors.includes(color)) {
    resolvedColor = SAVANNAH_SPEC.default_color;
  }

  // PANEL RESOLUTION
  if (kind === 'panel') {
    const cost = PANEL_COSTS[height_ft]?.[resolvedColor];
    if (cost === undefined) {
      return {
        valid: false,
        reason: `No panel cost for ${height_ft}ft ${resolvedColor}`,
        canonical_key: null,
        unit_cost: null
      };
    }

    return {
      valid: true,
      canonical_key: `vinyl_panel_privacy_${height_ft}ft_savannah_${resolvedColor}`,
      unit_cost: cost
    };
  }

  // POST RESOLUTION
  if (kind === 'post') {
    if (!role || !SAVANNAH_SPEC.post_roles.includes(role)) {
      return {
        valid: false,
        reason: `Invalid post role: ${role} (must be one of: ${SAVANNAH_SPEC.post_roles.join(', ')})`,
        canonical_key: null,
        unit_cost: null
      };
    }

    const postLength = POST_LENGTHS[height_ft];
    const postLengthStr = `${postLength}ft`;
    const cost = POST_COSTS[resolvedColor]?.[postLengthStr];

    if (cost === undefined) {
      return {
        valid: false,
        reason: `No post cost for ${resolvedColor} ${postLengthStr}`,
        canonical_key: null,
        unit_cost: null
      };
    }

    return {
      valid: true,
      canonical_key: `vinyl_post_${role}_${height_ft}ft_savannah_${resolvedColor}`,
      unit_cost: cost
    };
  }

  // GATE RESOLUTION
  if (kind === 'gate') {
    if (!gate_type || !['single', 'double'].includes(gate_type)) {
      return {
        valid: false,
        reason: `Invalid gate type: ${gate_type} (must be 'single' or 'double')`,
        canonical_key: null,
        unit_cost: null
      };
    }

    if (!gate_width_in) {
      return {
        valid: false,
        reason: 'gate_width_in is required for gate resolution',
        canonical_key: null,
        unit_cost: null
      };
    }

    // Build canonical key for inch-based gates
    const canonical_key = `vinyl_gate_${gate_type}_${gate_width_in}in_${height_ft}ft_savannah_${resolvedColor}`;
    
    // NEW: ft-based Savannah gates (add-on path)
    if (canonical_key?.startsWith("vinyl_gate_single_") || canonical_key?.startsWith("vinyl_gate_double_")) {
      const ftGateAttempt = resolveSavannahFtGate({ canonical_key });
      if (ftGateAttempt.valid) {
        return {
          valid: true,
          canonical_key: ftGateAttempt.canonical_key,
          unit_cost: ftGateAttempt.unit_cost,
          reason: "Savannah ft-based gate resolver (color ignored; doubles split into leaves)"
        };
      }

      // If it *was* an ft-based key but missing pricing, return the reason
      const parsed = parseSavannahFtGateKey(canonical_key);
      if (parsed) {
        return {
          valid: false,
          canonical_key,
          unit_cost: null,
          reason: ftGateAttempt.reason
        };
      }
    }

    // Existing inch-based gate resolution
    const gateTable = gate_type === 'single' ? GATES_SINGLE : GATES_DOUBLE;
    const colorTable = gateTable[resolvedColor] || gateTable['white'];
    const widthStr = String(gate_width_in);
    const heightStr = String(height_ft);
    const cost = colorTable[widthStr]?.[heightStr];

    if (cost === undefined) {
      return {
        valid: false,
        reason: `No ${gate_type} gate pricing for ${widthStr}" x ${height_ft}ft`,
        canonical_key: null,
        unit_cost: null
      };
    }

    return {
      valid: true,
      canonical_key,
      unit_cost: cost,
      color: resolvedColor
    };
  }

  // CAP RESOLUTION
  if (kind === 'cap') {
    const capData = CAPS[height_ft];
    if (!capData) {
      return {
        valid: false,
        reason: `No cap for ${height_ft}ft height`,
        canonical_key: null,
        unit_cost: null
      };
    }

    const cost = typeof capData.cost === 'object' 
      ? capData.cost[resolvedColor] || capData.cost['white']
      : capData.cost;

    return {
      valid: true,
      canonical_key: `vinyl_cap_${capData.default}_${height_ft}ft_${resolvedColor}`,
      unit_cost: cost,
      cap_style: capData.default
    };
  }

  // Unknown kind
  return {
    valid: false,
    reason: `Unknown kind: ${kind}`,
    canonical_key: null,
    unit_cost: null
  };
}

/**
 * DOUBLE GATE LEAF SPLIT
 * If a double gate is 6/8/10/12 wide, price as two single leaves 3/4/5/6 wide.
 */
export function splitDoubleGateIntoLeaves(doubleWidthFt) {
  const w = Number(doubleWidthFt);

  const map = {
    6: 3,
    8: 4,
    10: 5,
    12: 6
  };

  const leafWidth = map[w];

  if (!leafWidth) {
    return {
      valid: false,
      reason: `Unsupported double gate width: ${doubleWidthFt}. Only 6, 8, 10, 12 are supported for leaf splitting.`
    };
  }

  return {
    valid: true,
    leaves: [{ width_ft: leafWidth, qty: 2 }],
    leafWidthFt: leafWidth,
    totalLeaves: 2
  };
}

/**
 * Savannah pricing ignores color suffix.
 * Example: vinyl_gate_single_6ft_4ft_savannah_grey -> vinyl_gate_single_6ft_4ft_savannah
 */
function stripSavannahColorSuffix(canonicalKey) {
  if (!canonicalKey) return canonicalKey;
  return canonicalKey.replace(/_savannah_(white|tan|khaki|grey|black)$/i, "_savannah");
}

/**
 * NEW: FT-based Savannah gate keys (in addition to existing inch-based gates)
 * - vinyl_gate_single_{H}ft_{W}ft_savannah_{color}
 * - vinyl_gate_double_{H}ft_{W}ft_savannah_{color}
 */
function parseSavannahFtGateKey(canonicalKey) {
  if (!canonicalKey) return null;

  const m = canonicalKey.match(
    /^vinyl_gate_(single|double)_(\d+)ft_(\d+)ft_savannah_(white|tan|khaki|grey|black)$/i
  );
  if (!m) return null;

  return {
    kind: m[1].toLowerCase(),        // single | double
    height_ft: Number(m[2]),
    width_ft: Number(m[3]),          // leaf width (single) OR total width (double)
    color: m[4].toLowerCase()
  };
}

/**
 * Base unit cost map (COLOR IGNORED).
 * Keys MUST be color-stripped:
 *  - vinyl_gate_single_6ft_4ft_savannah
 *  - vinyl_gate_single_5ft_5ft_savannah
 *  - etc
 */
const SAVANNAH_FT_GATE_UNIT_COST = {
  // TODO: FILL THESE WITH YOUR ACTUAL PRICES
  // Examples:
  "vinyl_gate_single_6ft_3ft_savannah": 350.00,
  "vinyl_gate_single_6ft_4ft_savannah": 399.00,
  "vinyl_gate_single_6ft_5ft_savannah": 425.00,
  "vinyl_gate_single_6ft_6ft_savannah": 503.87,
  "vinyl_gate_single_5ft_3ft_savannah": 325.00,
  "vinyl_gate_single_5ft_4ft_savannah": 375.00,
  "vinyl_gate_single_5ft_5ft_savannah": 400.00,
  "vinyl_gate_single_5ft_6ft_savannah": 475.00,
  "vinyl_gate_single_4ft_3ft_savannah": 300.00,
  "vinyl_gate_single_4ft_4ft_savannah": 350.00,
  "vinyl_gate_single_4ft_5ft_savannah": 375.00,
  "vinyl_gate_single_4ft_6ft_savannah": 450.00
};

/**
 * Resolve NEW ft-based Savannah gates
 * - singles: direct from map
 * - doubles: 2x leaf single cost using splitDoubleGateIntoLeaves
 */
function resolveSavannahFtGate({ canonical_key }) {
  const parsed = parseSavannahFtGateKey(canonical_key);
  if (!parsed) return { valid: false, reason: "Not a Savannah ft-based gate key" };

  const baseKey = stripSavannahColorSuffix(canonical_key);

  // SINGLE: cost must exist
  if (parsed.kind === "single") {
    const unit_cost = SAVANNAH_FT_GATE_UNIT_COST[baseKey];
    if (unit_cost == null) {
      return {
        valid: false,
        canonical_key,
        reason: `Missing unit cost for ${baseKey}. Add it to SAVANNAH_FT_GATE_UNIT_COST (color ignored).`
      };
    }

    return { valid: true, canonical_key, unit_cost };
  }

  // DOUBLE: price as 2 leaf singles
  const split = splitDoubleGateIntoLeaves(parsed.width_ft);
  if (!split.valid) {
    return { valid: false, canonical_key, reason: split.reason };
  }

  const leafWidth = split.leafWidthFt;
  const leafKeyWithColor = `vinyl_gate_single_${parsed.height_ft}ft_${leafWidth}ft_savannah_${parsed.color}`;
  const leafBaseKey = stripSavannahColorSuffix(leafKeyWithColor);

  const leafUnitCost = SAVANNAH_FT_GATE_UNIT_COST[leafBaseKey];
  if (leafUnitCost == null) {
    return {
      valid: false,
      canonical_key,
      reason: `Double gate requires leaf pricing, but missing unit cost for ${leafBaseKey}. Add single-leaf pricing (color ignored).`
    };
  }

  const unit_cost = leafUnitCost * 2;
  return { valid: true, canonical_key, unit_cost };
}

/**
 * Validate if all items in a job's takeoff can be resolved
 * Returns pricing block status
 */
export function validateSavannahCoverage(takeoffItems, jobHeight, jobColor) {
  const unresolved = [];

  for (const item of takeoffItems) {
    // Try to match item to Savannah kind
    const kind = detectItemKind(item);
    if (!kind) {
      unresolved.push({
        item,
        reason: 'Cannot detect item kind'
      });
      continue;
    }

    const resolution = resolveSavannahItem({
      kind,
      height_ft: jobHeight,
      color: jobColor,
      role: detectPostRole(item),
      gate_type: detectGateType(item),
      gate_width_in: detectGateWidth(item)
    });

    if (!resolution.valid) {
      unresolved.push({
        item,
        reason: resolution.reason
      });
    }
  }

  return {
    valid: unresolved.length === 0,
    unresolved,
    blockPricing: unresolved.length > 0
  };
}

// Helper: Detect item kind from canonical key or name
function detectItemKind(item) {
  const key = item.canonical_key || item.canonicalKey || '';
  const name = item.lineItemName || '';

  if (key.includes('panel') || name.toLowerCase().includes('panel')) return 'panel';
  if (key.includes('post') || name.toLowerCase().includes('post')) return 'post';
  if (key.includes('gate') || name.toLowerCase().includes('gate')) return 'gate';
  if (key.includes('cap') || name.toLowerCase().includes('cap')) return 'cap';

  return null;
}

// Helper: Detect post role
function detectPostRole(item) {
  const key = item.canonical_key || item.canonicalKey || '';
  
  for (const role of SAVANNAH_SPEC.post_roles) {
    if (key.includes(`_${role}_`)) return role;
  }

  return null;
}

// Helper: Detect gate type
function detectGateType(item) {
  const key = item.canonical_key || item.canonicalKey || '';
  
  if (key.includes('_single_')) return 'single';
  if (key.includes('_double_')) return 'double';

  return null;
}

// Helper: Detect gate width
function detectGateWidth(item) {
  const key = item.canonical_key || item.canonicalKey || '';
  const match = key.match(/_(\d+\.?\d*)in_/);

  return match ? parseFloat(match[1]) : null;
}