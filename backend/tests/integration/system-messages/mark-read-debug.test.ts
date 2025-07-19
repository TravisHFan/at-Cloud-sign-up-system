/**
 * Mark as Read API Debug Test
 *
 * This test checks what happens when we call the markAsRead API
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

describe("Mark as Read API Debug", () => {
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

  it("DIAGNOSTIC: Trace what happens to userStates on markAsRead", async () => {
    console.log("\n=== MARK AS READ DIAGNOSTIC ===");

    // Step 1: Create message
    console.log("\n📝 Step 1: Create message");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Read Status Test",
        content: "Testing read functionality",
        type: "announcement",
        priority: "medium",
      });

    expect(createResponse.status).toBe(201);
    const messageId = createResponse.body.data.message.id;
    console.log(`Created message ID: ${messageId}`);

    // Step 2: Check initial state in database
    console.log("\n🗄️ Step 2: Check initial database state");
    const dbMessage1 = await Message.findById(messageId).lean();
    const participantId = participantUser._id.toString();
    console.log("Participant ID:", participantId);
    console.log(
      "Initial userStates:",
      JSON.stringify(dbMessage1?.userStates, null, 2)
    );

    // Step 3: Get initial API response
    console.log("\n📡 Step 3: Get initial API response");
    const getResponse1 = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const message1 = getResponse1.body.data.messages.find(
      (msg: any) => msg.id === messageId
    );
    console.log("Initial API message.isRead:", message1?.isRead);

    // Step 4: Call markAsRead API
    console.log("\n✅ Step 4: Call markAsRead API");
    const markReadResponse = await request(app)
      .patch(`/api/v1/system-messages/${messageId}/read`)
      .set("Authorization", `Bearer ${participantToken}`);

    console.log("markAsRead status:", markReadResponse.status);
    console.log("markAsRead response:", markReadResponse.body);

    // Step 5: Check database state after markAsRead
    console.log("\n🗄️ Step 5: Check database state after markAsRead");
    const dbMessage2 = await Message.findById(messageId).lean();
    console.log(
      "Updated userStates:",
      JSON.stringify(dbMessage2?.userStates, null, 2)
    );

    // Step 6: Get API response after markAsRead
    console.log("\n📡 Step 6: Get API response after markAsRead");
    const getResponse2 = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const message2 = getResponse2.body.data.messages.find(
      (msg: any) => msg.id === messageId
    );
    console.log("Updated API message.isRead:", message2?.isRead);

    // Step 7: Analysis
    console.log("\n🔍 Step 7: Analysis");
    const initialState = dbMessage1?.userStates?.[participantId];
    const updatedState = dbMessage2?.userStates?.[participantId];

    console.log("Initial state for participant:", initialState);
    console.log("Updated state for participant:", updatedState);

    if (updatedState?.isReadInSystem === true && message2?.isRead === false) {
      console.log(
        "🐛 BUG: Database shows isReadInSystem=true but API returns isRead=false"
      );
    }

    console.log("\n=== DIAGNOSTIC END ===\n");
  });
});
