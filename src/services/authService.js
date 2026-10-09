import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { auth, allowedUid } from "./firebase";
export const watchAuth = (callback, onError) =>
  onAuthStateChanged(auth, async (user) => {
    if (user && user.uid !== allowedUid) {
      callback(null);
      onError(new Error("このアカウントでは利用できません"));
      try {
        await signOut(auth);
      } catch {
        onError(
          new Error(
            "利用できないアカウントのログアウトに失敗しました。再読み込みしてください",
          ),
        );
      }
    } else callback(user);
  });
export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  if (result.user.uid !== allowedUid) {
    await signOut(auth);
    throw new Error("このアカウントでは利用できません");
  }
}
export const logout = () => signOut(auth);
