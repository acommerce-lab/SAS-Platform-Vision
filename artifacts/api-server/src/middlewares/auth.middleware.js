import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';
import { verifyAccessToken } from '../lib/token.js';
import { logger } from '../lib/logger.js';

/**
 * requireAuth — verifies the session cookie and injects req.user.
 *
 * req.user = { id, role, email, name }
 */
export function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.['sas_session'];
    if (!token) {
      return next(AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'No session token'));
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    logger.debug({ err }, 'Auth middleware: token verification failed');
    if (err?.name === 'TokenExpiredError') {
      return next(new AppError(ErrorCodes.AUTH_TOKEN_EXPIRED, 'Session expired'));
    }
    return next(new AppError(ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid session token'));
  }
}

/**
 * requireRole — restricts access to one or more roles.
 * Must be used after requireAuth.
 *
 * @param {...string} roles - Allowed roles: 'admin', 'carrier', 'shipper'
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Not authenticated'));
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(ErrorCodes.FORBIDDEN, `Role '${req.user.role}' is not permitted`));
    }
    next();
  };
}
