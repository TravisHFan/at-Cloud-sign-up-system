const axios = require("axios");

async function testProfileUpdate() {
  try {
    console.log("🧪 Testing profile update endpoint...");

    // First login to get a token
    const loginResponse = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "superadmin",
        password: "SuperAdmin123!",
      }
    );

    if (loginResponse.data.success) {
      const token = loginResponse.data.data.accessToken;
      console.log("✅ Login successful");

      // Test profile update with various field combinations that might cause issues
      console.log("\n🔄 Testing profile update with various fields...");

      const testCases = [
        {
          name: "Basic fields",
          data: {
            firstName: "Super Updated",
            lastName: "Administrator Updated",
            occupation: "Updated Pastor",
          },
        },
        {
          name: "With email (should be ignored)",
          data: {
            firstName: "Super",
            lastName: "Administrator",
            email: "new-email@example.com",
          },
        },
        {
          name: "With empty string values",
          data: {
            firstName: "",
            lastName: "",
            phone: "",
            occupation: "",
          },
        },
        {
          name: "With notification preferences",
          data: {
            firstName: "Super",
            lastName: "Administrator",
            emailNotifications: false,
            smsNotifications: true,
            pushNotifications: false,
          },
        },
        {
          name: "With flexible phone format",
          data: {
            firstName: "Super",
            lastName: "Administrator",
            phone: "+1 (234) 567-8900",
          },
        },
        {
          name: "With @Cloud leader info",
          data: {
            firstName: "Super",
            lastName: "Administrator",
            isAtCloudLeader: true,
            roleInAtCloud: "Senior Pastor",
          },
        },
      ];

      for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        try {
          const updateResponse = await axios.put(
            "http://localhost:5001/api/v1/users/profile",
            testCase.data,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log("✅ Success");
        } catch (updateError) {
          console.log("❌ Failed:");
          console.log("Status:", updateError.response?.status);
          console.log(
            "Error:",
            JSON.stringify(updateError.response?.data, null, 2)
          );
        }
      }
    } else {
      console.log("❌ Login failed:", loginResponse.data.message);
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.log("⏳ Rate limited - please wait a moment and try again");
    } else {
      console.log("❌ Error:", error.response?.data || error.message);
    }
  }
}

testProfileUpdate();
