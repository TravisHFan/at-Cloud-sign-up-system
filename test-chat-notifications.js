// Test script for chat notification fixes
console.log("🧪 Testing chat notification fixes...");

let authToken = null;

async function testChatNotificationFlow() {
  try {
    // Step 1: Login
    console.log("🔐 Step 1: Logging in as John Doe...");
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

    // Step 2: Get current notifications
    console.log("📊 Step 2: Getting current notifications...");
    const notificationsResponse = await fetch(
      "http://localhost:5001/api/v1/notifications",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const notificationsData = await notificationsResponse.json();
    console.log("📋 Current notifications:", notificationsData);

    const chatNotifications =
      notificationsData.data?.notifications?.filter(
        (n) => n.type === "CHAT_MESSAGE"
      ) || [];

    console.log(`📨 Found ${chatNotifications.length} chat notifications`);

    // Analyze chat notifications
    chatNotifications.forEach((notification, index) => {
      console.log(`📝 Chat notification ${index + 1}:`, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        hasFromUser: !!notification.fromUser,
        fromUser: notification.fromUser,
        metadata: notification.metadata,
        type: notification.type,
      });

      if (!notification.fromUser) {
        console.warn(
          "⚠️ Chat notification missing fromUser data:",
          notification.id
        );
      }
    });

    // Step 3: Test notification rendering structure
    console.log("🎨 Step 3: Testing notification display...");

    // Wait for page to load
    setTimeout(() => {
      const bellButton = document.querySelector(
        'button[class*="relative"][class*="p-2"]'
      );
      if (bellButton) {
        console.log("🔔 Found bell button, clicking...");
        bellButton.click();

        setTimeout(() => {
          const dropdown = document.querySelector(
            'div[class*="absolute"][class*="right-0"]'
          );
          if (dropdown) {
            const notificationItems = dropdown.querySelectorAll(
              'div[class*="px-4"][class*="py-3"]'
            );
            console.log(
              `📋 Found ${notificationItems.length} notification items in dropdown`
            );

            notificationItems.forEach((item, index) => {
              const titleElement = item.querySelector(
                'p[class*="font-medium"]'
              );
              const messageElement = item.querySelector(
                'p[class*="text-gray-500"]'
              );
              const avatarElement = item.querySelector(
                'img[class*="rounded-full"]'
              );

              console.log(`📝 Notification item ${index + 1}:`, {
                title: titleElement?.textContent?.trim(),
                message: messageElement?.textContent?.trim(),
                hasAvatar: !!avatarElement,
                avatarSrc: avatarElement?.src,
                isEmpty:
                  !titleElement?.textContent?.trim() &&
                  !messageElement?.textContent?.trim(),
              });
            });
          } else {
            console.error("❌ Dropdown not found");
          }
        }, 500);
      } else {
        console.error("❌ Bell button not found");
      }
    }, 2000);

    console.log("🎉 Test completed! Check console for detailed results.");
  } catch (error) {
    console.error("💥 Test failed:", error.message);
  }
}

// Add test button to page
const testButton = document.createElement("button");
testButton.textContent = "Test Chat Notifications";
testButton.className =
  "fixed top-4 left-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 z-50";
testButton.onclick = testChatNotificationFlow;
document.body.appendChild(testButton);

console.log(
  "🚀 Chat notification test loaded. Click the green button to run test."
);

// Export for console use
window.testChatNotificationFlow = testChatNotificationFlow;
