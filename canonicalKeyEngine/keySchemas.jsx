import { CanonicalKeyError } from "./errors";
import {
  normalizeSystem,
  normalizeColorToken,
  normalizeHeightIn,
  heightInToFt,
  normalizeInchesToken,
  normalizeFeetToken
} from "./tokens";
import { buildKeyFromSegments } from "./normalize";

function ftTokenFromHeightIn(heightIn) {
  const ft = heightInToFt(normalizeHeightIn(heightIn));
  return `${ft}ft`;
}

function normalizeFinishToken(finish) {
  if (!finish) return "galv";
  const f = String(finish).trim().toLowerCase().replace(/\s+/g, "");
  if (f === "galvanized" || f === "galv") return "galv";
  if (f === "stainlesssteel" || f === "ss") return "ss";
  if (f === "zinc") return "zinc";
  if (f === "black") return "black";
  return f;
}

function normalizeWoodVarToken(v) {
  if (!v) return null;
  const t = String(v).trim().toLowerCase();
  if (t === "standard" || t === "std") return null;
  if (t === "pine") return "pine";
  if (t === "cedar") return "cedar";
  if (t === "treated" || t === "pt") return "treated";
  return t.replace(/\s+/g, "_");
}

function normalizeFastenerType(type) {
  if (!type) return "selftap";
  const t = String(type).trim().toLowerCase().replace(/\s+/g, "");
  if (t === "selftap" || t === "selftapping") return "selftap";
  if (t === "tek") return "tek";
  if (t === "rivet") return "rivet";
  return t;
}

