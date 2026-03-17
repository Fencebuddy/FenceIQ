export class CanonicalKeyError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "CanonicalKeyError";
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}