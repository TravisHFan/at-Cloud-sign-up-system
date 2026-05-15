/**
 * Event Permission Utilities
 *
 * Contains permission checking logic for event operations.
 * Extracted from eventController.ts to improve maintainability and reusability.
 */

import { Types } from "mongoose";
import Program from "../../models/Program";
import Purchase from "../../models/Purchase";

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

/**
 * Check if a user can edit an event through one of the event's affiliated
 * programs. This is intentionally narrower than general event management.
 *
 * A user qualifies when they are a mentor or class rep of any program in
 * event.programLabels.
 */
export async function isAffiliatedProgramEditor(
  event: {
    programLabels?: Array<Types.ObjectId | string>;
  },
  userId: string,
  _userRole?: string
): Promise<boolean> {
  const programIds = (event.programLabels || [])
    .map((id) => id?.toString())
    .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (programIds.length === 0 || !Types.ObjectId.isValid(userId)) {
    return false;
  }

  const userObjectId = new Types.ObjectId(userId);

  const affiliatedProgram = await Program.findOne({
    _id: { $in: programIds },
    $or: [
      { "mentors.userId": userObjectId },
      { "adminEnrollments.classReps": userObjectId },
    ],
  }).select("_id");

  if (affiliatedProgram) {
    return true;
  }

  const classRepPurchase = await Purchase.findOne({
    purchaseType: "program",
    programId: { $in: programIds },
    userId: userObjectId,
    status: "completed",
    isClassRep: true,
    unenrolledAt: { $exists: false },
  }).select("_id");

  return !!classRepPurchase;
}
