import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event, Program } from "../models";
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
      // v1 policy: unset programId on events and clear program.events
      await Event.updateMany({ programId: id }, { $set: { programId: null } });
      await Program.findByIdAndDelete(id);
      res.status(200).json({
        success: true,
        message: "Program deleted. Unlinked related events.",
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to delete program." });
    }
  }

  static async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      // Optional pagination and sorting via query params
      const { page, limit, sort } = req.query as {
        page?: string;
        limit?: string;
        sort?: string; // e.g., "date:asc" | "date:desc"
      };

      const type = (req.query as { type?: string }).type;
      const status = (req.query as { status?: string }).status;

      const filter: Record<string, unknown> = { programId: id };
      if (type) filter.type = type;
      if (status) filter.status = status;

      const hasPagingParams = Boolean(page || limit || sort || type || status);

      // Determine sort direction
      const sortDir = ((): 1 | -1 => {
        if (sort === "date:desc") return -1;
        return 1; // default asc
      })();

      const sortSpec = { date: sortDir, time: sortDir, createdAt: sortDir };

      if (!hasPagingParams) {
        // Legacy behavior: return full array (sorted asc by date/time)
        const events = await Event.find(filter).sort(sortSpec).lean();
        res.status(200).json({ success: true, data: events });
        return;
      }

      const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(limit || "20", 10) || 20)
      );

      const total = await Event.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));

      const items = await Event.find(filter)
        .sort(sortSpec)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          items,
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          sort: { field: "date", dir: sortDir === 1 ? "asc" : "desc" },
          filters: { ...(type ? { type } : {}), ...(status ? { status } : {}) },
        },
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to list program events." });
    }
  }
}
