/**
 * JWT helpers — sign and verify access / refresh tokens.
 * Uses Node.js built-in `crypto` and manual JWT implementation
 * to avoid adding jsonwebtoken as a dependency.
 *
 * For production, swap this to jsonwebtoken or jose if preferred.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config/config.js';

function base64url(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseBase64url(str) {
  const padding = 4 - (str.length % 4);
  const padded = str + (padding === 4 ? '' : '='.repeat(padding));
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload, secret, expiresInMs) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: Math.floor((Date.now() + expiresInMs) / 1000),
    }),
  );
  const data = `${header}.${body}`;
  const sig = base64url(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Invalid token format'), { name: 'JsonWebTokenError' });

  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expectedSig = base64url(createHmac('sha256', secret).update(data).digest());

  // Timing-safe comparison
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    throw Object.assign(new Error('Invalid signature'), { name: 'JsonWebTokenError' });
  }

  const payload = JSON.parse(parseBase64url(body).toString());
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw Object.assign(new Error('Token expired'), { name: 'TokenExpiredError' });
  }

  return payload;
}

function parseDuration(str) {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration string: ${str}`);
  return parseInt(match[1], 10) * units[match[2]];
}

export function signAccessToken(payload) {
  return sign(payload, config.jwt.secret, parseDuration(config.jwt.expiry));
}

export function verifyAccessToken(token) {
  return verify(token, config.jwt.secret);
}

export function signRefreshToken(payload) {
  return sign(payload, config.jwt.refreshSecret, parseDuration(config.jwt.refreshExpiry));
}

export function verifyRefreshToken(token) {
  return verify(token, config.jwt.refreshSecret);
}
