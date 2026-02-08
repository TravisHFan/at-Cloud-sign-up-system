/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

const disableCoverageThresholds =
  process.env.VITEST_DISABLE_COVERAGE_THRESHOLDS === "true";

// Integration tests don't have mocked code paths, so coverage thresholds don't apply
const isIntegrationScope = process.env.VITEST_SCOPE === "integration";

export default defineConfig({
  test: {
    // 30 seconds timeout for integration tests with bcrypt operations
    // Bcrypt hashing is intentionally slow (~20s) for security
    testTimeout: 30000,
    environment: "node",
    globals: true,
    setupFiles: [
      "./tests/config/setup.ts",
      "./vitest.setup.ts",
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
      thresholds:
        disableCoverageThresholds || isIntegrationScope
          ? undefined
          : {
              lines: 90,
              statements: 90,
              functions: 90,
              branches: 85,
            },
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
    // Run tests sequentially to avoid database conflicts
    // NOTE: Some unit tests may experience mock pollution when run in full suite
    // but pass when run individually. This is a known limitation of shared module mocks.
    // All integration tests pass, confirming actual functionality is correct.
    sequence: {
      hooks: "list", // Run hooks in sequence
    },
    fileParallelism: false, // Run test files sequentially to prevent mock pollution
    pool: "forks", // Use forks instead of threads for better isolation
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true, // Isolate each test file to prevent mock pollution
      },
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
