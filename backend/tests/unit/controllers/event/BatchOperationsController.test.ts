import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { BatchOperationsController } from "../../../../src/controllers/event/BatchOperationsController";
import { Event } from "../../../../src/models";
import { EventController } from "../../../../src/controllers/eventController";
import { CachePatterns } from "../../../../src/services";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    getEventStatus: vi.fn(),
    toIdString: vi.fn((id) => id.toString()),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

describe("BatchOperationsController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      user: {
        _id: new mongoose.Types.ObjectId(),
        role: "Super Admin",
      },
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("updateAllEventStatuses", () => {
    describe("successful updates", () => {
      it("should update event statuses and return updated count", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-01",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const event2 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-02",
          time: "14:00",
          endTime: "16:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([event1, event2]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus)
          .mockReturnValueOnce("completed")
          .mockReturnValueOnce("completed");
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({
          status: { $ne: "cancelled" },
        });
        expect(EventController.getEventStatus).toHaveBeenCalledTimes(2);
        expect(Event.findByIdAndUpdate).toHaveBeenCalledTimes(2);
        expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(event1._id, {
          status: "completed",
        });
        expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(event2._id, {
          status: "completed",
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Updated 2 event statuses.",
          data: { updatedCount: 2 },
        });
      });

      it("should skip events with unchanged status", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-12-31",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([event1]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.getEventStatus).toHaveBeenCalledTimes(1);
        expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Updated 0 event statuses.",
          data: { updatedCount: 0 },
        });
      });

      it("should handle empty event list", async () => {
        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Updated 0 event statuses.",
          data: { updatedCount: 0 },
        });
      });

      it("should exclude cancelled events", async () => {
        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({
          status: { $ne: "cancelled" },
        });
      });

      it("should select only required fields", async () => {
        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        const selectCall = mockFind.mock.results[0].value.select;
        expect(selectCall).toHaveBeenCalledWith(
          "_id date endDate time endTime status timeZone"
        );
      });

      it("should use endDate if provided, otherwise use date", async () => {
        const eventWithEndDate = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-01",
          endDate: "2024-01-03",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
          timeZone: "America/Los_Angeles",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([eventWithEndDate]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("ongoing");
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.getEventStatus).toHaveBeenCalledWith(
          "2024-01-01",
          "2024-01-03",
          "10:00",
          "12:00",
          "America/Los_Angeles"
        );
      });

      it("should use date as endDate when endDate is missing", async () => {
        const eventWithoutEndDate = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-01",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([eventWithoutEndDate]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.getEventStatus).toHaveBeenCalledWith(
          "2024-01-01",
          "2024-01-01",
          "10:00",
          "12:00",
          undefined
        );
      });
    });

    describe("cache invalidation", () => {
      it("should invalidate event and analytics caches on status update", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-01",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([event1]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("completed");
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          event1._id.toString()
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });

      it("should not invalidate caches when no status changes", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-12-31",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([event1]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
        expect(CachePatterns.invalidateAnalyticsCache).not.toHaveBeenCalled();
      });
    });

    describe("fallback query handling", () => {
      it("should handle query without select method", async () => {
        const events = [
          {
            _id: new mongoose.Types.ObjectId(),
            date: "2024-01-01",
            time: "10:00",
            endTime: "12:00",
            status: "upcoming",
          },
        ];

        vi.mocked(Event.find).mockResolvedValue(events as any);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle query without lean method", async () => {
        const events = [
          {
            _id: new mongoose.Types.ObjectId(),
            date: "2024-01-01",
            time: "10:00",
            endTime: "12:00",
            status: "upcoming",
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(events),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.find).mockRejectedValue(new Error("Database error"));

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update event statuses.",
        });
      });

      it("should handle update errors", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          date: "2024-01-01",
          time: "10:00",
          endTime: "12:00",
          status: "upcoming",
        };

        const mockFind = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([event1]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("completed");
        vi.mocked(Event.findByIdAndUpdate).mockRejectedValue(
          new Error("Update failed")
        );

        await BatchOperationsController.updateAllEventStatuses(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update event statuses.",
        });
      });
    });
  });

  describe("recalculateSignupCounts", () => {
    describe("successful recalculation", () => {
      it("should recalculate signup counts and return updated count", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 5,
          calculateSignedUp: vi.fn().mockResolvedValue(10),
        };

        const event2 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 3,
          calculateSignedUp: vi.fn().mockResolvedValue(8),
        };

        vi.mocked(Event.find).mockResolvedValue([event1, event2] as any);
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({});
        expect(event1.calculateSignedUp).toHaveBeenCalled();
        expect(event2.calculateSignedUp).toHaveBeenCalled();
        expect(Event.findByIdAndUpdate).toHaveBeenCalledTimes(2);
        expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(event1._id, {
          signedUp: 10,
        });
        expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(event2._id, {
          signedUp: 8,
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Recalculated signup counts for 2 events.",
          data: { updatedCount: 2 },
        });
      });

      it("should skip events with unchanged signup counts", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 10,
          calculateSignedUp: vi.fn().mockResolvedValue(10),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(event1.calculateSignedUp).toHaveBeenCalled();
        expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Recalculated signup counts for 0 events.",
          data: { updatedCount: 0 },
        });
      });

      it("should handle events with no signedUp field", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: undefined,
          calculateSignedUp: vi.fn().mockResolvedValue(5),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(event1._id, {
          signedUp: 5,
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Recalculated signup counts for 1 events.",
          data: { updatedCount: 1 },
        });
      });

      it("should handle empty event list", async () => {
        vi.mocked(Event.find).mockResolvedValue([] as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Recalculated signup counts for 0 events.",
          data: { updatedCount: 0 },
        });
      });

      it("should query all events without filters", async () => {
        vi.mocked(Event.find).mockResolvedValue([] as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({});
      });
    });

    describe("cache invalidation", () => {
      it("should invalidate event and analytics caches on signup count update", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 5,
          calculateSignedUp: vi.fn().mockResolvedValue(10),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);
        vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          event1._id.toString()
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });

      it("should not invalidate caches when no signup count changes", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 10,
          calculateSignedUp: vi.fn().mockResolvedValue(10),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
        expect(CachePatterns.invalidateAnalyticsCache).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.find).mockRejectedValue(new Error("Database error"));

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to recalculate signup counts.",
        });
      });

      it("should handle calculation errors", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 5,
          calculateSignedUp: vi
            .fn()
            .mockRejectedValue(new Error("Calculation failed")),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to recalculate signup counts.",
        });
      });

      it("should handle update errors", async () => {
        const event1 = {
          _id: new mongoose.Types.ObjectId(),
          signedUp: 5,
          calculateSignedUp: vi.fn().mockResolvedValue(10),
        };

        vi.mocked(Event.find).mockResolvedValue([event1] as any);
        vi.mocked(Event.findByIdAndUpdate).mockRejectedValue(
          new Error("Update failed")
        );

        await BatchOperationsController.recalculateSignupCounts(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to recalculate signup counts.",
        });
      });
    });
  });
});
