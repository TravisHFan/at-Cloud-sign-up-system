/**
 * User Deletion Service
 * Handles complete cascade deletion of user data across all collections
 * Ensures data integrity and correct statistics after user deletion
 */

import mongoose from "mongoose";
import { User, Registration, Event, Message } from "../models";
import { IUser } from "../models/User";
import { ResponseBuilderService } from "./ResponseBuilderService";
import { socketService } from "./infrastructure/SocketService";

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
    events: string[]; // Event IDs that had statistics updated
    affectedUsers: number; // Number of users whose stats were recalculated
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
    const session = await mongoose.startSession();
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
      await session.withTransaction(async () => {
        // 1. Get user data before deletion
        const userToDelete = await User.findById(userId).session(session);
        if (!userToDelete) {
          throw new Error("User not found");
        }
        report.userEmail = userToDelete.email;

        // 2. Delete all registrations (as participant)
        const deletedRegistrations = await Registration.deleteMany(
          { userId: new mongoose.Types.ObjectId(userId) },
          { session }
        );
        report.deletedData.registrations =
          deletedRegistrations.deletedCount || 0;

        // 3. Delete registrations where user was the registrar
        const deletedAsRegistrar = await Registration.deleteMany(
          { registeredBy: new mongoose.Types.ObjectId(userId) },
          { session }
        );
        report.deletedData.registrations +=
          deletedAsRegistrar.deletedCount || 0;

        // 4. Clean up audit histories where user performed actions
        await Registration.updateMany(
          {},
          {
            $pull: {
              actionHistory: {
                performedBy: new mongoose.Types.ObjectId(userId),
              },
            },
          },
          { session }
        );

        // 5. Handle events created by the user
        const eventsCreatedByUser = await Event.find({
          createdBy: new mongoose.Types.ObjectId(userId),
        }).session(session);

        for (const event of eventsCreatedByUser) {
          // Option A: Delete events created by user
          await Event.findByIdAndDelete(event._id, { session });
          // Also delete all registrations for these events
          await Registration.deleteMany({ eventId: event._id }, { session });
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
          },
          { session }
        );
        report.deletedData.eventOrganizations =
          eventsAsOrganizer.modifiedCount || 0;

        // 7. Clean up message states
        const messagesWithUserStates = await Message.updateMany(
          {},
          {
            $unset: {
              [`userStates.${userId}`]: "",
            },
          },
          { session }
        );
        report.deletedData.messageStates =
          messagesWithUserStates.modifiedCount || 0;

        // 8. Delete messages created by the user
        const deletedMessages = await Message.deleteMany(
          {
            $or: [
              { "creator.id": userId },
              { createdBy: new mongoose.Types.ObjectId(userId) },
            ],
          },
          { session }
        );
        report.deletedData.messagesCreated = deletedMessages.deletedCount || 0;

        // 9. Finally, delete the user record
        await User.findByIdAndDelete(userId, { session });
        report.deletedData.userRecord = true;

        // 10. Recalculate affected event statistics
        const affectedEvents = await Event.find({
          _id: {
            $in: [
              ...eventsCreatedByUser.map((e) => e._id),
              // Add other potentially affected events
            ],
          },
        }).session(session);

        for (const event of affectedEvents) {
          await event.save({ session }); // Triggers pre-save middleware to recalculate stats
          report.updatedStatistics.events.push(
            (event._id as mongoose.Types.ObjectId).toString()
          );
        }
      });

      console.log(
        `✅ User completely deleted: ${report.userEmail} by Super Admin: ${performedBy.email}`
      );
      console.log(`📊 Deletion Report:`, report);

      return report;
    } catch (error: any) {
      report.errors.push(error.message);
      console.error("❌ User deletion failed:", error);
      throw error;
    } finally {
      await session.endSession();
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
      [`userStates.${userId}`]: { $exists: true },
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
        name: user.getFullName(),
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
  }
}
