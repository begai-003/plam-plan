import { readFile, mkdir, writeFile } from "node:fs/promises";
const uid = process.env.FIREBASE_ALLOWED_UID;
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid))
  throw new Error(
    "FIREBASE_ALLOWED_UID に本人のFirebase UID（英数字・_・-）を指定してください",
  );
await mkdir(".runtime", { recursive: true });
for (const file of ["firestore.rules", "storage.rules"])
  await writeFile(
    `.runtime/${file}`,
    (await readFile(file, "utf8")).replaceAll("__ALLOWED_UID__", uid),
  );
const config = JSON.parse(await readFile("firebase.json", "utf8"));
config.firestore.rules = ".runtime/firestore.rules";
config.firestore.indexes = "firestore.indexes.json";
config.storage.rules = ".runtime/storage.rules";
await writeFile(
  "firebase.runtime.json",
  JSON.stringify(config, null, 2) + "\n",
);
console.log(
  "本人UIDを設定したRulesを生成しました。firebase deploy --config firebase.runtime.json --project <project-id> --only firestore:rules,firestore:indexes,storage を使用してください。",
);
