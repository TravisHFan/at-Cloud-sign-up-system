import mongoose from "mongoose";

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Ensure a single shared MongoDB connection for integration tests.
 * Safe to call multiple times; subsequent calls reuse the in-flight or established connection.
 */
export async function ensureIntegrationDB() {
  if (mongoose.connection.readyState === 1) return; // already connected
  if (connecting) {
    await connecting;
    return;
  }
  const uri =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/atcloud-signup-test";
  connecting = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    family: 4,
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
