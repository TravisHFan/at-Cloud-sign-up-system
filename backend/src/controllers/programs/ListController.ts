import { Request, Response } from "express";
import { Program } from "../../models";

export default class ListController {
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
}