function normalizeStyleToken(style) {
  if (!style) return "standard";
  return String(style).trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeProfileToken(profile) {
  if (!profile) return "standard";
  return String(profile).trim().toLowerCase().replace(/-/g, "_");
}

/**
 * CATALOG-ALIGNED KEY SCHEMAS
 * Format matches your MaterialCatalog exactly:
 * - chainlink_fabric_6ft_galv
 * - chainlink_post_terminal_6ft_galv
 * - vinyl_panel_6x8_tan
 * - vinyl_gate_single_62_khaki_6ft
 * - vinyl_post_5x5_white
 */
export const KeySchemas = Object.freeze({
  chainlink: {
    // Posts
    postLine: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "post", "line", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    postTerminal: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "post", "terminal", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    postGate: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "post", "gate", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    // Fabric
    fabric: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "fabric", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    // Rails
    toprail: ({ color, lengthFt = "10" }) =>
      buildKeyFromSegments(["chainlink", "rail", "top", `${lengthFt}ft`, normalizeColorToken(color)]),

    bottomRail: ({ color, lengthFt = "10" }) =>
      buildKeyFromSegments(["chainlink", "rail", "bottom", `${lengthFt}ft`, normalizeColorToken(color)]),

    braceRail: ({ color, lengthFt = "10" }) =>
      buildKeyFromSegments(["chainlink", "rail", "brace", `${lengthFt}ft`, normalizeColorToken(color)]),

    // Bottom System
    tensionWireBottom: ({ color }) =>
      buildKeyFromSegments(["chainlink", "tensionwire", "bottom", normalizeColorToken(color)]),

    hogRing: ({ finish = "galv" }) =>
      buildKeyFromSegments(["chainlink", "hogring", normalizeFinishToken(finish)]),

    // Termination + Bracing
    tensionBar: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "tensionbar", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    tensionBand: ({ color }) =>
      buildKeyFromSegments(["chainlink", "band", "tension", normalizeColorToken(color)]),

    braceBand: ({ color }) =>
      buildKeyFromSegments(["chainlink", "band", "brace", normalizeColorToken(color)]),

    railBand: ({ color }) =>
      buildKeyFromSegments(["chainlink", "band", "rail", normalizeColorToken(color)]),

    trussRod: ({ color, lengthFt = "10" }) =>
      buildKeyFromSegments(["chainlink", "trussrod", `${lengthFt}ft`, normalizeColorToken(color)]),

    railEnd: ({ color }) =>
      buildKeyFromSegments(["chainlink", "rail", "end", normalizeColorToken(color)]),

    // Ties (flat, not nested)
    tieWire: ({ color }) =>
      buildKeyFromSegments(["chainlink", "ties", "30pack"]),

    // Caps (flat, not nested)
    capDome: ({ color }) =>
      buildKeyFromSegments(["chainlink", "cap", "dome", normalizeColorToken(color)]),

    capLoop: ({ color }) =>
      buildKeyFromSegments(["chainlink", "cap", "loop", normalizeColorToken(color)]),

    // Privacy
    privacySlat: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "privacy", "slat", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    privacyScreen: ({ heightIn, color }) =>
      buildKeyFromSegments(["chainlink", "privacy", "screen", ftTokenFromHeightIn(heightIn), normalizeColorToken(color)]),

    // Gate Hardware
    gateHardwareSet: ({ color }) =>
      buildKeyFromSegments(["chainlink", "gate", "hardware", normalizeColorToken(color)]),

    caneBolt: ({ finish = "galv" }) =>
      buildKeyFromSegments(["chainlink", "cane", "bolt", normalizeFinishToken(finish)]),

    // Gates: chainlink_gate_walk_4x4_galv
    gate: ({ heightFt, widthFt, color }) => {
      const h = typeof heightFt === 'number' ? heightFt : parseInt(heightFt);
      const w = typeof widthFt === 'number' ? widthFt : parseInt(widthFt);
      return buildKeyFromSegments(["chainlink", "gate", "walk", `${w}x${h}`, normalizeColorToken(color)]);
    },

    // Concrete
    concrete: () =>
      buildKeyFromSegments(["chainlink", "concrete"])
  },

  vinyl: {
    // Panels: vinyl_panel_6x8_tan
    panelPrivacy: ({ heightIn, style = "savannah", color }) => {
      const ft = heightInToFt(normalizeHeightIn(heightIn));
      return buildKeyFromSegments(["vinyl", "panel", "6x8", normalizeColorToken(color)]);
    },

    // Rails
    railTop: ({ lengthFt = "6", color }) =>
      buildKeyFromSegments(["vinyl", "rail", "top", `${lengthFt}ft`, normalizeColorToken(color)]),

    railBottom: ({ lengthFt = "6", color }) =>
      buildKeyFromSegments(["vinyl", "rail", "bottom", `${lengthFt}ft`, normalizeColorToken(color)]),

    // Gates: vinyl_gate_single_62_white_6ft (format: swing_widthToken_color_heightFt)
    gate: ({ swing, widthIn, heightIn, color }) => {
      const s = String(swing || "").trim().toLowerCase();
      if (!["single", "double"].includes(s)) throw new CanonicalKeyError("vinyl.gate requires swing=single|double", { swing });
      
      const ft = heightInToFt(normalizeHeightIn(heightIn));
      const widthNum = typeof widthIn === 'number' ? widthIn : parseFloat(String(widthIn).replace(/[^0-9.]/g, ''));
      const widthToken = Math.floor(widthNum); // 62.5 → 62, 44.5 → 44, 38.5 → 38, 68.5 → 68
      
      return buildKeyFromSegments(["vinyl", "gate", s, String(widthToken), normalizeColorToken(color), `${ft}ft`]);
    },

    // Posts: vinyl_post_5x5_white (role accepted but NOT encoded in key)
    post: ({ color, size = "5x5", role }) => {
      // role is metadata only - not part of key for now
      return buildKeyFromSegments(["vinyl", "post", size, normalizeColorToken(color)]);
    },

    // Caps
    capNewEngland: ({ color }) =>
      buildKeyFromSegments(["vinyl", "cap", "newengland", normalizeColorToken(color)]),

    capExternal: ({ color }) =>
      buildKeyFromSegments(["vinyl", "cap", "external", normalizeColorToken(color)]),

    // Latches
    latchPro: ({ size = "4in" }) =>
      buildKeyFromSegments(["vinyl", "latch", "pro", size]),

    latchPool: () =>
      buildKeyFromSegments(["vinyl", "latch", "pool"]),

    // Hardware
    hingeSet: () =>
      buildKeyFromSegments(["vinyl", "hinge", "set"]),

    caneBolt: () =>
      buildKeyFromSegments(["vinyl", "bolt", "cane"]),

    dropRod: () =>
      buildKeyFromSegments(["vinyl", "drop", "rod"]),

    gateStop: () =>
      buildKeyFromSegments(["vinyl", "gate", "stop"]),

    noDigDonut: () =>
      buildKeyFromSegments(["vinyl", "nodig", "donut"]),

    reinforcePost: () =>
      buildKeyFromSegments(["vinyl", "reinforce", "post", "steel"]),

    // Concrete
    concrete: () =>
      buildKeyFromSegments(["vinyl", "concrete"])
  },

  wood: {
    rail: ({ size = "2x4x8", var: v }) => {
      const sizeToken = String(size).replace(/x/g, '_');
      const varToken = normalizeWoodVarToken(v);
      return varToken
        ? buildKeyFromSegments(["wood", "rail", sizeToken, varToken])
        : buildKeyFromSegments(["wood", "rail", sizeToken]);
    },

    picket: ({ size = "1x6", heightFt, profile = "dog-ear", var: v }) => {
      const sizeToken = String(size).replace(/x/g, '_');
      const profileToken = normalizeProfileToken(profile);
      const varToken = normalizeWoodVarToken(v);
      return varToken
        ? buildKeyFromSegments(["wood", "picket", sizeToken, profileToken, `${heightFt}ft`, varToken])
        : buildKeyFromSegments(["wood", "picket", sizeToken, profileToken, `${heightFt}ft`]);
    },

    postSteel: ({ size = "4x4" }) => {
      const sizeToken = String(size).replace(/x/g, '_');
      return buildKeyFromSegments(["wood", "post", sizeToken, "steel"]);
    },

    postGate: ({ size = "4x6" }) => {
      const sizeToken = String(size).replace(/x/g, '_');
      return buildKeyFromSegments(["wood", "post", sizeToken, "gate"]);
    },

    gate: ({ swing, widthIn, heightIn, var: v }) => {
      const s = String(swing || "").trim().toLowerCase();
      const widthToken = String(widthIn);
      const ft = heightInToFt(normalizeHeightIn(heightIn));
      const varToken = normalizeWoodVarToken(v);
      return varToken
        ? buildKeyFromSegments(["wood", "gate", s, widthToken, `${ft}ft`, varToken])
        : buildKeyFromSegments(["wood", "gate", s, widthToken, `${ft}ft`]);
    },

    gateKit: () =>
      buildKeyFromSegments(["wood", "gate", "kit", "adjust"]),

    hingeSet: () =>
      buildKeyFromSegments(["wood", "hinge", "set"]),

    gateLatch: () =>
      buildKeyFromSegments(["wood", "gate", "latch"]),

    caneBolt: () =>
      buildKeyFromSegments(["wood", "bolt", "cane"]),

    nail: ({ size = "2in" }) =>
      buildKeyFromSegments(["wood", "nail", size, "galv"]),

    screw: ({ size = "3in" }) =>
      buildKeyFromSegments(["wood", "screw", size, "deck"]),

    concrete: () =>
      buildKeyFromSegments(["wood", "concrete"])
  },

  aluminum: {
    // Panels: aluminum_panel_pacific_4_5_6 (no 'x' separator, all underscores)
    panel: ({ style = "pacific", heightFt = "4.5", widthFt = "6" }) => {
      const heightToken = String(heightFt).replace('.', '_');
      return buildKeyFromSegments(["aluminum", "panel", normalizeStyleToken(style), heightToken, String(widthFt)]);
    },

    // Posts: aluminum_post_line_2_2_7ft (no 'x' separator in size)
    post: ({ role, size = "2x2", heightFt = "7" }) => {
      if (!role) throw new CanonicalKeyError("aluminum.post requires role", { role });
      const heightToken = String(heightFt).replace('.', '_');
      const sizeToken = String(size).replace('x', '_');
      return buildKeyFromSegments(["aluminum", "post", String(role), sizeToken, `${heightToken}ft`]);
    },

    // Gates: aluminum_gate_single_48
    gate: ({ swing, widthIn }) => {
      const s = String(swing || "").trim().toLowerCase();
      if (!["single", "double"].includes(s)) throw new CanonicalKeyError("aluminum.gate requires swing=single|double", { swing });
      const w = typeof widthIn === 'number' ? widthIn : parseInt(String(widthIn).replace(/[^0-9]/g, ''));
      return buildKeyFromSegments(["aluminum", "gate", s, String(w)]);
    },

    // Caps
    cap: ({ style = "flat" }) =>
      buildKeyFromSegments(["aluminum", "cap", normalizeStyleToken(style)]),

    // Brackets/Mounting
    bracketSet: ({ style = "standard" }) =>
      buildKeyFromSegments(["aluminum", "bracket", normalizeStyleToken(style)]),

    // Fasteners
    fastener: ({ type = "selftap", finish = "ss" }) =>
      buildKeyFromSegments(["aluminum", "fastener", normalizeFastenerType(type), normalizeFinishToken(finish)]),

    // Hardware
    latchPool: () =>
      buildKeyFromSegments(["aluminum", "latch", "pool"]),

    hingeCornerstone: () =>
      buildKeyFromSegments(["aluminum", "hinge", "cornerstone"]),

    dropRod: () =>
      buildKeyFromSegments(["aluminum", "drop", "rod"]),

    gateStop: () =>
      buildKeyFromSegments(["aluminum", "gate", "stop"]),

    // Concrete
    concrete: () =>
      buildKeyFromSegments(["aluminum", "concrete"])
  },

  general: {
    deliveryFee: () =>
      buildKeyFromSegments(["fee", "delivery"]),
    
    carriageBolt: ({ finish = "galv" }) =>
      buildKeyFromSegments(["general", "bolt", "carriage", normalizeFinishToken(finish)])
  }
});