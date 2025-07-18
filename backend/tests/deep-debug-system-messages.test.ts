import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import { User, SystemMessage } from "../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("Deep Debug: System Messages Storage and Retrieval", () => {
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await SystemMessage.deleteMany({});

    // Create admin user
    adminUser = await User.create({
      username: "admin",
      email: "admin@test.com",
      password: "AdminPass123",
      firstName: "Admin",
      lastName: "User",
      role: "Administrator",
      isVerified: true,
      isActive: true,
    });

    // Get token
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });
    adminToken = adminLogin.body.data.accessToken;
  });

  it("should investigate system message storage and retrieval step by step", async () => {
    console.log("=== Deep Debug: System Message Flow ===");

    // Step 1: Check initial state
    console.log("\n1. Initial State Check:");
    const initialSystemMessages = await SystemMessage.find({});
    const initialUser = await User.findById(adminUser._id);
    console.log("Initial SystemMessage count:", initialSystemMessages.length);
    console.log(
      "Initial user systemMessageStates:",
      initialUser?.systemMessageStates?.length || 0
    );

    // Step 2: Create system message
    console.log("\n2. Creating System Message:");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Debug Message",
        content: "This is a debug message",
        type: "announcement",
        priority: "medium",
      });

    console.log("Create response status:", createResponse.status);
    console.log("Create response body:", createResponse.body);

    // Step 3: Check database state after creation
    console.log("\n3. Database State After Creation:");
    const systemMessagesInDB = await SystemMessage.find({});
    const userAfterCreate = await User.findById(adminUser._id);

    console.log("SystemMessage count in DB:", systemMessagesInDB.length);
    console.log(
      "SystemMessage details:",
      systemMessagesInDB.map((msg) => ({
        id: (msg as any)._id.toString(),
        title: msg.title,
        type: msg.type,
        isActive: msg.isActive,
      }))
    );

    console.log(
      "User systemMessageStates count:",
      userAfterCreate?.systemMessageStates?.length || 0
    );
    console.log(
      "User systemMessageStates details:",
      userAfterCreate?.systemMessageStates
    );

    // Step 4: Test the GET endpoint
    console.log("\n4. Testing GET /api/v1/system-messages:");
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("GET response status:", getResponse.status);
    console.log(
      "GET response body:",
      JSON.stringify(getResponse.body, null, 2)
    );

    // Step 5: Direct database query to see what the controller should find
    console.log("\n5. Direct Database Query Simulation:");
    const userId = adminUser._id;
    const userWithStates = await User.findById(userId).select(
      "systemMessageStates role"
    );
    const activeSystemMessages = await SystemMessage.find({ isActive: true });

    console.log("User found:", !!userWithStates);
    console.log("User role:", userWithStates?.role);
    console.log(
      "User systemMessageStates count:",
      userWithStates?.systemMessageStates?.length || 0
    );
    console.log("Active SystemMessages count:", activeSystemMessages.length);

    // Step 6: Manual message combination (like controller does)
    console.log("\n6. Manual Message Combination:");
    const messagesWithStates = activeSystemMessages
      .map((message) => {
        const userState = userWithStates?.systemMessageStates.find(
          (state: any) => state.messageId === (message as any)._id.toString()
        );

        console.log(
          `Message ${(message as any)._id} -> UserState found:`,
          !!userState
        );
        if (userState) {
          console.log("UserState details:", {
            messageId: userState.messageId,
            isRead: userState.isRead,
            isDeleted: userState.isDeleted,
          });
        }

        return {
          id: (message as any)._id,
          title: message.title,
          isDeleted: userState?.isDeleted || false,
        };
      })
      .filter((message) => !message.isDeleted);

    console.log("Final filtered messages count:", messagesWithStates.length);
    console.log("Final messages:", messagesWithStates);

    // Assertions
    expect(createResponse.status).toBe(201);
    expect(getResponse.status).toBe(200);
    expect(systemMessagesInDB).toHaveLength(1);
    expect(getResponse.body.data.messages).toHaveLength(1);
  });
});
