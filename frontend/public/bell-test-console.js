console.log("🔔 Bell Notification Fix - Browser Console Test");
console.log("=".repeat(50));

// Monitor WebSocket events for bell notification updates
const originalConsoleLog = console.log;

// Intercept WebSocket messages if possible
if (window.WebSocket) {
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = new originalWebSocket(url, protocols);

    ws.addEventListener("message", function (event) {
      try {
        const data = JSON.parse(event.data);
        if (data[0] === "bell_notification_update") {
          console.log("🔔 BELL NOTIFICATION UPDATE RECEIVED:");
          console.log("   Event:", data[1].event);
          console.log("   Data:", data[1].data);

          if (data[1].event === "notification_added") {
            console.log("✅ NEW NOTIFICATION ADDED IN REAL-TIME!");
            console.log("   Title:", data[1].data.title);
            console.log("   Content:", data[1].data.content);
          }
        }
      } catch (e) {
        // Not JSON or not relevant
      }
    });

    return ws;
  };
}

// Monitor for notification context updates
let notificationUpdateCount = 0;
const checkInterval = setInterval(() => {
  const bellIcon = document.querySelector('[class*="bell"]');
  const notificationBadge = document.querySelector('[class*="bg-red-500"]');

  if (notificationBadge) {
    const currentCount = notificationBadge.textContent;
    if (currentCount && parseInt(currentCount) > notificationUpdateCount) {
      console.log(`🔔 Bell count updated to: ${currentCount}`);
      notificationUpdateCount = parseInt(currentCount);
    }
  }
}, 1000);

// Stop monitoring after 5 minutes
setTimeout(() => {
  clearInterval(checkInterval);
  console.log("🔔 Monitoring stopped after 5 minutes");
}, 5 * 60 * 1000);

console.log("📋 Instructions:");
console.log(
  "1. Now create a new notification (system message, role change, etc.)"
);
console.log("2. Watch this console for real-time updates");
console.log("3. Look for '✅ NEW NOTIFICATION ADDED IN REAL-TIME!' messages");
console.log("4. Bell count should update immediately without page refresh");

console.log("\n🔍 Monitoring bell notifications for 5 minutes...");
