import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestListController from "../../../../src/controllers/guest/GuestListController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findActiveByEvent: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { GuestRegistration } from "../../../../src/models";

interface MockRequest {
  params: Record<string, string>;
  user?: {
    _id: string;
  };
  userRole?: string;
}

describe("GuestListController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      params: {
        eventId: "event123",
      },
      user: undefined,
      userRole: undefined,
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getEventGuests", () => {
    describe("Successful Retrieval - Public View", () => {
      it("should return public JSON for unauthenticated users", async () => {
        const mockPublicJson = {
          id: "guestreg123",
          fullName: "John Guest",
          roleId: "role456",
        };

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn().mockReturnValue(mockPublicJson),
          toAdminJSON: vi.fn(),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findActiveByEvent).toHaveBeenCalledWith(
          "event123"
        );
        expect(mockGuest.toPublicJSON).toHaveBeenCalled();
        expect(mockGuest.toAdminJSON).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            guests: [mockPublicJson],
            count: 1,
          },
        });
      });

      it("should return public JSON for Participant users", async () => {
        mockReq.user = { _id: "user123" };
        mockReq.userRole = "Participant";

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn().mockReturnValue({ id: "guestreg123" }),
          toAdminJSON: vi.fn(),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.toPublicJSON).toHaveBeenCalled();
        expect(mockGuest.toAdminJSON).not.toHaveBeenCalled();
      });

      it("should return public JSON for Staff users", async () => {
        mockReq.user = { _id: "user123" };
        mockReq.userRole = "Staff";

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn().mockReturnValue({ id: "guestreg123" }),
          toAdminJSON: vi.fn(),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.toPublicJSON).toHaveBeenCalled();
        expect(mockGuest.toAdminJSON).not.toHaveBeenCalled();
      });
    });

    describe("Successful Retrieval - Admin View", () => {
      it("should return admin JSON for Super Admin", async () => {
        mockReq.user = { _id: "admin123" };
        mockReq.userRole = "Super Admin";

        const mockAdminJson = {
          id: "guestreg123",
          fullName: "John Guest",
          email: "guest@test.com",
          phone: "123456789",
          roleId: "role456",
        };

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn(),
          toAdminJSON: vi.fn().mockReturnValue(mockAdminJson),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.toAdminJSON).toHaveBeenCalled();
        expect(mockGuest.toPublicJSON).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            guests: [mockAdminJson],
            count: 1,
          },
        });
      });

      it("should return admin JSON for Administrator", async () => {
        mockReq.user = { _id: "admin123" };
        mockReq.userRole = "Administrator";

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn(),
          toAdminJSON: vi.fn().mockReturnValue({ id: "guestreg123" }),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.toAdminJSON).toHaveBeenCalled();
        expect(mockGuest.toPublicJSON).not.toHaveBeenCalled();
      });

      it("should return admin JSON for Leader", async () => {
        mockReq.user = { _id: "leader123" };
        mockReq.userRole = "Leader";

        const mockGuest = {
          _id: "guestreg123",
          toPublicJSON: vi.fn(),
          toAdminJSON: vi.fn().mockReturnValue({ id: "guestreg123" }),
        };

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue([
          mockGuest,
        ] as any);

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.toAdminJSON).toHaveBeenCalled();
        expect(mockGuest.toPublicJSON).not.toHaveBeenCalled();
      });
    });

    describe("Empty Results", () => {
      it("should return empty array when no guests found", async () => {
        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue(
          [] as any
        );

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            guests: [],
            count: 0,
          },
        });
      });
    });

    describe("Multiple Guests", () => {
      it("should return all guests with correct count", async () => {
        const mockGuests = [
          {
            _id: "guest1",
            toPublicJSON: vi.fn().mockReturnValue({ id: "guest1" }),
            toAdminJSON: vi.fn(),
          },
          {
            _id: "guest2",
            toPublicJSON: vi.fn().mockReturnValue({ id: "guest2" }),
            toAdminJSON: vi.fn(),
          },
          {
            _id: "guest3",
            toPublicJSON: vi.fn().mockReturnValue({ id: "guest3" }),
            toAdminJSON: vi.fn(),
          },
        ];

        vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue(
          mockGuests as any
        );

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            guests: [{ id: "guest1" }, { id: "guest2" }, { id: "guest3" }],
            count: 3,
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findActiveByEvent).mockRejectedValue(
          new Error("Database error")
        );

        await GuestListController.getEventGuests(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch event guests",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
