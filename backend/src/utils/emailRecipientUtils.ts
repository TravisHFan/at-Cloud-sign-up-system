import User from "../models/User";
import Registration from "../models/Registration";
import { IEvent } from "../models/Event";

/**
 * EmailRecipientUtils - Critical foundation class for email routing logic
 *
 * This class provides standardized methods to discover email recipients
 * based on user roles, preferences, and event participation.
 *
 * All methods filter by:
 * - isActive: true (user account is active)
 * - isVerified: true (user has verified their email)
 * - emailNotifications: true (user wants to receive emails)
 */
export class EmailRecipientUtils {
  /**
   * Get Super Admin and Administrator users for admin notifications
   * Used for: Role changes, security alerts, new user signups
   */
  static async getAdminUsers(): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    return await User.find({
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role");
  }

  /**
   * Get all active users who want emails (excluding specified email)
   * Used for: Event creation notifications, system announcements
   */
  static async getActiveVerifiedUsers(
    excludeEmail?: string
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    const filter: any = {
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    };

    if (excludeEmail) {
      filter.email = { $ne: excludeEmail };
    }

    return await User.find(filter).select("email firstName lastName");
  }

  /**
   * Get event co-organizers (excluding main organizer)
   * Used for: Co-organizer assignment notifications, organizer communications
   */
  static async getEventCoOrganizers(
    event: IEvent
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    // Get the main organizer's email first
    const mainOrganizer = await User.findById(event.createdBy).select("email");
    const mainOrganizerEmail = mainOrganizer?.email;

    if (!event.organizerDetails || event.organizerDetails.length === 0) {
      return [];
    }

    const coOrganizerEmails = event.organizerDetails
      .filter((organizer) => organizer.email !== mainOrganizerEmail)
      .map((organizer) => organizer.email);

    if (coOrganizerEmails.length === 0) {
      return [];
    }

    return await User.find({
      email: { $in: coOrganizerEmails },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName");
  }

  /**
   * Get recipients for System Authorization Level changes
   * Used for: When users are promoted/demoted between Super Admin, Administrator, Leader, Participant
   */
  static async getSystemAuthorizationChangeRecipients(
    changedUserId: string
  ): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    return await User.find({
      _id: { $ne: changedUserId },
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role");
  }

  /**
   * Get recipients for Role in @Cloud changes (ministry leadership)
   * Used for: When users update their ministry positions (Youth Pastor, IT Director, etc.)
   */
  static async getRoleInAtCloudChangeRecipients(): Promise<
    Array<{
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      roleInAtCloud?: string;
    }>
  > {
    return await User.find({
      $or: [
        { role: "Super Admin" },
        {
          role: { $in: ["Administrator", "Leader"] },
          isAtCloudLeader: true,
        },
      ],
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role roleInAtCloud");
  }

  /**
   * Get a specific user by ID (for targeted notifications)
   * Used for: Password changes, account updates, role assignments
   */
  static async getUserById(
    userId: string
  ): Promise<{ email: string; firstName: string; lastName: string } | null> {
    return await User.findOne({
      _id: userId,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName");
  }

  /**
   * Get a specific user by email (for targeted notifications)
   * Used for: External notifications, manual email triggers
   */
  static async getUserByEmail(
    email: string
  ): Promise<{ email: string; firstName: string; lastName: string } | null> {
    return await User.findOne({
      email: email.toLowerCase(),
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName");
  }

  /**
   * Get users with specific role(s)
   * Used for: Role-specific announcements, targeted communications
   */
  static async getUsersByRole(
    roles: string | string[]
  ): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    const roleArray = Array.isArray(roles) ? roles : [roles];

    return await User.find({
      role: { $in: roleArray },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role");
  }

  /**
   * Get @Cloud leaders for ministry-related notifications
   * Used for: Ministry announcements, leadership communications
   */
  static async getAtCloudLeaders(): Promise<
    Array<{
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      roleInAtCloud?: string;
    }>
  > {
    return await User.find({
      isAtCloudLeader: true,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role roleInAtCloud");
  }

  /**
   * Get event participants for reminder notifications
   * Used for: Event reminders, event updates
   */
  static async getEventParticipants(
    eventId: string
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    // Get all registrations for this event
    const registrations = await Registration.find({
      eventId: eventId,
      // Only approved registrations
      $or: [
        { status: "approved" },
        { status: "confirmed" },
        { status: { $exists: false } }, // Legacy registrations without status
      ],
    }).populate(
      "userId",
      "email firstName lastName isActive isVerified emailNotifications"
    );

    // Filter for active, verified users who want email notifications
    return registrations
      .filter((registration) => {
        const user = registration.userId as any;
        return (
          user &&
          user.isActive &&
          user.isVerified &&
          user.emailNotifications &&
          user.email
        );
      })
      .map((registration) => {
        const user = registration.userId as any;
        return {
          email: user.email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
        };
      });
  }
}
