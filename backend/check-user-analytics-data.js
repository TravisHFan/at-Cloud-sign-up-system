#!/usr/bin/env node

/**
 * Check user data in database for church and occupation statistics
 */

const mongoose = require("mongoose");

async function checkUserData() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to atcloud-signup database");

    // Get the users collection directly
    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`\n📋 Found ${users.length} users in database:`);

    let hasOccupation = 0;
    let hasCompany = 0;
    let hasWeeklyChurch = 0;
    let hasChurchAddress = 0;

    users.forEach((user, index) => {
      console.log(
        `\n${index + 1}. User: ${user.firstName} ${user.lastName} (${
          user.email
        })`
      );
      console.log(`   - occupation: ${user.occupation || "EMPTY ❌"}`);
      console.log(`   - company: ${user.company || "EMPTY ❌"}`);
      console.log(`   - weeklyChurch: ${user.weeklyChurch || "EMPTY ❌"}`);
      console.log(`   - churchAddress: ${user.churchAddress || "EMPTY ❌"}`);

      if (user.occupation) hasOccupation++;
      if (user.company) hasCompany++;
      if (user.weeklyChurch) hasWeeklyChurch++;
      if (user.churchAddress) hasChurchAddress++;
    });

    console.log(`\n📊 Statistics Summary:`);
    console.log(`   Users with occupation: ${hasOccupation}/${users.length}`);
    console.log(`   Users with company: ${hasCompany}/${users.length}`);
    console.log(
      `   Users with weeklyChurch: ${hasWeeklyChurch}/${users.length}`
    );
    console.log(
      `   Users with churchAddress: ${hasChurchAddress}/${users.length}`
    );

    if (hasOccupation === 0 && hasWeeklyChurch === 0) {
      console.log(
        `\n⚠️ NO DATA FOUND! This explains why analytics show all 0s.`
      );
      console.log(
        `   The users don't have church or occupation information populated.`
      );
    } else {
      console.log(
        `\n✅ Data exists! The issue might be in the frontend processing.`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkUserData();
