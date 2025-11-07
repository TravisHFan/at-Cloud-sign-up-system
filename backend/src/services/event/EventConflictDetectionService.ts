/**
 * EventConflictDetectionService
 *
 * Handles conflict detection for event creation.
 * Extracted from CreationController.ts for better organization and maintainability.
 *
 * Responsibilities:
 * - Check for time overlaps with existing events
 * - Timezone-aware conflict detection
 * - Test environment bypass logic
 */

interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts?: Array<unknown>;
}

export class EventConflictDetectionService {
  /**
   * Check for time conflicts with existing events
   *
   * @param date - Event start date (YYYY-MM-DD)
   * @param time - Event start time (HH:mm)
   * @param endDate - Event end date (YYYY-MM-DD)
   * @param endTime - Event end time (HH:mm)
   * @param excludeEventId - Optional event ID to exclude from conflict check (for updates)
   * @param timeZone - Optional timezone for conflict detection
   * @param suppressNotifications - If true in test environment, skip conflict check
   * @returns Conflict check result with conflicts array if found
   */
  static async checkConflicts(
    date: string,
    time: string,
    endDate: string,
    endTime: string,
    excludeEventId?: string,
    timeZone?: string,
    suppressNotifications?: boolean
  ): Promise<ConflictCheckResult> {
    // Skip conflict check in test environment when suppressNotifications=true
    // This allows integration test scenarios to create overlapping events
    const skipConflictCheck =
      process.env.NODE_ENV === "test" && suppressNotifications;

    if (skipConflictCheck) {
      return { hasConflict: false };
    }

    try {
      // Dynamic import to avoid circular dependency
      const { EventController } = await import(
        "../../controllers/eventController"
      );

      const conflicts = await EventController.findConflictingEvents(
        date,
        time,
        endDate,
        endTime,
        excludeEventId,
        timeZone
      );

      if (conflicts.length > 0) {
        return {
          hasConflict: true,
          conflicts,
        };
      }

      return { hasConflict: false };
    } catch (e) {
      console.error("Conflict detection failed:", e);
      // Continue (do not block) if conflict check fails unexpectedly
      // Return no conflict to allow event creation to proceed
      return { hasConflict: false };
    }
  }
}
