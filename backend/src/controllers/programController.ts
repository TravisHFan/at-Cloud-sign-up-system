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
}
