/**
 * Vitest Global Setup
 * Handles global test environment initialization and cleanup
 */

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
  // Global cleanup if needed
  console.log("✅ Test environment cleaned up");
}
