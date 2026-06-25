import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

/**
 * Firebase config values come from environment variables (see .env.example).
 * These values are safe to expose client-side — Firebase's web API keys are
 * not secrets; access is controlled by Firestore Security Rules
 * (see /firebase/firestore.rules), not by hiding this config.
 *
 * NOTE: no `firebase/storage` import here on purpose. Per spec section 2.4,
 * this app never persists receipt images, so Firebase Storage is unused
 * across the entire codebase. `VITE_FIREBASE_STORAGE_BUCKET` is left in
 * the env config below only because some Firebase SDK internals expect
 * the field to exist on the config object — it's not actually used to
 * store anything.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
