/**
 * Debug script for co-organizer notifications
 */
import { EmailRecipientUtils } from "./src/utils/emailRecipientUtils";
import { Event, User } from "./src/models/index";
import { UnifiedMessageController } from "./src/controllers/unifiedMessageController";
import mongoose from "mongoose";

async function debugCoOrganizerNotifications() {
  try {
    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("✅ Connected to MongoDB");

    // Test event ID
    const eventId = "6889abdb33f5ce4cc613388e";
    const event = await Event.findById(eventId);

    if (!event) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`📋 Testing event: ${event.title}`);
    console.log(`👤 Main organizer ID: ${event.createdBy}`);
    console.log(
      `👥 Organizer details count: ${event.organizerDetails?.length || 0}`
    );

    // Test step 1: Check EmailRecipientUtils.getEventCoOrganizers
    console.log("\n🔍 Step 1: Testing getEventCoOrganizers...");
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);
    console.log(`📧 Found ${coOrganizers.length} co-organizers:`);
    coOrganizers.forEach((coOrg, index) => {
      console.log(
        `  ${index + 1}. ${coOrg.firstName} ${coOrg.lastName} (${coOrg.email})`
      );
    });

    if (coOrganizers.length === 0) {
      console.log("⚠️  No co-organizers found. Checking potential issues...");

      // Check each organizer detail
      if (event.organizerDetails) {
        for (const [index, org] of event.organizerDetails.entries()) {
          console.log(
            `   Organizer ${index + 1}: ${org.name} (userId: ${org.userId})`
          );

          if (org.userId) {
            const user = await User.findById(org.userId).select(
              "email firstName lastName isActive isVerified emailNotifications"
            );
            if (user) {
              console.log(
                `     - User found: ${user.firstName} ${user.lastName} (${user.email})`
              );
              console.log(
                `     - isActive: ${user.isActive}, isVerified: ${user.isVerified}, emailNotifications: ${user.emailNotifications}`
              );
              console.log(
                `     - Is main organizer: ${
                  org.userId.toString() === event.createdBy.toString()
                }`
              );
            } else {
              console.log(`     - ❌ User not found for userId: ${org.userId}`);
            }
          } else {
            console.log(`     - ❌ No userId found`);
          }
        }
      }
    }

    // Test step 2: Test createTargetedSystemMessage directly
    if (coOrganizers.length > 0) {
      console.log("\n🔍 Step 2: Testing createTargetedSystemMessage...");

      const testCoOrganizer = coOrganizers[0];
      const coOrganizerUser = await User.findOne({
        email: testCoOrganizer.email,
      }).select("_id");

      if (coOrganizerUser) {
        console.log(`📝 Creating test message for: ${testCoOrganizer.email}`);

        try {
          const result =
            await UnifiedMessageController.createTargetedSystemMessage(
              {
                title: `TEST: Co-Organizer Assignment: ${event.title}`,
                content: `This is a test message for debugging co-organizer notifications.`,
                type: "assignment",
                priority: "high",
              },
              [(coOrganizerUser._id as any).toString()],
              {
                id: "system",
                firstName: "Debug",
                lastName: "System",
                username: "debug",
                gender: "male",
                authLevel: "Super Admin",
                roleInAtCloud: "System",
              }
            );

          console.log(`✅ Test message created with ID: ${result._id}`);
        } catch (error) {
          console.error(`❌ Failed to create test message:`, error);
        }
      } else {
        console.log(
          `❌ Could not find user for email: ${testCoOrganizer.email}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

debugCoOrganizerNotifications();
