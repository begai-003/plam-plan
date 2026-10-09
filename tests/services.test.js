import { beforeEach, describe, it, expect, vi } from "vitest";
import { kit, paint, paints } from "./fixtures.js";
const state = vi.hoisted(() => ({
  docs: new Map(),
  images: new Map(),
  writes: [],
  serverError: false,
  ambiguous: false,
  removeError: false,
  uploadError: false,
  authUser: null,
}));
vi.mock("../src/services/firebase.js", () => ({
  db: {},
  storage: {},
  auth: {},
  allowedUid: "test-owner",
}));
vi.mock("firebase/firestore", () => ({
  doc: (_, ...parts) => parts.join("/"),
  collection: () => "",
  onSnapshot: () => () => {},
  serverTimestamp: () => ({ seconds: 100 }),
  getDocFromServer: async (ref) => {
    if (state.serverError) throw new Error("network");
    return {
      exists: () => state.docs.has(ref),
      data: () => state.docs.get(ref),
    };
  },
  runTransaction: async (_, action) => {
    const updates = [];
    const tx = {
      get: async (ref) => ({
        exists: () => state.docs.has(ref),
        data: () => state.docs.get(ref),
      }),
      set: (ref, data) => updates.push(() => state.docs.set(ref, data)),
      update: (ref, data) =>
        updates.push(() =>
          state.docs.set(ref, { ...state.docs.get(ref), ...data }),
        ),
      delete: (ref) => updates.push(() => state.docs.delete(ref)),
    };
    await action(tx);
    updates.forEach((update) => update());
    state.writes.push(updates.length);
    if (state.ambiguous)
      throw Object.assign(new Error("unknown commit"), { code: "unavailable" });
  },
}));
vi.mock("firebase/storage", () => ({
  ref: (_, path) => ({ fullPath: path }),
  uploadBytes: async (ref, file) => {
    if (state.uploadError) throw new Error("upload failed");
    state.images.set(ref.fullPath, file);
  },
  getBlob: async (ref) => state.images.get(ref.fullPath),
  deleteObject: async (ref) => {
    if (state.removeError) throw new Error("delete failed");
    state.images.delete(ref.fullPath);
  },
  listAll: async (ref) => ({
    items: [...state.images.keys()]
      .filter((path) => path.startsWith(ref.fullPath + "/"))
      .map((fullPath) => ({ fullPath })),
  }),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: async () => ({ user: state.authUser }),
  signOut: vi.fn(async () => {}),
  onAuthStateChanged: (_, fn) => {
    fn(state.authUser);
    return () => {};
  },
}));
import { kitRepository, paintRepository } from "../src/services/repository.js";
import {
  saveKitWithImage,
  deleteKit,
  retryCleanup,
  pendingCleanup,
} from "../src/services/imageRepository.js";
import { login } from "../src/services/authService.js";
import { signOut } from "firebase/auth";
const path = "users/test-owner/kits/k";
beforeEach(() => {
  state.docs.clear();
  state.images.clear();
  state.writes = [];
  state.serverError = false;
  state.ambiguous = false;
  state.removeError = false;
  state.uploadError = false;
  state.authUser = { uid: "test-owner" };
  vi.stubGlobal("navigator", { onLine: true });
});
describe("Firebase 保存契約", () => {
  it("作成IDを維持し、二重登録を防ぐ", async () => {
    const k = kit();
    await kitRepository.save("k", k, null, { paints: paints() });
    await kitRepository.save("k", k, null, { paints: paints() });
    expect(state.docs.size).toBe(1);
    expect(state.docs.get(path).revision).toBe(1);
  });
  it("確定したserverTimestamp、revisionで子要素更新を保存する", async () => {
    const k = kit();
    await kitRepository.save("k", k, null, { paints: paints() });
    k.runners[0].memo = "注意";
    await kitRepository.save("k", k, 1, { paints: paints(), previous: k });
    expect(state.docs.get(path).revision).toBe(2);
    expect(state.docs.get(path).runners[0].memo).toBe("注意");
  });
  it("古いrevisionを拒否して現データを維持する", async () => {
    const k = kit();
    await kitRepository.save("k", k, null, { paints: paints() });
    await expect(
      kitRepository.save("k", { ...k, name: "old" }, 0, { paints: paints() }),
    ).rejects.toThrow("別端末");
    expect(state.docs.get(path).name).toBe(k.name);
  });
  it("通信結果不明時はサーバー照会し成功を照合する", async () => {
    state.ambiguous = true;
    await expect(
      kitRepository.save("k", kit(), null, { paints: paints() }),
    ).resolves.toBeUndefined();
    expect(state.docs.size).toBe(1);
  });
  it("オフラインは書き込み前に止める", async () => {
    navigator.onLine = false;
    await expect(paintRepository.save("p", paint(), null)).rejects.toThrow(
      "オフライン",
    );
    expect(state.docs.size).toBe(0);
  });
  it("削除処理中のキットは編集できない", async () => {
    state.docs.set(path, { ...kit(), revision: 2, status: "deleting" });
    await expect(
      kitRepository.save("k", kit(), 2, { paints: paints() }),
    ).rejects.toThrow("削除処理中");
  });
});
describe("画像交換・キット削除", () => {
  const file = { type: "image/png", size: 3 };
  it("画像アップロード後にDBを保存し、その後に旧画像を削除する", async () => {
    const k = { ...kit(), imagePath: path + "/old" };
    state.docs.set(path, { ...k, revision: 1, createdAt: { seconds: 1 } });
    state.images.set(k.imagePath, file);
    await saveKitWithImage(
      "k",
      k,
      1,
      { paints: paints(), previous: k },
      file,
      false,
      "new",
    );
    expect(state.docs.get(path).imagePath).toBe(path + "/new");
    expect(state.images.has(path + "/old")).toBe(false);
  });
  it("DB保存の失敗時は新画像を削除し旧画像を維持する", async () => {
    const k = { ...kit(), imagePath: path + "/old" };
    state.docs.set(path, { ...k, revision: 2 });
    state.images.set(k.imagePath, file);
    await expect(
      saveKitWithImage(
        "k",
        k,
        1,
        { paints: paints(), previous: k },
        file,
        false,
        "new",
      ),
    ).rejects.toThrow("別端末");
    expect(state.images.has(path + "/new")).toBe(false);
    expect(state.images.has(path + "/old")).toBe(true);
  });
  it("サーバー照会不能時は保存済みかもしれない新画像を破壊しない", async () => {
    const k = kit();
    state.serverError = true;
    state.ambiguous = true;
    await expect(
      saveKitWithImage(
        "k",
        k,
        null,
        { paints: paints(), previous: null },
        file,
        false,
        "new",
      ),
    ).rejects.toThrow("unknown");
    expect(state.images.has(path + "/new")).toBe(true);
  });
  it("アップロード失敗時はDBを書き換えない", async () => {
    state.uploadError = true;
    await expect(
      saveKitWithImage(
        "k",
        kit(),
        null,
        { paints: paints() },
        file,
        false,
        "new",
      ),
    ).rejects.toThrow("upload");
    expect(state.docs.size).toBe(0);
  });
  it("旧画像削除の失敗を通知し、再試行で削除する", async () => {
    const k = { ...kit(), imagePath: path + "/old" };
    state.docs.set(path, { ...k, revision: 1, createdAt: { seconds: 1 } });
    state.images.set(k.imagePath, file);
    state.removeError = true;
    expect(
      await saveKitWithImage(
        "k",
        k,
        1,
        { paints: paints(), previous: k },
        file,
        false,
        "new",
      ),
    ).toContain("旧画像");
    expect(pendingCleanup()).toContain(k.imagePath);
    state.removeError = false;
    await retryCleanup();
    expect(pendingCleanup()).toEqual([]);
    expect(state.images.has(k.imagePath)).toBe(false);
  });
  it("画像削除失敗はdeletingを保持し、次回再試行で塗料台帳を残す", async () => {
    const k = { ...kit(), id: "k", revision: 1, imagePath: path + "/image" };
    state.docs.set(path, k);
    state.images.set(k.imagePath, file);
    state.docs.set("users/test-owner/paints/p", paint());
    state.removeError = true;
    await expect(deleteKit(k)).rejects.toThrow("delete failed");
    expect(state.docs.get(path).status).toBe("deleting");
    state.removeError = false;
    await deleteKit({ ...k, status: "deleting", revision: 2 });
    expect(state.docs.has(path)).toBe(false);
    expect(state.docs.has("users/test-owner/paints/p")).toBe(true);
    expect(state.images.size).toBe(0);
  });
});
describe("Google 認証", () => {
  it("本人のGoogle認証を許可する", async () => {
    await expect(login()).resolves.toBeUndefined();
  });
  it("本人以外のGoogle認証を拒否してログアウトする", async () => {
    state.authUser = { uid: "other" };
    await expect(login()).rejects.toThrow("このアカウント");
    expect(signOut).toHaveBeenCalled();
  });
});
