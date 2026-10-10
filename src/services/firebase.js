import { initializeApp } from "@firebase/app";
import { getAuth, connectAuthEmulator } from "@firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "@firebase/firestore";
const env = import.meta.env;
export const allowedUid = env.VITE_ALLOWED_UID || "";
export const useEmulators = env.VITE_USE_EMULATORS === "true";
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const configured =
  Object.values(config).every(Boolean) && Boolean(allowedUid);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
if (app && useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
