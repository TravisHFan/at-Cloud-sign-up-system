#!/usr/bin/env node

/**
 * Test script to verify notification marking behavior
 * Run this to debug why notifications come back as unread after page refresh
 */

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Test configuration
const API_BASE = "http://localhost:5001/api/v1";
const TEST_USER_CREDENTIALS = {
  username: "john_doe",
  password: "password123",
};

let authToken = null;

async function authenticate() {
  console.log("🔐 Authenticating test user...");

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(TEST_USER_CREDENTIALS),
    });

    const data = await response.json();

    if (data.success && data.data?.token) {
      authToken = data.data.token;
      console.log("✅ Authentication successful");
      return true;
    } else {
      console.error("❌ Authentication failed:", data.message);
      return false;
    }
  } catch (error) {
    console.error("❌ Authentication error:", error.message);
    return false;
  }
}

async function getNotifications() {
  console.log("📥 Fetching notifications...");

  try {
    const response = await fetch(`${API_BASE}/notifications`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (data.success) {
      console.log(`📊 Found ${data.data.notifications.length} notifications`);
      console.log(`📊 Unread count: ${data.data.unreadCount}`);

      // Show details of first few notifications
      data.data.notifications.slice(0, 3).forEach((notif, index) => {
        console.log(
          `  ${index + 1}. ${notif.type} - "${notif.title}" (Read: ${
            notif.isRead
          })`
        );
      });

      return data.data.notifications;
    } else {
      console.error("❌ Failed to get notifications:", data.message);
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching notifications:", error.message);
    return [];
  }
}

async function markNotificationAsRead(notificationId) {
  console.log(`✅ Marking notification ${notificationId} as read...`);

  try {
    const response = await fetch(
      `${API_BASE}/notifications/${notificationId}/read`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("✅ Successfully marked as read");
      return true;
    } else {
      console.error("❌ Failed to mark as read:", data.message);
      return false;
    }
  } catch (error) {
    console.error("❌ Error marking notification as read:", error.message);
    return false;
  }
}

async function testNotificationPersistence() {
  console.log("\n🧪 Testing notification read status persistence...\n");

  // Step 1: Authenticate
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log("❌ Cannot continue without authentication");
    return;
  }

  // Step 2: Get current notifications
  console.log("\n--- STEP 1: Get initial notifications ---");
  const initialNotifications = await getNotifications();

  // Find an unread notification
  const unreadNotification = initialNotifications.find(
    (notif) => !notif.isRead
  );

  if (!unreadNotification) {
    console.log("⚠️ No unread notifications found. Test cannot proceed.");
    console.log("💡 Send yourself a chat message first, then run this test.");
    return;
  }

  console.log(`\n🎯 Testing with notification: "${unreadNotification.title}"`);
  console.log(`   Type: ${unreadNotification.type}`);
  console.log(`   ID: ${unreadNotification.id || unreadNotification._id}`);
  console.log(`   Currently read: ${unreadNotification.isRead}`);

  // Step 3: Mark the notification as read
  console.log("\n--- STEP 2: Mark notification as read ---");
  const notificationId = unreadNotification.id || unreadNotification._id;
  const markSuccess = await markNotificationAsRead(notificationId);

  if (!markSuccess) {
    console.log(
      "❌ Failed to mark notification as read. Test cannot continue."
    );
    return;
  }

  // Step 4: Fetch notifications again to verify it's marked as read
  console.log("\n--- STEP 3: Verify notification is marked as read ---");
  const updatedNotifications = await getNotifications();
  const updatedNotification = updatedNotifications.find(
    (notif) => (notif.id || notif._id) === notificationId
  );

  if (updatedNotification) {
    console.log(`📊 Notification status after marking as read:`);
    console.log(`   Title: "${updatedNotification.title}"`);
    console.log(`   Read: ${updatedNotification.isRead}`);
    console.log(`   Read At: ${updatedNotification.readAt || "Not set"}`);

    if (updatedNotification.isRead) {
      console.log("✅ SUCCESS: Notification is properly marked as read");
    } else {
      console.log(
        "❌ PROBLEM: Notification is still unread after marking as read"
      );
    }
  } else {
    console.log("❌ PROBLEM: Notification not found after marking as read");
  }

  // Step 5: Wait a moment and fetch again to simulate page refresh
  console.log("\n--- STEP 4: Simulate page refresh (fetch again) ---");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const refreshedNotifications = await getNotifications();
  const refreshedNotification = refreshedNotifications.find(
    (notif) => (notif.id || notif._id) === notificationId
  );

  if (refreshedNotification) {
    console.log(`📊 Notification status after "refresh":`);
    console.log(`   Title: "${refreshedNotification.title}"`);
    console.log(`   Read: ${refreshedNotification.isRead}`);
    console.log(`   Read At: ${refreshedNotification.readAt || "Not set"}`);

    if (refreshedNotification.isRead) {
      console.log(
        "✅ SUCCESS: Notification stays marked as read after refresh"
      );
      console.log(
        "🎉 The backend is working correctly! The issue might be in the frontend."
      );
    } else {
      console.log(
        "❌ PROBLEM FOUND: Notification reverted to unread after refresh"
      );
      console.log("🔍 This indicates a backend persistence issue.");
    }
  } else {
    console.log("❌ PROBLEM: Notification disappeared after refresh");
  }

  console.log("\n🏁 Test completed.");
}

// Handle missing node-fetch gracefully
async function checkDependencies() {
  try {
    require("node-fetch");
    return true;
  } catch (error) {
    console.error("❌ Missing dependency: node-fetch");
    console.log("📦 Please install it with: npm install node-fetch");
    return false;
  }
}

// Main execution
async function main() {
  console.log("🧪 Notification Read Status Persistence Test");
  console.log("=".repeat(50));

  const hasDepencencies = await checkDependencies();
  if (!hasDepencencies) {
    return;
  }

  await testNotificationPersistence();
}

main().catch(console.error);
