/**
 * Test script to verify the bell notification persistence
 * This script will:
 * 1. Login as a user
 * 2. Send a message to another user (creates a notification)
 * 3. Check if the notification is persisted in the database
 */

const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

// Test users
const SENDER = {
  username: "mike_wilson",
  password: "password123",
};

const RECEIVER = {
  username: "john_doe",
  password: "password123",
};

let senderToken = "";
let receiverToken = "";

async function login(credentials) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, credentials);
    if (response.data.success) {
      console.log(`✅ Login successful for ${credentials.username}`);
      return response.data.token;
    } else {
      console.error(
        `❌ Login failed for ${credentials.username}:`,
        response.data.message
      );
      return null;
    }
  } catch (error) {
    console.error(
      `❌ Login error for ${credentials.username}:`,
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function sendMessage(token, receiverId, message) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        content: message,
        receiverId: receiverId,
        messageType: "text",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.data.success) {
      console.log("✅ Message sent successfully");
      return response.data.data;
    } else {
      console.error("❌ Failed to send message:", response.data.message);
      return null;
    }
  } catch (error) {
    console.error(
      "❌ Message send error:",
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function getNotifications(token) {
  try {
    const response = await axios.get(`${BASE_URL}/user/notifications/bell`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success) {
      console.log(
        `✅ Retrieved ${response.data.data.notifications.length} notifications`
      );
      return response.data.data.notifications;
    } else {
      console.error("❌ Failed to get notifications:", response.data.message);
      return [];
    }
  } catch (error) {
    console.error(
      "❌ Get notifications error:",
      error.response?.data?.message || error.message
    );
    return [];
  }
}

async function getUserId(token) {
  try {
    const response = await axios.get(`${BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success) {
      return response.data.data.user._id || response.data.data.user.id;
    }
    return null;
  } catch (error) {
    console.error(
      "❌ Get user profile error:",
      error.response?.data?.message || error.message
    );
    return null;
  }
}

async function testNotificationPersistence() {
  console.log("🧪 Testing Bell Notification Persistence...\n");

  // Step 1: Login both users
  console.log("📝 Step 1: Logging in users...");
  senderToken = await login(SENDER);
  receiverToken = await login(RECEIVER);

  if (!senderToken || !receiverToken) {
    console.error("❌ Failed to login users. Test aborted.");
    return;
  }

  // Step 2: Get user IDs
  console.log("\n📝 Step 2: Getting user IDs...");
  const senderId = await getUserId(senderToken);
  const receiverId = await getUserId(receiverToken);

  if (!senderId || !receiverId) {
    console.error("❌ Failed to get user IDs. Test aborted.");
    return;
  }

  console.log(`Sender ID: ${senderId}`);
  console.log(`Receiver ID: ${receiverId}`);

  // Step 3: Check initial notifications for receiver
  console.log("\n📝 Step 3: Checking initial notifications for receiver...");
  const initialNotifications = await getNotifications(receiverToken);
  console.log(`Initial notification count: ${initialNotifications.length}`);

  // Step 4: Send a message (this should create a notification)
  console.log("\n📝 Step 4: Sending message to create notification...");
  const message = `Test message for bell notification persistence - ${new Date().toISOString()}`;
  const messageResult = await sendMessage(senderToken, receiverId, message);

  if (!messageResult) {
    console.error("❌ Failed to send message. Test aborted.");
    return;
  }

  // Step 5: Wait a moment for notification to be created
  console.log("\n📝 Step 5: Waiting for notification to be processed...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 6: Check notifications again
  console.log("\n📝 Step 6: Checking notifications after message...");
  const finalNotifications = await getNotifications(receiverToken);
  console.log(`Final notification count: ${finalNotifications.length}`);

  // Step 7: Verify the notification was created
  const newNotifications = finalNotifications.filter(
    (n) => !initialNotifications.some((initial) => initial._id === n._id)
  );

  console.log(`\n📊 Test Results:`);
  console.log(`- Initial notifications: ${initialNotifications.length}`);
  console.log(`- Final notifications: ${finalNotifications.length}`);
  console.log(`- New notifications: ${newNotifications.length}`);

  if (newNotifications.length > 0) {
    console.log("✅ SUCCESS: Bell notification was created and persisted!");
    console.log("📋 New notification details:");
    newNotifications.forEach((notification) => {
      console.log(`  - ID: ${notification._id}`);
      console.log(`  - Type: ${notification.type}`);
      console.log(`  - Title: ${notification.title}`);
      console.log(`  - Message: ${notification.message}`);
      console.log(`  - Read: ${notification.isRead}`);
      console.log(`  - Created: ${notification.createdAt}`);
    });
  } else {
    console.log("❌ FAILURE: No new notification was created!");
  }

  console.log(
    "\n🔄 To test persistence, refresh your browser and check if the notification is still there!"
  );
}

// Run the test
testNotificationPersistence().catch(console.error);
