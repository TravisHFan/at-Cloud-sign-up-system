import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check route
app.get("/", (req, res) => {
  res.json({ message: "Backend server is running!", timestamp: new Date() });
});

// MongoDB connection
const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${mongoose.connection.db?.databaseName}`);
    console.log(`🔗 MongoDB version: ${mongoose.version}`);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Test importing individual models one by one
const testModels = async () => {
  try {
    console.log("🧪 Testing model imports...");

    // Test User model
    console.log("Testing User model...");
    const User = (await import("./models/User")).default;
    console.log("✅ User model imported successfully");

    // Test Event model
    console.log("Testing Event model...");
    const Event = (await import("./models/Event")).default;
    console.log("✅ Event model imported successfully");

    // Test Registration model
    console.log("Testing Registration model...");
    const Registration = (await import("./models/Registration")).default;
    console.log("✅ Registration model imported successfully");

    console.log("✅ All models imported successfully");
  } catch (error) {
    console.error("❌ Model import failed:", error);
    throw error;
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    await testModels();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
