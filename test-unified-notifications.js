/**
 * Test script for the new unified notification system
 * This script tests the database persistence of notifications and system messages
 */

const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

// Test user credentials (replace with valid ones)
const TEST_CREDENTIALS = {
  username: "john_doe",
  password: "password123",
};

let authToken = "";

async function login() {
  try {
    console.log("🔐 Logging in...");
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      TEST_CREDENTIALS
    );

    if (response.data.success) {
      authToken = response.data.token;
      console.log("✅ Login successful");
      return true;
    } else {
      console.error("❌ Login failed:", response.data.message);
      return false;
    }
  } catch (error) {
    console.error(
      "❌ Login error:",
      error.response?.data?.message || error.message
    );
    return false;
  }
}

async function testUnifiedNotifications() {
  try {
    console.log("\n📋 Testing unified notifications API...");
    const response = await axios.get(`${BASE_URL}/notifications/v2`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.data.success) {
      console.log("✅ Unified notifications API working");
      console.log(
        `📊 Found ${response.data.notifications.length} notifications`
      );
      console.log(`🔔 Unread count: ${response.data.unreadCount}`);
      return response.data;
    } else {
      console.error("❌ Unified notifications failed:", response.data.message);
      return null;
    }
  } catch (error) {
    console.error(
      "❌ Unified notifications error:",
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function testSystemMessages() {
  try {
    console.log("\n📢 Testing system messages API...");
    const response = await axios.get(
      `${BASE_URL}/notifications/v2/system-messages`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (response.data.success) {
      console.log("✅ System messages API working");
      console.log(
        `📊 Found ${response.data.systemMessages.length} system messages`
      );
      return response.data;
    } else {
      console.error("❌ System messages failed:", response.data.message);
      return null;
    }
  } catch (error) {
    console.error(
      "❌ System messages error:",
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function createTestSystemMessage() {
  try {
    console.log("\n✨ Creating test system message...");
    const testMessage = {
      title: "Test Persistence Message",
      content:
        "This is a test message to verify database persistence works correctly.",
      type: "announcement",
      priority: "medium",
    };

    const response = await axios.post(
      `${BASE_URL}/notifications/v2/system-messages`,
      testMessage,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (response.data.success) {
      console.log("✅ Test system message created successfully");
      console.log(`📋 Message ID: ${response.data.systemMessage.id}`);
      return response.data.systemMessage;
    } else {
      console.error(
        "❌ Failed to create test system message:",
        response.data.message
      );
      return null;
    }
  } catch (error) {
    console.error(
      "❌ Create system message error:",
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    console.log(`\n📖 Marking notification ${notificationId} as read...`);
    const response = await axios.patch(
      `${BASE_URL}/notifications/v2/${notificationId}/read`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (response.data.success) {
      console.log("✅ Notification marked as read successfully");
      return true;
    } else {
      console.error(
        "❌ Failed to mark notification as read:",
        response.data.message
      );
      return false;
    }
  } catch (error) {
    console.error(
      "❌ Mark as read error:",
      error.response?.data?.message || error.message
    );
    return false;
  }
}

async function runPersistenceTest() {
  console.log("🚀 Starting Unified Notification System Persistence Test\n");

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log("❌ Test failed at login step");
    return;
  }

  // Step 2: Get initial state
  console.log("\n📊 Getting initial notification state...");
  const initialNotifications = await testUnifiedNotifications();
  const initialSystemMessages = await testSystemMessages();

  if (!initialNotifications || !initialSystemMessages) {
    console.log("❌ Test failed at initial state check");
    return;
  }

  // Step 3: Create a test system message
  const newSystemMessage = await createTestSystemMessage();
  if (!newSystemMessage) {
    console.log("❌ Test failed at system message creation");
    return;
  }

  // Step 4: Wait a moment and check if it appears in notifications
  console.log("\n⏳ Waiting 2 seconds for real-time propagation...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const updatedNotifications = await testUnifiedNotifications();
  if (!updatedNotifications) {
    console.log("❌ Test failed at updated state check");
    return;
  }

  // Step 5: Check if the new message appears in notifications
  const notificationForSystemMessage = updatedNotifications.notifications.find(
    (n) => n.systemMessage && n.systemMessage.id === newSystemMessage.id
  );

  if (notificationForSystemMessage) {
    console.log("✅ System message properly appears in unified notifications");

    // Step 6: Mark the notification as read
    const markReadSuccess = await markNotificationAsRead(
      notificationForSystemMessage.id
    );

    if (markReadSuccess) {
      // Step 7: Verify persistence by checking again
      console.log("\n🔄 Verifying persistence after marking as read...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalNotifications = await testUnifiedNotifications();
      if (finalNotifications) {
        const updatedNotification = finalNotifications.notifications.find(
          (n) => n.id === notificationForSystemMessage.id
        );

        if (updatedNotification && updatedNotification.isRead) {
          console.log("✅ Notification read status persisted correctly");
          console.log("\n🎉 PERSISTENCE TEST PASSED! 🎉");
          console.log(
            "✅ Database-backend-frontend integration is working properly"
          );
          console.log("✅ Changes will survive page refresh");
        } else {
          console.log("❌ Notification read status not persisted");
          console.log("❌ PERSISTENCE TEST FAILED");
        }
      }
    }
  } else {
    console.log("❌ System message did not appear in unified notifications");
    console.log("❌ PERSISTENCE TEST FAILED");
  }

  console.log("\n📋 Test Summary:");
  console.log(
    `Initial notifications: ${initialNotifications.notifications.length}`
  );
  console.log(`Initial unread count: ${initialNotifications.unreadCount}`);
  console.log(
    `Final notifications: ${updatedNotifications.notifications.length}`
  );
  console.log(`Final unread count: ${updatedNotifications.unreadCount}`);
}

// Check if axios is available
if (typeof require === "undefined") {
  console.error(
    "❌ This script requires Node.js. Please run with: node test-unified-notifications.js"
  );
} else {
  runPersistenceTest().catch((error) => {
    console.error("❌ Unexpected error:", error);
  });
}
