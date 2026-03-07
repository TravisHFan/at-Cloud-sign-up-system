/**
 * Vitest Global Setup
 * Handles global test environment initialization and cleanup
 */

import mongoose from "mongoose";

export async function setup() {
  console.log("🔧 Setting up test environment...");

  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key-for-jwt-tokens";
  process.env.EMAIL_SERVICE_ENABLED = "false";

  console.log("✅ Test environment ready");
}

export async function teardown() {
  console.log("🧹 Cleaning up test environment...");

  try {
    // Connect to test database for cleanup
    const uri =
      process.env.MONGODB_TEST_URI ||
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/atcloud-signup-test";

    // Safety check: only cleanup test databases
    if (!uri.includes("test")) {
      console.warn(
        "⚠️  Skipping cleanup: Database URI does not contain 'test'",
      );
      return;
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`📦 Connected to test database for cleanup`);

    // Import and run safe cleanup (preserves real users)
    const { safeCleanupAllTestData } =
      await import("../integration/setup/cleanup");
    await safeCleanupAllTestData();

    await mongoose.disconnect();
    console.log("✅ Test environment cleaned up (real users preserved)");
  } catch (error) {
    // Don't fail the test run if cleanup fails
    console.error("⚠️  Cleanup error (non-fatal):", error);
  }
}
