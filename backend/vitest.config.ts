/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/config/setup.ts"],
    include: [
      "src/**/*.{test,spec}.ts",
      "tests/unit/**/*.{test,spec}.ts",
      "tests/integration/**/*.{test,spec}.ts",
      "tests/e2e/**/*.{test,spec}.ts",
    ],
    exclude: ["tests/legacy/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
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
