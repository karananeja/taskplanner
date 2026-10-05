import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      WEB_ORIGIN: "http://localhost:3000",
      // Tests never talk to Google, whatever apps/api/.env says.
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
    globalSetup: ["./test/global-setup.ts"],
    // Integration tests share one SQLite file; run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/index.ts"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: { lines: 85, branches: 75, functions: 85 },
    },
  },
});
