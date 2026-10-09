import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  listAll,
} from "firebase/storage";
import { newKit, newPaint } from "../src/domain.js";
let env;
const owner = "test-owner";
const kitData = () => ({
  ...newKit(),
  name: "テストキット",
  revision: 1,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const paintData = () => ({
  ...newPaint(),
  name: "白",
  manufacturer: "メーカー",
  color: "白",
  revision: 1,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const db = (uid = owner) => env.authenticatedContext(uid).firestore();
const kitRef = (database, id = "kit") =>
  doc(database, "users", owner, "kits", id);
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-plam-plan",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8").replaceAll(
        "__ALLOWED_UID__",
        owner,
      ),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8").replaceAll(
        "__ALLOWED_UID__",
        owner,
      ),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});
afterAll(async () => {
  await env?.cleanup();
});
describe("Firestore Security Rules", () => {
  it("本人のみ作成・取得・一覧・更新・削除できる", async () => {
    const d = db();
    const r = kitRef(d);
    await assertSucceeds(setDoc(r, kitData()));
    await assertSucceeds(getDoc(r));
    await assertSucceeds(getDocs(collection(d, "users", owner, "kits")));
    await assertSucceeds(
      updateDoc(r, { name: "変更", revision: 2, updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(r));
    await assertSucceeds(
      updateDoc(r, {
        status: "deleting",
        revision: 3,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(r, {
        name: "再編集",
        revision: 4,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(r));
  });
  for (const uid of [null, "other"])
    it(`${uid || "未認証"}は本人データの全操作が拒否される`, async () => {
      await setDoc(kitRef(db()), kitData());
      const d = uid ? db(uid) : env.unauthenticatedContext().firestore();
      const r = kitRef(d);
      await assertFails(getDoc(r));
      await assertFails(getDocs(collection(d, "users", owner, "kits")));
      await assertFails(setDoc(kitRef(d, "new"), kitData()));
      await assertFails(
        updateDoc(r, {
          name: "変更",
          revision: 2,
          updatedAt: serverTimestamp(),
        }),
      );
      await assertFails(deleteDoc(r));
    });
  it("パスUIDを他人のUIDにしても拒否する", async () => {
    await assertFails(
      setDoc(doc(db("other"), "users", "other", "kits", "kit"), kitData()),
    );
    await assertFails(
      setDoc(doc(db(), "users", "other", "kits", "kit"), kitData()),
    );
  });
  it("余分なフィールド・不正な型・createdAt変更・revision飛ばしを拒否する", async () => {
    const d = db();
    await assertFails(setDoc(kitRef(d), { ...kitData(), admin: true }));
    await assertFails(setDoc(kitRef(d), { ...kitData(), runners: "bad" }));
    await setDoc(kitRef(d), kitData());
    await assertFails(
      updateDoc(kitRef(d), { revision: 5, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(kitRef(d), {
        createdAt: serverTimestamp(),
        revision: 2,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("画像は自分のキットのパスのみ許可する", async () => {
    await assertFails(
      setDoc(kitRef(db()), {
        ...kitData(),
        imagePath: "https://example.com/public.png",
      }),
    );
    await assertFails(
      setDoc(kitRef(db()), {
        ...kitData(),
        imagePath: `users/${owner}/kits/other/image`,
      }),
    );
  });
  it("塗料の論理削除・復元を許可し物理削除は拒否する", async () => {
    const r = doc(db(), "users", owner, "paints", "paint");
    await assertSucceeds(setDoc(r, paintData()));
    await assertSucceeds(
      updateDoc(r, {
        archived: true,
        revision: 2,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(r, {
        archived: false,
        revision: 3,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(r));
  });
  it("塗料の不正な本数・商品番号・旧式残量を拒否する", async () => {
    const r = doc(db(), "users", owner, "paints", "paint");
    for (const fields of [
      { dilutedBottleCount: -1 },
      { dilutedBottleCount: 1.5 },
      { productNumber: "001" },
      { remainingPercent: 80 },
    ])
      await assertFails(setDoc(r, { ...paintData(), ...fields }));
  });
});
describe("Storage Security Rules", () => {
  const image = (storage) => ref(storage, `users/${owner}/kits/kit/image`);
  it("本人は画像のアップロード・取得・一覧・削除ができる", async () => {
    const storage = env.authenticatedContext(owner).storage();
    await assertSucceeds(
      uploadBytes(image(storage), new Uint8Array([1, 2, 3]), {
        contentType: "image/png",
      }),
    );
    expect((await assertSucceeds(getBytes(image(storage)))).byteLength).toBe(3);
    await assertSucceeds(listAll(ref(storage, `users/${owner}/kits/kit`)));
    await assertSucceeds(deleteObject(image(storage)));
  });
  for (const uid of [null, "other"])
    it(`${uid || "未認証"}の画像全操作を拒否する`, async () => {
      const storage = uid
        ? env.authenticatedContext(uid).storage()
        : env.unauthenticatedContext().storage();
      await assertFails(
        uploadBytes(image(storage), new Uint8Array([1]), {
          contentType: "image/png",
        }),
      );
      await assertFails(getBytes(image(storage)));
      await assertFails(listAll(ref(storage, `users/${owner}/kits/kit`)));
      await assertFails(deleteObject(image(storage)));
    });
  it("不正な形式・サイズと他人のパスを拒否する", async () => {
    const storage = env.authenticatedContext(owner).storage();
    await assertFails(
      uploadBytes(image(storage), new Uint8Array([1]), {
        contentType: "image/svg+xml",
      }),
    );
    await assertFails(
      uploadBytes(image(storage), new Uint8Array(5 * 1024 * 1024 + 1), {
        contentType: "image/png",
      }),
    );
    await assertFails(
      uploadBytes(
        ref(storage, "users/other/kits/kit/image"),
        new Uint8Array([1]),
        { contentType: "image/png" },
      ),
    );
  });
});
