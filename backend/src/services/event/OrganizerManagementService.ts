import { Types } from "mongoose";
import type { IEvent } from "../../models/Event";

/**
 * OrganizerManagementService
 * Handles organizer tracking and normalization for event updates.
 * Extracted from UpdateController Phase 8.1.3.
 */
export class OrganizerManagementService {
  /**
   * Track old organizer user IDs from existing event.
   * Used to detect which organizers were added/removed.
   */
  trackOldOrganizers(event: IEvent): string[] {
    if (!event.organizerDetails || !Array.isArray(event.organizerDetails)) {
      return [];
    }

    return event.organizerDetails
      .map((org: { userId?: Types.ObjectId | string }) => {
        if (!org.userId) return null;
        return org.userId instanceof Types.ObjectId
          ? org.userId.toString()
          : String(org.userId);
      })
      .filter((id: string | null): id is string => id !== null);
  }

  /**
   * Normalize organizer details from update request.
   * Strips email/phone to use placeholders (fetched fresh at read time).
   */
  normalizeOrganizerDetails(organizerDetails: any[]): any[] {
    if (!Array.isArray(organizerDetails)) {
      return [];
    }

    return organizerDetails.map((organizer) => ({
      userId: organizer.userId,
      name: organizer.name,
      role: organizer.role,
      avatar: organizer.avatar,
      gender: organizer.gender,
      email: "placeholder@example.com", // Fetched fresh at read time
      phone: "Phone not provided",
    }));
  }
}
