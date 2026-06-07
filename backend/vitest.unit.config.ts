/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

const disableCoverageThresholds =
  process.env.VITEST_DISABLE_COVERAGE_THRESHOLDS === "true";

export default defineConfig({
  test: {
    testTimeout: 10000,
    environment: "node",
    globals: true,
    setupFiles: ["./tests/config/setup.ts", "./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.ts", "tests/unit/**/*.{test,spec}.ts"],
    exclude: [
      "tests/legacy/**/*",
      "tests/integration/**/*",
      "tests/e2e/**/*",
      "tests/migration/**/*",
      // Exclude any ad-hoc debug test files if accidentally added in the future
      "tests/**/debug-*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      thresholds: disableCoverageThresholds
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
    // Keep the conservative isolation settings until mock-polluted unit files
    // are modernized in smaller follow-up passes.
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
