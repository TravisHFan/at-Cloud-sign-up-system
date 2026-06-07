/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    environment: "node",
    globals: true,
    setupFiles: [
      "./tests/config/setup.ts",
      "./vitest.setup.ts",
      "./tests/config/integrationDBSetup.ts",
    ],
    include: [
      "tests/integration/**/*.{test,spec}.ts",
      "tests/e2e/**/*.{test,spec}.ts",
      "tests/migration/**/*.{test,spec}.ts",
    ],
    exclude: [
      "tests/legacy/**/*",
      // Exclude any ad-hoc debug test files if accidentally added in the future
      "tests/**/debug-*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      thresholds: undefined,
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "src/scripts/",
        "scripts/",
        "src/index.ts",
        "src/types/api-responses.ts",
        "**/*.d.ts",
      ],
    },
    globalSetup: "./tests/config/globalSetup.ts",
    sequence: {
      hooks: "list",
    },
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
