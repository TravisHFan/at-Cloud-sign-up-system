import mongoose from "mongoose";
import { IUser } from "../models/User";
import User from "../models/User";
import Registration from "../models/Registration";
import Event from "../models/Event";
import Message from "../models/Message";
import { CachePatterns } from "./infrastructure/CacheService";

export interface UserDeletionReport {
  userId: string;
  userEmail: string;
  deletedData: {
    userRecord: boolean;
    registrations: number;
    eventsCreated: number;
    eventOrganizations: number;
    messageStates: number;
    messagesCreated: number;
  };
  updatedStatistics: {
    events: string[];
    affectedUsers: number;
  };
  errors: string[];
}

export class UserDeletionService {
  /**
   * Completely delete a user and all associated data
   * WARNING: This is irreversible and removes all traces of the user
   */
  static async deleteUserCompletely(
    userId: string,
    performedBy: IUser
  ): Promise<UserDeletionReport> {
    const report: UserDeletionReport = {
      userId,
      userEmail: "",
      deletedData: {
        userRecord: false,
        registrations: 0,
        eventsCreated: 0,
        eventOrganizations: 0,
        messageStates: 0,
        messagesCreated: 0,
      },
      updatedStatistics: {
        events: [],
        affectedUsers: 0,
      },
      errors: [],
    };

    try {
      // 1. Get user data before deletion
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        throw new Error("User not found");
      }
      report.userEmail = userToDelete.email;

      // 2. Delete all registrations (as participant)
      const deletedRegistrations = await Registration.deleteMany({
        userId: new mongoose.Types.ObjectId(userId),
      });
      report.deletedData.registrations = deletedRegistrations.deletedCount || 0;

      // 3. Delete registrations where user was the registrar
      const deletedAsRegistrar = await Registration.deleteMany({
        registeredBy: new mongoose.Types.ObjectId(userId),
      });
      report.deletedData.registrations += deletedAsRegistrar.deletedCount || 0;

      // 4. Clean up audit histories where user performed actions
      // Use a targeted filter instead of collection-wide scan for performance
      await Registration.updateMany(
        {
          "actionHistory.performedBy": new mongoose.Types.ObjectId(userId),
        },
        {
          $pull: {
            actionHistory: {
              performedBy: new mongoose.Types.ObjectId(userId),
            },
          },
        }
      );

      // 5. Handle events created by the user
      const eventsCreatedByUser = await Event.find({
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      for (const event of eventsCreatedByUser) {
        // Delete events created by user
        await Event.findByIdAndDelete(event._id);
        // Also delete all registrations for these events
        await Registration.deleteMany({ eventId: event._id });
        report.deletedData.eventsCreated++;
      }

      // 6. Remove user from organizer lists in other events
      const eventsAsOrganizer = await Event.updateMany(
        {
          "organizerDetails.userId": new mongoose.Types.ObjectId(userId),
        },
        {
          $pull: {
            organizerDetails: {
              userId: new mongoose.Types.ObjectId(userId),
            },
          },
        }
      );
      report.deletedData.eventOrganizations =
        eventsAsOrganizer.modifiedCount || 0;

      // 7. Clean up message states (only where user key exists)
      const messagesWithUserStates = await Message.updateMany(
        { [`userStates.${userId}`]: { $exists: true } },
        {
          $unset: {
            [`userStates.${userId}`]: 1,
          },
        }
      );
      report.deletedData.messageStates =
        messagesWithUserStates.modifiedCount || 0;

      // 8. Delete messages created by the user
      const deletedMessages = await Message.deleteMany({
        $or: [
          { "creator.id": userId },
          { createdBy: new mongoose.Types.ObjectId(userId) },
        ],
      });
      report.deletedData.messagesCreated = deletedMessages.deletedCount || 0;

      // 9. Finally, delete the user record
      await User.findByIdAndDelete(userId);
      report.deletedData.userRecord = true;

      // 10. Update statistics for affected events
      const affectedEvents = await Event.find({
        _id: {
          $in: eventsCreatedByUser.map((e) => e._id),
        },
      });

      for (const event of affectedEvents) {
        await event.save(); // Triggers pre-save middleware to recalculate stats
        report.updatedStatistics.events.push(
          (event._id as mongoose.Types.ObjectId).toString()
        );
      }

      // 11. Invalidate all relevant caches after user deletion
      await CachePatterns.invalidateUserCache(userId);
      await CachePatterns.invalidateAllUserCaches(); // For user listings
      await CachePatterns.invalidateAnalyticsCache(); // For user count analytics
      // Invalidate event caches for all affected events
      for (const eventId of report.updatedStatistics.events) {
        await CachePatterns.invalidateEventCache(eventId);
      }

      console.log(
        `✅ User completely deleted: ${report.userEmail} by Super Admin: ${performedBy.email}`
      );
      console.log(`📊 Deletion Report:`, report);

      return report;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push(message);
      console.error("❌ User deletion failed:", error);
      throw error;
    }
  }

  /**
   * Get user deletion impact analysis before actual deletion
   * Shows what would be deleted without performing the deletion
   */
  static async getUserDeletionImpact(userId: string): Promise<{
    user: {
      email: string;
      name: string;
      role: string;
      createdAt: Date;
    };
    impact: {
      registrations: number;
      eventsCreated: number;
      eventOrganizations: number;
      messageStates: number;
      messagesCreated: number;
      affectedEvents: Array<{
        id: string;
        title: string;
        participantCount: number;
      }>;
    };
    risks: string[];
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Count registrations
      const registrationCount = await Registration.countDocuments({
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { registeredBy: new mongoose.Types.ObjectId(userId) },
        ],
      });

      // Count events created
      const eventsCreated = await Event.find({
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      // Count organizer roles
      const eventOrganizations = await Event.countDocuments({
        "organizerDetails.userId": new mongoose.Types.ObjectId(userId),
      });

      // Count message states
      const messagesWithStates = await Message.countDocuments({
        "userStates.userId": new mongoose.Types.ObjectId(userId),
      });

      // Count messages created
      const messagesCreated = await Message.countDocuments({
        $or: [
          { "creator.id": userId },
          { createdBy: new mongoose.Types.ObjectId(userId) },
        ],
      });

      // Analyze risks
      const risks: string[] = [];
      if (eventsCreated.length > 0) {
        risks.push(
          `Will permanently delete ${eventsCreated.length} events created by this user`
        );
      }
      if (registrationCount > 0) {
        risks.push(`Will remove ${registrationCount} event registrations`);
      }
      if (user.role === "Super Admin") {
        risks.push("WARNING: Attempting to delete a Super Admin user");
      }

      return {
        user: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          createdAt: user.createdAt,
        },
        impact: {
          registrations: registrationCount,
          eventsCreated: eventsCreated.length,
          eventOrganizations,
          messageStates: messagesWithStates,
          messagesCreated,
          affectedEvents: eventsCreated.map((event) => ({
            id: (event._id as mongoose.Types.ObjectId).toString(),
            title: event.title,
            participantCount: event.signedUp,
          })),
        },
        risks,
      };
    } catch (error: unknown) {
      // If the user is not found, throw specific error that tests expect
      if (error instanceof Error && error.message === "User not found") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze deletion impact: ${message}`);
    }
  }
}
