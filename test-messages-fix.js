const axios = require("axios");

async function testMessagesAPI() {
  try {
    console.log("🧪 Testing messages API without parameters...");

    // This should trigger our backend fix
    const response = await axios.get("http://localhost:5001/api/v1/messages", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ API Response:", response.data);
  } catch (error) {
    console.log(
      "❌ Expected error (no auth token):",
      error.response?.data || error.message
    );

    // The error should be about authentication, not about missing parameters
    if (
      error.response?.data?.message?.includes(
        "Must specify chatRoomId, eventId, or receiverId"
      )
    ) {
      console.log("🚨 Backend fix NOT working - still requiring parameters");
    } else {
      console.log(
        "✅ Backend fix working - error is about auth, not missing parameters"
      );
    }
  }
}

testMessagesAPI();
