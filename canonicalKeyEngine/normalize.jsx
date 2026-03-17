import { validateCanonicalKey, validateSegment } from "./validators";
import { CanonicalKeyError } from "./errors";

export function buildKeyFromSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new CanonicalKeyError("segments must be a non-empty array", { segments });
  }
  const clean = segments.map((s, i) => validateSegment(String(s), `segment[${i}]`));
  const key = clean.join("_");  // UNDERSCORE not dot
  return validateCanonicalKey(key);
}