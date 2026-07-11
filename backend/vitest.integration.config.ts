/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  backendCoverage,
  backendSetupFiles,
  sharedBackendTestConfig,
} from "./vitest.base.config";

process.env.VITEST_RUN_ID ??= `${process.pid}-${Date.now()}`;

export default defineConfig({
  test: {
    ...sharedBackendTestConfig,
    name: "db-integration",
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: [
      ...backendSetupFiles,
      "./tests/config/integrationDBSetup.ts",
    ],
    include: [
      "tests/integration/**/*.{test,spec}.ts",
      "tests/migration/**/*.{test,spec}.ts",
    ],
    exclude: [
      "tests/legacy/**/*",
      "tests/integration/perf/**/*",
      // Exclude any ad-hoc debug test files if accidentally added in the future
      "tests/**/debug-*.test.ts",
    ],
    coverage: backendCoverage("coverage/db-integration"),
    globalSetup: "./tests/config/globalSetup.ts",
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
