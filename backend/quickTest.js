const mongoose = require("mongoose");
const axios = require("axios");

async function testMessageTargeting() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");

    // Login as Lisa
    const lisaLogin = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "lisa@atcloud.com",
        password: "password123",
      }
    );
    const lisaToken = lisaLogin.data.data.accessToken;
    const lisaUserId = lisaLogin.data.data.user.id;
    console.log("Lisa User ID:", lisaUserId);

    // Get Lisa's messages
    const lisaMessages = await axios.get(
      "http://localhost:5001/api/v1/system-messages",
      {
        headers: { Authorization: `Bearer ${lisaToken}` },
      }
    );

    console.log("\nLisa's Messages:");
    lisaMessages.data.data.systemMessages.forEach((msg) => {
      console.log(`- "${msg.title}" (target: ${msg.targetUserId})`);
    });

    // Login as Sarah
    const sarahLogin = await axios.post(
      "http://localhost:5001/api/v1/auth/login",
      {
        emailOrUsername: "sarah@atcloud.com",
        password: "password123",
      }
    );
    const sarahToken = sarahLogin.data.data.accessToken;
    const sarahUserId = sarahLogin.data.data.user.id;
    console.log("\nSarah User ID:", sarahUserId);

    // Get Sarah's messages
    const sarahMessages = await axios.get(
      "http://localhost:5001/api/v1/system-messages",
      {
        headers: { Authorization: `Bearer ${sarahToken}` },
      }
    );

    console.log("\nSarah's Messages:");
    sarahMessages.data.data.systemMessages.forEach((msg) => {
      console.log(`- "${msg.title}" (target: ${msg.targetUserId})`);
    });

    // Check if there's cross-contamination
    const lisaWelcomeInSarahList = sarahMessages.data.data.systemMessages.find(
      (msg) => msg.targetUserId === lisaUserId
    );

    if (lisaWelcomeInSarahList) {
      console.log("\n❌ BUG FOUND: Sarah can see Lisa's targeted message!");
    } else {
      console.log("\n✅ PRIVACY OK: Sarah cannot see Lisa's targeted messages");
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testMessageTargeting();
