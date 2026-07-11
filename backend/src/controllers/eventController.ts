import mongoose, { FilterQuery, Types } from "mongoose";
import { Event, IEvent, Program } from "../models";
import { deriveEventStatus } from "../utils/event/eventStatus";
import { toInstantFromWallClock } from "../utils/event/timezoneUtils";
import { toIdString } from "../utils/idUtils";

export interface EventTimeConflict {
  id: string;
  title: string;
  date: string;
  endDate: string;
  time: string;
  endTime: string;
  timeZone?: string;
  programLabels: string[];
  programs: Array<{ id: string; title: string }>;
}

/**
 * Shared event-domain helpers. HTTP handlers live in focused controllers under
 * `controllers/event`; this class intentionally contains no route delegation.
 */
export class EventController {
  public static toIdString = toIdString;

  public static async findConflictingEvents(
    startDate: string,
    startTime: string,
    endDate: string,
    endTime: string,
    excludeEventId?: string,
    candidateTimeZone?: string,
    candidateProgramLabels?: string[],
  ): Promise<EventTimeConflict[]> {
    void candidateProgramLabels;

    const dateRangeFilter: FilterQuery<IEvent> = {
      status: { $ne: "cancelled" },
      date: { $lte: endDate },
      endDate: { $gte: startDate },
    };
    if (excludeEventId && mongoose.Types.ObjectId.isValid(excludeEventId)) {
      dateRangeFilter._id = {
        $ne: new mongoose.Types.ObjectId(excludeEventId),
      };
    }

    type CandidateEvent = {
      _id: Types.ObjectId;
      title: string;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      timeZone?: string;
      programLabels?: Types.ObjectId[];
    };
    type Chain =
      | {
          select?: (fields: string) => unknown;
          lean?: () => Promise<unknown>;
        }
      | Promise<unknown>
      | unknown;

    let query = (Event as unknown as { find: (q: unknown) => Chain }).find(
      dateRangeFilter,
    );
    if (query && typeof (query as { select?: unknown }).select === "function") {
      query = (query as { select: (fields: string) => unknown }).select(
        "_id title date endDate time endTime timeZone programLabels",
      ) as Chain;
    }
    const rawCandidates =
      query && typeof (query as { lean?: unknown }).lean === "function"
        ? await (query as { lean: () => Promise<unknown> }).lean()
        : await (query as Promise<unknown>);
    const candidates = Array.isArray(rawCandidates)
      ? (rawCandidates as CandidateEvent[])
      : [];

    const newStart = toInstantFromWallClock(
      startDate,
      startTime,
      candidateTimeZone,
    );
    const newEnd = toInstantFromWallClock(endDate, endTime, candidateTimeZone);
    const conflicts = candidates.filter((event) => {
      const eventStart = toInstantFromWallClock(
        event.date,
        event.time,
        event.timeZone,
      );
      const eventEnd = toInstantFromWallClock(
        event.endDate || event.date,
        event.endTime,
        event.timeZone,
      );
      return newStart < eventEnd && newEnd > eventStart;
    });

    const programIds = Array.from(
      new Set(
        conflicts.flatMap((event) =>
          (event.programLabels || []).map((id) => id.toString()),
        ),
      ),
    );
    const programTitleById = new Map<string, string>();
    if (programIds.length > 0) {
      try {
        const programs = (await Program.find({ _id: { $in: programIds } })
          .select("_id title")
          .lean()) as unknown as Array<{ _id: Types.ObjectId; title: string }>;
        for (const program of programs) {
          programTitleById.set(program._id.toString(), program.title);
        }
      } catch {
        // Program titles are supplementary; overlap detection remains useful.
      }
    }

    return conflicts.map((event) => {
      const labels = (event.programLabels || []).map((id) => id.toString());
      return {
        id: event._id.toString(),
        title: event.title,
        date: event.date,
        endDate: event.endDate || event.date,
        time: event.time,
        endTime: event.endTime,
        timeZone: event.timeZone,
        programLabels: labels,
        programs: labels.map((programId) => ({
          id: programId,
          title: programTitleById.get(programId) || "Unknown program",
        })),
      };
    });
  }

  public static getEventStatus(
    eventDate: string,
    eventEndDateOrTime: string,
    eventTimeOrEndTime: string,
    maybeEventEndTime?: string,
    maybeTimeZone?: string,
  ): "upcoming" | "ongoing" | "completed" {
    const legacySignature = typeof maybeEventEndTime === "undefined";
    return deriveEventStatus(
      eventDate,
      legacySignature ? eventDate : eventEndDateOrTime,
      legacySignature ? eventEndDateOrTime : eventTimeOrEndTime,
      legacySignature ? eventTimeOrEndTime : maybeEventEndTime,
      maybeTimeZone,
    );
  }
}
