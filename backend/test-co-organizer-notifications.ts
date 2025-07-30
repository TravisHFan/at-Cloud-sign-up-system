import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Event, Registration, Message } from "./src/models";
import { EmailRecipientUtils } from "./src/utils/emailRecipientUtils";
import { UnifiedMessageController } from "./src/controllers/unifiedMessageController";
import { ResponseBuilderService } from "./src/services/ResponseBuilderService";

// Load environment variables
dotenv.config();

interface TestResults {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

class CoOrganizerNotificationTester {
  private results: TestResults[] = [];
  private testEventId: string = "";
  private mainOrganizerId: string = "";
  private coOrganizerIds: string[] = [];
  private messageChecks: any[] = [];
  private bellNotificationChecks: any[] = [];

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI!);
      console.log("✅ Connected to MongoDB");
      this.logResult("Database Connection", true);
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error);
      this.logResult(
        "Database Connection",
        false,
        undefined,
        (error as Error).message
      );
      process.exit(1);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }

  private logResult(
    step: string,
    success: boolean,
    data?: any,
    error?: string
  ) {
    this.results.push({ step, success, data, error });
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${step}: ${success ? "PASS" : "FAIL"}`);
    if (error) console.log(`   Error: ${error}`);
    if (data) console.log(`   Data:`, JSON.stringify(data, null, 2));
  }

  async setupTestData() {
    console.log("\n🔧 Setting up test data...");

    try {
      // Find existing users to use as organizers
      const users = await User.find({
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      }).limit(3);

      if (users.length < 3) {
        throw new Error("Need at least 3 active users for testing");
      }

      this.mainOrganizerId = (users[0] as any)._id.toString();
      this.coOrganizerIds = [
        (users[1] as any)._id.toString(),
        (users[2] as any)._id.toString(),
      ];

      this.logResult("Test Data Setup", true, {
        mainOrganizer: { id: this.mainOrganizerId, email: users[0].email },
        coOrganizers: [
          { id: this.coOrganizerIds[0], email: users[1].email },
          { id: this.coOrganizerIds[1], email: users[2].email },
        ],
      });

      return { mainOrganizer: users[0], coOrganizers: [users[1], users[2]] };
    } catch (error) {
      this.logResult("Test Data Setup", false, undefined, error.message);
      throw error;
    }
  }

  async createTestEvent(mainOrganizer: any, coOrganizers: any[]) {
    console.log("\n📅 Creating test event...");

    try {
      const event = new Event({
        title: "CO-ORGANIZER NOTIFICATION TEST EVENT",
        description: "Testing co-organizer notifications - automated test",
        date: "2024-12-25",
        time: "14:00",
        endTime: "16:00",
        location: "Test Location",
        organizer: mainOrganizer.firstName + " " + mainOrganizer.lastName,
        organizerDetails: [
          {
            userId: new mongoose.Types.ObjectId(mainOrganizer._id),
            name: mainOrganizer.firstName + " " + mainOrganizer.lastName,
            role: "Main Organizer",
            email: "placeholder@example.com", // This should be a placeholder
            phone: "555-0001",
            gender: mainOrganizer.gender || "male",
          },
          {
            userId: new mongoose.Types.ObjectId(coOrganizers[0]._id),
            name: coOrganizers[0].firstName + " " + coOrganizers[0].lastName,
            role: "Co-Organizer",
            email: "placeholder@example.com", // This should be a placeholder
            phone: "555-0002",
            gender: coOrganizers[0].gender || "male",
          },
          {
            userId: new mongoose.Types.ObjectId(coOrganizers[1]._id),
            name: coOrganizers[1].firstName + " " + coOrganizers[1].lastName,
            role: "Co-Organizer",
            email: "placeholder@example.com", // This should be a placeholder
            phone: "555-0003",
            gender: coOrganizers[1].gender || "female",
          },
        ],
        createdBy: new mongoose.Types.ObjectId(mainOrganizer._id),
        purpose: "Testing co-organizer notification system",
        format: "Test Format",
        roles: [
          {
            id: "test-role-1",
            name: "Test Participant",
            description: "Test role for notification testing",
            maxParticipants: 10,
          },
        ],
        signedUp: 0,
        totalSlots: 10,
      });

      await event.save();
      this.testEventId = (event as any)._id.toString();

      this.logResult("Test Event Creation", true, {
        eventId: this.testEventId,
        organizerDetails: event.organizerDetails?.map((org) => ({
          userId: org.userId?.toString(),
          email: org.email,
          name: org.name,
          role: org.role,
        })),
      });

      return event;
    } catch (error) {
      this.logResult("Test Event Creation", false, undefined, error.message);
      throw error;
    }
  }

  async testEmailRecipientUtils(event: any) {
    console.log("\n📧 Testing EmailRecipientUtils.getEventCoOrganizers...");

    try {
      const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
        event
      );

      this.logResult(
        "EmailRecipientUtils - Raw Event",
        coOrganizers.length > 0,
        {
          foundCoOrganizers: coOrganizers.length,
          coOrganizers: coOrganizers.map((co) => ({
            email: co.email,
            firstName: co.firstName,
            lastName: co.lastName,
          })),
        }
      );

      return coOrganizers;
    } catch (error) {
      this.logResult(
        "EmailRecipientUtils - Raw Event",
        false,
        undefined,
        error.message
      );
      throw error;
    }
  }

  async testResponseBuilderService(eventId: string) {
    console.log(
      "\n🔄 Testing ResponseBuilderService.buildEventWithRegistrations..."
    );

    try {
      const populatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(eventId);

      this.logResult("ResponseBuilderService", true, {
        eventId: populatedEvent?.id,
        organizerDetails: populatedEvent?.organizerDetails?.map((org: any) => ({
          userId: org.userId,
          email: org.email,
          name: org.name,
          role: org.role,
        })),
      });

      return populatedEvent;
    } catch (error) {
      this.logResult("ResponseBuilderService", false, undefined, error.message);
      throw error;
    }
  }

  async testEmailRecipientUtilsWithPopulatedEvent(populatedEvent: any) {
    console.log("\n📧 Testing EmailRecipientUtils with populated event...");

    try {
      const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
        populatedEvent
      );

      this.logResult(
        "EmailRecipientUtils - Populated Event",
        coOrganizers.length > 0,
        {
          foundCoOrganizers: coOrganizers.length,
          coOrganizers: coOrganizers.map((co) => ({
            email: co.email,
            firstName: co.firstName,
            lastName: co.lastName,
          })),
        }
      );

      return coOrganizers;
    } catch (error) {
      this.logResult(
        "EmailRecipientUtils - Populated Event",
        false,
        undefined,
        error.message
      );
      throw error;
    }
  }

  async testCreateTargetedSystemMessage(coOrganizers: any[]) {
    console.log(
      "\n💬 Testing UnifiedMessageController.createTargetedSystemMessage..."
    );

    try {
      const targetUserIds = this.coOrganizerIds;

      await UnifiedMessageController.createTargetedSystemMessage(
        {
          title: "TEST: Co-Organizer Assignment",
          content:
            "This is a test notification for co-organizer assignment. If you see this, the notification system is working!",
          type: "assignment",
          priority: "high",
        },
        targetUserIds,
        {
          id: this.mainOrganizerId,
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
          roleInAtCloud: "Test Role",
        }
      );

      this.logResult("Create Targeted System Message", true, {
        targetUserIds,
        messageCreated: true,
      });

      return true;
    } catch (error) {
      this.logResult(
        "Create Targeted System Message",
        false,
        undefined,
        error.message
      );
      throw error;
    }
  }

  async verifySystemMessages() {
    console.log("\n🔍 Verifying system messages were created...");

    try {
      // Check if messages were created for co-organizers
      const messages = await Message.find({
        title: { $regex: "TEST: Co-Organizer Assignment" },
      });

      const messageChecks = [];

      for (const coOrganizerId of this.coOrganizerIds) {
        const userMessages = messages.filter(
          (msg) => msg.userStates && msg.userStates.has(coOrganizerId)
        );

        this.messageChecks.push({
          userId: coOrganizerId,
          messageCount: userMessages.length,
          messages: userMessages.map((msg) => ({
            id: (msg as any)._id.toString(),
            title: msg.title,
            hasUserState: msg.userStates.has(coOrganizerId),
            userState: msg.userStates.get(coOrganizerId),
          })),
        });
      }

      this.logResult(
        "System Message Verification",
        this.messageChecks.every((check) => check.messageCount > 0),
        {
          totalMessages: messages.length,
          messageChecks: this.messageChecks,
        }
      );

      return this.messageChecks;
    } catch (error) {
      this.logResult(
        "System Message Verification",
        false,
        undefined,
        error.message
      );
      throw error;
    }
  }

  async checkBellNotifications() {
    console.log("\n🔔 Checking bell notification API...");

    try {
      const bellNotificationChecks = [];

      for (const coOrganizerId of this.coOrganizerIds) {
        // Simulate the bell notification query
        const userMessages = await Message.find({
          $or: [
            { userStates: { $exists: false } }, // Global messages
            { [`userStates.${coOrganizerId}`]: { $exists: true } }, // User-specific messages
          ],
        }).sort({ createdAt: -1 });

        const unreadCount = userMessages.filter((msg) => {
          if (!msg.userStates || msg.userStates.size === 0) {
            // Global message - check if user has read it
            return true; // For simplicity, assume unread
          } else {
            // Targeted message - check user's read status
            const userState = msg.userStates.get(coOrganizerId);
            return userState && !userState.isReadInBell;
          }
        }).length;

        this.bellNotificationChecks.push({
          userId: coOrganizerId,
          totalMessages: userMessages.length,
          unreadCount,
          recentMessages: userMessages.slice(0, 3).map((msg) => ({
            title: msg.title,
            type: msg.type,
            isTargeted: msg.userStates && msg.userStates.has(coOrganizerId),
            userState: msg.userStates?.get(coOrganizerId),
          })),
        });
      }

      this.logResult("Bell Notification Check", true, {
        bellNotificationChecks: this.bellNotificationChecks,
      });
      return this.bellNotificationChecks;
    } catch (error) {
      this.logResult(
        "Bell Notification Check",
        false,
        undefined,
        error.message
      );
      throw error;
    }
  }

  async cleanup() {
    console.log("\n🧹 Cleaning up test data...");

    try {
      // Delete test event and any test messages
      await Event.findByIdAndDelete(this.testEventId);
      await Message.deleteMany({
        title: { $regex: "TEST: Co-Organizer Assignment" },
      });

      this.logResult("Cleanup", true);
    } catch (error) {
      this.logResult("Cleanup", false, undefined, error.message);
    }
  }

  generateReport() {
    console.log("\n📊 TEST REPORT");
    console.log("=".repeat(50));

    const passed = this.results.filter((r) => r.success).length;
    const total = this.results.length;

    console.log(`Overall: ${passed}/${total} tests passed\n`);

    this.results.forEach((result) => {
      const icon = result.success ? "✅" : "❌";
      console.log(`${icon} ${result.step}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("\n🔍 DIAGNOSIS:");

    if (
      this.results.find(
        (r) => r.step === "EmailRecipientUtils - Raw Event" && !r.success
      )
    ) {
      console.log(
        "❌ EmailRecipientUtils failing with raw event (placeholder emails)"
      );
    }

    if (
      this.results.find(
        (r) => r.step === "EmailRecipientUtils - Populated Event" && !r.success
      )
    ) {
      console.log("❌ EmailRecipientUtils failing even with populated event");
    }

    if (
      this.results.find(
        (r) => r.step === "Create Targeted System Message" && !r.success
      )
    ) {
      console.log(
        "❌ UnifiedMessageController.createTargetedSystemMessage failing"
      );
    }

    if (
      this.results.find(
        (r) => r.step === "System Message Verification" && !r.success
      )
    ) {
      console.log("❌ System messages not being created in database");
    }

    console.log("\n");
  }

  async runFullTest() {
    try {
      await this.connect();

      const { mainOrganizer, coOrganizers } = await this.setupTestData();
      const event = await this.createTestEvent(mainOrganizer, coOrganizers);

      // Test with raw event (should fail due to placeholder emails)
      await this.testEmailRecipientUtils(event);

      // Test with populated event (should work)
      const populatedEvent = await this.testResponseBuilderService(
        this.testEventId
      );
      const coOrganizersFromPopulated =
        await this.testEmailRecipientUtilsWithPopulatedEvent(populatedEvent);

      // Test creating targeted system messages
      await this.testCreateTargetedSystemMessage(coOrganizersFromPopulated);

      // Verify messages were created
      await this.verifySystemMessages();

      // Check bell notifications
      await this.checkBellNotifications();

      await this.cleanup();
    } catch (error) {
      console.error("💥 Test failed:", error);
    } finally {
      await this.disconnect();
      this.generateReport();
    }
  }
}

// Run the test
async function main() {
  const tester = new CoOrganizerNotificationTester();
  await tester.runFullTest();
}

main().catch(console.error);
