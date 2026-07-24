import { randomUUID } from 'crypto';

/**
 * Attaches a unique correlation ID to every request.
 * Echoed back in error responses so requests can be traced.
 */
export function correlationMiddleware(req, _res, next) {
  req.correlationId = req.headers['x-correlation-id'] ?? randomUUID();
  next();
}
