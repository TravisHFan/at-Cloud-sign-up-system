// Test script for System Messages Hybrid Architecture
// Run with: node test-system-messages.js

const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

// Test configuration
const testConfig = {
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
};

let authToken = "";
let testUsers = {};
let testMessageId = "";

async function createTestUsers() {
  console.log("\n🔧 Creating test users...");

  const users = [
    {
      username: "testsuperadmin",
      email: "testsuperadmin@test.com",
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      firstName: "Test",
      lastName: "SuperAdmin",
      gender: "male",
      isAtCloudLeader: false,
      role: "Super Admin",
      acceptTerms: true,
    },
    {
      username: "testparticipant",
      email: "testparticipant@test.com",
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      firstName: "Test",
      lastName: "Participant",
      gender: "female",
      isAtCloudLeader: false,
      role: "Participant",
      acceptTerms: true,
    },
  ];

  for (const userData of users) {
    try {
      const response = await axios.post(
        `${BASE_URL}/auth/register`,
        userData,
        testConfig
      );
      console.log(`✅ Created user: ${userData.username}`);
      testUsers[userData.username] = {
        ...userData,
        id: response.data.data.user.id,
      };
    } catch (error) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.message?.includes("already exists")
      ) {
        console.log(`⚠️  User ${userData.username} already exists`);
        testUsers[userData.username] = userData;
      } else {
        console.error(
          `❌ Failed to create user ${userData.username}:`,
          error.response?.data?.message
        );
      }
    }
  }
}

async function loginUser(username, password) {
  try {
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        identifier: username,
        password: password,
      },
      testConfig
    );

    console.log(`✅ Logged in as: ${username}`);
    return response.data.data.token;
  } catch (error) {
    console.error(
      `❌ Failed to login as ${username}:`,
      error.response?.data?.message
    );
    return null;
  }
}

async function testCreateSystemMessage() {
  console.log("\n📝 Testing System Message Creation (Requirement 4)...");

  try {
    const response = await axios.post(
      `${BASE_URL}/system-messages`,
      {
        title: "Test System Announcement",
        content:
          "This is a test system message created by the hybrid architecture. All users should receive this in both system messages and bell notifications.",
        type: "announcement",
        priority: "high",
      },
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    testMessageId = response.data.data.id;
    console.log(`✅ Created system message with ID: ${testMessageId}`);
    console.log(`📊 Sent to ${response.data.data.recipientCount} users`);
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to create system message:",
      error.response?.data?.message
    );
    return false;
  }
}

async function testGetSystemMessages() {
  console.log("\n📋 Testing Get System Messages (Requirement 1)...");

  try {
    const response = await axios.get(`${BASE_URL}/system-messages`, {
      ...testConfig,
      headers: {
        ...testConfig.headers,
        Authorization: `Bearer ${authToken}`,
      },
    });

    const messages = response.data.data.messages;
    console.log(`✅ Retrieved ${messages.length} system messages`);

    if (messages.length > 0) {
      const firstMessage = messages[0];
      console.log(
        `📄 First message: "${firstMessage.title}" (Read: ${firstMessage.isRead})`
      );
    }

    return messages;
  } catch (error) {
    console.error(
      "❌ Failed to get system messages:",
      error.response?.data?.message
    );
    return [];
  }
}

