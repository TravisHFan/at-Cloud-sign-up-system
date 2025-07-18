import request from "supertest";
import express from "express";

// Simple health check test
describe("Health Check", () => {
  const app = express();

  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  it("should return health status", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Server is running");
    expect(response.body.timestamp).toBeDefined();
  });
});
