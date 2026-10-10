import { runTransaction, serverTimestamp } from "@firebase/firestore";
import { db } from "./firebase";
import { recordRef } from "./repository";
import { assertRevision } from "../domain";
// Retain the legacy deleting state so interrupted deletions can still be resumed.
export async function deleteKit(kit) {
  if (!navigator.onLine) throw new Error("オフラインのため削除できません");
  const ref = recordRef("kits", kit.id);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.status !== "deleting") {
      assertRevision(data.revision, kit.revision);
      tx.update(ref, {
        status: "deleting",
        revision: data.revision + 1,
        updatedAt: serverTimestamp(),
      });
    }
  });
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      if (snapshot.data().status !== "deleting")
        throw new Error("削除状態が変更されました");
      tx.delete(ref);
    }
  });
}
