/**
 * Firebase Admin SDK provider.
 * Reads credentials from environment variables only.
 * If credentials are missing, the provider is marked as unavailable.
 * The app starts successfully — auth calls fail gracefully at runtime.
 */

import { logger } from '../../lib/logger.js';
import { config } from '../../config/config.js';

let adminApp = null;
let firebaseAuth = null;
let firebaseStorage = null;

export async function initFirebase() {
  const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      'Firebase credentials not configured. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable Firebase features.',
    );
    return;
  }

  try {
    const { default: admin } = await import('firebase-admin');

    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket: storageBucket ?? undefined,
      });
    } else {
      adminApp = admin.apps[0];
    }

    firebaseAuth = admin.auth();
    if (storageBucket) {
      firebaseStorage = admin.storage().bucket();
    }

    logger.info({ projectId }, 'Firebase Admin SDK initialised');
  } catch (err) {
    logger.error({ err }, 'Failed to initialise Firebase Admin SDK — Firebase features unavailable');
  }
}

export function getFirebaseAuth() {
  if (!firebaseAuth) {
    throw Object.assign(
      new Error('Firebase Auth is not initialised. Check FIREBASE_* environment variables.'),
      { code: 'FIREBASE_NOT_CONFIGURED' },
    );
  }
  return firebaseAuth;
}

export function getFirebaseStorage() {
  if (!firebaseStorage) {
    throw Object.assign(
      new Error('Firebase Storage is not initialised. Check FIREBASE_STORAGE_BUCKET environment variable.'),
      { code: 'FIREBASE_NOT_CONFIGURED' },
    );
  }
  return firebaseStorage;
}

export function isFirebaseReady() {
  return !!adminApp;
}

/**
 * Create a Firebase user and return their UID.
 * Falls back gracefully if Firebase is not configured.
 *
 * @param {{ email: string, password: string, displayName?: string }} params
 * @returns {Promise<string>} Firebase UID
 */
export async function createFirebaseUser({ email, password, displayName = '' }) {
  const auth = getFirebaseAuth();
  const user = await auth.createUser({ email, password, displayName });
  return user.uid;
}

/**
 * Verify a Firebase ID token.
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken>}
 */
export async function verifyFirebaseToken(idToken) {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(idToken);
}

/**
 * Delete a Firebase user by UID.
 * @param {string} uid
 */
export async function deleteFirebaseUser(uid) {
  const auth = getFirebaseAuth();
  await auth.deleteUser(uid);
}
