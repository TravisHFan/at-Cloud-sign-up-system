/**
 * Model Method Debug Test
 *
 * This test directly calls the model methods to debug the Map issue
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import { User, Message } from "../../../src/models";
import routes from "../../../src/routes";

const app = express();
app.use(express.json());
app.use(routes);

describe("Model Method Debug", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;

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
    await User.deleteMany({});
    await Message.deleteMany({});

    // Create users
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "TestPassword123!",
      gender: "male",
      role: "Administrator",
      isActive: true,
      isVerified: true,
    });

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "TestPassword123!",
      gender: "female",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    // Login both users
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "participant-test",
        password: "TestPassword123!",
      });

    adminToken = adminLogin.body.data.accessToken;
    participantToken = participantLogin.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Message.deleteMany({});
  });

  it("DIAGNOSTIC: Debug Map.set and getUserState/updateUserState", async () => {
    console.log("\n=== MODEL METHOD DEBUG ===");

    // Step 1: Create message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Model Debug Test",
        content: "Testing model internals",
        type: "announcement",
        priority: "medium",
      });

    const messageId = createResponse.body.data.message.id;
    const participantId = participantUser._id.toString();
    console.log(`Participant ID: ${participantId}`);

    // Step 2: Get message and debug Map operations
    const message = await Message.findById(messageId);

    if (message) {
      console.log("\n🔧 Step 2: Debug Map operations");

      // Check if userStates is actually a Map
      console.log("userStates type:", typeof message.userStates);
      console.log("userStates is Map:", message.userStates instanceof Map);
      console.log("userStates keys:", Array.from(message.userStates.keys()));

      // Get initial state
      console.log("\n📝 Testing getUserState:");
      const initialState = message.getUserState(participantId);
      console.log("Initial state:", initialState);

      // Test manual Map.set
      console.log("\n🔧 Testing manual Map.set:");
      const newState = {
        ...initialState,
        isReadInSystem: true,
        readInSystemAt: new Date(),
        lastInteractionAt: new Date(),
      };

      console.log("Setting new state:", newState);
      message.userStates.set(participantId, newState);
      message.markModified("userStates");

      // Check if it worked
      const manualState = message.getUserState(participantId);
      console.log("State after manual set:", manualState);

      // Test updateUserState method
      console.log("\n⚙️ Testing updateUserState method:");
      message.updateUserState(participantId, {
        isReadInSystem: true,
        readInSystemAt: new Date(),
      });

      const updateState = message.getUserState(participantId);
      console.log("State after updateUserState:", updateState);

      // Test markAsReadInSystem method
      console.log("\n✅ Testing markAsReadInSystem method:");
      message.markAsReadInSystem(participantId);

      const markState = message.getUserState(participantId);
      console.log("State after markAsReadInSystem:", markState);

      // Save and check
      console.log("\n💾 Saving and checking:");
      await message.save();

      const savedState = message.getUserState(participantId);
      console.log("State after save:", savedState);

      // Fresh query
      const freshMessage = await Message.findById(messageId);
      const freshState = freshMessage?.getUserState(participantId);
      console.log("Fresh query state:", freshState);
    }

    console.log("\n=== DIAGNOSTIC END ===\n");
  });
});
