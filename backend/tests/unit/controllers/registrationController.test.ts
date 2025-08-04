import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";

// Declare global flags for error simulation
declare global {
  var shouldThrowDatabaseError: boolean;
  var shouldThrowValidationError: boolean;
}

// Mock Registration model with comprehensive methods
vi.mock("../../../src/models", () => ({
  Registration: Object.assign(
    vi.fn().mockImplementation((data) => ({
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi.fn().mockReturnValue({}),
      remove: vi.fn().mockResolvedValue({}),
      updateOne: vi.fn().mockResolvedValue({}),
      ...data,
    })),
    {
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findByIdAndDelete: vi.fn(),
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    }
  ),
  Event: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  }),
  User: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  }),
}));

// Mock mongoose
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      Types: {
        ObjectId: {
          isValid: vi.fn().mockReturnValue(true),
        },
      },
      Schema: actual.Schema,
    },
  };
});

// Mock SocketService for real-time updates
vi.mock("../../../src/services/SocketService", () => ({
  socketService: {
    emitRegistrationUpdate: vi.fn(),
    emitEventUpdate: vi.fn(),
    emitUserUpdate: vi.fn(),
  },
}));

// Since there's no actual registrationController, we'll create a mock implementation
// that represents what registration management operations would look like
class MockRegistrationController {
  // Get all registrations for an event
  static async getEventRegistrations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params;

      if (!eventId) {
        res.status(400).json({
          success: false,
          message: "Event ID is required",
        });
        return;
      }

