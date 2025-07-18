import mongoose from "mongoose";

export default async function globalTeardown() {
  try {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI_TEST ||
          "mongodb://localhost:27017/atcloud-signup-test"
      );
    }

    // Drop the entire test database to ensure clean state
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log("Test database cleaned up successfully");
    }

    // Close connection
    await mongoose.connection.close();
  } catch (error) {
    console.error("Error during test cleanup:", error);
  }
}
