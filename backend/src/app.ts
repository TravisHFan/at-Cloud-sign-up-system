import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import routes from "./routes";
import ShortLinkService from "./services/ShortLinkService";
import { ShortLinkMetricsService } from "./services/ShortLinkMetricsService";
import {
  shortLinkRedirectCounter,
  getMetrics as getPromMetrics,
  isPromEnabled,
} from "./services/PrometheusMetricsService";
import { Logger } from "./services/LoggerService";
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
import { socketService } from "./services/infrastructure/SocketService"; // used only in index, kept import compatibility if needed by tests in future
import RequestMonitorService from "./middleware/RequestMonitorService";
import ErrorHandlerMiddleware from "./middleware/errorHandler";
import { requestCorrelation } from "./middleware/requestCorrelation";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Note: Do not auto-connect to MongoDB here. Tests and server bootstrap manage connections explicitly.

// Trust proxy for accurate IP addresses behind reverse proxies
app.set("trust proxy", 1);

// Request correlation (early - before other middleware)
app.use(requestCorrelation());

// Security middleware
app.use(securityHeaders);
app.use(ipSecurity);
app.use(requestSizeLimit);

// CORS configuration
app.use(cors(corsOptions));

// HTTP response compression (balanced defaults)
app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);

// Request monitoring (early)
const requestMonitor = RequestMonitorService.getInstance();
app.use(requestMonitor.middleware());

// Rate limiting middleware
app.use(generalLimiter);
// Apply specific limiters to critical endpoints
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/profile", profileLimiter);
app.use("/api/auth/logout", profileLimiter);
app.use("/api/notifications", systemMessagesLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Test helper auth injection (only in test environment)
if (process.env.NODE_ENV === "test") {
  app.use((req, _res, next) => {
    const auth = req.header("Authorization");
    if (auth) {
      if (auth.startsWith("Bearer test-admin-")) {
        const userId = auth.substring("Bearer test-admin-".length).trim();
        if (mongoose.Types.ObjectId.isValid(userId)) {
          (req as any).user = {
            id: userId,
            role: "Administrator",
            _id: userId,
          };
        }
      } else if (auth.startsWith("Bearer test-")) {
        const userId = auth.substring("Bearer test-".length).trim();
        if (mongoose.Types.ObjectId.isValid(userId)) {
          (req as any).user = { id: userId, role: "Participant", _id: userId };
        }
      }
    }
    next();
  });
}

// XSS Protection
app.use(xssProtection);

// Static file serving for uploads with relaxed CORP and CORS for images
const appLogger = Logger.getInstance().child("App");
const getStaticUploadPath = (): string => {
  if (process.env.UPLOAD_DESTINATION) {
    const p = process.env.UPLOAD_DESTINATION.replace(/\/$/, "");
    appLogger.info(`📁 Using UPLOAD_DESTINATION for static files: ${p}`);
    return p;
  }
  if (process.env.NODE_ENV === "production") {
    appLogger.info(`📁 Using production upload path: /uploads`);
    return "/uploads";
  }
  const devPath = path.join(__dirname, "../uploads");
  appLogger.info(`📁 Using development upload path: ${devPath}`);
  return devPath;
};

const staticUploadPath = getStaticUploadPath();
appLogger.info(`🔗 Serving static files from: ${staticUploadPath}`);

app.use(
  "/uploads",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "https://at-cloud-sign-up-system.onrender.com",
    ];
    const origin = req.headers.origin as string | undefined;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept"
    );
    if (!res.getHeader("Cache-Control")) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=300"
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  }
);
app.use("/uploads", express.static(staticUploadPath));

// Routes
app.use("/api", routes);

// Root short redirect: /s/:key -> 302 to public event slug page
app.get("/s/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const result = await ShortLinkService.resolveKey(key);
    if (result.status === "active") {
      ShortLinkMetricsService.increment("redirect_active");
      try {
        shortLinkRedirectCounter.inc({ status: "active" });
      } catch {}
      // Redirect to frontend public event page path (relative). Frontend can handle full rendering.
      const target = `/public/events/${result.slug}`;
      res.redirect(302, target);
      return;
    }
    if (result.status === "expired") {
      ShortLinkMetricsService.increment("redirect_expired");
      try {
        shortLinkRedirectCounter.inc({ status: "expired" });
      } catch {}
      res.status(410).send("Short link expired");
      return;
    }
    ShortLinkMetricsService.increment("redirect_not_found");
    try {
      shortLinkRedirectCounter.inc({ status: "not_found" });
    } catch {}
    res.status(404).send("Short link not found");
  } catch {
    res.status(500).send("Failed to resolve short link");
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Lightweight metrics endpoint (non-auth) for short links (can be restricted later)
// Unified metrics endpoint: returns Prometheus exposition (text) when Accept header prefers text/plain
// Otherwise returns JSON with legacy in-memory short link counters plus an indicator of Prometheus enablement.
app.get("/metrics", async (req, res) => {
  const accept = req.headers["accept"] || "";
  if (isPromEnabled() && /text\/plain/.test(accept)) {
    try {
      const text = await getPromMetrics();
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.status(200).send(text);
      return;
    } catch (e) {
      res.status(500).send("Failed to collect Prometheus metrics");
      return;
    }
  }
  try {
    const metrics = ShortLinkMetricsService.getAll();
    res.status(200).json({
      success: true,
      metrics: { shortLinks: metrics },
      prometheus: { enabled: isPromEnabled() },
    });
  } catch (e) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch metrics" });
  }
});

// Backwards compatible old short links metrics path (JSON only)
app.get("/metrics/short-links", (req, res) => {
  try {
    const metrics = ShortLinkMetricsService.getAll();
    res.status(200).json({ success: true, metrics });
  } catch (e) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch metrics" });
  }
});

// Global error handlers (security first, then application)
app.use(securityErrorHandler);
app.use(ErrorHandlerMiddleware.globalErrorHandler);

// Default export for testing and server bootstrap
export default app;
