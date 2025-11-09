import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import EventListController from "../../../../src/controllers/programs/EventListController";
import { Event } from "../../../../src/models";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe("EventListController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: {},
      query: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("listEvents", () => {
    const programId = new mongoose.Types.ObjectId();
    const eventId1 = new mongoose.Types.ObjectId();
    const eventId2 = new mongoose.Types.ObjectId();

    describe("validation", () => {
      it("should return 400 for invalid program ID", async () => {
        mockReq.params = { id: "invalid-id" };

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid program ID.",
        });
      });
    });

    describe("legacy behavior (no pagination)", () => {
      beforeEach(() => {
        mockReq.params = { id: programId.toString() };
        mockReq.query = {};
      });

      it("should return empty array when no events found", async () => {
        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({
          programLabels: programId.toString(),
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: [],
        });
      });

      it("should return all events for program", async () => {
        const mockEvents = [
          {
            _id: eventId1,
            title: "Event 1",
            date: "2025-01-15",
            time: "10:00",
          },
          {
            _id: eventId2,
            title: "Event 2",
            date: "2025-01-16",
            time: "14:00",
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockEvents),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: [
            {
              id: eventId1.toString(),
              title: "Event 1",
              date: "2025-01-15",
              time: "10:00",
            },
            {
              id: eventId2.toString(),
              title: "Event 2",
              date: "2025-01-16",
              time: "14:00",
            },
          ],
        });
      });

      it("should sort events by date and time ascending", async () => {
        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const sortCall = mockFind.mock.results[0].value.sort;
        expect(sortCall).toHaveBeenCalledWith({ date: 1, time: 1 });
      });

      it("should transform _id to id in response", async () => {
        const mockEvents = [
          {
            _id: eventId1,
            title: "Event 1",
            programLabels: [programId],
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockEvents),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data[0]).toHaveProperty("id", eventId1.toString());
        expect(response.data[0]).not.toHaveProperty("_id");
      });
    });

    describe("pagination", () => {
      beforeEach(() => {
        mockReq.params = { id: programId.toString() };
      });

      it("should return paginated results when page and limit provided", async () => {
        mockReq.query = { page: "1", limit: "10" };

        const mockEvents = [
          { _id: eventId1, title: "Event 1" },
          { _id: eventId2, title: "Event 2" },
        ];

        vi.mocked(Event.countDocuments).mockResolvedValue(2);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockEvents),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.countDocuments).toHaveBeenCalledWith({
          programLabels: programId.toString(),
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            items: [
              { id: eventId1.toString(), title: "Event 1" },
              { id: eventId2.toString(), title: "Event 2" },
            ],
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
            sort: { field: "date", dir: "asc" },
          },
        });
      });

      it("should use default sort (date:asc) when not specified", async () => {
        mockReq.query = { page: "1", limit: "10" };

        vi.mocked(Event.countDocuments).mockResolvedValue(0);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const sortCall = mockFind.mock.results[0].value.sort;
        expect(sortCall).toHaveBeenCalledWith({ date: 1, time: 1 });
      });

      it("should support date:desc sorting", async () => {
        mockReq.query = { page: "1", limit: "10", sort: "date:desc" };

        vi.mocked(Event.countDocuments).mockResolvedValue(0);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const sortCall = mockFind.mock.results[0].value.sort;
        expect(sortCall).toHaveBeenCalledWith({ date: -1, time: -1 });
      });

      it("should support custom field sorting", async () => {
        mockReq.query = { page: "1", limit: "10", sort: "title:asc" };

        vi.mocked(Event.countDocuments).mockResolvedValue(0);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const sortCall = mockFind.mock.results[0].value.sort;
        expect(sortCall).toHaveBeenCalledWith({ title: 1 });
      });

      it("should calculate skip correctly for pagination", async () => {
        mockReq.query = { page: "3", limit: "5" };

        vi.mocked(Event.countDocuments).mockResolvedValue(20);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const skipCall =
          mockFind.mock.results[0].value.sort.mock.results[0].value.skip;
        expect(skipCall).toHaveBeenCalledWith(10); // (3-1) * 5 = 10
      });

      it("should calculate totalPages correctly", async () => {
        mockReq.query = { page: "1", limit: "10" };

        vi.mocked(Event.countDocuments).mockResolvedValue(25);

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.totalPages).toBe(3); // Math.ceil(25/10)
      });

      it("should not paginate with invalid page number", async () => {
        mockReq.query = { page: "invalid", limit: "10" };

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.countDocuments).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: [],
        });
      });

      it("should not paginate with zero or negative page", async () => {
        mockReq.query = { page: "0", limit: "10" };

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.countDocuments).not.toHaveBeenCalled();
      });

      it("should not paginate with invalid limit", async () => {
        mockReq.query = { page: "1", limit: "invalid" };

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.countDocuments).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        mockReq.params = { id: programId.toString() };
        mockReq.query = {};
      });

      it("should handle database errors", async () => {
        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to list program events.",
        });
      });

      it("should handle countDocuments errors in pagination", async () => {
        mockReq.query = { page: "1", limit: "10" };

        vi.mocked(Event.countDocuments).mockRejectedValue(
          new Error("Count error")
        );

        await EventListController.listEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to list program events.",
        });
      });
    });
  });
});
