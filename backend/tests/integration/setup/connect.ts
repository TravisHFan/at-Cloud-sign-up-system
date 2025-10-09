import mongoose from "mongoose";

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Ensure a single shared MongoDB connection for integration tests.
 * Safe to call multiple times; subsequent calls reuse the in-flight or established connection.
 *
 * IMPORTANT: Use this function instead of mongoose.connect() directly in test files
 * to prevent connection pool exhaustion.
 */
export async function ensureIntegrationDB() {
  // Reuse existing connection more aggressively (1 = connected, 2 = connecting)
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return;
  }

  if (connecting) {
    await connecting;
    return;
  }

  const uri =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/atcloud-signup-test";

  connecting = mongoose.connect(uri, {
    maxPoolSize: 50, // Increased from default 10 to handle test suite load
    minPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    autoIndex: true, // Enable auto-indexing for tests that need it
  } as any);

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function closeIntegrationDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}
