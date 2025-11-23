import mongoose from "mongoose";
import { Program, Purchase } from "../../models";

/**
 * CoOrganizerProgramAccessService
 *
 * Validates that all co-organizers have access to paid programs associated with an event.
 * This prevents Leaders (or higher) from being assigned as co-organizers to events in
 * paid programs they haven't purchased.
 *
 * Responsibilities:
 * - Check if event has paid programs (skip validation if no programs or all free)
 * - Verify each co-organizer has access (admin/mentor/purchased) to at least one paid program
 * - Return user-friendly error messages listing unauthorized co-organizers
 *
 * Rules:
 * - Super Admin and Administrator: Always have access (skip check)
 * - Free programs: No validation needed
 * - Co-organizers must be enrolled in at least ONE of the associated paid programs
 * - Enrollment means: mentor status OR completed purchase
 */

interface CoOrganizerAccessResult {
  valid: boolean;
  error?: {
    status: number;
    message: string;
    data?: {
      unauthorizedCoOrganizers: Array<{
        userId: string;
        name: string;
      }>;
    };
  };
}

interface OrganizerDetail {
  userId?: unknown;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export class CoOrganizerProgramAccessService {
  /**
   * Validate that all co-organizers have access to at least one of the event's paid programs
   *
   * @param organizerDetails - Array of organizer details from event data
   * @param programLabels - Array of program IDs associated with the event
   * @returns Validation result with error details if validation fails
   */
  static async validateCoOrganizerAccess(
    organizerDetails: OrganizerDetail[] | undefined,
    programLabels: unknown[] | undefined
  ): Promise<CoOrganizerAccessResult> {
    // If no organizers specified, validation passes
    if (!organizerDetails || organizerDetails.length === 0) {
      return { valid: true };
    }

    // If no programs specified, validation passes (no program restrictions)
    if (!programLabels || programLabels.length === 0) {
      return { valid: true };
    }

    // Step 1: Fetch all programs and check if any are paid
    const programIds = programLabels
      .filter((id) => id !== null && id !== undefined)
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (programIds.length === 0) {
      return { valid: true };
    }

    // Fetch programs with relevant fields
    const programs = await (
      Program as unknown as {
        find: (q: unknown) => {
          select: (f: string) => Promise<unknown[]>;
        };
      }
    )
      .find({ _id: { $in: programIds } })
      .select("_id isFree mentors");

    const typedPrograms = programs as Array<{
      _id: mongoose.Types.ObjectId;
      isFree?: boolean;
      mentors?: Array<{ userId: unknown }>;
    }>;

    // Check if at least one program is paid
    const hasPaidProgram = typedPrograms.some((p) => p.isFree !== true);

    // If all programs are free, no validation needed
    if (!hasPaidProgram) {
      return { valid: true };
    }

    // Step 2: Validate each co-organizer has access to at least one paid program
    const unauthorizedCoOrganizers: Array<{ userId: string; name: string }> =
      [];

    for (const organizer of organizerDetails) {
      const userId = organizer.userId;

      // Skip if no userId specified
      if (!userId) {
        continue;
      }

      const userIdStr = String(userId);

      // Check if user has access to at least one program
      let hasAccessToAny = false;

      for (const program of typedPrograms) {
        // Skip free programs
        if (program.isFree === true) {
          continue;
        }

        // Check 1: Is user a mentor of this program?
        const isMentor = program.mentors?.some(
          (m) => String(m.userId) === userIdStr
        );

        if (isMentor) {
          hasAccessToAny = true;
          break; // Found access, no need to check other programs
        }

        // Check 2: Has user purchased this program?
        const purchase = await (
          Purchase as unknown as {
            findOne: (q: unknown) => Promise<unknown>;
          }
        ).findOne({
          userId: new mongoose.Types.ObjectId(userIdStr),
          programId: program._id,
          status: "completed",
        });

        if (purchase) {
          hasAccessToAny = true;
          break; // Found access, no need to check other programs
        }
      }

      // If user has no access to any of the paid programs, mark as unauthorized
      if (!hasAccessToAny) {
        unauthorizedCoOrganizers.push({
          userId: userIdStr,
          name: organizer.name || "Unknown",
        });
      }
    }

    // Step 3: Return validation result
    if (unauthorizedCoOrganizers.length > 0) {
      const names = unauthorizedCoOrganizers.map((u) => u.name).join(", ");
      return {
        valid: false,
        error: {
          status: 403,
          message: `The following co-organizer(s) do not have access to the paid program(s) associated with this event: ${names}. Co-organizers must be enrolled in at least one of the event's paid programs.`,
          data: {
            unauthorizedCoOrganizers,
          },
        },
      };
    }

    return { valid: true };
  }
}
