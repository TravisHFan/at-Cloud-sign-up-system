import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/index";

describe("Event Creation System Messages Bug Test", () => {
  let adminToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should demonstrate that event creation does not create system messages", async () => {
    // First, register and login as an admin to create events
    const registrationData = {
      username: `eventtestadmin_${Date.now()}`,
      firstName: "Test",
      lastName: "Admin",
      email: `eventtestadmin_${Date.now()}@test.com`,
      password: "Password123",
      confirmPassword: "Password123",
      phone: "1234567890",
      isAtCloudLeader: true,
      roleInAtCloud: "Event Creator",
      acceptTerms: true,
    };

    console.log("🔧 Registering admin user...");
    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send(registrationData);

    expect(registerResponse.status).toBe(201);
    console.log("✅ Admin registered successfully");

    // Login
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      emailOrUsername: registrationData.email,
      password: "Password123",
    });

    expect(loginResponse.status).toBe(200);
    adminToken = loginResponse.body.accessToken;
    console.log("✅ Admin logged in successfully");

    // Count system messages before creating event
    const beforeMessagesResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    const messageCountBefore =
      beforeMessagesResponse.body.data?.totalCount || 0;
    console.log(
      `📋 System messages before event creation: ${messageCountBefore}`
    );

    // Create an event
    const eventData = {
      title: "Test Event for System Message Bug",
      type: "Workshop",
      description: "Testing if event creation triggers system messages",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      startTime: "10:00",
      endTime: "12:00",
      location: "Test Location",
      maxParticipants: 20,
      registrationDeadline: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toISOString(), // 5 days from now
      category: "Technology",
    };

    console.log("🆕 Creating event...");
    const createEventResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    console.log("Event creation response:", {
      status: createEventResponse.status,
      success: createEventResponse.body.success,
      eventId: createEventResponse.body.data?.event?.id,
    });

    expect(createEventResponse.status).toBe(201);
    expect(createEventResponse.body.success).toBe(true);
    console.log("✅ Event created successfully");

    // Wait a moment for any async system message creation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Count system messages after creating event
    const afterMessagesResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    const messageCountAfter = afterMessagesResponse.body.data?.totalCount || 0;
    console.log(
      `📋 System messages after event creation: ${messageCountAfter}`
    );

    // Check if any new system messages were created
    const newMessagesCreated = messageCountAfter - messageCountBefore;
    console.log(`📈 New system messages created: ${newMessagesCreated}`);

    // The bug is that NO system messages are created for event creation
    // This test documents the current broken behavior
    console.log(
      "🐛 BUG CONFIRMED: Event creation should create system messages for all users, but currently creates none"
    );

    expect(newMessagesCreated).toBe(0); // This confirms the bug - it SHOULD be > 0
  });
});
