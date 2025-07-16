// Test script to validate notification fixes
console.log("🧪 Testing notification fixes...");

// Wait for the app to load
setTimeout(() => {
  console.log("🔍 Checking for notification elements...");

  // Look for the notification bell
  const bellButton = document.querySelector(
    'button[class*="relative"][class*="p-2"]'
  );
  if (bellButton) {
    console.log("🔔 Found bell button:", bellButton);

    // Check if there's a notification count badge
    const badge = bellButton.querySelector('span[class*="bg-red-500"]');
    if (badge) {
      console.log("🔢 Notification count:", badge.textContent);

      // Click the bell to open the dropdown
      console.log("👆 Clicking bell button...");
      bellButton.click();

      // Wait a moment for the dropdown to appear
      setTimeout(() => {
        const dropdown = document.querySelector(
          'div[class*="absolute"][class*="right-0"][class*="mt-2"]'
        );
        if (dropdown) {
          console.log("📋 Notification dropdown opened");

          // Count notification items
          const notificationItems = dropdown.querySelectorAll(
            'div[class*="flex"][class*="items-start"]'
          );
          console.log(
            `📊 Found ${notificationItems.length} notification items`
          );

          // Check each notification for content
          notificationItems.forEach((item, index) => {
            const titleElement = item.querySelector('p[class*="font-medium"]');
            const messageElement = item.querySelector(
              'p[class*="text-gray-500"]'
            );

            const title = titleElement?.textContent || "";
            const message = messageElement?.textContent || "";

            console.log(`📝 Notification ${index + 1}:`, {
              title: title.trim(),
              message: message.trim(),
              isEmpty: !title.trim() && !message.trim(),
            });
          });

          // Look for empty notifications specifically
          const emptyNotifications = Array.from(notificationItems).filter(
            (item) => {
              const titleElement = item.querySelector(
                'p[class*="font-medium"]'
              );
              const messageElement = item.querySelector(
                'p[class*="text-gray-500"]'
              );
              const title = titleElement?.textContent?.trim() || "";
              const message = messageElement?.textContent?.trim() || "";
              return !title && !message;
            }
          );

          if (emptyNotifications.length > 0) {
            console.error(
              `❌ Found ${emptyNotifications.length} empty notifications`
            );
          } else {
            console.log("✅ No empty notifications found!");
          }
        } else {
          console.log("❌ Notification dropdown not found");
        }
      }, 500);
    } else {
      console.log(
        "📭 No notification count badge found (no unread notifications)"
      );
    }
  } else {
    console.log("❌ Bell button not found");
  }
}, 2000);

console.log("⏱️ Test will run in 2 seconds...");
