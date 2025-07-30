import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/index";

describe("Event System Messages Fix Test", () => {
  let adminToken: string;
  let adminUserId: string;

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

  it("should create system messages when an event is created", async () => {
    // First, register and login as an admin to create events
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const registrationData = {
      username: `fix${randomId}`, // Short unique username
      firstName: "Test",
      lastName: "Admin",
      email: `eventfixadmin_${timestamp}_${randomId}@test.com`,
      password: "Password123!",
      confirmPassword: "Password123!",
      phone: "1234567890",
      isAtCloudLeader: true,
      roleInAtCloud: "Event Creator",
      acceptTerms: true,
      gender: "male",
    };

    console.log("🔧 Registering admin user...");
    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send(registrationData);

    if (registerResponse.status !== 201) {
      console.error("Registration failed:", registerResponse.body);
    }
    expect(registerResponse.status).toBe(201);
    adminUserId = registerResponse.body.data?.user?.id;
    console.log("✅ Admin registered successfully with ID:", adminUserId);

    // Login
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      emailOrUsername: registrationData.email,
      password: "Password123!",
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
      title: "System Message Test Event",
      type: "Workshop",
      description: "Testing if event creation triggers system messages",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 7 days from now
      time: "10:00",
      endTime: "12:00",
      organizer: "Test Admin",
      purpose: "Testing system message functionality",
      format: "Online",
      zoomLink: "https://zoom.us/test",
      roles: ["Developer", "Tester"],
      maxParticipants: 20,
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 5 days from now
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
      message: createEventResponse.body.message,
    });

    expect(createEventResponse.status).toBe(201);
    expect(createEventResponse.body.success).toBe(true);
    console.log("✅ Event created successfully");

    // Wait a moment for system message creation
    await new Promise((resolve) => setTimeout(resolve, 2000));

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

    // With our fix, system messages SHOULD be created for event creation
    console.log(
      "🎉 EXPECTED: Event creation should create system messages for all users"
    );

    expect(newMessagesCreated).toBeGreaterThan(0); // This should now pass with our fix
  });
});
