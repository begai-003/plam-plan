// Test-only helper: Auth Emulator accepts synthetic Google ID tokens.
import { GoogleAuthProvider, signInWithCredential } from "@firebase/auth";
import { auth } from "../../src/services/firebase.js";
export function signInAs(email) {
  const token = JSON.stringify({
    sub: email.startsWith("owner") ? "google-owner" : "google-other",
    email,
    email_verified: true,
    name: "Emulator user",
  });
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
