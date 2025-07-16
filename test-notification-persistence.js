// Test script for notification persistence fixes
console.log("🧪 Testing notification persistence fixes...");

let authToken = null;

async function testNotificationPersistence() {
  try {
    // Step 1: Login
    console.log("🔐 Step 1: Logging in...");
    const loginResponse = await fetch(
      "http://localhost:5001/api/v1/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "johndoe",
          password: "password123",
        }),
      }
    );

    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }

    authToken = loginData.data.token;
    console.log("✅ Login successful");

    // Step 2: Get initial notifications
    console.log("📊 Step 2: Getting initial notifications...");
    const initialNotificationsResponse = await fetch(
      "http://localhost:5001/api/v1/notifications",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const initialNotifications = await initialNotificationsResponse.json();
    const chatNotifications =
      initialNotifications.data?.notifications?.filter(
        (n) => n.type === "CHAT_MESSAGE" && !n.isRead
      ) || [];

    console.log(
      `📋 Found ${chatNotifications.length} unread chat notifications`
    );

    if (chatNotifications.length === 0) {
      console.log("ℹ️ No unread chat notifications to test with");
      return;
    }

    const testNotification = chatNotifications[0];
    console.log(
      `🎯 Testing with notification: ${testNotification.id} (${testNotification.title})`
    );

    // Step 3: Mark notification as read
    console.log("✅ Step 3: Marking notification as read...");
    const markReadResponse = await fetch(
      `http://localhost:5001/api/v1/notifications/${testNotification.id}/read`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const markReadData = await markReadResponse.json();
    if (!markReadData.success) {
      throw new Error(`Failed to mark as read: ${markReadData.message}`);
    }
    console.log("✅ Notification marked as read successfully");

    // Step 4: Verify notification is marked as read
    console.log("🔍 Step 4: Verifying notification is marked as read...");
    const verifyResponse = await fetch(
      "http://localhost:5001/api/v1/notifications",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const verifyData = await verifyResponse.json();
    const updatedNotification = verifyData.data?.notifications?.find(
      (n) => n.id === testNotification.id
    );

    if (updatedNotification && updatedNotification.isRead) {
      console.log("✅ Notification correctly marked as read");
    } else {
      console.error("❌ Notification not marked as read");
    }

    // Step 5: Delete notification
    console.log("🗑️ Step 5: Deleting notification...");
    const deleteResponse = await fetch(
      `http://localhost:5001/api/v1/notifications/${testNotification.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const deleteData = await deleteResponse.json();
    if (!deleteData.success) {
      throw new Error(`Failed to delete: ${deleteData.message}`);
    }
    console.log("✅ Notification deleted successfully");

    // Step 6: Verify notification is deleted
    console.log("🔍 Step 6: Verifying notification is deleted...");
    const finalResponse = await fetch(
      "http://localhost:5001/api/v1/notifications",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const finalData = await finalResponse.json();
    const deletedNotification = finalData.data?.notifications?.find(
      (n) => n.id === testNotification.id
    );

    if (!deletedNotification) {
      console.log("✅ Notification correctly deleted");
    } else {
      console.error("❌ Notification still exists after deletion");
    }

    console.log("🎉 All tests completed successfully!");
  } catch (error) {
    console.error("💥 Test failed:", error.message);
  }
}

// Test button integration
const testButton = document.createElement("button");
testButton.textContent = "Test Notification Persistence";
testButton.className =
  "bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 m-4";
testButton.onclick = testNotificationPersistence;

// Add to page
document.body.appendChild(testButton);

console.log(
  "🚀 Notification persistence test loaded. Click the test button to run."
);

// Also export for console use
window.testNotificationPersistence = testNotificationPersistence;
