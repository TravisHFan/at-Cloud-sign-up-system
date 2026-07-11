/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  backendSetupFiles,
  sharedBackendTestConfig,
} from "./vitest.base.config";

process.env.VITEST_RUN_ID ??= `${process.pid}-${Date.now()}`;

export default defineConfig({
  test: {
    ...sharedBackendTestConfig,
    name: "perf",
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: [
      ...backendSetupFiles,
      "./tests/config/integrationDBSetup.ts",
    ],
    include: ["tests/integration/perf/**/*.{test,spec}.ts"],
    globalSetup: "./tests/config/globalSetup.ts",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
