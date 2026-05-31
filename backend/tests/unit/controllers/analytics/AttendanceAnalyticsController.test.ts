import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Response } from "express";
import AttendanceAnalyticsController from "../../../../src/controllers/analytics/AttendanceAnalyticsController";

vi.mock("../../../../src/models", () => ({
  Registration: {
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

import { Registration } from "../../../../src/models";
import { hasPermission } from "../../../../src/utils/roleUtils";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("AttendanceAnalyticsController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
    mockReq = {
      query: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockReq.user = undefined;

    await AttendanceAnalyticsController.getAttendanceAnalytics(
      mockReq as any,
      mockRes as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: "Authentication required.",
    });
  });

  it("returns 403 when the user lacks analytics permission", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    await AttendanceAnalyticsController.getAttendanceAnalytics(
      mockReq as any,
      mockRes as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: "Insufficient permissions to view attendance analytics.",
    });
  });

  it("aggregates attendance by summary, person, program, and event", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(Registration.aggregate).mockResolvedValue([
      {
        registrationId: "r1",
        userId: "u1",
        firstName: "Ann",
        lastName: "Lee",
        status: "attended",
        attendanceConfirmed: true,
        eventId: "e1",
        eventTitle: "Leadership Night",
        eventDate: "2026-01-02T00:00:00.000Z",
        eventType: "Meeting",
        programs: [
          {
            id: "p1",
            title: "EMBA",
            programType: "EMBA Mentor Circles",
          },
        ],
      },
      {
        registrationId: "r2",
        userId: "u2",
        firstName: "Bob",
        lastName: "Kim",
        status: "no_show",
        attendanceConfirmed: false,
        eventId: "e1",
        eventTitle: "Leadership Night",
        eventDate: "2026-01-02T00:00:00.000Z",
        eventType: "Meeting",
        programs: [
          {
            id: "p1",
            title: "EMBA",
            programType: "EMBA Mentor Circles",
          },
        ],
      },
      {
        registrationId: "r3",
        userId: "u3",
        firstName: "Cara",
        lastName: "Ng",
        status: "active",
        attendanceConfirmed: false,
        eventId: "e2",
        eventTitle: "Workshop",
        eventDate: "2026-01-03T00:00:00.000Z",
        eventType: "Workshop",
        programs: [],
      },
      {
        registrationId: "r4",
        userId: "u1",
        firstName: "Ann",
        lastName: "Lee",
        status: "active",
        attendanceConfirmed: true,
        eventId: "e2",
        eventTitle: "Workshop",
        eventDate: "2026-01-03T00:00:00.000Z",
        eventType: "Workshop",
        programs: [
          {
            id: "p1",
            title: "EMBA",
            programType: "EMBA Mentor Circles",
          },
        ],
      },
    ] as any);

    await AttendanceAnalyticsController.getAttendanceAnalytics(
      mockReq as any,
      mockRes as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.summary).toMatchObject({
      registered: 4,
      attended: 2,
      absent: 1,
      unrecorded: 1,
      recorded: 3,
    });

    const ann = payload.data.byPerson.find(
      (person: { userId: string }) => person.userId === "u1",
    );
    expect(ann).toMatchObject({
      name: "Ann Lee",
      registered: 2,
      attended: 2,
      absent: 0,
      completedEvents: 2,
      lastAttendedEvent: "Workshop",
    });

    const emba = payload.data.byProgram.find(
      (program: { programId: string }) => program.programId === "p1",
    );
    expect(emba).toMatchObject({
      programTitle: "EMBA",
      registered: 3,
      attended: 2,
      absent: 1,
      completedEvents: 2,
    });

    const unlabeled = payload.data.byProgram.find(
      (program: { programId: string }) => program.programId === "__unlabeled",
    );
    expect(unlabeled).toMatchObject({
      programTitle: "Unlabeled Events",
      registered: 1,
      unrecorded: 1,
    });
  });
});
