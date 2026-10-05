import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the real API and web app, on their own ports, against a freshly seeded
 * throwaway database (apps/api/e2e.db). Your dev servers and dev.db are never touched.
 */
const API_PORT = 4100;
const WEB_PORT = 5174;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Tests share one seeded database, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "dark",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1500, height: 900 } }, dependencies: ["setup"] },
  ],
  webServer: [
    {
      command: "npm run db:reset:e2e -w @tp/api && npm start -w @tp/api",
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: "file:./e2e.db",
        WEB_ORIGIN: WEB_URL,
        NODE_ENV: "test",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
    },
    {
      command: "npm run dev -w @tp/web",
      url: WEB_URL,
      env: { WEB_PORT: String(WEB_PORT), API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
