/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

const disableCoverageThresholds =
  process.env.VITEST_DISABLE_COVERAGE_THRESHOLDS === "true";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [
      "./tests/config/setup.ts",
      "./vitest.setup.ts", // optional eager hooks
      "./tests/config/integrationDBSetup.ts",
    ],
    include: [
      "src/**/*.{test,spec}.ts",
      "tests/unit/**/*.{test,spec}.ts",
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
      thresholds: disableCoverageThresholds
        ? undefined
        : {
            lines: 85,
            statements: 85,
            functions: 85,
            branches: 80,
          },
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "src/scripts/",
        "src/index.ts",
        "**/*.d.ts",
      ],
    },
    testTimeout: 30000,
    globalSetup: "./tests/config/globalSetup.ts",
    // Run tests sequentially to avoid database conflicts
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
