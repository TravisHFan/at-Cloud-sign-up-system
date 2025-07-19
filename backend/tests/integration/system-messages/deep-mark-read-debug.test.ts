/**
 * Deep Mark as Read Debug Test
 *
 * This test checks if the markAsReadInSystem method is actually being called
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

describe("Deep Mark as Read Debug", () => {
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

  it("DIAGNOSTIC: Test direct model method vs API", async () => {
    console.log("\n=== DEEP MARK AS READ DIAGNOSTIC ===");

    // Step 1: Create message via API
    console.log("\n📝 Step 1: Create message via API");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Direct Model Test",
        content: "Testing model methods directly",
        type: "announcement",
        priority: "medium",
      });

    const messageId = createResponse.body.data.message.id;
    const participantId = participantUser._id.toString();
    console.log(`Message ID: ${messageId}`);
    console.log(`Participant ID: ${participantId}`);

    // Step 2: Test direct model method
    console.log("\n🔧 Step 2: Test direct model method");
    const message = await Message.findById(messageId);

    if (message) {
      console.log("Found message in database");
      console.log(
        "Initial userStates keys:",
        Array.from(message.userStates.keys())
      );

      // Get initial state
      const initialState = message.getUserState(participantId);
      console.log("Initial participant state:", initialState);

      // Call markAsReadInSystem directly
      console.log("Calling markAsReadInSystem directly...");
      message.markAsReadInSystem(participantId);
      console.log("Called markAsReadInSystem");

      // Check state before save
      const stateBeforeSave = message.getUserState(participantId);
      console.log("State before save:", stateBeforeSave);

      // Save
      console.log("Saving message...");
      await message.save();
      console.log("Message saved");

      // Check state after save
      const stateAfterSave = message.getUserState(participantId);
      console.log("State after save:", stateAfterSave);
    } else {
      console.log("❌ Message not found in database!");
    }

    // Step 3: Verify in fresh query
    console.log("\n🔍 Step 3: Fresh database query");
    const freshMessage = await Message.findById(messageId).lean();
    console.log(
      "Fresh userStates:",
      JSON.stringify(freshMessage?.userStates, null, 2)
    );

    // Step 4: Test API call separately
    console.log("\n📡 Step 4: Test API call separately");

    // Reset the message first
    await Message.findByIdAndUpdate(messageId, {
      $set: {
        [`userStates.${participantId}.isReadInSystem`]: false,
      },
    });

    const markReadResponse = await request(app)
      .patch(`/api/v1/system-messages/${messageId}/read`)
      .set("Authorization", `Bearer ${participantToken}`);

    console.log("API markAsRead status:", markReadResponse.status);

    // Check final state
    const finalMessage = await Message.findById(messageId).lean();
    console.log(
      "Final userStates after API:",
      JSON.stringify(finalMessage?.userStates, null, 2)
    );

    console.log("\n=== DIAGNOSTIC END ===\n");
  });
});
