import type { CoverageV8Options, InlineConfig } from "vitest";

export const backendSetupFiles = [
  "./tests/config/setup.ts",
  "./vitest.setup.ts",
];

export const sharedBackendTestConfig: Pick<
  InlineConfig,
  | "environment"
  | "globals"
  | "sequence"
  | "pool"
  | "poolOptions"
  | "silent"
> = {
  environment: "node",
  globals: true,
  // Error-path contracts intentionally exercise production logging. Keep the
  // normal signal compact; thrown errors and assertion failures still surface.
  // Set VITEST_VERBOSE_LOGS=true when investigating the captured diagnostics.
  silent: process.env.VITEST_VERBOSE_LOGS !== "true",
  sequence: { hooks: "list" },
  pool: "forks",
  poolOptions: {
    forks: {
      isolate: true,
    },
  },
};

export const backendCoverageExclude = [
  "node_modules/",
  "dist/",
  "tests/",
  "src/scripts/",
  "scripts/",
  "src/index.ts",
  "src/types/api-responses.ts",
  "**/*.d.ts",
];

export function backendCoverage(
  reportsDirectory: string,
  thresholds?: CoverageV8Options["thresholds"],
): CoverageV8Options {
  return {
    provider: "v8",
    include: ["src/**/*.ts"],
    reporter: ["text", "lcov", "html", "json-summary"],
    reportsDirectory,
    thresholds,
    exclude: backendCoverageExclude,
  };
}
