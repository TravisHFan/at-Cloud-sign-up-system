import { beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  // Clean up after all tests
  await mongoose.connection.close();
});
