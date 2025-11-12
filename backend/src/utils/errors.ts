/**
 * Custom error class for validation errors
 * These should return 400 status codes
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Custom error class for not found errors
 * These should return 404 status codes
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
