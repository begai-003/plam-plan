import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 7000 },
  use: {
    baseURL: "http://127.0.0.1:4173/plam-plan/",
    headless: true,
    actionTimeout: 12000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node_modules/.bin/vite --host 127.0.0.1 --port 4173`,
    url: "http://127.0.0.1:4173/plam-plan/",
    reuseExistingServer: false,
  },
  reporter: "list",
});
