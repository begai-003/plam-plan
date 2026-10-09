import {
  ref,
  uploadBytes,
  getBlob,
  deleteObject,
  listAll,
} from "firebase/storage";
import {
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { storage, db, allowedUid } from "./firebase";
import { recordRef, kitRepository } from "./repository";
import { assertRevision, validateImage, uuid } from "../domain";
export const imageRepository = {
  async load(path) {
    return URL.createObjectURL(await getBlob(ref(storage, path)));
  },
  async remove(path) {
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      if (e.code !== "storage/object-not-found") throw e;
    }
  },
  async upload(kitId, file, imageId) {
    validateImage(file);
    const path = `users/${allowedUid}/kits/${kitId}/${imageId}`;
    await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return path;
  },
};
export async function saveKitWithImage(
  id,
  draft,
  revision,
  context,
  file,
  removeImage,
  imageId = uuid(),
) {
  const previousPath = context.previous?.imagePath || null;
  const path = file
    ? await imageRepository.upload(id, file, imageId)
    : removeImage
      ? null
      : draft.imagePath;
  try {
    await kitRepository.save(
      id,
      { ...draft, imagePath: path },
      revision,
      context,
    );
  } catch (error) {
    if (file) {
      try {
        const saved = await getDocFromServer(recordRef("kits", id));
        if (!saved.exists() || saved.data().imagePath !== path)
          await imageRepository.remove(path);
      } catch {
        /* Do not delete an image when commit state is unknown. See orphan cleanup procedure. */
      }
    }
    throw error;
  }
  if (previousPath && previousPath !== path) {
    try {
      await imageRepository.remove(previousPath);
    } catch {
      rememberCleanup(previousPath);
      return "保存しました。旧画像の削除に失敗しました。画像の削除を再試行してください";
    }
  }
}
// Application data is never persisted in localStorage. Keep retries in memory.
let cleanupPaths = [];
export function pendingCleanup() {
  return [...cleanupPaths];
}
function rememberCleanup(path) {
  cleanupPaths = [...new Set([...cleanupPaths, path])];
}
export async function retryCleanup() {
  const failures = [];
  for (const path of pendingCleanup()) {
    try {
      const kitId = path.split("/")[3];
      const kit = await getDocFromServer(recordRef("kits", kitId));
      if (kit.exists() && kit.data().imagePath === path) continue;
      await imageRepository.remove(path);
    } catch {
      failures.push(path);
    }
  }
  cleanupPaths = failures;
  if (failures.length)
    throw new Error(
      "旧画像の削除に失敗しました。通信を確認して再試行してください",
    );
}
export async function deleteKit(kit) {
  if (!navigator.onLine) throw new Error("オフラインのため削除できません");
  const refDoc = recordRef("kits", kit.id);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(refDoc);
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.status !== "deleting") {
      assertRevision(data.revision, kit.revision);
      tx.update(refDoc, {
        status: "deleting",
        revision: data.revision + 1,
        updatedAt: serverTimestamp(),
      });
    }
  });
  const images = await listAll(
    ref(storage, `users/${allowedUid}/kits/${kit.id}`),
  );
  for (const item of images.items) await imageRepository.remove(item.fullPath);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(refDoc);
    if (snapshot.exists()) {
      if (snapshot.data().status !== "deleting")
        throw new Error("削除状態が変更されました");
      tx.delete(refDoc);
    }
  });
}
