import { Request, Response } from "express";
import { Program } from "../../models";
import {
  normalizeProgramRoles,
  type ProgramRoleSource,
} from "../../utils/programRoles";
import { escapeRegex, normalizeSearchText } from "../../utils/search";

const PROGRAM_LIST_PROJECTION = [
  "title",
  "programType",
  "hostedBy",
  "period",
  "introduction",
  "flyerUrl",
  "zoomLink",
  "meetingId",
  "passcode",
  "earlyBirdDeadline",
  "isFree",
  "programRoles",
  "mentors",
  "adminEnrollments",
  "fullPriceTicket",
  "classRepDiscount",
  "earlyBirdDiscount",
  "events",
  "createdBy",
  "createdAt",
  "updatedAt",
].join(" ");

export default class ListController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { type, q } = req.query as { type?: string; q?: string };
      const requestedPage = Number.parseInt(String(req.query.page ?? "1"), 10);
      const requestedLimit = Number.parseInt(
        String(req.query.limit ?? "20"),
        10,
      );
      const page = requestedPage > 0 ? requestedPage : 1;
      const limit =
        requestedLimit > 0 ? Math.min(requestedLimit, 100) : 20;
      const skip = (page - 1) * limit;
      const filter: Record<string, unknown> = {};
      if (type) filter.programType = type;
      const search = normalizeSearchText(q);
      if (search) {
        filter.title = { $regex: escapeRegex(search), $options: "i" };
      }
      const [programs, totalPrograms] = await Promise.all([
        Program.find(filter)
          .select(PROGRAM_LIST_PROJECTION)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Program.countDocuments(filter),
      ]);

      // Transform _id to id for frontend compatibility (lean() bypasses toJSON transform)
      const transformedPrograms = programs.map((program) => {
        const { _id, ...rest } = program as Record<string, unknown> & {
          _id: unknown;
        };
        return {
          ...rest,
          id: _id?.toString(),
          programRoles: normalizeProgramRoles(
            program as unknown as ProgramRoleSource,
          ),
        };
      });

      const totalPages = Math.ceil(totalPrograms / limit);
      res.status(200).json({
        success: true,
        data: transformedPrograms,
        pagination: {
          currentPage: page,
          limit,
          totalPrograms,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to list programs." });
    }
  }
}
