/**
 * Configuration loader — reads from environment variables only.
 * Fails fast at startup if required values are missing.
 */

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name, defaultValue = null) {
  return process.env[name] ?? defaultValue;
}

function requiredInt(name) {
  const value = required(name);
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be a valid integer, got: "${value}"`);
  return parsed;
}

export const config = {
  // ─── Application ────────────────────────────────────────────────────────
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:5000'),
  isProduction: process.env['NODE_ENV'] === 'production',
  isDevelopment: process.env['NODE_ENV'] !== 'production',

  // ─── Database ───────────────────────────────────────────────────────────
  database: {
    url: optional('DATABASE_URL'),
  },

  // ─── JWT / Session ──────────────────────────────────────────────────────
  jwt: {
    secret: optional('JWT_SECRET', 'dev-secret-change-in-production'),
    expiry: optional('JWT_EXPIRY', '15m'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
    cookieName: 'sas_session',
    refreshCookieName: 'sas_refresh',
  },

  // ─── Firebase ───────────────────────────────────────────────────────────
  firebase: {
    projectId: optional('FIREBASE_PROJECT_ID'),
    clientEmail: optional('FIREBASE_CLIENT_EMAIL'),
    privateKey: optional('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n') ?? null,
    storageBucket: optional('FIREBASE_STORAGE_BUCKET'),
    apiKey: optional('FIREBASE_API_KEY'),
    authDomain: optional('FIREBASE_AUTH_DOMAIN'),
  },

  // ─── OSRM / Maps ────────────────────────────────────────────────────────
  maps: {
    osrmBaseUrl: optional('OSRM_BASE_URL', 'http://router.project-osrm.org'),
    timeoutMs: parseInt(optional('OSRM_TIMEOUT_MS', '5000'), 10),
    userAgent: optional('USER_AGENT', 'SASPlatform/1.0'),
  },

  // ─── SMTP ───────────────────────────────────────────────────────────────
  smtp: {
    host: optional('SMTP_HOST'),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    user: optional('SMTP_USER'),
    password: optional('SMTP_PASSWORD'),
    from: optional('SMTP_FROM', 'SAS Platform <notifications@example.com>'),
  },

  // ─── Rate Limiting ──────────────────────────────────────────────────────
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    maxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },
};
