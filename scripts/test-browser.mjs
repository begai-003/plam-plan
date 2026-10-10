import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
// Isolated fixtures must never overwrite Rules prepared for a real project.
const directory = ".runtime/browser";
mkdirSync(directory, { recursive: true });
const config = JSON.parse(readFileSync("firebase.json", "utf8"));
for (const name of ["firestore"]) {
  writeFileSync(
    `${directory}/${name}.rules`,
    readFileSync(`${name}.rules`, "utf8").replaceAll(
      "__ALLOWED_UID__",
      "test-owner",
    ),
  );
  config[name].rules = `${name}.rules`;
}
config.firestore.indexes = "../../firestore.indexes.json";
const configPath = `${directory}/firebase.test.json`;
writeFileSync(configPath, JSON.stringify(config, null, 2));
const env = {
  ...process.env,
  FIREBASE_EMULATORS_PATH:
    process.env.FIREBASE_EMULATORS_PATH || resolve(".runtime/emulator-cache"),
  XDG_CONFIG_HOME:
    process.env.XDG_CONFIG_HOME || resolve(".runtime/firebase-config"),
  CI: "true",
  VITE_FIREBASE_API_KEY: "demo-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-plam-plan.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "demo-plam-plan",
  VITE_FIREBASE_APP_ID: "demo-app-id",
  VITE_ALLOWED_UID: "test-owner",
  VITE_USE_EMULATORS: "true",
};
const result = spawnSync(
  "node_modules/.bin/firebase",
  [
    "emulators:exec",
    "--config",
    configPath,
    "--project",
    "demo-plam-plan",
    "--only",
    "auth,firestore",
    "node_modules/.bin/playwright test",
  ],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
