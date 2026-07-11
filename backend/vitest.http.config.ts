/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  backendCoverage,
  backendSetupFiles,
  sharedBackendTestConfig,
} from "./vitest.base.config";

export default defineConfig({
  test: {
    ...sharedBackendTestConfig,
    name: "http-contract",
    testTimeout: 15000,
    setupFiles: backendSetupFiles,
    include: ["tests/http-contract/**/*.{test,spec}.ts"],
    coverage: backendCoverage("coverage/http-contract"),
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
