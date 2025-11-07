/**
 * EventOrganizerDataService
 *
 * Handles organizer data processing for event creation.
 * Extracted from CreationController.ts for better organization and maintainability.
 *
 * Responsibilities:
 * - Process organizer details with placeholder pattern
 * - Store only essential organizer info (userId, name, role, avatar, gender)
 * - Add placeholders for email/phone (these are fetched fresh at read time from User collection)
 * - Prevent stale contact data and reduce storage redundancy
 *
 * Design Pattern:
 * This service implements the "placeholder pattern" where contact details (email, phone)
 * are NOT stored in the event document. Instead, they are fetched fresh from the User
 * collection when the event is read. This prevents stale data issues when users update
 * their contact information.
 */

interface IncomingOrganizerData {
  userId?: unknown;
  name?: string;
  role?: string;
  avatar?: string;
  gender?: "male" | "female";
}

interface ProcessedOrganizerData {
  userId?: unknown;
  name?: string;
  role?: string;
  avatar?: string;
  gender?: "male" | "female";
  email: string; // Placeholder - replaced at read time
  phone: string; // Placeholder - replaced at read time
}

export class EventOrganizerDataService {
  /**
   * Process organizer details for event creation
   *
   * Stores only essential organizer information with placeholder contact details.
   * Contact details (email, phone) are ALWAYS fetched fresh from User collection
   * in getEventById to prevent stale data.
   *
   * @param organizerDetails - Array of organizer data from request body
   * @returns Processed organizer details with placeholders for contact info
   */
  static processOrganizerDetails(
    organizerDetails?: IncomingOrganizerData[]
  ): ProcessedOrganizerData[] {
    if (!organizerDetails || !Array.isArray(organizerDetails)) {
      return [];
    }

    return organizerDetails.map(
      (organizer: IncomingOrganizerData): ProcessedOrganizerData => ({
        userId: organizer.userId, // Essential for lookup
        name: organizer.name, // Display name
        role: organizer.role, // Organizer role (e.g., "Main Organizer", "Co-organizer")
        avatar: organizer.avatar, // Avatar URL if provided
        gender: organizer.gender, // For default avatar selection if no custom avatar
        // NOTE: email and phone are now ALWAYS fetched fresh from User collection in getEventById
        email: "placeholder@example.com", // Placeholder - will be replaced at read time
        phone: "Phone not provided", // Placeholder - will be replaced at read time
      })
    );
  }
}
