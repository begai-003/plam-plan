import { beforeEach, describe, it, expect, vi } from "vitest";
import { kit, paint, paints } from "./fixtures.js";
const state = vi.hoisted(() => ({
  docs: new Map(),
  writes: [],
  serverError: false,
  ambiguous: false,
  authUser: null,
}));
vi.mock("../src/services/firebase.js", () => ({
  db: {},
  auth: {},
  allowedUid: "test-owner",
}));
vi.mock("@firebase/firestore", () => ({
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
vi.mock("@firebase/auth", () => ({
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
import { deleteKit } from "../src/services/kitDeletion.js";
import { login } from "../src/services/authService.js";
import { signOut } from "@firebase/auth";
const path = "users/test-owner/kits/k";
beforeEach(() => {
  state.docs.clear();
  state.writes = [];
  state.serverError = false;
  state.ambiguous = false;
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
describe("キット削除・旧データ互換", () => {
  it("旧imagePathを除去して計画・revisionを維持する", async () => {
    const k = { ...kit(), imagePath: "users/test-owner/kits/k/old" };
    state.docs.set(path, { ...k, revision: 1 });
    await kitRepository.save("k", k, 1, { paints: paints(), previous: k });
    expect(state.docs.get(path)).not.toHaveProperty("imagePath");
    expect(state.docs.get(path).groups).toEqual(k.groups);
    expect(state.docs.get(path).revision).toBe(2);
  });
  it("旧画像付きのdeletingキットもFirestoreだけで削除し台帳を残す", async () => {
    state.docs.set(path, {
      ...kit(),
      revision: 2,
      status: "deleting",
      imagePath: "legacy",
    });
    state.docs.set("users/test-owner/paints/p", paint());
    await deleteKit({ id: "k", revision: 1 });
    expect(state.docs.has(path)).toBe(false);
    expect(state.docs.has("users/test-owner/paints/p")).toBe(true);
  });
  it("古いrevisionの削除は拒否する", async () => {
    state.docs.set(path, { ...kit(), revision: 2 });
    await expect(deleteKit({ id: "k", revision: 1 })).rejects.toThrow("別端末");
    expect(state.docs.get(path).status).toBe("active");
  });
  it("削除の中断後は再試行できる", async () => {
    state.docs.set(path, { ...kit(), revision: 1 });
    state.ambiguous = true;
    await expect(deleteKit({ id: "k", revision: 1 })).rejects.toThrow();
    expect(state.docs.get(path).status).toBe("deleting");
    state.ambiguous = false;
    await deleteKit({ id: "k", revision: 1 });
    expect(state.docs.has(path)).toBe(false);
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
