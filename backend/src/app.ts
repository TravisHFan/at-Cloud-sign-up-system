import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import routes from "./routes";
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
} from "./middleware/security";
import ErrorHandlerMiddleware from "./middleware/errorHandler";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB for testing
if (process.env.NODE_ENV === "test") {
  const mongoURI =
    process.env.MONGODB_TEST_URI ||
    "mongodb://localhost:27017/atcloud-signup-test";
  mongoose.connect(mongoURI).catch(console.error);
}

// Trust proxy for accurate IP addresses behind reverse proxies
app.set("trust proxy", 1);

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Rate limiting middleware
app.use("/api/auth", authLimiter);
app.use("/api/users/profile", profileLimiter);
app.use("/api/system/messages", systemMessagesLimiter);
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// XSS Protection
app.use(xssProtection);

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global error handler
app.use(ErrorHandlerMiddleware.globalErrorHandler);

// Default export for testing
export default app;
