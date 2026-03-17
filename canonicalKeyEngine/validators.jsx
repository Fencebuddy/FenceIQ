import { CanonicalKeyError } from "./errors";

const CANONICAL_KEY_REGEX = /^[a-z][a-z0-9_]{0,180}$/;  // Underscores only, no dots
const RESERVED = new Set(["null", "undefined", "constructor", "prototype", "__proto__"]);

export function validateCanonicalKey(key) {
  if (typeof key !== "string") throw new CanonicalKeyError("canonicalKey must be string", { key });
  const k = key.trim().toLowerCase();
  if (!k) throw new CanonicalKeyError("canonicalKey cannot be empty", { key });
  if (RESERVED.has(k)) throw new CanonicalKeyError("canonicalKey uses reserved word", { key: k });
  if (/\s/.test(k)) throw new CanonicalKeyError("canonicalKey cannot contain whitespace", { key: k });
  if (k.includes("{") || k.includes("}")) throw new CanonicalKeyError("canonicalKey cannot contain template braces", { key: k });
  if (k.includes("-")) throw new CanonicalKeyError("canonicalKey cannot contain hyphens", { key: k });
  if (!CANONICAL_KEY_REGEX.test(k)) throw new CanonicalKeyError("canonicalKey format invalid", { key: k });
  
  // Validate characters only (no segment splitting for underscore format)
  if (!/^[a-z0-9][a-z0-9_]*$/.test(k)) {
    throw new CanonicalKeyError("Invalid key format (use a-z0-9_ only)", { key: k });
  }
  return k;
}

export function validateSegment(seg, name = "segment") {
  if (typeof seg !== "string" || !seg.trim()) throw new CanonicalKeyError(`${name} required`, { seg });
  const s = seg.trim().toLowerCase();
  if (s.includes("-")) throw new CanonicalKeyError(`Invalid ${name} segment (no hyphens)`, { name, seg: s });
  if (s.includes(".")) throw new CanonicalKeyError(`Invalid ${name} segment (no dots - use underscores)`, { name, seg: s });
  if (!/^[a-z0-9][a-z0-9_]*$/.test(s)) {
    throw new CanonicalKeyError(`Invalid ${name} segment (use a-z0-9_ only)`, { name, seg, normalized: s });
  }
  return s;
}