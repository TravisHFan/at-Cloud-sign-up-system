/**
 * EventConflictController
 *
 * Handles event scheduling conflict detection.
 * Extracted from eventController.ts for better modularity.
 */

import { Request, Response } from "express";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import {
  toInstantFromWallClock,
  instantToWallClock,
} from "../../utils/event/timezoneUtils";
import { EventController } from "../eventController";

export class EventConflictController {
  /**
   * Check for scheduling conflicts with existing events
   */
  static async checkTimeConflict(req: Request, res: Response): Promise<void> {
    try {
      const pickStr = (v: unknown): string | undefined =>
        typeof v === "string"
          ? v
          : Array.isArray(v) && typeof v[0] === "string"
          ? v[0]
          : undefined;
      const startDate = pickStr(req.query.startDate);
      const startTime = pickStr(req.query.startTime);
      const endDate = pickStr(req.query.endDate);
      const endTime = pickStr(req.query.endTime);
      const excludeId = pickStr(req.query.excludeId);
      const mode = pickStr(req.query.mode);
      const timeZone = pickStr(req.query.timeZone);

      if (!startDate || !startTime) {
        res.status(400).json({
          success: false,
          message: "startDate and startTime are required",
        });
        return;
      }

      // Point-in-interval check if end not provided
      const effectiveEndDate = endDate || startDate;
      const effectiveEndTime = endTime || startTime;

      // If explicitly point mode, nudge end time by +1 minute for detection using event's timeZone.
      let checkEndDate = effectiveEndDate as string;
      let checkEndTime = effectiveEndTime as string;
      if (!endDate || mode === "point") {
        const pt = toInstantFromWallClock(startDate, startTime, timeZone);
        const plus = new Date(pt.getTime() + 60 * 1000);
        const wc = instantToWallClock(plus, timeZone);
        checkEndDate = wc.date;
        checkEndTime = wc.time;
      }

      const conflicts = await EventController.findConflictingEvents(
        startDate,
        startTime,
        checkEndDate,
        checkEndTime,
        excludeId,
        timeZone
      );

      res.status(200).json({
        success: true,
        data: { conflict: conflicts.length > 0, conflicts },
      });
    } catch (error) {
      // console.error("checkTimeConflict error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "checkTimeConflict failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to check time conflicts.",
      });
    }
  }
}
