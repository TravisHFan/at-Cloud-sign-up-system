import { Request, Response } from "express";
import { Types } from "mongoose";
import { Event } from "../../models";
import { EventController } from "../eventController";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { CachePatterns } from "../../services";

/**
 * BatchOperationsController
 *
 * Handles batch operations on events:
 * - updateAllEventStatuses: Batch update all event statuses based on current time
 * - recalculateSignupCounts: Recalculate signup counts for all events
 *
 * These are typically admin/system operations run periodically or manually.
 */
export class BatchOperationsController {
  // Batch update all event statuses (can be called periodically)
  static async updateAllEventStatuses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount =
        await BatchOperationsController.updateAllEventStatusesHelper();

      res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} event statuses.`,
        data: { updatedCount },
      });
    } catch (error: unknown) {
      console.error("Update event statuses error:", error);
      CorrelatedLogger.fromRequest(req, "BatchOperationsController").error(
        "updateAllEventStatuses failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to update event statuses.",
      });
    }
  }

  // Helper method to update all event statuses without sending response
  public static async updateAllEventStatusesHelper(): Promise<number> {
    // Be robust to test doubles that don't support chaining
    type StatusChain =
      | {
          select?: (fields: string) => unknown;
          lean?: () => Promise<unknown>;
        }
      | Promise<unknown>
      | unknown;
    const findRes = (
      Event as unknown as { find: (q: unknown) => StatusChain }
    ).find({ status: { $ne: "cancelled" } });
    let events: Array<{
      _id: Types.ObjectId;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      status: string;
    }> = [] as Array<{
      _id: Types.ObjectId;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      status: string;
    }>;
    if (
      findRes &&
      typeof (findRes as { select?: unknown }).select === "function"
    ) {
      try {
        const maybe = (
          findRes as { select: (fields: string) => unknown }
        ).select("_id date endDate time endTime status timeZone");
        // Prefer lean when available to reduce overhead
        if (maybe && typeof (maybe as { lean?: unknown }).lean === "function") {
          events = (await (
            maybe as { lean: () => Promise<unknown> }
          ).lean()) as Array<{
            _id: Types.ObjectId;
            date: string;
            endDate?: string;
            time: string;
            endTime: string;
            status: string;
            timeZone?: string;
          }>;
        } else {
          events = (await maybe) as Array<{
            _id: Types.ObjectId;
            date: string;
            endDate?: string;
            time: string;
            endTime: string;
            status: string;
            timeZone?: string;
          }>;
        }
      } catch {
        // Fallback to awaiting the original query/mocked value
        events = (await (findRes as Promise<unknown>)) as Array<{
          _id: Types.ObjectId;
          date: string;
          endDate?: string;
          time: string;
          endTime: string;
          status: string;
          timeZone?: string;
        }>;
      }
    } else {
      // Mocked implementation might return an array directly
      events = (await (findRes as Promise<unknown>)) as Array<{
        _id: Types.ObjectId;
        date: string;
        endDate?: string;
        time: string;
        endTime: string;
        status: string;
        timeZone?: string;
      }>;
    }
    let updatedCount = 0;

    for (const event of events) {
      const newStatus = EventController.getEventStatus(
        event.date,
        (event.endDate as unknown as string) || event.date,
        event.time,
        event.endTime,
        // @ts-expect-error test doubles in certain suites may omit timeZone
        event.timeZone
      );

      if (event.status !== newStatus) {
        await Event.findByIdAndUpdate(event._id, { status: newStatus });
        updatedCount++;

        // Invalidate caches after status update
        await CachePatterns.invalidateEventCache(event._id.toString());
        await CachePatterns.invalidateAnalyticsCache();
      }
    }

    return updatedCount;
  }

  // Recalculate signup counts for all events
  static async recalculateSignupCounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount =
        await BatchOperationsController.recalculateSignupCountsHelper();

      res.status(200).json({
        success: true,
        message: `Recalculated signup counts for ${updatedCount} events.`,
        data: { updatedCount },
      });
    } catch (error: unknown) {
      console.error("Recalculate signup counts error:", error);
      CorrelatedLogger.fromRequest(req, "BatchOperationsController").error(
        "recalculateSignupCounts failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to recalculate signup counts.",
      });
    }
  }

  // Helper method to recalculate signup counts for all events
  public static async recalculateSignupCountsHelper(): Promise<number> {
    const events = await Event.find({});
    let updatedCount = 0;

    for (const event of events) {
      const currentSignedUp = event.signedUp || 0;
      const calculatedSignedUp = await event.calculateSignedUp();

      if (currentSignedUp !== calculatedSignedUp) {
        await Event.findByIdAndUpdate(event._id, {
          signedUp: calculatedSignedUp,
        });
        updatedCount++;

        // Invalidate caches after signup count update
        await CachePatterns.invalidateEventCache(
          EventController.toIdString(event._id)
        );
        await CachePatterns.invalidateAnalyticsCache();
      }
    }

    return updatedCount;
  }
}
