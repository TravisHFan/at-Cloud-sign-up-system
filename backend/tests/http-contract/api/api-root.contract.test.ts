import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";

describe("GET / - API Root/Info Endpoint", () => {
  it("should return API information and endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("message");
    expect(response.body).toHaveProperty("version");
    expect(response.body).toHaveProperty("documentation");
  });

  it("should include authentication endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("auth");
    expect(response.body.documentation.auth).toHaveProperty("login");
    expect(response.body.documentation.auth).toHaveProperty("register");
    expect(response.body.documentation.auth).toHaveProperty("logout");
    expect(response.body.documentation.auth.login).toBe("POST /auth/login");
  });

  it("should include user endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("users");
    expect(response.body.documentation.users).toHaveProperty("getProfile");
    expect(response.body.documentation.users).toHaveProperty("updateProfile");
    expect(response.body.documentation.users).toHaveProperty("getUserById");
  });

  it("should include event endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("events");
    expect(response.body.documentation.events).toHaveProperty("getAllEvents");
    expect(response.body.documentation.events).toHaveProperty("createEvent");
    expect(response.body.documentation.events).toHaveProperty("signUpForEvent");
  });

  it("should include notification endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("notifications");
    expect(response.body.documentation.notifications).toHaveProperty(
      "getSystemMessages"
    );
  });

  it("should include email notification endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("emailNotifications");
    expect(response.body.documentation.emailNotifications).toHaveProperty(
      "roleChange"
    );
    expect(response.body.documentation.emailNotifications).toHaveProperty(
      "eventCreated"
    );
  });

  it("should include feedback endpoint documentation", async () => {
    const response = await request(app).get("/api");

    expect(response.body.documentation).toHaveProperty("feedback");
    expect(response.body.documentation.feedback).toHaveProperty(
      "submitFeedback"
    );
  });

  it("should return valid JSON structure", async () => {
    const response = await request(app).get("/api");

    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toBeTypeOf("object");
  });

  it("should not require authentication", async () => {
    const response = await request(app).get("/api");

    // Should succeed without Bearer token
    expect(response.status).toBe(200);
  });
});

describe("404 Handler - Undefined Routes", () => {
  it("should return 404 for undefined API routes", async () => {
    const response = await request(app).get("/api/nonexistent-route");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("success", false);
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toMatch(/not found/i);
  });

  it("should provide helpful suggestion in 404 response", async () => {
    const response = await request(app).get("/api/invalid/endpoint/path");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("suggestion");
    expect(response.body.suggestion).toMatch(/\/api/);
  });

  it("should include original URL in 404 message", async () => {
    const testPath = "/api/test-missing-route";
    const response = await request(app).get(testPath);

    expect(response.status).toBe(404);
    expect(response.body.message).toContain(testPath);
  });
});
