// Debug script to check notification issues
console.log("🔍 Debugging notification issues...");

// Function to safely log notification data
function debugNotifications() {
  // Try to get notification data from the app
  const notificationElements = document.querySelectorAll(
    "[data-notification-id]"
  );
  console.log("📋 Notification elements found:", notificationElements.length);

  notificationElements.forEach((element, index) => {
    const notificationId = element.getAttribute("data-notification-id");
    console.log(`📝 Notification ${index + 1}:`, {
      id: notificationId,
      element: element,
      innerHTML: element.innerHTML,
      textContent: element.textContent,
      classList: element.classList.toString(),
    });
  });

  // Check for notification dropdown
  const bellButton = document.querySelector(
    'button[class*="bell" i], button:has(svg[class*="bell" i])'
  );
  if (bellButton) {
    console.log("🔔 Bell button found:", bellButton);

    // Check for notification count badge
    const badge = bellButton.querySelector('[class*="bg-red"], .absolute');
    if (badge) {
      console.log("🔢 Notification count badge:", badge.textContent);
    }
  }

  // Check for empty notifications
  const emptyNotifications = Array.from(
    document.querySelectorAll('[class*="notification"]')
  ).filter((el) => {
    const text = el.textContent?.trim();
    return !text || text.length < 5;
  });

  if (emptyNotifications.length > 0) {
    console.log(
      "⚠️ Empty or minimal content notifications found:",
      emptyNotifications
    );
  }

  // Try to access React dev tools data if available
  if (window.React) {
    console.log("⚛️ React detected, checking for component state...");
  }

  return {
    totalElements: notificationElements.length,
    emptyNotifications: emptyNotifications.length,
    bellButton: !!bellButton,
  };
}

// Run the debug
const results = debugNotifications();
console.log("📊 Debug results:", results);

// Set up a watcher for new notifications
if (!window._notificationDebugWatcher) {
  window._notificationDebugWatcher = true;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        const hasNotificationNodes = Array.from(mutation.addedNodes).some(
          (node) => {
            return (
              node.nodeType === 1 &&
              (node.classList?.contains("notification") ||
                node.innerHTML?.includes("notification") ||
                node.innerHTML?.includes("bell"))
            );
          }
        );

        if (hasNotificationNodes) {
          console.log(
            "🔄 New notification elements detected, re-running debug..."
          );
          setTimeout(debugNotifications, 100);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("👀 Notification watcher set up");
}
