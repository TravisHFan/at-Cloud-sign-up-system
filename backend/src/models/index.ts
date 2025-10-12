// Re-export all models for easy importing
export { default as User, IUser } from "./User";
export {
  default as Event,
  IEvent,
  IEventRole,
  IOrganizerDetail,
} from "./Event";
export {
  default as Registration,
  IRegistration,
  IEventRegistrationStats,
} from "./Registration";
export { default as Message, IMessage, IMessageModel } from "./Message"; // Unified Message System
export {
  default as GuestRegistration,
  IGuestRegistration,
  IGuestRegistrationModel,
} from "./GuestRegistration";
export { default as Program, IProgram } from "./Program";
export { default as ShortLink, IShortLink, IShortLinkModel } from "./ShortLink";

// Database connection helper
import mongoose from "mongoose";

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    await mongoose.connect(mongoUri, options);

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {});

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const state = mongoose.connection.readyState;
    return state === 1; // 1 = connected
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
};

// Get database statistics
export const getDatabaseStats = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const stats = await db.stats();
    const collections = await db.listCollections().toArray();

    return {
      databaseName: db.databaseName,
      collections: collections.length,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      connected: mongoose.connection.readyState === 1,
    };
  } catch (error) {
    console.error("Failed to get database statistics:", error);
    throw error;
  }
};
