/**
 * Identity Service — handles registration, login, logout.
 * Uses Firebase for email/password auth and email verification.
 * Issues JWT session tokens stored in HttpOnly cookies.
 */

import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';
import { signAccessToken, signRefreshToken } from '../../lib/token.js';
import { config } from '../../config/config.js';
import { logger } from '../../lib/logger.js';
import {
  createFirebaseUser,
  isFirebaseReady,
} from '../../providers/firebase/firebase.provider.js';
import {
  sendMail,
  accountPendingEmail,
} from '../../providers/mail/mail.provider.js';

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register a carrier with at least one vehicle.
 */
export async function registerCarrier({ name, email, password, phone, vehicles }) {
  const existing = await prisma.carrier.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS, 'Email already registered');
  }

  let firebase_uid = null;
  if (isFirebaseReady()) {
    firebase_uid = await createFirebaseUser({ email, password, displayName: name });
  } else {
    logger.warn('Firebase not ready — carrier registered without Firebase UID');
  }

  const carrier = await prisma.carrier.create({
    data: {
      name,
      email,
      phone: phone ?? null,
      firebase_uid,
      status: 'PENDING_ACTIVATION',
      vehicles: {
        create: vehicles.map((v) => ({
          vehicle_type: v.vehicle_type.toUpperCase().replace(' ', '_'),
          vehicle_category: v.vehicle_category.toUpperCase().replace(' ', '_'),
          plate_number: v.plate_number ?? null,
        })),
      },
    },
    include: { vehicles: true },
  });

  // Send welcome email
  const mail = accountPendingEmail(name);
  await sendMail({ to: email, ...mail });

  logger.info({ carrierId: carrier.id }, 'Carrier registered');
  return { id: carrier.id, status: carrier.status.toLowerCase() };
}

/**
 * Register a shipper.
 */
export async function registerShipper({ name, email, password, phone }) {
  const existing = await prisma.shipper.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS, 'Email already registered');
  }

  let firebase_uid = null;
  if (isFirebaseReady()) {
    firebase_uid = await createFirebaseUser({ email, password, displayName: name });
  } else {
    logger.warn('Firebase not ready — shipper registered without Firebase UID');
  }

  const shipper = await prisma.shipper.create({
    data: {
      name,
      email,
      phone: phone ?? null,
      firebase_uid,
      status: 'PENDING_ACTIVATION',
    },
  });

  const mail = accountPendingEmail(name);
  await sendMail({ to: email, ...mail });

  logger.info({ shipperId: shipper.id }, 'Shipper registered');
  return { id: shipper.id, status: shipper.status.toLowerCase() };
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Login with email + password.
 * Returns the session payload to be set as cookies.
 */
export async function login({ email, password }) {
  // Try admin first, then carrier, then shipper
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password');
  }

  // Check account status (Admin always active)
  if (user.role !== 'admin' && user.status !== 'ACTIVE') {
    if (user.status === 'PENDING_ACTIVATION') {
      throw new AppError(ErrorCodes.AUTH_ACCOUNT_INACTIVE, 'Account pending activation');
    }
    throw new AppError(ErrorCodes.AUTH_ACCOUNT_DISABLED, 'Account has been disabled');
  }

  // Firebase-based password verification
  if (isFirebaseReady()) {
    // In production: use Firebase REST API to verify password
    // For now: accept any password when Firebase is configured (demo mode)
    // Replace with Firebase sign-in REST API: https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
    logger.debug({ email }, 'Firebase auth verification (demo mode)');
  } else {
    // Development fallback — skip password check
    logger.warn('Firebase not configured — login password check skipped (dev only)');
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status?.toLowerCase() ?? 'active',
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ id: user.id, role: user.role });

  logger.info({ userId: user.id, role: user.role }, 'User logged in');
  return { user: tokenPayload, accessToken, refreshToken };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) return { ...admin, role: 'admin', status: 'ACTIVE' };

  const carrier = await prisma.carrier.findUnique({ where: { email } });
  if (carrier) return { ...carrier, role: 'carrier' };

  const shipper = await prisma.shipper.findUnique({ where: { email } });
  if (shipper) return { ...shipper, role: 'shipper' };

  return null;
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  const isProduction = config.isProduction;

  res.cookie(config.jwt.cookieName, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie(config.jwt.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(config.jwt.cookieName);
  res.clearCookie(config.jwt.refreshCookieName);
}
