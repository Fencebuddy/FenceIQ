import { CanonicalKeyError } from "./errors";

const HEIGHT_IN_ALLOWED = new Set([48, 60, 72, 96]); // 4/5/6/8ft
const HEIGHT_FT_ALLOWED = new Set([4, 5, 6, 8]);

const ALLOWED_COLOR_TOKENS = new Set([
  "white",
  "khaki",
  "tan",
  "bronze",
  "black",
  "galv",
  "black_vinyl",
  "coastal_grey",
  "cedar_woodgrain",
  "grey"
]);

const COLOR_MAP = Object.freeze({
  "black": "black",
  "blk": "black",
  "white": "white",
  "wht": "white",
  "khaki": "khaki",
  "tan": "khaki",
  "bronze": "bronze",
  "brown": "bronze",
  "galv": "galv",
  "galvanized": "galv",
  "vinylcoatedblack": "black_vinyl",
  "blackvinyl": "black_vinyl",
  "black_vinyl": "black_vinyl",
  "coastalgrey": "coastal_grey",
  "coastal_grey": "coastal_grey",
  "cedarwoodgrain": "cedar_woodgrain",
  "cedar_woodgrain": "cedar_woodgrain",
  "grey": "grey",
  "gray": "grey"
});

export function normalizeColorToken(color) {
  if (typeof color !== "string" || !color.trim()) {
    throw new CanonicalKeyError("color token required", { color });
  }
  const raw = color.trim().toLowerCase();
  const compact = raw.replace(/[\s\-]+/g, "");

  const mapped = COLOR_MAP[raw] || COLOR_MAP[compact];
  if (!mapped) {
    throw new CanonicalKeyError("Unknown color token (not allowed)", { color: raw, allowed: [...ALLOWED_COLOR_TOKENS] });
  }
  if (!ALLOWED_COLOR_TOKENS.has(mapped)) {
    throw new CanonicalKeyError("Mapped color token not in allowlist", { color: raw, mapped });
  }
  if (!/^[a-z0-9_]+$/.test(mapped)) {
    throw new CanonicalKeyError("Invalid color token format (use a-z0-9_)", { color: raw, mapped });
  }
  return mapped;
}

export function normalizeSystem(system) {
  if (typeof system !== "string" || !system.trim()) {
    throw new CanonicalKeyError("system required", { system });
  }
  const s = system.trim().toLowerCase();
  const allowed = new Set(["vinyl", "wood", "aluminum", "chainlink"]);
  if (!allowed.has(s)) throw new CanonicalKeyError("Invalid system", { system: s, allowed: [...allowed] });
  return s;
}

export function normalizeHeightIn(heightIn) {
  if (!Number.isFinite(heightIn)) throw new CanonicalKeyError("heightIn must be finite", { heightIn });
  if (!Number.isInteger(heightIn)) throw new CanonicalKeyError("heightIn must be an integer (no rounding)", { heightIn });
  if (!HEIGHT_IN_ALLOWED.has(heightIn)) throw new CanonicalKeyError("heightIn must be 48/60/72/96", { heightIn });
  return heightIn;
}

export function normalizeHeightFt(heightFt) {
  if (!Number.isFinite(heightFt)) throw new CanonicalKeyError("heightFt must be finite", { heightFt });
  if (!Number.isInteger(heightFt)) throw new CanonicalKeyError("heightFt must be an integer", { heightFt });
  if (!HEIGHT_FT_ALLOWED.has(heightFt)) throw new CanonicalKeyError("heightFt must be 4/5/6/8", { heightFt });
  return heightFt;
}

export function heightInToFt(heightIn) {
  const h = normalizeHeightIn(heightIn);
  const ft = h / 12;
  if (!Number.isInteger(ft)) throw new CanonicalKeyError("heightIn must be divisible by 12", { heightIn: h, ft });
  return normalizeHeightFt(ft);
}

export function normalizeInchesToken(inchesToken) {
  if (typeof inchesToken !== "string" || !inchesToken.trim()) {
    throw new CanonicalKeyError("inches token required", { inchesToken });
  }
  let t = inchesToken.trim().toLowerCase();
  t = t.replace(/\s+/g, "");
  t = t.replace(/^(\d+)\.(\d+)in$/, "$1_$2in");
  if (!/^\d+(_\d+)?in$/.test(t)) {
    throw new CanonicalKeyError("Invalid inches token (use 48in or 62_5in)", { inchesToken, normalized: t });
  }
  return t;
}

export function normalizeFeetToken(feetToken) {
  if (typeof feetToken !== "string" || !feetToken.trim()) {
    throw new CanonicalKeyError("feet token required", { feetToken });
  }
  let t = feetToken.trim().toLowerCase();
  t = t.replace(/\s+/g, "");
  t = t.replace(/^(\d+)\.(\d+)ft$/, "$1_$2ft");
  if (!/^\d+(_\d+)?ft$/.test(t)) {
    throw new CanonicalKeyError("Invalid feet token (use 6ft or 4_5ft)", { feetToken, normalized: t });
  }
  return t;
}