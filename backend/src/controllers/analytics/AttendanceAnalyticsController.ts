import { Request, Response } from "express";
import { Registration } from "../../models";
import { hasPermission, PERMISSIONS } from "../../utils/roleUtils";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

type AttendanceBucket = "attended" | "absent" | "unrecorded";

type ProgramRef = {
  id: string;
  title: string;
  programType?: string;
};

type AttendanceRegistrationRow = {
  registrationId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  roleInAtCloud?: string;
  systemAuthorizationLevel?: string;
  status?: string;
  attendanceConfirmed?: boolean;
  eventId: string;
  eventTitle: string;
  eventDate?: string | Date;
  eventType?: string;
  roleName?: string;
  programs?: ProgramRef[];
};

type AttendanceCounts = {
  registered: number;
  attended: number;
  absent: number;
  unrecorded: number;
};

const emptyCounts = (): AttendanceCounts => ({
  registered: 0,
  attended: 0,
  absent: 0,
  unrecorded: 0,
});

const getAttendanceBucket = (
  row: Pick<AttendanceRegistrationRow, "status" | "attendanceConfirmed">,
): AttendanceBucket => {
  if (row.status === "attended" || row.attendanceConfirmed === true) {
    return "attended";
  }

  if (row.status === "no_show") {
    return "absent";
  }

  return "unrecorded";
};

const applyBucket = (counts: AttendanceCounts, bucket: AttendanceBucket) => {
  counts.registered += 1;
  counts[bucket] += 1;
};

const withRates = (counts: AttendanceCounts) => {
  const recorded = counts.attended + counts.absent;

  return {
    ...counts,
    recorded,
    attendanceRate: recorded > 0 ? (counts.attended / recorded) * 100 : 0,
    noShowRate: recorded > 0 ? (counts.absent / recorded) * 100 : 0,
    completionRate:
      counts.registered > 0 ? (recorded / counts.registered) * 100 : 0,
  };
};

const formatName = (row: AttendanceRegistrationRow): string => {
  const firstName = row.firstName?.trim() || "";
  const lastName = row.lastName?.trim() || "";

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return row.username?.trim() || row.email?.trim() || "Unknown";
};

const getEventTime = (row: AttendanceRegistrationRow): number => {
  if (!row.eventDate) return 0;
  const parsed = new Date(row.eventDate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value?: string | Date): string => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
};

const unlabeledProgram: ProgramRef = {
  id: "__unlabeled",
  title: "Unlabeled Events",
  programType: "Unlabeled",
};

