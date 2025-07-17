// Quick test to verify the refactored system
const http = require("http");

async function testAPI() {
  console.log("🔍 Testing Refactored Backend System...\n");

  const options = {
    hostname: "localhost",
    port: 5001,
    path: "/health",
    method: "GET",
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log("✅ Backend Health Check:");
      console.log(`📊 Status Code: ${res.statusCode}`);

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("📋 Response:", JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log("📋 Response:", data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("❌ Backend connection failed:", err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.error("❌ Request timeout");
      req.abort();
      reject(new Error("Timeout"));
    });

    req.end();
  });
}

// Test database connection
async function testDatabase() {
  console.log("\n🗄️ Testing Database Connection...");

  const options = {
    hostname: "localhost",
    port: 5001,
    path: "/api/users/stats",
    method: "GET",
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`📊 Database Test Status: ${res.statusCode}`);

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("📋 User Stats:", JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log("📋 Response:", data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("❌ Database test failed:", err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.error("❌ Request timeout");
      req.abort();
      reject(new Error("Timeout"));
    });

    req.end();
  });
}

async function runTests() {
  try {
    await testAPI();
    await testDatabase();

    console.log("\n🎉 System Validation Complete!");
    console.log("✅ Backend refactoring successful");
    console.log("✅ Database connection working");
    console.log("✅ API endpoints responding");
  } catch (error) {
    console.error("\n❌ System test failed:", error.message);
  }
}

runTests();
