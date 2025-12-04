import mongoose from "mongoose";
import Event, { IEvent, IOrganizerDetail } from "../../models/Event";
import Purchase from "../../models/Purchase";
import User from "../../models/User";
import { Logger } from "../LoggerService";

const log = Logger.getInstance().child("EventAccessControlService");

export type AccessReason =
  | "system_admin"
  | "organizer"
  | "co_organizer"
  | "free_event"
  | "program_purchase"
  | "event_purchase";

export interface EventAccessResult {
  hasAccess: boolean;
  requiresPurchase: boolean;
  accessReason?: AccessReason;
}

/**
 * EventAccessControlService
 *
 * Determines if a user has access to view a paid event's full details.
 *
 * Access Logic (in priority order):
 * 1. System Authorization: Super Admin or Administrator → Free access
 * 2. Event Organizers: Organizer or Co-organizer of this event → Free access
 * 3. Free Event: If pricing.isFree = true → Everyone has access
 * 4. Program Purchase: User purchased ANY program in event.programLabels → Free access
 * 5. Event Purchase: User has completed purchase for this specific event → Access granted
 * 6. Default: No access (must purchase)
 */
class EventAccessControlService {
  /**
   * Check if a user has access to view a paid event
   */
  async checkUserAccess(
    userId: string | mongoose.Types.ObjectId,
    eventId: string | mongoose.Types.ObjectId
  ): Promise<EventAccessResult> {
    try {
      const userIdObj =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;
      const eventIdObj =
        typeof eventId === "string"
          ? new mongoose.Types.ObjectId(eventId)
          : eventId;

      // Fetch event
      const event = await Event.findById(eventIdObj);
      if (!event) {
        throw new Error("Event not found");
      }

      // Check 1: Free event - everyone has access
      if (event.pricing?.isFree !== false) {
        // Default is true, so if undefined or true, it's free
        return {
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "free_event",
        };
      }

      // Fetch user
      const user = await User.findById(userIdObj);
      if (!user) {
        throw new Error("User not found");
      }

      // Check 2: System Authorization - Super Admin or Administrator
      if (user.role === "Super Admin" || user.role === "Administrator") {
        return {
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "system_admin",
        };
      }

      // Check 3: Event Organizer (creator)
      if (event.createdBy.toString() === userIdObj.toString()) {
        return {
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "organizer",
        };
      }

      // Check 4: Co-organizer
      if (event.organizerDetails && event.organizerDetails.length > 0) {
        const isCoOrganizer = event.organizerDetails.some(
          (org: IOrganizerDetail) =>
            org.userId && org.userId.toString() === userIdObj.toString()
        );
        if (isCoOrganizer) {
          return {
            hasAccess: true,
            requiresPurchase: false,
            accessReason: "co_organizer",
          };
        }
      }

      // Check 5: Program Purchase - user purchased ANY linked program
      if (event.programLabels && event.programLabels.length > 0) {
        const hasProgramPurchase = await Purchase.findOne({
          userId: userIdObj,
          purchaseType: "program",
          programId: { $in: event.programLabels },
          status: "completed",
        });

        if (hasProgramPurchase) {
          return {
            hasAccess: true,
            requiresPurchase: false,
            accessReason: "program_purchase",
          };
        }
      }

      // Check 6: Event Purchase - user purchased this specific event
      const hasEventPurchase = await Purchase.findOne({
        userId: userIdObj,
        purchaseType: "event",
        eventId: eventIdObj,
        status: "completed",
      });

      if (hasEventPurchase) {
        return {
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "event_purchase",
        };
      }

      // Default: No access, must purchase
      return {
        hasAccess: false,
        requiresPurchase: true,
      };
    } catch (error) {
      log.error(
        "Error in EventAccessControlService.checkUserAccess:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Format access reason for user-friendly display
   */
  formatAccessReason(reason: AccessReason): string {
    const reasonMap: Record<AccessReason, string> = {
      system_admin: "Super Admin",
      organizer: "Creator",
      co_organizer: "Co-organizer",
      free_event: "Free Event",
      program_purchase: "Program Enrollee",
      event_purchase: "Event Ticket Holder",
    };

    return reasonMap[reason] || "Unknown";
  }

  /**
   * Batch check access for multiple users (useful for admin views)
   */
  async checkMultipleUsersAccess(
    userIds: (string | mongoose.Types.ObjectId)[],
    eventId: string | mongoose.Types.ObjectId
  ): Promise<Map<string, EventAccessResult>> {
    const results = new Map<string, EventAccessResult>();

    for (const userId of userIds) {
      try {
        const userIdStr =
          typeof userId === "string" ? userId : userId.toString();
        const result = await this.checkUserAccess(userId, eventId);
        results.set(userIdStr, result);
      } catch (error) {
        log.error(
          `Error checking access for user ${userId}:`,
          error instanceof Error ? error : undefined
        );
        results.set(typeof userId === "string" ? userId : userId.toString(), {
          hasAccess: false,
          requiresPurchase: true,
        });
      }
    }

    return results;
  }
}

export default new EventAccessControlService();
