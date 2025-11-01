import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event } from "../../models";

export default class EventListController {
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
}
