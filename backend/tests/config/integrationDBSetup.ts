/**
 * Vitest Integration DB Setup
 * Establishes a MongoDB connection for integration tests only.
 */
import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";

const isIntegration = process.env.VITEST_SCOPE === "integration";

if (isIntegration) {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri =
        process.env.MONGODB_TEST_URI ||
        "mongodb://127.0.0.1:27017/atcloud-signup-test";
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        family: 4,
      } as any);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
}
