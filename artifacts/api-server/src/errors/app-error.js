import { ErrorCodes, ErrorHttpStatus } from './error-codes.js';

/**
 * AppError — structured application error.
 * Every thrown error that reaches the error middleware must be an AppError.
 */
export class AppError extends Error {
  /**
   * @param {string} code       - Error code from ErrorCodes catalog
   * @param {string} message    - Human-readable message (not shown to end users directly)
   * @param {object} [details]  - Optional structured details (validation errors, etc.)
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = ErrorHttpStatus[code] ?? 500;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Factories ──────────────────────────────────────────────────────────

  static notFound(code = ErrorCodes.NOT_FOUND, message = 'Resource not found') {
    return new AppError(code, message);
  }

  static unauthorized(code = ErrorCodes.UNAUTHORIZED, message = 'Unauthorized') {
    return new AppError(code, message);
  }

  static forbidden(code = ErrorCodes.FORBIDDEN, message = 'Forbidden') {
    return new AppError(code, message);
  }

  static conflict(code = ErrorCodes.CONFLICT, message = 'Conflict', details = null) {
    return new AppError(code, message, details);
  }

  static validation(message = 'Validation error', details = null) {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, details);
  }

  static invalidTransition(from, to) {
    return new AppError(
      ErrorCodes.SHIPMENT_INVALID_TRANSITION,
      `Cannot transition shipment from ${from} to ${to}`,
      { from, to },
    );
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
