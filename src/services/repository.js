import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  getDocFromServer,
} from "@firebase/firestore";
import { db, allowedUid } from "./firebase";
import {
  assertRevision,
  validateKit,
  validatePaint,
  sameData,
} from "../domain";
export const recordRef = (kind, id) => doc(db, "users", allowedUid, kind, id);
export const watchRecords = (kind, next, error) =>
  onSnapshot(
    collection(db, "users", allowedUid, kind),
    (snapshot) => next(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))),
    error,
  );
function editable(record) {
  const { id, createdAt, updatedAt, revision, imagePath, ...data } = record;
  return data;
}
export async function saveRecord(
  kind,
  id,
  draft,
  expectedRevision,
  context = {},
) {
  if (!navigator.onLine)
    throw new Error(
      "オフラインのため保存できません。通信回復後に再試行してください",
    );
  const data = editable(draft);
  if (kind === "kits") validateKit(data, context.paints, context.previous);
  else validatePaint(data);
  const ref = recordRef(kind, id);
  const desiredRevision = (expectedRevision ?? 0) + 1;
  try {
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      if (expectedRevision == null) {
        if (current.exists()) {
          // A retry of an already committed create must never overwrite it.
          throw new Error(
            "同じIDの登録済みデータがあります。登録結果を確認してください",
          );
        }
      } else {
        if (!current.exists())
          throw new Error("データが見つかりません。再読み込みしてください");
        assertRevision(current.data().revision, expectedRevision);
        if (kind === "kits" && current.data().status === "deleting")
          throw new Error("削除処理中のキットは編集できません");
      }
      transaction.set(ref, {
        ...data,
        schemaVersion: 1,
        revision: desiredRevision,
        createdAt: current.exists()
          ? current.data().createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    // Reconcile ambiguous network failures against the server, never a cached document.
    if (
      ["unavailable", "deadline-exceeded", "unknown"].includes(error.code) ||
      expectedRevision == null
    ) {
      try {
        const saved = await getDocFromServer(ref);
        if (
          saved.exists() &&
          saved.data().revision === desiredRevision &&
          sameData(editable(saved.data()), data)
        )
          return;
      } catch {
        /* Preserve draft and its ID; retry rather than creating another record. */
      }
    }
    throw error;
  }
}
export const kitRepository = {
  watch: (next, error) => watchRecords("kits", next, error),
  save: (id, data, revision, context) =>
    saveRecord("kits", id, data, revision, context),
};
export const paintRepository = {
  watch: (next, error) => watchRecords("paints", next, error),
  save: (id, data, revision) => saveRecord("paints", id, data, revision),
};
