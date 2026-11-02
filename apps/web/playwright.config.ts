import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run flows deterministically
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["github"]] : [["list"], ["html"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.CLIENT_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../api run dev",
      port: 4000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        DATABASE_URL:
          process.env.DATABASE_URL_TEST ||
          "postgresql://postgres:postgres@localhost:5432/nexusops_ai_test?schema=public",
        DATABASE_URL_TEST:
          process.env.DATABASE_URL_TEST ||
          "postgresql://postgres:postgres@localhost:5432/nexusops_ai_test?schema=public",
        LLM_PROVIDER: "mock",
        EMBEDDINGS_PROVIDER: "mock",
      },
    },
    {
      command: "npm run dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
