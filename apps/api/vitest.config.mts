import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false, // Run API test files sequentially to avoid interference
    cache: false,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/testSetup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/modules/**/*.service.ts", "src/lib/**"],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/logger.ts",
        "**/*.d.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
      ],
      thresholds: {
        lines: 70,
      },
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
