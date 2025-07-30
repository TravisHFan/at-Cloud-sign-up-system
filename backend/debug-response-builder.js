const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment
dotenv.config();

// Import models and services
const { User, Event } = require("./dist/models");
const {
  ResponseBuilderService,
} = require("./dist/services/ResponseBuilderService");

async function debugResponseBuilderService() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find a user to test with
    const users = await User.find({ isActive: true }).limit(3);
    if (users.length < 3) {
      throw new Error("Need at least 3 users for testing");
    }

    console.log("\n👥 Test users found:");
    users.forEach((user, index) => {
      console.log(
        `  User ${index + 1}: ${user.firstName} ${user.lastName} (${
          user.email
        }) - ID: ${user._id}`
      );
    });

    // Create a test event directly in database
    const testEvent = new Event({
      title: "DEBUG RESPONSE BUILDER TEST",
      description: "Testing ResponseBuilderService",
      date: "2024-12-25",
      time: "14:00",
      endTime: "16:00",
      location: "Test Location",
      type: "Workshop",
      organizer: `${users[0].firstName} ${users[0].lastName}`,
      organizerDetails: [
        {
          userId: users[0]._id, // This should be a proper ObjectId
          name: `${users[0].firstName} ${users[0].lastName}`,
          role: "Main Organizer",
          email: "placeholder@example.com", // This should get replaced
          phone: "555-0001",
          gender: users[0].gender || "male",
        },
        {
          userId: users[1]._id, // This should be a proper ObjectId
          name: `${users[1].firstName} ${users[1].lastName}`,
          role: "Co-Organizer",
          email: "placeholder@example.com", // This should get replaced
          phone: "555-0002",
          gender: users[1].gender || "male",
        },
        {
          userId: users[2]._id, // This should be a proper ObjectId
          name: `${users[2].firstName} ${users[2].lastName}`,
          role: "Co-Organizer",
          email: "placeholder@example.com", // This should get replaced
          phone: "555-0003",
          gender: users[2].gender || "female",
        },
      ],
      createdBy: users[0]._id,
      purpose: "Testing ResponseBuilderService debug",
      format: "In-person",
      roles: [
        {
          id: "debug-role-1",
          name: "Debug Participant",
          description: "Debug role for testing",
          maxParticipants: 10,
        },
      ],
      signedUp: 0,
      totalSlots: 10,
    });

    await testEvent.save();
    console.log(`\n📅 Created test event with ID: ${testEvent._id}`);

    // Check raw organizer details
    console.log("\n🔍 Raw organizer details from database:");
    testEvent.organizerDetails.forEach((org, index) => {
      console.log(`  Organizer ${index + 1}:`, {
        userId: org.userId,
        userIdType: typeof org.userId,
        email: org.email,
        name: org.name,
        role: org.role,
      });
    });

    console.log(
      "\n🔄 Testing ResponseBuilderService.buildEventWithRegistrations..."
    );
    const populatedEvent =
      await ResponseBuilderService.buildEventWithRegistrations(
        testEvent._id.toString()
      );

    console.log("\n✅ Populated event organizer details:");
    if (populatedEvent && populatedEvent.organizerDetails) {
      populatedEvent.organizerDetails.forEach((org, index) => {
        console.log(`  Organizer ${index + 1}:`, {
          userId: org.userId,
          userIdType: typeof org.userId,
          email: org.email,
          name: org.name,
          role: org.role,
        });
      });
    } else {
      console.log("❌ No organizer details in populated event");
    }

    // Test the private method indirectly
    console.log("\n🧪 Testing fresh contact population logic...");
    for (let i = 0; i < testEvent.organizerDetails.length; i++) {
      const organizer = testEvent.organizerDetails[i];
      console.log(`\n  Testing organizer ${i + 1}:`);
      console.log(
        `    Original userId: ${organizer.userId} (${typeof organizer.userId})`
      );

      if (organizer.userId) {
        try {
          const user = await User.findById(organizer.userId).select(
            "email phone firstName lastName avatar"
          );
          if (user) {
            console.log(
              `    ✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`
            );
            console.log(
              `    📧 Email should be updated from '${organizer.email}' to '${user.email}'`
            );
          } else {
            console.log(
              `    ❌ User not found for userId: ${organizer.userId}`
            );
          }
        } catch (error) {
          console.log(`    💥 Error finding user: ${error.message}`);
        }
      } else {
        console.log(`    ⚠️  No userId found`);
      }
    }

    // Cleanup
    await Event.findByIdAndDelete(testEvent._id);
    console.log(`\n🧹 Cleaned up test event`);
  } catch (error) {
    console.error("💥 Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

debugResponseBuilderService();