async function testGetBellNotifications() {
  console.log("\n🔔 Testing Get Bell Notifications (Requirement 5)...");

  try {
    const response = await axios.get(
      `${BASE_URL}/system-messages/bell-notifications`,
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const notifications = response.data.data.notifications;
    console.log(`✅ Retrieved ${notifications.length} bell notifications`);
    console.log(`📊 Unread count: ${response.data.data.unreadCount}`);

    if (notifications.length > 0) {
      const firstNotification = notifications[0];
      console.log(`🔔 First notification: "${firstNotification.title}"`);
      console.log(
        `🔄 Show remove button: ${firstNotification.showRemoveButton}`
      );
    }

    return notifications;
  } catch (error) {
    console.error(
      "❌ Failed to get bell notifications:",
      error.response?.data?.message
    );
    return [];
  }
}

async function testMarkSystemMessageAsRead() {
  console.log(
    "\n✅ Testing Mark System Message as Read (Requirement 1 & 8)..."
  );

  if (!testMessageId) {
    console.log("⚠️  No test message ID available");
    return false;
  }

  try {
    const response = await axios.patch(
      `${BASE_URL}/system-messages/${testMessageId}/read`,
      {},
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    console.log("✅ System message marked as read");
    console.log("🔄 This should also sync bell notification (Requirement 8)");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to mark message as read:",
      error.response?.data?.message
    );
    return false;
  }
}

async function testMarkBellNotificationAsRead() {
  console.log("\n✅ Testing Mark Bell Notification as Read (Requirement 5)...");

  if (!testMessageId) {
    console.log("⚠️  No test message ID available");
    return false;
  }

  try {
    const response = await axios.patch(
      `${BASE_URL}/system-messages/bell-notifications/${testMessageId}/read`,
      {},
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    console.log("✅ Bell notification marked as read");
    console.log("🔄 Remove button should now be visible");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to mark bell notification as read:",
      error.response?.data?.message
    );
    return false;
  }
}

async function testDeleteSystemMessage() {
  console.log("\n🗑️  Testing Delete System Message (Requirement 2)...");

  if (!testMessageId) {
    console.log("⚠️  No test message ID available");
    return false;
  }

  try {
    const response = await axios.delete(
      `${BASE_URL}/system-messages/${testMessageId}`,
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    console.log("✅ System message deleted from current user view");
    console.log("ℹ️  Other users should still see the message");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to delete system message:",
      error.response?.data?.message
    );
    return false;
  }
}

async function testRemoveBellNotification() {
  console.log("\n🔕 Testing Remove Bell Notification (Requirement 6)...");

  if (!testMessageId) {
    console.log("⚠️  No test message ID available");
    return false;
  }

  try {
    const response = await axios.delete(
      `${BASE_URL}/system-messages/bell-notifications/${testMessageId}`,
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    console.log("✅ Bell notification removed");
    console.log("ℹ️  System message should still be accessible");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to remove bell notification:",
      error.response?.data?.message
    );
    return false;
  }
}

async function testParticipantCannotCreate() {
  console.log(
    "\n🚫 Testing Participant Cannot Create Messages (Requirement 4)..."
  );

  // Login as participant
  const participantToken = await loginUser("testparticipant", "TestPass123!");
  if (!participantToken) {
    console.log("⚠️  Could not login as participant");
    return false;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/system-messages`,
      {
        title: "Unauthorized Message",
        content: "This should fail",
        type: "announcement",
        priority: "low",
      },
      {
        ...testConfig,
        headers: {
          ...testConfig.headers,
          Authorization: `Bearer ${participantToken}`,
        },
      }
    );

    console.log(
      "❌ Participant was able to create message (this should not happen)"
    );
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log("✅ Participant correctly blocked from creating messages");
      return true;
    } else {
      console.error("❌ Unexpected error:", error.response?.data?.message);
      return false;
    }
  }
}

async function runAllTests() {
  console.log("🚀 Starting System Messages Hybrid Architecture Tests");
  console.log("🎯 Testing 8 Requirements Implementation");

  try {
    // Setup
    await createTestUsers();
    authToken = await loginUser("testsuperadmin", "TestPass123!");

    if (!authToken) {
      console.error("❌ Could not get auth token");
      return;
    }

    // Run tests
    const results = [];

    results.push(await testCreateSystemMessage());
    results.push(await testGetSystemMessages());
    results.push(await testGetBellNotifications());
    results.push(await testMarkSystemMessageAsRead());
    results.push(await testGetBellNotifications()); // Check sync
    results.push(await testMarkBellNotificationAsRead());
    results.push(await testGetBellNotifications()); // Check remove button
    results.push(await testParticipantCannotCreate());
    results.push(await testDeleteSystemMessage());
    results.push(await testRemoveBellNotification());

    // Summary
    const passed = results.filter((r) => r === true).length;
    const total = results.length;

    console.log("\n📊 Test Results Summary:");
    console.log(`✅ Passed: ${passed}/${total}`);

    if (passed === total) {
      console.log(
        "🎉 All tests passed! Hybrid Architecture working correctly."
      );
    } else {
      console.log("⚠️  Some tests failed. Check the output above.");
    }
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
  }
}

// Run tests
runAllTests().catch(console.error);
