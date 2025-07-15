const axios = require("axios");

async function testSystemAuthorizationLevel() {
  try {
    console.log("🧪 Testing System Authorization Level in Profile");
    console.log("=================================================\n");

    // Test with different users to see their authorization levels
    const testUsers = [
      {
        name: "Super Admin",
        email: "superadmin@atcloud.org",
        password: "SuperAdmin123!",
      },
      {
        name: "Administrator",
        email: "john.doe@atcloud.org",
        password: "AdminPass123!",
      },
      {
        name: "Leader",
        email: "sarah.johnson@atcloud.org",
        password: "LeaderPass123!",
      },
      {
        name: "Participant",
        email: "emily.davis@gmail.com",
        password: "Participant123!",
      },
    ];

    for (const user of testUsers) {
      console.log(`📋 Testing ${user.name} Authorization Level`);

      try {
        // Login
        const loginResponse = await axios.post(
          "http://localhost:5001/api/v1/auth/login",
          {
            emailOrUsername: user.email,
            password: user.password,
          }
        );

        if (!loginResponse.data.success) {
          console.log(
            `❌ Login failed for ${user.name}:`,
            loginResponse.data.message
          );
          continue;
        }

        const token = loginResponse.data.data.accessToken;
        const loginUser = loginResponse.data.data.user;

        console.log(`✅ ${user.name} logged in successfully`);
        console.log(`   Login Response Role: ${loginUser.role}`);

        // Get profile
        const profileResponse = await axios.get(
          "http://localhost:5001/api/v1/users/profile",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const profileUser = profileResponse.data.data.user;

        console.log(`📊 Profile Response for ${user.name}:`);
        console.log(`   - ID: ${profileUser.id}`);
        console.log(`   - Username: ${profileUser.username}`);
        console.log(`   - Email: ${profileUser.email}`);
        console.log(
          `   - System Authorization Level: ${profileUser.role || "MISSING!"}`
        );
        console.log(`   - @Cloud Leader: ${profileUser.isAtCloudLeader}`);
        console.log(
          `   - Role in @Cloud: ${profileUser.roleInAtCloud || "N/A"}`
        );

        if (!profileUser.role) {
          console.log(`❌ ISSUE: Role field is missing from profile response!`);
        } else {
          console.log(`✅ Role field present: "${profileUser.role}"`);
        }

        console.log(""); // Empty line for readability
      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`⏳ Rate limited for ${user.name} - skipping`);
        } else {
          console.log(
            `❌ Error testing ${user.name}:`,
            error.response?.data?.message || error.message
          );
        }
        console.log(""); // Empty line for readability
      }
    }

    console.log("🎯 Analysis Complete");
    console.log("\n💡 Expected Authorization Levels:");
    console.log("   - Super Admin: Full system access");
    console.log("   - Administrator: Admin privileges");
    console.log("   - Leader: Leadership privileges");
    console.log("   - Participant: Basic user access");
  } catch (error) {
    console.log("❌ Test failed:", error.message);
  }
}

testSystemAuthorizationLevel();
