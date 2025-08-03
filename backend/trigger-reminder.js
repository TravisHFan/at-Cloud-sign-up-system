/**
 * Manually trigger the EventReminderScheduler to test reminder processing
 */

const axios = require("axios");

async function triggerReminder() {
  try {
    console.log("🚀 Manually triggering EventReminderScheduler...\n");

    // Call the manual trigger endpoint
    const response = await axios.post(
      "http://localhost:5001/api/v1/email-notifications/schedule-reminder",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Response status:", response.status);
    console.log("📋 Response data:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error triggering reminder:",
      error.response?.data || error.message
    );
  }
}

triggerReminder();
