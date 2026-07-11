/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  backendCoverage,
  backendSetupFiles,
  sharedBackendTestConfig,
} from "./vitest.base.config";
import { coverageThresholds } from "../config/coverage-thresholds";

const disableCoverageThresholds =
  process.env.VITEST_DISABLE_COVERAGE_THRESHOLDS === "true";

export default defineConfig({
  test: {
    ...sharedBackendTestConfig,
    testTimeout: 10000,
    setupFiles: backendSetupFiles,
    include: ["src/**/*.{test,spec}.ts", "tests/unit/**/*.{test,spec}.ts"],
    exclude: [
      "tests/legacy/**/*",
      "tests/integration/**/*",
      "tests/http-contract/**/*",
      "tests/e2e/**/*",
      "tests/migration/**/*",
      // Exclude any ad-hoc debug test files if accidentally added in the future
      "tests/**/debug-*.test.ts",
    ],
    coverage: backendCoverage(
      "coverage/unit",
      disableCoverageThresholds
        ? undefined
        : { ...coverageThresholds.backend },
    ),
    fileParallelism: true,
    maxWorkers: 2,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
