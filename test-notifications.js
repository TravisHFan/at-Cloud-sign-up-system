// Simple notification test script
console.log("🧪 Testing notification functionality...");

// Function to test notifications after login
function testNotifications() {
  // Look for the notification bell
  const bellButton = document.querySelector(
    'button[class*="relative"][class*="p-2"]'
  );

  if (!bellButton) {
    console.error("❌ Notification bell button not found");
    return;
  }

  console.log("🔔 Found notification bell button");

  // Get the notification count
  const badge = bellButton.querySelector('span[class*="bg-red-500"]');
  const notificationCount = badge ? badge.textContent : "0";
  console.log(`📊 Notification count: ${notificationCount}`);

  // Click the bell to open dropdown
  console.log("👆 Opening notification dropdown...");
  bellButton.click();

  // Wait for dropdown to appear
  setTimeout(() => {
    const dropdown = document.querySelector(
      'div[class*="absolute"][class*="right-0"][class*="mt-2"]'
    );

    if (!dropdown) {
      console.error("❌ Notification dropdown not found");
      return;
    }

    console.log("✅ Notification dropdown opened");

    // Count notifications
    const notifications = dropdown.querySelectorAll(
      'div[class*="px-4"][class*="py-3"]'
    );
    console.log(`📋 Found ${notifications.length} notification items`);

    // Test each notification
    notifications.forEach((notification, index) => {
      const titleElement = notification.querySelector(
        'p[class*="font-medium"]'
      );
      const messageElement = notification.querySelector(
        'p[class*="text-gray-500"]'
      );

      const title = titleElement?.textContent?.trim() || "";
      const message = messageElement?.textContent?.trim() || "";

      console.log(`📝 Notification ${index + 1}:`);
      console.log(`   Title: "${title}"`);
      console.log(`   Message: "${message}"`);
      console.log(`   Empty: ${!title && !message}`);

      if (!title && !message) {
        console.error(`❌ Empty notification detected at index ${index + 1}`);
      }
    });

    // Test clicking a notification
    if (notifications.length > 0) {
      console.log("🔗 Testing notification click...");
      const firstNotification = notifications[0];
      const clickableArea = firstNotification.querySelector(
        'div[class*="cursor-pointer"]'
      );

      if (clickableArea) {
        console.log("👆 Clicking first notification...");
        clickableArea.click();
      } else {
        console.warn("⚠️ No clickable area found in notification");
      }
    }
  }, 500);
}

// Auto-run test after page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(testNotifications, 2000);
  });
} else {
  setTimeout(testNotifications, 2000);
}

console.log("🚀 Notification test script loaded. Test will run in 2 seconds.");

// Export for manual testing
window.testNotifications = testNotifications;
