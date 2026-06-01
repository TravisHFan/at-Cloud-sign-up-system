/**
 * Vitest Setup File
 * Configures global testing environment for trio system tests
 */

import { beforeEach, afterEach, afterAll, vi } from "vitest";

// Global test setup
beforeEach(() => {
  // Always start each test with real timers to avoid leaks from other files
  vi.useRealTimers();
  // Reset all mocks before each test
  vi.clearAllMocks();
});

// Safety net: ensure timers are real after each test/file
afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

// Setup global test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-tokens";
process.env.MONGODB_TEST_URI =
  process.env.MONGODB_TEST_URI ||
  "mongodb://localhost:27017/atcloud-signup-test";
process.env.EMAIL_SERVICE_ENABLED = "false"; // Disable real emails in tests
process.env.FRONTEND_URL = "http://localhost:5173";

// Keep backend test output focused by default.
// Set VITEST_VERBOSE_LOGS=true to inspect console.log/info/debug locally.
const quiet =
  process.env.VITEST_VERBOSE_LOGS !== "true" &&
  process.env.VITEST_SILENT !== "false";
if (quiet) {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop as any;
  // eslint-disable-next-line no-console
  console.info = noop as any;
  // eslint-disable-next-line no-console
  console.debug = noop as any;
}
