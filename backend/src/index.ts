import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
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

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;

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
    await connectDB();

    // Initialize WebSocket server
    socketService.initialize(httpServer);

    // Setup API documentation
    setupSwagger(app);

    // Mount routes
    app.use(routes);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 API Health: http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔌 WebSocket ready for real-time notifications`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
