require("dotenv").config();
const mongoose = require("mongoose");

async function verifySchema() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud"
    );
    console.log("📊 MongoDB User Schema Verification");

    const User = mongoose.model(
      "User",
      new mongoose.Schema({}, { strict: false })
    );
    const users = await User.find({}).limit(1);

    if (users.length > 0) {
      const user = users[0];
      console.log("✅ Sample User Fields:");
      console.log("- Username:", user.username);
      console.log("- Email:", user.email);
      console.log("- Role:", user.role);
      console.log("- EmailNotifications:", user.emailNotifications);
      console.log("- SmsNotifications:", user.smsNotifications);
      console.log("- PushNotifications:", user.pushNotifications);
      console.log("- IsAtCloudLeader:", user.isAtCloudLeader);
      console.log("- Ministry:", user.ministry);
      console.log("- ChurchName:", user.churchName);
      console.log("- IsVerified:", user.isVerified);
      console.log("- Avatar:", user.avatar);
      console.log("- Phone:", user.phone);

      // Check all required fields are present
      const requiredFields = [
        "emailNotifications",
        "smsNotifications",
        "pushNotifications",
        "isAtCloudLeader",
        "ministry",
        "churchName",
        "avatar",
        "bio",
        "location",
        "phone",
        "dateOfBirth",
        "gender",
        "emergencyContact",
        "dietaryRestrictions",
        "specialNeeds",
        "lastLoginAt",
        "loginCount",
        "failedLoginAttempts",
      ];

      const missingFields = requiredFields.filter(
        (field) => user[field] === undefined
      );

      if (missingFields.length === 0) {
        console.log("🎉 All required fields are present!");
      } else {
        console.log("⚠️  Missing fields:", missingFields);
      }
    }

    console.log("🎯 Total users in collection:", await User.countDocuments());

    await mongoose.connection.close();
    console.log("✅ Verification complete");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifySchema();
