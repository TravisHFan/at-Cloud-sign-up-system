import mongoose from "mongoose";
import { Program, Purchase } from "../../models";
import { EventController } from "../../controllers/eventController";

/**
 * ProgramLinkageService
 * Handles program association and validation for event updates.
 * Extracted from UpdateController Phase 8.1.4.
 */
export class ProgramLinkageService {
  /**
   * Extract previous program labels from event.
   */
  static extractPreviousLabels(event: { programLabels?: unknown }): string[] {
    return Array.isArray(event.programLabels)
      ? event.programLabels.map((id: unknown) => EventController.toIdString(id))
      : [];
  }

  /**
   * Process and validate program labels from update request.
   * Returns validated program IDs or null if validation fails.
   */
  static async processAndValidate(
    rawProgramLabels: unknown,
    userId?: unknown,
    userRole?: string
  ): Promise<{
    success: boolean;
    programIds?: string[];
    linkedPrograms?: Array<{ _id: unknown }>;
    error?: { status: number; message: string; data?: unknown };
  }> {
    // If explicitly clearing (null or empty string)
    if (rawProgramLabels === null || rawProgramLabels === "") {
      return { success: true, programIds: [], linkedPrograms: [] };
    }

    // Must be array
    if (!Array.isArray(rawProgramLabels)) {
      return { success: true, programIds: [], linkedPrograms: [] };
    }

    // Filter out invalid values
    const programIds = rawProgramLabels
      .filter((id) => id && String(id).trim() && id !== "none")
      .map((id) => String(id).trim());

    // Deduplicate
    const uniqueIds = Array.from(new Set(programIds));

    // Validate each ID and fetch program documents
    const linkedProgramDocs: Array<{ _id: unknown }> = [];

    for (const pid of uniqueIds) {
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return {
          success: false,
          error: {
            status: 400,
            message: `Invalid program ID: ${pid}`,
          },
        };
      }

      // Verify program exists
      const program = await (
        Program as unknown as {
          findById: (id: string) => {
            select: (f: string) => Promise<unknown>;
          };
        }
      )
        .findById(pid)
        .select("_id isFree mentors");

      if (!program) {
        return {
          success: false,
          error: {
            status: 400,
            message: `Program not found: ${pid}`,
          },
        };
      }

      linkedProgramDocs.push(program as { _id: unknown });
    }

    // FOR LEADER USERS: Validate they can only associate programs they have access to
    if (userRole === "Leader") {
      const accessCheck = await this.validateLeaderAccess(
        linkedProgramDocs,
        userId
      );
      if (!accessCheck.success) {
        return accessCheck;
      }
    }

    return {
      success: true,
      programIds: uniqueIds,
      linkedPrograms: linkedProgramDocs,
    };
  }

  /**
   * Validate that a Leader user has access to all specified programs.
   * Access is granted if: program is free, user is a mentor, or user purchased it.
   */
  private static async validateLeaderAccess(
    linkedPrograms: Array<{ _id: unknown }>,
    userId?: unknown
  ): Promise<{
    success: boolean;
    error?: { status: number; message: string; data?: unknown };
  }> {
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
          success: false,
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

    return { success: true };
  }

  /**
   * Convert validated program IDs to ObjectId array for storage.
   */
  static toObjectIdArray(programIds: string[]): mongoose.Types.ObjectId[] {
    return programIds.map((id) => new mongoose.Types.ObjectId(id));
  }
}
