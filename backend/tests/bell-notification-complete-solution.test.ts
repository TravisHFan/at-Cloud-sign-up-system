import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import { User } from "../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("🎉 BELL NOTIFICATION ISSUES - COMPLETE SOLUTION VERIFICATION", () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let regularToken: string;

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

    // Create users
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

    regularUser = await User.create({
      username: "user",
      email: "user@test.com",
      password: "UserPass123",
      firstName: "Regular",
      lastName: "User",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    // Get tokens
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });

    const userLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "user@test.com", password: "UserPass123" });

    expect(adminLogin.status).toBe(200);
    expect(userLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;
    regularToken = userLogin.body.data.accessToken;
  });

  it("🎯 COMPLETE WORKFLOW: Create, Read, Mark All Read, Delete", async () => {
    console.log("\n🎉 === COMPLETE BELL NOTIFICATION WORKFLOW TEST ===");

    // Step 1: Create multiple system messages
    console.log("Step 1: Creating system messages...");

    const messages = [
      { title: "Announcement", type: "announcement", priority: "high" },
      { title: "Maintenance", type: "maintenance", priority: "medium" },
      { title: "Update", type: "update", priority: "low" },
    ];

    const createdMessageIds: string[] = [];
    for (const msg of messages) {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: msg.title,
          content: `${msg.title} content`,
          type: msg.type,
          priority: msg.priority,
        });

      expect(response.status).toBe(201);
      createdMessageIds.push(response.body.data.id);
    }
    console.log(`✅ Created ${messages.length} system messages`);

    // Step 2: Verify bell notifications are created
    console.log("Step 2: Verifying bell notifications...");
    const initialBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(initialBellResponse.status).toBe(200);
    expect(initialBellResponse.body.data.notifications).toHaveLength(3);
    expect(initialBellResponse.body.data.unreadCount).toBe(3);
    console.log("✅ 3 unread bell notifications created");

    // Step 3: Mark individual notification as read
    console.log("Step 3: Marking one notification as read...");
    const markOneReadResponse = await request(app)
      .patch(
        `/api/v1/system-messages/bell-notifications/${createdMessageIds[0]}/read`
      )
      .set("Authorization", `Bearer ${regularToken}`);

    expect(markOneReadResponse.status).toBe(200);
    console.log("✅ Individual notification marked as read");

    // Step 4: Verify partial read state
    const partialReadResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(partialReadResponse.body.data.unreadCount).toBe(2);
    console.log("✅ Unread count reduced to 2");

    // Step 5: Test MARK ALL AS READ (Issue 2 - Fixed)
    console.log("Step 5: Testing MARK ALL AS READ functionality...");
    const markAllReadResponse = await request(app)
      .put("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(markAllReadResponse.status).toBe(200);
    expect(markAllReadResponse.body.data.markedCount).toBe(2); // Should mark remaining 2 as read
    console.log("✅ ISSUE 2 FIXED: Mark all read works correctly");

    // Step 6: Verify all notifications are read
    const allReadResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(allReadResponse.body.data.unreadCount).toBe(0);
    expect(
      allReadResponse.body.data.notifications.every((n: any) => n.isRead)
    ).toBe(true);
    console.log("✅ All notifications are now read");

    // Step 7: Test DELETE READ NOTIFICATIONS (Issue 1 - Working)
    console.log("Step 7: Testing DELETE READ NOTIFICATIONS functionality...");

    // Delete first notification
    const deleteFirstResponse = await request(app)
      .delete(`/api/v1/user/notifications/bell/${createdMessageIds[0]}`)
      .set("Authorization", `Bearer ${regularToken}`);

    expect(deleteFirstResponse.status).toBe(200);
    console.log("✅ ISSUE 1 CONFIRMED: Delete read notification works");

    // Delete second notification
    const deleteSecondResponse = await request(app)
      .delete(`/api/v1/user/notifications/bell/${createdMessageIds[1]}`)
      .set("Authorization", `Bearer ${regularToken}`);

    expect(deleteSecondResponse.status).toBe(200);
    console.log("✅ Second notification deleted successfully");

    // Step 8: Verify deletions
    const finalBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(finalBellResponse.body.data.notifications).toHaveLength(1);
    console.log("✅ Only 1 notification remains after deletions");

    // Step 9: Verify system messages still exist (deletions should only affect bell notifications)
    const systemMessagesResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(systemMessagesResponse.body.data.messages).toHaveLength(3);
    console.log(
      "✅ All system messages still exist (deletions only affected bell notifications)"
    );

    console.log("\n🏆 === COMPLETE SUCCESS SUMMARY ===");
    console.log("✅ ISSUE 1 (Delete Read Notifications): WORKING CORRECTLY");
    console.log("✅ ISSUE 2 (Mark All Read): COMPLETELY FIXED");
    console.log("✅ End-to-end workflow: CREATE → READ → MARK ALL → DELETE");
    console.log("✅ All bell notification functionality working perfectly!");
  });

  it("🔄 REGRESSION TEST: Ensure existing functionality still works", async () => {
    console.log("\n🔄 === REGRESSION TEST ===");

    // Create a system message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Regression Test",
        content: "Testing existing functionality",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;

    // Test all core endpoints still work
    console.log("Testing core endpoints...");

    // GET bell notifications
    const getBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);
    expect(getBellResponse.status).toBe(200);
    console.log("✅ GET bell notifications works");

    // PATCH mark as read
    const patchReadResponse = await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
      .set("Authorization", `Bearer ${regularToken}`);
    expect(patchReadResponse.status).toBe(200);
    console.log("✅ PATCH mark as read works");

    // PUT mark all as read
    const putMarkAllResponse = await request(app)
      .put("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${regularToken}`);
    expect(putMarkAllResponse.status).toBe(200);
    console.log("✅ PUT mark all as read works");

    // DELETE notification
    const deleteResponse = await request(app)
      .delete(`/api/v1/user/notifications/bell/${messageId}`)
      .set("Authorization", `Bearer ${regularToken}`);
    expect(deleteResponse.status).toBe(200);
    console.log("✅ DELETE notification works");

    console.log("🎉 All regression tests passed!");
  });
});
