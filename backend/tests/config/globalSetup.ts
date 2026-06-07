/**
 * Vitest Global Setup
 * Handles global test environment initialization and cleanup
 */

import mongoose from "mongoose";

const verboseLogs = process.env.VITEST_VERBOSE_LOGS === "true";
const log = (...args: unknown[]) => {
  if (verboseLogs) console.log(...args);
};

export async function setup() {
  log("Setting up test environment...");

  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key-for-jwt-tokens";
  process.env.EMAIL_SERVICE_ENABLED = "false";

  log("Test environment ready");
}

export async function teardown() {
  log("Cleaning up test environment...");

  try {
    const shouldRunDatabaseCleanup =
      process.env.VITEST_SCOPE === "integration" ||
      process.env.TEST_DB_CLEANUP === "1" ||
      mongoose.connection.readyState !== 0;

    if (!shouldRunDatabaseCleanup) {
      log("Skipping database cleanup for non-DB test run");
      return;
    }

    // Connect to test database for cleanup
    const uri =
      process.env.MONGODB_TEST_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/atcloud-signup-test";

    // Safety check: only cleanup test databases
    if (!uri.includes("test")) {
      console.warn(
        "⚠️  Skipping cleanup: Database URI does not contain 'test'",
      );
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      log("Connected to test database for cleanup");
    }

    // Import and run safe cleanup (preserves real users)
    const { safeCleanupAllTestData } =
      await import("../integration/setup/cleanup");
    await safeCleanupAllTestData();

    await mongoose.disconnect();
    log("Test environment cleaned up (real users preserved)");
  } catch (error) {
    // Don't fail the test run if cleanup fails
    console.error("⚠️  Cleanup error (non-fatal):", error);
  }
}
