export class MappingEngineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "MappingEngineError";
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}