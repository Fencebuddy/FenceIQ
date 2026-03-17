export class PricingTruthError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PricingTruthError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Enforces "unique record" invariant for truth sets.
 * - If 0 records: returns null (caller decides fallback behavior)
 * - If 1 record: returns the record
 * - If >1: throws PricingTruthError (FAIL LOUD)
 */
export function requireUniqueOrNull({ records, code, message, details = {} }) {
  if (!records || records.length === 0) return null;
  if (records.length === 1) return records[0];
  throw new PricingTruthError(code, message, { ...details, count: records.length });
}