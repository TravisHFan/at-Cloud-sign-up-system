import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import routes from "./routes";
import { setupSwagger } from "./config/swagger";
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
import { socketService } from "./services/infrastructure/SocketService";
import RequestMonitorService from "./middleware/RequestMonitorService";
import monitorRoutes from "./routes/monitor";
import EventReminderScheduler from "./services/EventReminderScheduler";

// Load environment variables
dotenv.config();

// Ensure upload directories exist
const ensureUploadDirectories = () => {
  // Allow explicit override via environment variable
  let baseUploadPath: string;
  if (process.env.UPLOAD_DESTINATION) {
    baseUploadPath = process.env.UPLOAD_DESTINATION.replace(/\/$/, ""); // Remove trailing slash
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

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;

// Export app for testing
export { app };

// Security middleware
app.use(securityHeaders);
app.use(ipSecurity);
app.use(requestSizeLimit);

// HTTP response compression (gzip/deflate)
app.use(
  compression({
    filter: (req, res) => {
      // Don't compress if the request includes 'x-no-compression' header
      if (req.headers["x-no-compression"]) {
        return false;
      }
      // Use compression filter function
      return compression.filter(req, res);
    },
    level: 6, // Compression level (1-9, 6 is good balance)
    threshold: 1024, // Only compress responses larger than 1KB
  })
);

// CORS configuration
app.use(cors(corsOptions));

// Request monitoring middleware (must be early in the chain)
const requestMonitor = RequestMonitorService.getInstance();
app.use(requestMonitor.middleware());

// Rate limiting
app.use(generalLimiter);
// Apply auth rate limiter only to specific auth endpoints, not all /auth routes (versionless)
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
// Apply moderate rate limiter to profile endpoints
app.use("/api/auth/profile", profileLimiter);
app.use("/api/auth/logout", profileLimiter);
// Apply generous rate limiter to notifications (for polling)
app.use("/api/notifications", systemMessagesLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// XSS Protection
app.use(xssProtection);
app.use(cookieParser());

// Static file serving for uploads
const getStaticUploadPath = (): string => {
  // Allow explicit override via environment variable
  if (process.env.UPLOAD_DESTINATION) {
    const path = process.env.UPLOAD_DESTINATION.replace(/\/$/, ""); // Remove trailing slash
    console.log(`📁 Using UPLOAD_DESTINATION for static files: ${path}`);
    return path;
  }

  // In production on Render, use the mounted disk path
  if (process.env.NODE_ENV === "production") {
    console.log(`📁 Using production upload path: /uploads`);
    return "/uploads";
  }
  // In development, use relative path
  const devPath = path.join(__dirname, "../uploads");
  console.log(`📁 Using development upload path: ${devPath}`);
  return devPath;
};

const staticUploadPath = getStaticUploadPath();
console.log(`🔗 Serving static files from: ${staticUploadPath}`);
app.use("/uploads", express.static(staticUploadPath));

// Request logging middleware
app.use((req, res, next) => {
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
    // Ensure upload directories exist
    ensureUploadDirectories();

    await connectDB();

    // Initialize WebSocket server
    socketService.initialize(httpServer);

    // Setup API documentation
    setupSwagger(app);

    // Mount routes under /api
    app.use("/api", routes);

    // Preserve top-level health endpoint for external monitors
    app.get("/health", (_req, res) => {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

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
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
