import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event, Program, Purchase, User } from "../models";
import AuditLog from "../models/AuditLog";
import { EventCascadeService } from "../services";
import { RoleUtils } from "../utils/roleUtils";

export class ProgramController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }
      if (!RoleUtils.isAdmin(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only Administrators can create programs.",
        });
        return;
      }

      const payload = req.body || {};
      const doc = await Program.create({ ...payload, createdBy: req.user._id });
      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: (error as Error).message });
    }
  }

  /**
   * Retrieves all events linked to a specific program
   *
   * @route GET /programs/:id/events
   * @param req.params.id - Program ObjectId (required)
   * @returns {Object} Success response with events array sorted by date/time
   * @example
   * // Response format
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "_id": "event123",
   *       "title": "Event Title",
   *       "date": "2025-01-15",
   *       "time": "10:00",
   *       "programId": "program123",
   *       // ... other event fields
   *     }
   *   ]
   * }
   * @throws {400} Invalid program ID format
   * @throws {500} Database error during retrieval
   */
  static async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      // Optional server-side pagination when page & limit are provided
      const { page, limit, sort } = req.query as {
        page?: string;
        limit?: string;
        sort?: string; // e.g., "date:asc" or "date:desc"
      };

      const pageNum = Number(page);
      const limitNum = Number(limit);

      // If valid pagination params supplied, return paginated shape
      const shouldPaginate =
        Number.isFinite(pageNum) &&
        pageNum > 0 &&
        Number.isFinite(limitNum) &&
        limitNum > 0;

      if (shouldPaginate) {
        // Parse sort param: default date:asc
        let sortField = "date";
        let sortDir: "asc" | "desc" = "asc";
        if (typeof sort === "string" && sort.includes(":")) {
          const [field, dir] = sort.split(":");
          if (field) sortField = field;
          if (dir === "asc" || dir === "desc") sortDir = dir;
        }
        const sortSpec: Record<string, 1 | -1> = {
          [sortField]: sortDir === "desc" ? -1 : 1,
        };
        // For stable ordering when times exist on same date, add secondary time asc/desc
        if (sortField === "date") {
          sortSpec["time"] = sortDir === "desc" ? -1 : 1;
        }

        // Query programLabels array: find events where programLabels contains this program ID
        const filter = { programLabels: id } as const;
        const total = await Event.countDocuments(filter);
        const items = await Event.find(filter)
          .sort(sortSpec)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean();

        // Transform _id to id for frontend compatibility (lean() bypasses toJSON transform)
        const transformedItems = items.map((item) => {
          const { _id, ...rest } = item as Record<string, unknown> & {
            _id: unknown;
          };
          return {
            ...rest,
            id: _id?.toString(),
          };
        });

        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        res.status(200).json({
          success: true,
          data: {
            items: transformedItems,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            sort: { field: sortField, dir: sortDir },
          },
        });
        return;
      }

      // Legacy behavior: return full array (sorted asc)
      // Query programLabels array: find events where programLabels contains this program ID
      const events = await Event.find({ programLabels: id })
        .sort({ date: 1, time: 1 })
        .lean();

      // Transform _id to id for frontend compatibility (lean() bypasses toJSON transform)
      const transformedEvents = events.map((event) => {
        const { _id, ...rest } = event as Record<string, unknown> & {
          _id: unknown;
        };
        return {
          ...rest,
          id: _id?.toString(),
        };
      });

      res.status(200).json({ success: true, data: transformedEvents });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to list program events." });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { type, q } = req.query as { type?: string; q?: string };
      const filter: Record<string, unknown> = {};
      if (type) filter.programType = type;
      if (q) filter.title = { $regex: q, $options: "i" };
      const programs = await Program.find(filter as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .lean();

      // Transform _id to id for frontend compatibility (lean() bypasses toJSON transform)
      const transformedPrograms = programs.map((program) => {
        const { _id, ...rest } = program as Record<string, unknown> & {
          _id: unknown;
        };
        return {
          ...rest,
          id: _id?.toString(),
        };
      });

      res.status(200).json({ success: true, data: transformedPrograms });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to list programs." });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }
      res.status(200).json({ success: true, data: program });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to get program." });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }
      if (!RoleUtils.isAdmin(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only Administrators can update programs.",
        });
        return;
      }
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      const updated = await Program.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!updated) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: (error as Error).message });
    }
  }

  /**
   * Deletes a program with optional cascade deletion of linked events
   *
   * @route DELETE /programs/:id?deleteLinkedEvents=true|false
   * @param req.params.id - Program ObjectId (required)
   * @param req.query.deleteLinkedEvents - Boolean flag for cascade deletion (optional, default: false)
   * @security Requires Administrator or Super Admin role
   * @returns {Object} Success response with deletion details
   *
   * @example
   * // Unlink-only mode (deleteLinkedEvents=false or omitted)
   * {
   *   "success": true,
   *   "message": "Program deleted. Unlinked 3 related events.",
   *   "unlinkedEvents": 3
   * }
   *
   * @example
   * // Cascade mode (deleteLinkedEvents=true)
   * {
   *   "success": true,
   *   "message": "Program and 3 events deleted with cascades.",
   *   "deletedEvents": 3,
   *   "deletedRegistrations": 15,
   *   "deletedGuestRegistrations": 8
   * }
   *
   * @throws {401} Authentication required
   * @throws {403} Only Administrators can delete programs
   * @throws {400} Invalid program ID format
   * @throws {500} Database error during deletion
   */
  static async remove(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }
      if (!RoleUtils.isAdmin(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only Administrators can delete programs.",
        });
        return;
      }
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      const deleteLinkedEvents =
        String(
          (req.query as { deleteLinkedEvents?: string }).deleteLinkedEvents ??
            "false"
        ).toLowerCase() === "true";

      // Get program details before deletion for audit log
      const program = await Program.findById(id).lean();
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      const programData = program as {
        _id: unknown;
        title?: string;
        programType?: string;
      };

      if (!deleteLinkedEvents) {
        // Remove this program from all events' programLabels arrays
        const result = await Event.updateMany(
          { programLabels: id },
          { $pull: { programLabels: id } }
        );
        await Program.findByIdAndDelete(id);

        // Audit log for program deletion (unlink mode)
        try {
          await AuditLog.create({
            action: "program_deletion",
            actor: {
              id: req.user._id,
              role: req.user.role,
              email: req.user.email,
            },
            targetModel: "Program",
            targetId: id,
            details: {
              targetProgram: {
                id: programData._id,
                title: programData.title,
                programType: programData.programType,
              },
              cascadeMode: "unlink",
              unlinkedEvents: result.modifiedCount || 0,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || "unknown",
          });
        } catch (auditError) {
          console.error(
            "Failed to create audit log for program deletion:",
            auditError
          );
          // Don't fail the request if audit logging fails
        }

        res.status(200).json({
          success: true,
          message: `Program deleted. Unlinked ${
            result.modifiedCount || 0
          } related events.`,
          unlinkedEvents: result.modifiedCount || 0,
        });
        return;
      }

      // Cascade delete all linked events (events that have this program in programLabels)
      const events = await Event.find({ programLabels: id }).select("_id");
      let totalDeletedRegs = 0;
      let totalDeletedGuests = 0;
      for (const e of events) {
        const { deletedRegistrations, deletedGuestRegistrations } =
          await EventCascadeService.deleteEventFully(String(e._id));
        totalDeletedRegs += deletedRegistrations;
        totalDeletedGuests += deletedGuestRegistrations;
      }
      await Program.findByIdAndDelete(id);

      // Audit log for program deletion (cascade mode)
      try {
        await AuditLog.create({
          action: "program_deletion",
          actor: {
            id: req.user._id,
            role: req.user.role,
            email: req.user.email,
          },
          targetModel: "Program",
          targetId: id,
          details: {
            targetProgram: {
              id: programData._id,
              title: programData.title,
              programType: programData.programType,
            },
            cascadeMode: "delete",
            deletedEvents: events.length,
            deletedRegistrations: totalDeletedRegs,
            deletedGuestRegistrations: totalDeletedGuests,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
        });
      } catch (auditError) {
        console.error(
          "Failed to create audit log for program deletion:",
          auditError
        );
        // Don't fail the request if audit logging fails
      }

      res.status(200).json({
        success: true,
        message: `Program and ${events.length} events deleted with cascades.`,
        deletedEvents: events.length,
        deletedRegistrations: totalDeletedRegs,
        deletedGuestRegistrations: totalDeletedGuests,
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to delete program." });
    }
  }

  /**
   * Get all participants (mentees and class reps) for a program
   * Combines paid purchases and admin enrollments
   *
   * @route GET /programs/:id/participants
   * @returns {Object} Lists of mentees and classReps with user info and enrollment metadata
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Get all completed purchases for this program
      const purchases = await Purchase.find({
        programId: id,
        status: "completed",
      })
        .populate<{
          userId: {
            _id: mongoose.Types.ObjectId;
            firstName: string;
            lastName: string;
            email: string;
            phone?: string;
            avatar?: string;
            gender?: string;
            roleInAtCloud?: string;
          };
        }>(
          "userId",
          "firstName lastName email phone avatar gender roleInAtCloud"
        )
        .sort({ purchaseDate: 1 }); // Sort by enrollment date

      // Separate mentees and class reps from purchases
      const paidMentees = purchases
        .filter((p) => !p.isClassRep)
        .map((p) => ({
          user: p.userId,
          isPaid: true,
          enrollmentDate: p.purchaseDate,
        }));

      const paidClassReps = purchases
        .filter((p) => p.isClassRep)
        .map((p) => ({
          user: p.userId,
          isPaid: true,
          enrollmentDate: p.purchaseDate,
        }));

      // Get admin enrollments
      const adminMenteeIds = program.adminEnrollments?.mentees || [];
      const adminClassRepIds = program.adminEnrollments?.classReps || [];

      const adminMentees = await User.find({
        _id: { $in: adminMenteeIds },
      }).select(
        "_id firstName lastName email phone avatar gender roleInAtCloud"
      );

      const adminClassReps = await User.find({
        _id: { $in: adminClassRepIds },
      }).select(
        "_id firstName lastName email phone avatar gender roleInAtCloud"
      );

      // Combine paid and admin enrollments (admins sorted to end for now, can adjust later)
      const allMentees = [
        ...paidMentees,
        ...adminMentees.map((user) => ({
          user,
          isPaid: false,
          enrollmentDate: program.updatedAt, // Use program updated date as proxy
        })),
      ];

      const allClassReps = [
        ...paidClassReps,
        ...adminClassReps.map((user) => ({
          user,
          isPaid: false,
          enrollmentDate: program.updatedAt,
        })),
      ];

      res.status(200).json({
        success: true,
        data: {
          mentees: allMentees,
          classReps: allClassReps,
        },
      });
    } catch (error) {
      console.error("Error fetching program participants:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch program participants.",
      });
    }
  }

  /**
   * Admin enrollment - allows Super Admin & Administrator to enroll as mentee or class rep
   *
   * @route POST /programs/:id/admin-enroll
   * @body { enrollAs: 'mentee' | 'classRep' }
   * @returns {Object} Updated program with admin enrollment
   */
  static async adminEnroll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      // Only Super Admin and Administrator can use this endpoint
      if (
        req.user.role !== "Super Admin" &&
        req.user.role !== "Administrator"
      ) {
        res.status(403).json({
          success: false,
          message: "Only Super Admin and Administrator can enroll for free.",
        });
        return;
      }

      const { id } = req.params;
      const { enrollAs } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      if (enrollAs !== "mentee" && enrollAs !== "classRep") {
        res.status(400).json({
          success: false,
          message: "enrollAs must be 'mentee' or 'classRep'.",
        });
        return;
      }

      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Initialize adminEnrollments if it doesn't exist
      if (!program.adminEnrollments) {
        program.adminEnrollments = { mentees: [], classReps: [] };
      }
      if (!program.adminEnrollments.mentees) {
        program.adminEnrollments.mentees = [];
      }
      if (!program.adminEnrollments.classReps) {
        program.adminEnrollments.classReps = [];
      }

      // Check if user is already enrolled in either category
      const userId = req.user._id as mongoose.Types.ObjectId;
      const isMentee = program.adminEnrollments.mentees.some(
        (uid: mongoose.Types.ObjectId) => uid.toString() === userId.toString()
      );
      const isClassRep = program.adminEnrollments.classReps.some(
        (uid: mongoose.Types.ObjectId) => uid.toString() === userId.toString()
      );

      if (isMentee || isClassRep) {
        res.status(400).json({
          success: false,
          message:
            "You are already enrolled. Please unenroll first before enrolling as a different type.",
        });
        return;
      }

      // Add user to the appropriate list
      if (enrollAs === "mentee") {
        program.adminEnrollments.mentees.push(req.user._id);
      } else {
        program.adminEnrollments.classReps.push(req.user._id);
      }

      await program.save();

      // Audit log
      try {
        await AuditLog.create({
          action: "program_admin_enroll",
          actor: {
            id: req.user._id,
            role: req.user.role,
            email: req.user.email,
          },
          targetModel: "Program",
          targetId: id,
          details: {
            programTitle: program.title,
            enrollAs,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
        });
      } catch (auditError) {
        console.error(
          "Failed to create audit log for admin enrollment:",
          auditError
        );
      }

      res.status(200).json({
        success: true,
        message: `Successfully enrolled as ${enrollAs}.`,
        data: program,
      });
    } catch (error) {
      console.error("Error enrolling admin:", error);
      res.status(500).json({
        success: false,
        message: "Failed to enroll admin.",
      });
    }
  }

  /**
   * Admin unenrollment - removes admin from mentee or class rep list
   *
   * @route DELETE /programs/:id/admin-enroll
   * @returns {Object} Updated program without admin enrollment
   */
  static async adminUnenroll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      // Only Super Admin and Administrator can use this endpoint
      if (
        req.user.role !== "Super Admin" &&
        req.user.role !== "Administrator"
      ) {
        res.status(403).json({
          success: false,
          message: "Only Super Admin and Administrator can unenroll.",
        });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      if (!program.adminEnrollments) {
        res.status(400).json({
          success: false,
          message: "You are not enrolled in this program.",
        });
        return;
      }

      // Remove user from both lists (in case they're in one)
      const userId = req.user._id as mongoose.Types.ObjectId;
      const menteeIndex =
        program.adminEnrollments.mentees?.findIndex(
          (uid: mongoose.Types.ObjectId) => uid.toString() === userId.toString()
        ) ?? -1;
      const classRepIndex =
        program.adminEnrollments.classReps?.findIndex(
          (uid: mongoose.Types.ObjectId) => uid.toString() === userId.toString()
        ) ?? -1;

      let enrollmentType = "";
      if (menteeIndex !== -1) {
        program.adminEnrollments.mentees?.splice(menteeIndex, 1);
        enrollmentType = "mentee";
      } else if (classRepIndex !== -1) {
        program.adminEnrollments.classReps?.splice(classRepIndex, 1);
        enrollmentType = "classRep";
      } else {
        res.status(400).json({
          success: false,
          message: "You are not enrolled in this program.",
        });
        return;
      }

      await program.save();

      // Audit log
      try {
        await AuditLog.create({
          action: "program_admin_unenroll",
          actor: {
            id: req.user._id,
            role: req.user.role,
            email: req.user.email,
          },
          targetModel: "Program",
          targetId: id,
          details: {
            programTitle: program.title,
            enrollmentType,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
        });
      } catch (auditError) {
        console.error(
          "Failed to create audit log for admin unenrollment:",
          auditError
        );
      }

      res.status(200).json({
        success: true,
        message: "Successfully unenrolled from program.",
        data: program,
      });
    } catch (error) {
      console.error("Error unenrolling admin:", error);
      res.status(500).json({
        success: false,
        message: "Failed to unenroll admin.",
      });
    }
  }
}
