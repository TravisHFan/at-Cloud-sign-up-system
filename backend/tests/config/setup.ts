/**
 * Vitest Setup File
 * Configures global testing environment for trio system tests
 */

import { beforeEach, vi } from "vitest";

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

// Setup global test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-tokens";
process.env.MONGODB_TEST_URI = "mongodb://localhost:27017/atcloud-test";
process.env.EMAIL_SERVICE_ENABLED = "false"; // Disable real emails in tests
process.env.FRONTEND_URL = "http://localhost:5173";
