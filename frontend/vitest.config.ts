import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use threads pool but force singleThread to minimize memory in Node 22
    pool: "threads",
    maxWorkers: 1,
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: true,
      },
    },
    // Avoid stuck watch polling; we primarily use non-watch in root runs
    watch: false,
    // Be explicit about environment; many tests rely on jsdom
    environment: "jsdom",
    // Some tests can be a bit slow with fewer workers; raise timeout slightly
    testTimeout: 20000,
    hookTimeout: 20000,
    // De-duplicate diagnostics for noisy console.error traces
    silent: false,
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
