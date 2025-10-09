/**
 * Optimized Database Cleanup Utility
 *
 * This module provides efficient database cleanup methods that reduce
 * MongoDB stress during integration tests by:
 * 1. Batching operations to reduce round trips
 * 2. Using ordered operations to prevent race conditions
 * 3. Adding small delays between major operations
 * 4. Cleaning up in optimal order (dependent documents first)
 */

import mongoose from "mongoose";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import Message from "../../../src/models/Message";
import ShortLink from "../../../src/models/ShortLink";
import Program from "../../../src/models/Program";

/**
 * Comprehensive database cleanup with optimized order
 * Cleans up all test data in an order that respects foreign key relationships
 * and reduces MongoDB load.
 */
export async function cleanupAllTestData() {
  try {
    // Clean dependent documents first (those with foreign keys)
    // This prevents orphaned document issues and cascade cleanup problems

    // 1. Clean up registrations (depend on Users and Events)
    await Promise.all([
      Registration.deleteMany({}),
      GuestRegistration.deleteMany({}),
    ]);

    // Small delay to let MongoDB catch up
    await sleep(50);

    // 2. Clean up event-related documents
    await Promise.all([ShortLink.deleteMany({}), Message.deleteMany({})]);

    await sleep(50);

    // 3. Clean up main documents (Events and Programs)
    await Promise.all([Event.deleteMany({}), Program.deleteMany({})]);

    await sleep(50);

    // 4. Clean up users last (many other documents reference users)
    await User.deleteMany({});

    await sleep(50);
  } catch (error) {
    console.error("Error during database cleanup:", error);
    throw error;
  }
}

/**
 * Clean only specific collections
 * Use this for targeted cleanup to reduce MongoDB load
 */
export async function cleanupCollections(...models: any[]) {
  try {
    await Promise.all(models.map((model) => model.deleteMany({})));
    await sleep(30);
  } catch (error) {
    console.error("Error cleaning collections:", error);
    throw error;
  }
}

/**
 * Drop and recreate the test database
 * WARNING: Use sparingly - this is very heavy on MongoDB
 * Only use in setup/teardown, not between tests
 */
export async function dropTestDatabase() {
  try {
    const dbName = mongoose.connection.db?.databaseName;
    if (!dbName || !dbName.includes("test")) {
      throw new Error("Safety check: Can only drop test databases");
    }

    console.log(`[MongoDB] Dropping test database: ${dbName}`);
    await mongoose.connection.dropDatabase();
    console.log(`[MongoDB] Database dropped successfully`);

    // Wait for MongoDB to process the drop
    await sleep(100);
  } catch (error) {
    console.error("Error dropping database:", error);
    throw error;
  }
}

/**
 * Helper to add small delays between operations
 * This gives MongoDB time to process writes and reduces crash risk
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check MongoDB connection health
 * Use this before running tests to ensure MongoDB is responsive
 */
export async function checkMongoDBHealth(): Promise<boolean> {
  try {
    const adminDb = mongoose.connection.db?.admin();
    if (!adminDb) return false;

    const result = await adminDb.ping();
    return result.ok === 1;
  } catch (error) {
    console.error("[MongoDB Health Check] Failed:", error);
    return false;
  }
}

/**
 * Get connection pool statistics
 * Useful for debugging connection issues
 */
export async function getConnectionStats() {
  try {
    const stats = await mongoose.connection.db?.admin().serverStatus();
    return {
      connections: stats?.connections,
      network: stats?.network,
      mem: stats?.mem,
    };
  } catch (error) {
    console.error("[MongoDB Stats] Failed to get stats:", error);
    return null;
  }
}
