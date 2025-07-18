// Quick debug script to test individual endpoints
const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
require("dotenv").config();

async function debugTest() {
  try {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI_TEST);
    console.log("Connected to test database");

    // Import after DB connection
    const routes = require("./src/routes").default;
    const { User } = require("./src/models");

    // Create test app
    const app = express();
    app.use(express.json());
    app.use(routes);

    // Clean up and create test user
    await User.deleteMany({});

    const testUser = await User.create({
      username: "debuguser",
      email: "debug@test.com",
      password: "DebugPass123",
      role: "Administrator",
      isVerified: true,
      isActive: true,
    });

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "debug@test.com", password: "DebugPass123" });

    console.log("Login response status:", loginResponse.status);
    console.log(
      "Login response body:",
      JSON.stringify(loginResponse.body, null, 2)
    );

    if (loginResponse.status === 200) {
      const token = loginResponse.body.data.accessToken;

      // Test system message creation
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Debug Test Message",
          content: "Debug test content",
          type: "announcement",
          priority: "high",
        });

      console.log("Create response status:", createResponse.status);
      console.log(
        "Create response body:",
        JSON.stringify(createResponse.body, null, 2)
      );

      if (createResponse.status === 201) {
        const messageId = createResponse.body.data.id;

        // Test bell notifications GET
        const bellGetResponse = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${token}`);

        console.log("Bell GET response status:", bellGetResponse.status);
        console.log(
          "Bell GET response body:",
          JSON.stringify(bellGetResponse.body, null, 2)
        );

        // Test bell notification PATCH
        const bellPatchResponse = await request(app)
          .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
          .set("Authorization", `Bearer ${token}`);

        console.log("Bell PATCH response status:", bellPatchResponse.status);
        console.log(
          "Bell PATCH response body:",
          JSON.stringify(bellPatchResponse.body, null, 2)
        );
      }
    }
  } catch (error) {
    console.error("Debug test error:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

debugTest();