export default class AttendanceAnalyticsController {
  static async getAttendanceAnalytics(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_SYSTEM_ANALYTICS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view attendance analytics.",
        });
        return;
      }

      const rows = (await Registration.aggregate([
        {
          $lookup: {
            from: "events",
            localField: "eventId",
            foreignField: "_id",
            as: "event",
          },
        },
        { $unwind: "$event" },
        {
          $match: {
            "event.status": "completed",
            status: { $ne: "waitlisted" },
          },
        },
        {
          $lookup: {
            from: "programs",
            localField: "event.programLabels",
            foreignField: "_id",
            as: "programDocs",
          },
        },
        {
          $project: {
            registrationId: { $toString: "$_id" },
            userId: { $toString: "$userId" },
            firstName: "$userSnapshot.firstName",
            lastName: "$userSnapshot.lastName",
            username: "$userSnapshot.username",
            email: "$userSnapshot.email",
            roleInAtCloud: "$userSnapshot.roleInAtCloud",
            systemAuthorizationLevel: "$userSnapshot.systemAuthorizationLevel",
            status: { $ifNull: ["$status", "active"] },
            attendanceConfirmed: {
              $eq: ["$attendanceConfirmed", true],
            },
            eventId: { $toString: "$event._id" },
            eventTitle: "$event.title",
            eventDate: "$event.date",
            eventType: "$event.type",
            roleName: "$eventSnapshot.roleName",
            programs: {
              $map: {
                input: "$programDocs",
                as: "program",
                in: {
                  id: { $toString: "$$program._id" },
                  title: "$$program.title",
                  programType: "$$program.programType",
                },
              },
            },
          },
        },
        {
          $sort: {
            eventDate: -1,
            eventTitle: 1,
            lastName: 1,
            firstName: 1,
          },
        },
      ])) as AttendanceRegistrationRow[];

      const summary = emptyCounts();
      const people = new Map<
        string,
        AttendanceCounts & {
          userId: string;
          name: string;
          roleInAtCloud: string;
          systemAuthorizationLevel: string;
          programs: Set<string>;
          completedEvents: Set<string>;
          lastAttendedAt?: string;
          lastAttendedEvent?: string;
        }
      >();
      const programs = new Map<
        string,
        AttendanceCounts & {
          programId: string;
          programTitle: string;
          programType: string;
          completedEvents: Set<string>;
        }
      >();
      const events = new Map<
        string,
        AttendanceCounts & {
          eventId: string;
          eventTitle: string;
          eventDate: string;
          eventType: string;
          programs: ProgramRef[];
        }
      >();

      for (const row of rows) {
        const bucket = getAttendanceBucket(row);
        const eventPrograms =
          row.programs && row.programs.length > 0
            ? row.programs
            : [unlabeledProgram];

        applyBucket(summary, bucket);

        if (!people.has(row.userId)) {
          people.set(row.userId, {
            ...emptyCounts(),
            userId: row.userId,
            name: formatName(row),
            roleInAtCloud: row.roleInAtCloud || "",
            systemAuthorizationLevel:
              row.systemAuthorizationLevel || "Participant",
            programs: new Set<string>(),
            completedEvents: new Set<string>(),
          });
        }
        const person = people.get(row.userId)!;
        applyBucket(person, bucket);
        person.completedEvents.add(row.eventId);
        eventPrograms.forEach((program) => person.programs.add(program.title));

        if (bucket === "attended") {
          const eventTime = getEventTime(row);
          const previousTime = person.lastAttendedAt
            ? new Date(person.lastAttendedAt).getTime()
            : 0;
          if (eventTime >= previousTime) {
            person.lastAttendedAt = toIsoDate(row.eventDate) || undefined;
            person.lastAttendedEvent = row.eventTitle;
          }
        }

        for (const program of eventPrograms) {
          if (!programs.has(program.id)) {
            programs.set(program.id, {
              ...emptyCounts(),
              programId: program.id,
              programTitle: program.title,
              programType: program.programType || "Unknown",
              completedEvents: new Set<string>(),
            });
          }
          const programStats = programs.get(program.id)!;
          applyBucket(programStats, bucket);
          programStats.completedEvents.add(row.eventId);
        }

        if (!events.has(row.eventId)) {
          events.set(row.eventId, {
            ...emptyCounts(),
            eventId: row.eventId,
            eventTitle: row.eventTitle,
            eventDate: toIsoDate(row.eventDate),
            eventType: row.eventType || "",
            programs: eventPrograms,
          });
        }
        applyBucket(events.get(row.eventId)!, bucket);
      }

      res.status(200).json({
        success: true,
        data: {
          summary: withRates(summary),
          byPerson: Array.from(people.values())
            .map((person) => ({
              ...withRates(person),
              userId: person.userId,
              name: person.name,
              roleInAtCloud: person.roleInAtCloud,
              systemAuthorizationLevel: person.systemAuthorizationLevel,
              programs: Array.from(person.programs).sort(),
              completedEvents: person.completedEvents.size,
              lastAttendedAt: person.lastAttendedAt,
              lastAttendedEvent: person.lastAttendedEvent,
            }))
            .sort(
              (left, right) =>
                right.attended - left.attended ||
                right.registered - left.registered ||
                left.name.localeCompare(right.name),
            ),
          byProgram: Array.from(programs.values())
            .map((program) => ({
              ...withRates(program),
              programId: program.programId,
              programTitle: program.programTitle,
              programType: program.programType,
              completedEvents: program.completedEvents.size,
            }))
            .sort(
              (left, right) =>
                right.registered - left.registered ||
                left.programTitle.localeCompare(right.programTitle),
            ),
          byEvent: Array.from(events.values())
            .map((event) => ({
              ...withRates(event),
              eventId: event.eventId,
              eventTitle: event.eventTitle,
              eventDate: event.eventDate,
              eventType: event.eventType,
              programs: event.programs,
            }))
            .sort(
              (left, right) =>
                new Date(right.eventDate).getTime() -
                  new Date(left.eventDate).getTime() ||
                left.eventTitle.localeCompare(right.eventTitle),
            ),
        },
      });
    } catch (error: unknown) {
      console.error("Get attendance analytics error:", error);
      try {
        CorrelatedLogger.fromRequest(req, "AnalyticsController").error(
          "Get attendance analytics error",
          error as Error,
          "getAttendanceAnalytics",
          { query: req.query },
        );
      } catch {}
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance analytics.",
      });
    }
  }
}
