/**
 * Event Permission Utilities
 *
 * Contains permission checking logic for event operations.
 * Extracted from eventController.ts to improve maintainability and reusability.
 */

import { Types } from "mongoose";

/**
 * Helper function to check if a user is an organizer (creator or co-organizer) of an event
 *
 * @param event - Event object containing createdBy and organizerDetails
 * @param userId - User ID to check
 * @returns true if user is creator or co-organizer, false otherwise
 */
export function isEventOrganizer(
  event: {
    createdBy?: Types.ObjectId | string;
    organizerDetails?: Array<{ userId?: Types.ObjectId | string }>;
  },
  userId: string
): boolean {
  // Check if user is the event creator
  if (event.createdBy && event.createdBy.toString() === userId.toString()) {
    return true;
  }

  // Check if user is a co-organizer
  if (event.organizerDetails && event.organizerDetails.length > 0) {
    return event.organizerDetails.some(
      (organizer) => organizer.userId?.toString() === userId.toString()
    );
  }

  return false;
}
