import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

console.log("Starting minimal test...");

const testConnection = async () => {
  try {
    console.log("Testing MongoDB connection...");

    const mongoUri = process.env.MONGODB_URI;
    console.log("MongoDB URI:", mongoUri);

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    console.log("Attempting to connect...");
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${mongoose.connection.db?.databaseName}`);

    // Close connection
    await mongoose.connection.close();
    console.log("Connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed:", error);
    process.exit(1);
  }
};

testConnection();
