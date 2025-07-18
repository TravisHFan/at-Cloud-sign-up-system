/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
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
    globalSetup: "./tests/globalSetup.ts",
    globalTeardown: "./tests/globalTeardown.ts",
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
