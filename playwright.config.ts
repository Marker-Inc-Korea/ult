import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "webkit",
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: {
      width: 1440,
      height: 1000,
    },
  },
  webServer: {
    command: "bun run dev",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:5173/tests/visual/harness.html",
  },
});
