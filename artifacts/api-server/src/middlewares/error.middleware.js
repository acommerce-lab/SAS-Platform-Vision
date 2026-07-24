import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';
import { logger } from '../lib/logger.js';

/**
 * Global error handler. Must be registered LAST in Express.
 * Never calls next() — this is the terminal error handler.
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, _next) {
  // ── AppError (expected) ────────────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err, correlationId: req.correlationId }, 'Application error');
    } else {
      logger.warn({ code: err.code, correlationId: req.correlationId }, 'Client error: %s', err.message);
    }

    return res.status(err.httpStatus).json({
      ...err.toJSON(),
      error: {
        ...err.toJSON().error,
        correlationId: req.correlationId,
      },
    });
  }

  // ── Express / body-parser validation errors ────────────────────────────
  if (err?.type === 'entity.parse.failed') {
    logger.warn({ correlationId: req.correlationId }, 'Invalid JSON body');
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: 'Invalid JSON body',
        correlationId: req.correlationId,
      },
    });
  }

  // ── Unexpected error ───────────────────────────────────────────────────
  logger.error({ err, correlationId: req.correlationId }, 'Unhandled server error');

  return res.status(500).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      correlationId: req.correlationId,
    },
  });
}
