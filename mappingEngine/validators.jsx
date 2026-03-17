import { MappingEngineError } from "./errors";

export function assertFinite(n, name) {
  if (!Number.isFinite(n)) throw new MappingEngineError(`${name} must be finite`, { [name]: n });
  return n;
}

export function assertNonNeg(n, name) {
  assertFinite(n, name);
  if (n < 0) throw new MappingEngineError(`${name} must be >= 0`, { [name]: n });
  return n;
}

export function assertString(s, name) {
  if (typeof s !== "string" || !s.trim()) throw new MappingEngineError(`${name} required`, { [name]: s });
  return s.trim();
}