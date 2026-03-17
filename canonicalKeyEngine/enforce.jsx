import { validateCanonicalKey } from "./validators";
import { CanonicalKeyError } from "./errors";

export function assertNewCanonicalKey(key, context = {}) {
  const k = validateCanonicalKey(key);

  if (k.includes("{") || k.includes("}")) {
    throw new CanonicalKeyError("Legacy template key detected", { key: k, ...context });
  }
  if (k.includes("-")) {
    throw new CanonicalKeyError("Hyphen detected (blocked)", { key: k, ...context });
  }
  
  // No dot-decimal checks needed for underscore format
  return k;
}