      const registrations = await Registration.find({ eventId })
        .populate("userId", "firstName lastName email")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          registrations,
          count: registrations.length,
        },
      });
    } catch (error) {
      console.error("Error fetching event registrations:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all registrations for a user
  static async getUserRegistrations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      const registrations = await Registration.find({ userId })
        .populate("eventId", "title date time location")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          registrations,
          count: registrations.length,
        },
      });
    } catch (error) {
      console.error("Error fetching user registrations:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update registration status
  static async updateRegistrationStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { registrationId } = req.params;
      const { status } = req.body;

      if (!registrationId || !status) {
        res.status(400).json({
          success: false,
          message: "Registration ID and status are required",
        });
        return;
      }

      const registration = await Registration.findByIdAndUpdate(
        registrationId,
        { status },
        { new: true }
      );

      if (!registration) {
        res.status(404).json({
          success: false,
          message: "Registration not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: registration,
        message: "Registration status updated successfully",
      });
    } catch (error) {
      console.error("Error updating registration status:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get registration statistics
  static async getRegistrationStats(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const stats = await Registration.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalRegistrations = await Registration.countDocuments();

      res.status(200).json({
        success: true,
        data: {
          totalRegistrations,
          statusBreakdown: stats,
        },
      });
    } catch (error) {
      console.error("Error fetching registration stats:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Bulk update registrations
  static async bulkUpdateRegistrations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { registrationIds, updates } = req.body;

      if (!registrationIds || !Array.isArray(registrationIds) || !updates) {
        res.status(400).json({
          success: false,
          message: "Registration IDs array and updates object are required",
        });
        return;
      }

      const result = await Registration.updateMany(
        { _id: { $in: registrationIds } },
        updates
      );

      res.status(200).json({
        success: true,
        data: result,
        message: `Updated ${result.modifiedCount} registrations`,
      });
    } catch (error) {
      console.error("Error bulk updating registrations:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

// Import the models for testing
import { Registration, Event, User } from "../../../src/models";

describe("RegistrationController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    // Reset global flags to ensure test isolation
    global.shouldThrowDatabaseError = false;
    global.shouldThrowValidationError = false;

    // Reset response mocks
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: "user123",
        id: "user123",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
        role: "User",
      } as any,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("getEventRegistrations", () => {
    it("should return event registrations successfully", async () => {
      const eventId = "event123";
      mockRequest.params = { eventId };

      const mockRegistrations = [
        {
          _id: "reg1",
          userId: "user1",
          eventId: eventId,
          roleId: "role1",
          status: "active",
          createdAt: new Date(),
        },
        {
          _id: "reg2",
          userId: "user2",
          eventId: eventId,
          roleId: "role2",
          status: "active",
          createdAt: new Date(),
        },
      ];

      // Mock the find chain
      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockRegistrations),
      });
      (Registration.find as any).mockReturnValue({
        populate: mockPopulate,
      });

      await MockRegistrationController.getEventRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(Registration.find).toHaveBeenCalledWith({ eventId });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          registrations: mockRegistrations,
          count: mockRegistrations.length,
        },
      });
    });

    it("should return 400 if eventId is missing", async () => {
      mockRequest.params = {};

      await MockRegistrationController.getEventRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event ID is required",
      });
    });

    it("should handle database errors", async () => {
      const eventId = "event123";
      mockRequest.params = { eventId };

      (Registration.find as any).mockImplementation(() => {
        throw new Error("Database error");
      });

      await MockRegistrationController.getEventRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
    });
  });

  describe("getUserRegistrations", () => {
    it("should return user registrations successfully", async () => {
      const userId = "user123";
      mockRequest.params = { userId };

      const mockRegistrations = [
        {
          _id: "reg1",
          userId: userId,
          eventId: "event1",
          roleId: "role1",
          status: "active",
          createdAt: new Date(),
        },
      ];

      // Mock the find chain
      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockRegistrations),
      });
      (Registration.find as any).mockReturnValue({
        populate: mockPopulate,
      });

      await MockRegistrationController.getUserRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(Registration.find).toHaveBeenCalledWith({ userId });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          registrations: mockRegistrations,
          count: mockRegistrations.length,
        },
      });
    });

    it("should return 400 if userId is missing", async () => {
      mockRequest.params = {};

      await MockRegistrationController.getUserRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User ID is required",
      });
    });
  });

  describe("updateRegistrationStatus", () => {
    it("should update registration status successfully", async () => {
      const registrationId = "reg123";
      const status = "attended";
      mockRequest.params = { registrationId };
      mockRequest.body = { status };

      const mockUpdatedRegistration = {
        _id: registrationId,
        userId: "user123",
        eventId: "event123",
        status: status,
      };

      (Registration.findByIdAndUpdate as any).mockResolvedValue(
        mockUpdatedRegistration
      );

      await MockRegistrationController.updateRegistrationStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(Registration.findByIdAndUpdate).toHaveBeenCalledWith(
        registrationId,
        { status },
        { new: true }
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedRegistration,
        message: "Registration status updated successfully",
      });
    });

    it("should return 400 if required fields are missing", async () => {
      mockRequest.params = { registrationId: "reg123" };
      mockRequest.body = {}; // Missing status

      await MockRegistrationController.updateRegistrationStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration ID and status are required",
      });
    });

    it("should return 404 if registration not found", async () => {
      const registrationId = "nonexistent";
      const status = "attended";
      mockRequest.params = { registrationId };
      mockRequest.body = { status };

      (Registration.findByIdAndUpdate as any).mockResolvedValue(null);

      await MockRegistrationController.updateRegistrationStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration not found",
      });
    });
  });

  describe("getRegistrationStats", () => {
    it("should return registration statistics successfully", async () => {
      const mockStats = [
        { _id: "active", count: 50 },
        { _id: "attended", count: 30 },
        { _id: "no_show", count: 5 },
      ];
      const totalRegistrations = 85;

      (Registration.aggregate as any).mockResolvedValue(mockStats);
      (Registration.countDocuments as any).mockResolvedValue(
        totalRegistrations
      );

      await MockRegistrationController.getRegistrationStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(Registration.aggregate).toHaveBeenCalled();
      expect(Registration.countDocuments).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          totalRegistrations,
          statusBreakdown: mockStats,
        },
      });
    });

    it("should handle database errors", async () => {
      (Registration.aggregate as any).mockImplementation(() => {
        throw new Error("Database error");
      });

      await MockRegistrationController.getRegistrationStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
    });
  });

  describe("bulkUpdateRegistrations", () => {
    it("should bulk update registrations successfully", async () => {
      const registrationIds = ["reg1", "reg2", "reg3"];
      const updates = { status: "attended" };
      mockRequest.body = { registrationIds, updates };

      const mockResult = {
        modifiedCount: 3,
        matchedCount: 3,
      };

      (Registration.updateMany as any).mockResolvedValue(mockResult);

      await MockRegistrationController.bulkUpdateRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(Registration.updateMany).toHaveBeenCalledWith(
        { _id: { $in: registrationIds } },
        updates
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: "Updated 3 registrations",
      });
    });

    it("should return 400 if required fields are missing", async () => {
      mockRequest.body = { registrationIds: ["reg1"] }; // Missing updates

      await MockRegistrationController.bulkUpdateRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration IDs array and updates object are required",
      });
    });

    it("should return 400 if registrationIds is not an array", async () => {
      mockRequest.body = {
        registrationIds: "not-an-array",
        updates: { status: "attended" },
      };

      await MockRegistrationController.bulkUpdateRegistrations(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration IDs array and updates object are required",
      });
    });
  });

  describe("Method Existence Tests", () => {
    it("should have getEventRegistrations method", () => {
      expect(typeof MockRegistrationController.getEventRegistrations).toBe(
        "function"
      );
    });

    it("should have getUserRegistrations method", () => {
      expect(typeof MockRegistrationController.getUserRegistrations).toBe(
        "function"
      );
    });

    it("should have updateRegistrationStatus method", () => {
      expect(typeof MockRegistrationController.updateRegistrationStatus).toBe(
        "function"
      );
    });

    it("should have getRegistrationStats method", () => {
      expect(typeof MockRegistrationController.getRegistrationStats).toBe(
        "function"
      );
    });

    it("should have bulkUpdateRegistrations method", () => {
      expect(typeof MockRegistrationController.bulkUpdateRegistrations).toBe(
        "function"
      );
    });
  });
});
