import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "http";
import routes from "./routes";
import {
  SocketManager,
  NotificationService,
  UnifiedNotificationService,
} from "./services";
import {
  generalLimiter,
  authLimiter,
  profileLimiter,
  systemMessagesLimiter,
} from "./middleware/rateLimiting";
import {
  securityHeaders,
  corsOptions,
  xssProtection,
  requestSizeLimit,
  ipSecurity,
  securityErrorHandler,
} from "./middleware/security";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(securityHeaders);
app.use(ipSecurity);
app.use(requestSizeLimit);

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting
app.use(generalLimiter);
// Apply auth rate limiter only to specific auth endpoints, not all /auth routes
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/reset-password", authLimiter);
// Apply moderate rate limiter to profile endpoints
app.use("/api/v1/auth/profile", profileLimiter);
app.use("/api/v1/auth/logout", profileLimiter);
// Apply generous rate limiter to system messages (for polling)
app.use("/api/v1/system-messages", systemMessagesLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// XSS Protection
app.use(xssProtection);
app.use(cookieParser());

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Global error handler
app.use(securityErrorHandler);

// Database connection
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

    await mongoose.connect(mongoURI);

    console.log("✅ Connected to MongoDB successfully");
    console.log(`📊 Database: ${mongoose.connection.name}`);

    // Try to get MongoDB version
    try {
      const db = mongoose.connection.db;
      if (db) {
        const admin = db.admin();
        const dbInfo = await admin.serverStatus();
        console.log(`🏃‍♂️ MongoDB version: ${dbInfo.version}`);
      }
    } catch (dbInfoError) {
      console.log(
        "📊 MongoDB connection established (version info unavailable)"
      );
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("\n🔄 Received shutdown signal, closing HTTP server...");

  try {
    await mongoose.connection.close();
    console.log("📂 MongoDB connection closed");
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
    await connectDB();

    // Initialize Socket.IO
    const socketManager = new SocketManager(server);
    console.log("🔌 Socket.IO initialized");

    // Initialize notification service with socket manager
    NotificationService.initialize(socketManager);
    console.log("📱 Notification service initialized with real-time support");

    // Initialize unified notification service
    const unifiedNotificationService = new UnifiedNotificationService(
      socketManager
    );
    console.log("🔔 Unified notification service initialized");

    // Make services available globally
    app.set("socketManager", socketManager);
    app.set("unifiedNotificationService", unifiedNotificationService);

    // Mount routes AFTER services are initialized
    app.use(routes);

    server.listen(PORT, () => {
      console.log(`\n🚀 @Cloud Sign-up System Backend`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 API docs: http://localhost:${PORT}/api/v1`);
      console.log(`🔌 Socket.IO enabled for real-time features`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
