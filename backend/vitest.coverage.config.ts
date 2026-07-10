/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  backendCoverage,
  backendSetupFiles,
  sharedBackendTestConfig,
} from "./vitest.base.config";
import { coverageThresholds } from "../config/coverage-thresholds";

/**
 * Coverage is measured across the complete DB-free protection tier. Running
 * unit and HTTP-contract coverage separately under-counts routes and produces
 * misleading global percentages because each process sees only half the tier.
 */
export default defineConfig({
  test: {
    ...sharedBackendTestConfig,
    name: "fast-coverage",
    testTimeout: 15000,
    setupFiles: backendSetupFiles,
    include: [
      "src/**/*.{test,spec}.ts",
      "tests/unit/**/*.{test,spec}.ts",
      "tests/http-contract/**/*.{test,spec}.ts",
    ],
    exclude: [
      "tests/legacy/**/*",
      "tests/integration/**/*",
      "tests/e2e/**/*",
      "tests/migration/**/*",
      "tests/**/debug-*.test.ts",
    ],
    coverage: backendCoverage("coverage/fast", {
      ...coverageThresholds.backend,
    }),
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
