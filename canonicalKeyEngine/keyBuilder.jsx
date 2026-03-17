import { CanonicalKeyError } from "./errors";
import { KeySchemas } from "./keySchemas";
import { normalizeSystem } from "./tokens";

export function buildCanonicalKey(input) {
  if (!input || typeof input !== "object") throw new CanonicalKeyError("Input must be object", { input });
  const system = normalizeSystem(input.system);
  const type = input.type;

  if (typeof type !== "string" || !type.trim()) {
    throw new CanonicalKeyError("type required", { type });
  }

  const schemas = KeySchemas[system];
  const fn = schemas?.[type];
  if (typeof fn !== "function") {
    throw new CanonicalKeyError("Unknown key schema type for system", {
      system,
      type,
      available: schemas ? Object.keys(schemas) : []
    });
  }

  const params = { ...input };
  delete params.system;
  delete params.type;

  return fn(params);
}