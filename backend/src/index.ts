import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { setupSwagger } from "./config/swagger";
import { socketService } from "./services/infrastructure/SocketService";
import EventReminderScheduler from "./services/EventReminderScheduler";
import MaintenanceScheduler from "./services/MaintenanceScheduler";
import app from "./app";
import { lockService } from "./services";

// Load environment variables
dotenv.config();

// Ensure upload directories exist
const ensureUploadDirectories = () => {
  let baseUploadPath: string;
  if (process.env.UPLOAD_DESTINATION) {
    baseUploadPath = process.env.UPLOAD_DESTINATION.replace(/\/$/, "");
  } else {
    baseUploadPath =
      process.env.NODE_ENV === "production" ? "/uploads" : "uploads";
  }
  const uploadDirs = [baseUploadPath, path.join(baseUploadPath, "avatars")];
  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created upload directory: ${dir}`);
    } else {
      console.log(`✅ Upload directory exists: ${dir}`);
    }
  });
};

const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;

// Guard: In-memory lock requires single backend instance. Warn or fail fast based on env.
const enforceSingleInstanceIfNecessary = () => {
  const impl = (lockService as any)?.constructor?.name || "Unknown";
  const usingInMemory = impl === "InMemoryLockService";
  if (!usingInMemory) return; // Only applies to in-memory lock

  const webConcurrency = parseInt(process.env.WEB_CONCURRENCY || "1", 10);
  const pm2Cluster = process.env.PM2_CLUSTER_MODE === "true";
  const nodeAppInstance = process.env.NODE_APP_INSTANCE;
  const inferredConcurrency = Math.max(
    1,
    isNaN(webConcurrency) ? 1 : webConcurrency,
    pm2Cluster ? 2 : 1,
    nodeAppInstance ? 2 : 1
  );

  const enforce = process.env.SINGLE_INSTANCE_ENFORCE === "true";

  if (inferredConcurrency > 1) {
    const msg =
      "InMemoryLockService requires a single backend instance. Detected concurrent workers/processes via env.";
    if (enforce) {
      console.error(`❌ ${msg} Set WEB_CONCURRENCY=1 and disable cluster/PM2.`);
      process.exit(1);
    } else {
      console.warn(
        `⚠️ ${msg} Set SINGLE_INSTANCE_ENFORCE=true to fail-fast in production.`
      );
    }
  }

  console.log(
    `🔒 Lock implementation: ${impl} | SINGLE_INSTANCE_ENFORCE=${
      process.env.SINGLE_INSTANCE_ENFORCE || "false"
    }`
  );
};
// Database connection
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB successfully");

    // Try to get MongoDB version
    try {
      const db = mongoose.connection.db;
      if (db) {
        const admin = db.admin();
        const dbInfo = await admin.serverStatus();
        console.log(`📊 MongoDB version: ${dbInfo.version}`);
      }
    } catch (dbInfoError) {
      console.warn("⚠️ Could not fetch MongoDB info:", dbInfoError);
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    // Stop event reminder scheduler
    const scheduler = EventReminderScheduler.getInstance();
    scheduler.stop();

    // Stop maintenance scheduler
    const maintenance = MaintenanceScheduler.getInstance();
    maintenance.stop();

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Validate runtime concurrency constraints for in-memory locking
    enforceSingleInstanceIfNecessary();

    // Ensure upload directories exist
    ensureUploadDirectories();

    await connectDB();

    // Initialize WebSocket server
    socketService.initialize(httpServer);

    // Setup API documentation
    setupSwagger(app);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Legacy Health (kept): http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔌 WebSocket ready for real-time notifications`);

      // Start event reminder scheduler
      const scheduler = EventReminderScheduler.getInstance();
      scheduler.start();
      console.log(`⏰ Event reminder scheduler active`);

      // Start maintenance scheduler
      const maintenance = MaintenanceScheduler.getInstance();
      maintenance.start();
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
