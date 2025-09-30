import mongoose from "mongoose";

/**
 * Ensures the integration test is running with an active mongoose connection.
 * If not, throws a clear error instructing how to run the test with the proper env.
 */
export function assertDbReady() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection not established for integration test. Did you run with VITEST_SCOPE=integration or use the npm script test:integration / test:integration:one?"
    );
  }
}
