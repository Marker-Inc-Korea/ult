import { defineConfig } from "@playwright/test";

const visualPort = process.env.ULT_VISUAL_PORT ?? "5173";
const visualBaseUrl = `http://127.0.0.1:${visualPort}`;

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
    baseURL: visualBaseUrl,
    browserName: "webkit",
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: {
      width: 1440,
      height: 1000,
    },
  },
  webServer: {
    command: `bunx --bun vite --host 127.0.0.1 --port ${visualPort} --strictPort`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `${visualBaseUrl}/tests/visual/harness.html`,
  },
});
