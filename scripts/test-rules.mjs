import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const emulatorCache =
  process.env.FIREBASE_EMULATORS_PATH || resolve(".runtime/emulator-cache");
const configCache =
  process.env.XDG_CONFIG_HOME || resolve(".runtime/firebase-config");
mkdirSync(emulatorCache, { recursive: true });
const result = spawnSync(
  "node_modules/.bin/firebase",
  [
    "emulators:exec",
    "--project",
    "demo-plam-plan",
    "--only",
    "firestore",
    "node_modules/.bin/vitest run --config vitest.rules.config.js",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FIREBASE_EMULATORS_PATH: emulatorCache,
      XDG_CONFIG_HOME: configCache,
      CI: "true",
    },
  },
);
process.exit(result.status ?? 1);
