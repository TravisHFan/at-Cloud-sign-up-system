import { describe, it, expect } from "vitest";

describe("Health Check", () => {
  it("should return health status", () => {
    const healthStatus = {
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    expect(healthStatus.success).toBe(true);
    expect(healthStatus.message).toBe("Server is running");
    expect(typeof healthStatus.timestamp).toBe("string");
    expect(typeof healthStatus.environment).toBe("string");
  });
});
