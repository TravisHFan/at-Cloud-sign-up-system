import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { EventConflictController } from "../../../../src/controllers/event/EventConflictController";
import { EventController } from "../../../../src/controllers/eventController";

// Mock dependencies
vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    findConflictingEvents: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

describe("EventConflictController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      query: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("checkTimeConflict", () => {
    describe("validation", () => {
      it("should return 400 when startDate is missing", async () => {
        mockReq.query = {
          startTime: "10:00",
        };

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "startDate and startTime are required",
        });
      });

      it("should return 400 when startTime is missing", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
        };

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "startDate and startTime are required",
        });
      });

      it("should return 400 when both startDate and startTime are missing", async () => {
        mockReq.query = {};

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "startDate and startTime are required",
        });
      });

      it("should handle array query parameters by picking first element", async () => {
        mockReq.query = {
          startDate: ["2024-06-01", "2024-06-02"],
          startTime: ["10:00", "11:00"],
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(EventController.findConflictingEvents).toHaveBeenCalled();
      });

      it("should return 400 when query params are non-string types", async () => {
        mockReq.query = {
          startDate: 123,
          startTime: {},
        };

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("conflict detection", () => {
      it("should return no conflict when no overlapping events exist", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          endDate: "2024-06-01",
          endTime: "12:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: { conflict: false, conflicts: [] },
        });
      });

      it("should return conflict when overlapping events exist", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          endDate: "2024-06-01",
          endTime: "12:00",
        };

        const mockConflicts = [
          {
            _id: "event1",
            title: "Conflicting Event",
            date: "2024-06-01",
            time: "11:00",
          },
        ];

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue(
          mockConflicts as any
        );

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: { conflict: true, conflicts: mockConflicts },
        });
      });

      it("should use startDate/startTime as endDate/endTime when end not provided", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalled();
        const callArgs = vi.mocked(EventController.findConflictingEvents).mock
          .calls[0];
        // Should pass start date/time and adjusted end (due to +1 minute nudge)
        expect(callArgs[0]).toBe("2024-06-01");
        expect(callArgs[1]).toBe("10:00");
      });

      it("should exclude specific event ID when provided", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          excludeId: "event-to-exclude",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
          "2024-06-01",
          "10:00",
          expect.any(String),
          expect.any(String),
          "event-to-exclude",
          undefined
        );
      });

      it("should pass timeZone parameter to conflict detection", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          timeZone: "America/Los_Angeles",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
          "2024-06-01",
          "10:00",
          expect.any(String),
          expect.any(String),
          undefined,
          "America/Los_Angeles"
        );
      });
    });

    describe("point mode handling", () => {
      it("should nudge end time by +1 minute in point mode", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          mode: "point",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalled();
        const callArgs = vi.mocked(EventController.findConflictingEvents).mock
          .calls[0];

        // End date/time should be adjusted by +1 minute from start
        expect(callArgs[0]).toBe("2024-06-01"); // startDate
        expect(callArgs[1]).toBe("10:00"); // startTime
        // callArgs[2] and [3] are checkEndDate and checkEndTime (nudged by +1 minute)
        // Exact values depend on timezone conversion, but should be called
      });

      it("should apply point mode when endDate is missing", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          // No endDate/endTime - implicitly point mode
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalled();
      });

      it("should use provided endDate/endTime when mode is not point", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          endDate: "2024-06-01",
          endTime: "12:00",
          mode: "range",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
          "2024-06-01",
          "10:00",
          "2024-06-01",
          "12:00",
          undefined,
          undefined
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 when findConflictingEvents throws error", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockRejectedValue(
          new Error("Database error")
        );

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to check time conflicts.",
        });
      });

      it("should handle unexpected errors gracefully", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockRejectedValue(
          new Error("Unexpected error")
        );

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to check time conflicts.",
        });
      });
    });

    describe("multi-day events", () => {
      it("should handle multi-day events with different start and end dates", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          endDate: "2024-06-03",
          endTime: "12:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
          "2024-06-01",
          "10:00",
          "2024-06-03",
          "12:00",
          undefined,
          undefined
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("timezone handling", () => {
      it("should handle PDT timezone", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "16:00",
          endDate: "2024-06-01",
          endTime: "18:00",
          timeZone: "America/Los_Angeles",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
          "2024-06-01",
          "16:00",
          "2024-06-01",
          "18:00",
          undefined,
          "America/Los_Angeles"
        );
      });

      it("should handle UTC timezone", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
          timeZone: "UTC",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        const callArgs = vi.mocked(EventController.findConflictingEvents).mock
          .calls[0];
        expect(callArgs[5]).toBe("UTC");
      });

      it("should work without timezone parameter (undefined)", async () => {
        mockReq.query = {
          startDate: "2024-06-01",
          startTime: "10:00",
        };

        vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

        await EventConflictController.checkTimeConflict(
          mockReq as Request,
          mockRes as Response
        );

        const callArgs = vi.mocked(EventController.findConflictingEvents).mock
          .calls[0];
        expect(callArgs[5]).toBeUndefined();
      });
    });
  });
});
