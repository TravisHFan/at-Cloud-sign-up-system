const http = require("http");

console.log("🧪 Testing Messages API Fix...");

const options = {
  hostname: "localhost",
  port: 5001,
  path: "/api/v1/messages",
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = http.request(options, (res) => {
  console.log(`✅ Status Code: ${res.statusCode}`);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);
      console.log("📨 API Response:", response);

      // Check if the error is about authentication vs missing parameters
      if (
        response.message &&
        response.message.includes(
          "Must specify chatRoomId, eventId, or receiverId"
        )
      ) {
        console.log("🚨 Backend fix NOT working - still requiring parameters");
      } else if (
        response.message &&
        (response.message.includes("token") ||
          response.message.includes("auth"))
      ) {
        console.log(
          "✅ Backend fix working - error is about auth, not missing parameters"
        );
      } else {
        console.log(
          "🎉 Unexpected response - this might be working correctly!"
        );
      }
    } catch (e) {
      console.log("📄 Raw response:", data);
    }
  });
});

req.on("error", (e) => {
  console.error("❌ Request failed:", e.message);
});

req.end();
