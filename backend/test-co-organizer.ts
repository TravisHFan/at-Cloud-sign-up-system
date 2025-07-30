/**
 * Test script to verify co-organizer notifications functionality
 */

import { EmailRecipientUtils } from "./src/utils/emailRecipientUtils";
import { Event } from "./src/models/index";
import mongoose from "mongoose";

async function testCoOrganizerFunction() {
  try {
    // Connect to database (using environment variables from .env)
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/atcloud-signup-system"
    );
    console.log("✅ Connected to MongoDB");

    // Get a test event
    const eventId = "6889abdb33f5ce4cc613388e";
    const event = await Event.findById(eventId);

    if (!event) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`📋 Testing event: ${event.title}`);
    console.log(`👤 Main organizer ID: ${event.createdBy}`);
    console.log(
      `👥 Organizer details:`,
      event.organizerDetails?.map((org) => ({
        userId: org.userId,
        name: org.name,
        role: org.role,
      }))
    );

    // Test the getEventCoOrganizers function
    console.log("\n🔍 Testing getEventCoOrganizers function...");
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);

    console.log(`📧 Found ${coOrganizers.length} co-organizers:`);
    coOrganizers.forEach((coOrg, index) => {
      console.log(
        `  ${index + 1}. ${coOrg.firstName} ${coOrg.lastName} (${coOrg.email})`
      );
    });

    if (coOrganizers.length === 0) {
      console.log(
        "ℹ️  Note: Either no co-organizers found, or they are the main organizer, or they don't have email notifications enabled"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

testCoOrganizerFunction();
