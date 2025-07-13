import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Basic routes
app.get("/", (req, res) => {
  res.json({
    message: "@Cloud Sign-up System Backend",
    status: "running",
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "@Cloud Sign-up System",
  });
});

app.get("/api/v1", (req, res) => {
  res.json({
    message: "@Cloud Sign-up System API v1",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      events: "/api/v1/events",
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 @Cloud Sign-up System Backend`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API: http://localhost:${PORT}/api/v1`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
});

// Error handling
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
