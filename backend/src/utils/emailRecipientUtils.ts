import User from "../models/User";
import Registration from "../models/Registration";
import GuestRegistration from "../models/GuestRegistration";
import { IEvent } from "../models/Event";
import type mongoose from "mongoose";
import type { FilterQuery } from "mongoose";
import type { IUser } from "../models/User";

// Type helpers
function isObjectId(val: unknown): val is mongoose.Types.ObjectId {
  return (
    !!val &&
    typeof val === "object" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (val as { toString?: unknown }).toString instanceof Function &&
    // best-effort: ObjectId toString() doesn't return "[object Object]"
    (val as { toString: () => string }).toString() !== "[object Object]"
  );
}

function extractIdString(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (isObjectId(input)) return input.toString();
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    const maybeId = obj._id;
    if (isObjectId(maybeId)) return maybeId.toString();
    if (typeof maybeId === "string") return maybeId;
    if (typeof obj.toString === "function") {
      const s = (obj.toString as () => string)();
      if (s && s !== "[object Object]") return s;
    }
  }
  return null;
}

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
    const filter: FilterQuery<IUser> = {
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
    // Get the main organizer's ID for exclusion (handle both ObjectId and string)
    // FIX: Handle populated User objects (id field) and ObjectId objects (toString method)
    const mainOrganizerId =
      extractIdString(
        // createdBy is declared as ObjectId but may be populated at runtime
        (event as unknown as { createdBy: unknown }).createdBy
      ) || "";
    if (!event.organizerDetails || event.organizerDetails.length === 0) {
      return [];
    }

    // FIX: Use userId instead of email for filtering (stored emails are placeholders)
    // Get all organizer userIds except the main organizer
    const coOrganizerUserIds = event.organizerDetails
      .filter((organizer) => {
        const orgUserId = organizer.userId?.toString() || organizer.userId;
        const isNotMainOrganizer = orgUserId && orgUserId !== mainOrganizerId;
        return isNotMainOrganizer;
      })
      .map((organizer) => organizer.userId);

    if (coOrganizerUserIds.length === 0) {
      return [];
    }

    // Look up users by their IDs to get fresh contact information
    return await User.find({
      _id: { $in: coOrganizerUserIds },
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
    const result = await User.findOne({
      _id: userId,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    })
      .select("email firstName lastName")
      .lean<{ email: string; firstName: string; lastName: string }>();

    return result;
  }

  /**
   * Get a specific user by email (for targeted notifications)
   * Used for: External notifications, manual email triggers
   */
  static async getUserByEmail(
    email: string
  ): Promise<{ email: string; firstName: string; lastName: string } | null> {
    const result = await User.findOne({
      email: email.toLowerCase(),
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    })
      .select("email firstName lastName")
      .lean<{ email: string; firstName: string; lastName: string }>();

    return result;
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
   * Get @Cloud co-workers for ministry-related notifications
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
   * Get participants for an event (for email notifications)
   */
  static async getEventParticipants(
    eventId: string
  ): Promise<
    Array<{ email: string; firstName: string; lastName: string; _id?: string }>
  > {
    // Get all registrations for this event with approved/confirmed status
    const registrations = await Registration.find({
      eventId: eventId,
      // Accept both new status values and legacy ones
      $or: [
        { status: "approved" },
        { status: "confirmed" },
        { status: "active" }, // Added to handle current data structure
      ],
    });

    // Extract email recipients from userSnapshot data (current structure)
    // or fallback to populated userId (legacy structure)
    const recipients = [];

    for (const registration of registrations) {
      let email: string | undefined;
      let firstName: string | undefined;
      let lastName: string | undefined;
      let userId: mongoose.Types.ObjectId | string | undefined;

      // Try userSnapshot first (current structure)
      if (registration.userSnapshot) {
        email = registration.userSnapshot.email;
        firstName = registration.userSnapshot.firstName;
        lastName = registration.userSnapshot.lastName;
        userId = registration.userId; // Get the actual user ID from registration
      } else {
        // Fallback: try to populate user data (legacy structure)
        await registration.populate(
          "userId",
          "email firstName lastName isActive isVerified emailNotifications"
        );
        const userObj = registration.userId as unknown;
        if (typeof userObj === "object" && userObj !== null) {
          const u = userObj as Record<string, unknown>;
          const isActive =
            typeof u.isActive === "boolean" ? (u.isActive as boolean) : false;
          const isVerified =
            typeof u.isVerified === "boolean"
              ? (u.isVerified as boolean)
              : false;
          const wantsEmails =
            typeof u.emailNotifications === "boolean"
              ? (u.emailNotifications as boolean)
              : false;
          if (isActive && isVerified && wantsEmails) {
            email =
              typeof u.email === "string" ? (u.email as string) : undefined;
            firstName =
              typeof u.firstName === "string"
                ? (u.firstName as string)
                : undefined;
            lastName =
              typeof u.lastName === "string"
                ? (u.lastName as string)
                : undefined;
            userId =
              typeof u._id === "string"
                ? (u._id as string)
                : isObjectId(u._id)
                ? (u._id as mongoose.Types.ObjectId)
                : undefined;
          }
        }
      }

      // Add to recipients if we have valid email
      if (email && email.includes("@")) {
        recipients.push({
          email: email,
          firstName: firstName || "",
          lastName: lastName || "",
          _id: userId ? userId.toString() : undefined,
        });
      }
    }

    return recipients;
  }

  /**
   * Get guests for an event (for email notifications)
   * Guests are not users; they won't receive system messages, but do get emails.
   */
  static async getEventGuests(
    eventId: string
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    const guests = await GuestRegistration.find({
      eventId: eventId,
      status: "active",
    });

    const recipients: Array<{
      email: string;
      firstName: string;
      lastName: string;
    }> = [];

    for (const g of guests) {
      const email = g.email;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        continue; // skip invalid emails
      }
      const fullName = (g.fullName || "").trim();
      let firstName = "";
      let lastName = "";
      if (fullName) {
        const parts = fullName.split(/\s+/);
        firstName = parts.shift() || "";
        lastName = parts.join(" ");
      }
      recipients.push({ email, firstName, lastName });
    }

    return recipients;
  }
}
