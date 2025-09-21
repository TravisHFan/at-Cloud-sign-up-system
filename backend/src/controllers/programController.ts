import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event, Program } from "../models";
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

        const filter = { programId: id } as const;
        const total = await Event.countDocuments(filter);
        const items = await Event.find(filter)
          .sort(sortSpec)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean();
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        res.status(200).json({
          success: true,
          data: {
            items,
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
      const events = await Event.find({ programId: id })
        .sort({ date: 1, time: 1 })
        .lean();
      res.status(200).json({ success: true, data: events });
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
      res.status(200).json({ success: true, data: programs });
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

      if (!deleteLinkedEvents) {
        const result = await Event.updateMany(
          { programId: id },
          { $set: { programId: null } }
        );
        await Program.findByIdAndDelete(id);
        res.status(200).json({
          success: true,
          message: `Program deleted. Unlinked ${
            result.modifiedCount || 0
          } related events.`,
          unlinkedEvents: result.modifiedCount || 0,
        });
        return;
      }

      // Cascade delete all linked events then delete the program
      const events = await Event.find({ programId: id }).select("_id");
      let totalDeletedRegs = 0;
      let totalDeletedGuests = 0;
      for (const e of events) {
        const { deletedRegistrations, deletedGuestRegistrations } =
          await EventCascadeService.deleteEventFully(String(e._id));
        totalDeletedRegs += deletedRegistrations;
        totalDeletedGuests += deletedGuestRegistrations;
      }
      await Program.findByIdAndDelete(id);
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
}
