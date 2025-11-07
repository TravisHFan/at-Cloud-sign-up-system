import mongoose from "mongoose";
import { Program, Purchase } from "../../models";

/**
 * EventProgramLinkageService
 *
 * Handles program association and validation for event creation.
 * Extracted from CreationController.ts for better organization and maintainability.
 *
 * Responsibilities:
 * - Validate and deduplicate program IDs
 * - Verify program existence
 * - Enforce Leader access rules (free programs, purchased programs, mentor programs)
 * - Prepare validated ObjectIds for event document
 * - Perform bidirectional linking (event.programLabels and program.events)
 */

interface ProgramLinkageResult {
  valid: boolean;
  validatedProgramLabels?: mongoose.Types.ObjectId[];
  linkedPrograms?: Array<{ _id: unknown }>;
  error?: {
    status: number;
    message: string;
    data?: unknown;
  };
}

interface UserContext {
  _id: unknown;
  role: string;
}

export class EventProgramLinkageService {
  /**
   * Validate and prepare program linkage for event creation
   *
   * @param rawProgramLabels - Array of program IDs from request body
   * @param user - Current user context (for Leader access validation)
   * @returns Program linkage result with validated ObjectIds and linked programs, or validation error
   */
  static async validateAndLinkPrograms(
    rawProgramLabels: unknown,
    user: UserContext
  ): Promise<ProgramLinkageResult> {
    // If no program labels provided, return empty result
    if (!Array.isArray(rawProgramLabels) || rawProgramLabels.length === 0) {
      return {
        valid: true,
        validatedProgramLabels: [],
        linkedPrograms: [],
      };
    }

    // Step 1: Validate and deduplicate program IDs
    const programIds = rawProgramLabels
      .filter((id) => id !== null && id !== undefined && id !== "none")
      .map((id) => String(id))
      .filter((id) => id.trim() !== "");

    const uniqueIds = Array.from(new Set(programIds));

    const linkedPrograms: Array<{ _id: unknown }> = [];
    const validatedProgramLabels: mongoose.Types.ObjectId[] = [];

    // Step 2: Validate each program ID and verify existence
    for (const pid of uniqueIds) {
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return {
          valid: false,
          error: {
            status: 400,
            message: `Invalid program ID: ${pid}`,
          },
        };
      }

      // Verify program exists and fetch required fields
      const program = await (
        Program as unknown as {
          findById: (id: string) => {
            select: (f: string) => Promise<unknown>;
          };
        }
      )
        .findById(pid)
        .select("_id programType isFree mentors");

      if (!program) {
        return {
          valid: false,
          error: {
            status: 400,
            message: `Program not found for ID: ${pid}`,
          },
        };
      }

      linkedPrograms.push(program as { _id: unknown });
      validatedProgramLabels.push(new mongoose.Types.ObjectId(pid));
    }

    // Step 3: FOR LEADER USERS - Validate access to each program
    if (user.role === "Leader") {
      const leaderAccessResult = await this.validateLeaderAccess(
        linkedPrograms,
        user._id
      );
      if (!leaderAccessResult.valid) {
        return leaderAccessResult;
      }
    }

    return {
      valid: true,
      validatedProgramLabels,
      linkedPrograms,
    };
  }

  /**
   * Validate that a Leader user has access to all specified programs
   * Leaders can only associate programs they have access to:
   * - Free programs (accessible to everyone)
   * - Programs where they are a mentor
   * - Programs they have purchased
   */
  private static async validateLeaderAccess(
    linkedPrograms: Array<{ _id: unknown }>,
    userId: unknown
  ): Promise<ProgramLinkageResult> {
    for (const program of linkedPrograms) {
      const prog = program as {
        _id: unknown;
        isFree?: boolean;
        mentors?: Array<{ userId: unknown }>;
      };

      // Check 1: Is program free?
      if (prog.isFree === true) {
        continue; // Free programs are accessible to everyone
      }

      // Check 2: Is user a mentor of this program?
      const isMentor = prog.mentors?.some(
        (m) => String(m.userId) === String(userId)
      );
      if (isMentor) {
        continue; // Mentors have access without purchasing
      }

      // Check 3: Has user purchased this program?
      const purchase = await (
        Purchase as unknown as {
          findOne: (q: unknown) => Promise<unknown>;
        }
      ).findOne({
        userId: userId,
        programId: prog._id,
        status: "completed",
      });

      if (!purchase) {
        // User is Leader but has no access to this program
        return {
          valid: false,
          error: {
            status: 403,
            message:
              "You can only associate programs that you have access to (free programs, purchased programs, or programs where you are a mentor).",
            data: {
              programId: String(prog._id),
              reason: "no_access",
            },
          },
        };
      }
    }

    return { valid: true };
  }

  /**
   * Add event to program.events arrays (bidirectional linking)
   * This is called after event creation to maintain the relationship in both directions
   *
   * @param eventId - The created event's ID
   * @param linkedPrograms - Array of programs to link to
   */
  static async linkEventToPrograms(
    eventId: unknown,
    linkedPrograms: Array<{ _id: unknown }>
  ): Promise<void> {
    if (linkedPrograms.length === 0) {
      return;
    }

    for (const program of linkedPrograms) {
      try {
        await (
          Program as unknown as {
            updateOne: (q: unknown, u: unknown) => Promise<unknown>;
          }
        ).updateOne(
          { _id: program._id },
          { $addToSet: { events: eventId } } // $addToSet makes this idempotent
        );
      } catch (e) {
        console.warn(`Failed to add event to program ${program._id}`, e);
        // Continue with other programs even if one fails
      }
    }
  }
}
