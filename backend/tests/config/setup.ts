import { beforeEach, afterAll, beforeAll } from "vitest";
import mongoose from "mongoose";

beforeAll(async () => {
  // Ensure we connect to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env.MONGODB_URI_TEST ||
        "mongodb://localhost:27017/atcloud-signup-test"
    );
  }
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  try {
    // Drop the entire test database to ensure clean state
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log("Test database cleaned up successfully");
    }

    // Close connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (error) {
    console.error("Error during test cleanup:", error);
  }
});
