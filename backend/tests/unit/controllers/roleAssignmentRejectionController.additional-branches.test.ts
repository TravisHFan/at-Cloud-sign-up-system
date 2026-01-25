import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before imports
vi.mock("../../../src/utils/roleAssignmentRejectionToken");
vi.mock("../../../src/models/Registration");
vi.mock("../../../src/models/Event");
vi.mock("../../../src/models/User");
vi.mock("../../../src/services/notifications/TrioNotificationService");
vi.mock("../../../src/services/RejectionMetricsService");
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

import * as tokenUtil from "../../../src/utils/roleAssignmentRejectionToken";
import * as controller from "../../../src/controllers/roleAssignmentRejectionController";
import Registration from "../../../src/models/Registration";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";
import { RejectionMetricsService } from "../../../src/services/RejectionMetricsService";
import { socketService } from "../../../src/services/infrastructure/SocketService";

function mockReq(body: any = {}, query: any = {}) {
  return { body, query } as any;
}

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((c) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn().mockImplementation((d) => {
    res.data = d;
    return res;
  });
  return res;
}

describe("roleAssignmentRejectionController - additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateRoleAssignmentRejection", () => {
    it("should increment invalid metric when token is empty", async () => {
      const incrementSpy = vi.spyOn(RejectionMetricsService, "increment");

      const req = mockReq({}, { token: "" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(incrementSpy).toHaveBeenCalledWith("invalid");
      expect(res.statusCode).toBe(410);
    });

    it("should increment expired metric when token is expired", async () => {
      const incrementSpy = vi.spyOn(RejectionMetricsService, "increment");
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: false,
        reason: "expired",
      } as any);

      const req = mockReq({}, { token: "expired-token" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(incrementSpy).toHaveBeenCalledWith("expired");
      expect(res.statusCode).toBe(410);
    });

    it("should return 410 for invalid ObjectId in assignmentId", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "invalid-id",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const req = mockReq({}, { token: "valid-token" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(res.statusCode).toBe(410);
    });

    it("should return 410 when userId does not match assigneeId", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      vi.mocked(Registration.findById).mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439099", // Different from assigneeId
            eventId: "507f1f77bcf86cd799439088",
            eventSnapshot: { title: "Event", roleName: "Role" },
          }),
      } as any);

      const req = mockReq({}, { token: "valid-token" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(res.statusCode).toBe(410);
    });

    it("should fetch event timeZone successfully", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      vi.mocked(Registration.findById).mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012",
            eventId: "507f1f77bcf86cd799439088",
            eventSnapshot: {
              title: "Event",
              date: "2025-01-20",
              time: "10:00",
              roleName: "Speaker",
            },
          }),
      } as any);

      vi.mocked(Event.findById).mockReturnValue({
        select: () => ({
          lean: () =>
            Promise.resolve({
              _id: "507f1f77bcf86cd799439088",
              timeZone: "America/New_York",
            }),
        }),
      } as any);

      const req = mockReq({}, { token: "valid-token" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.event.timeZone).toBe("America/New_York");
    });

    it("should handle event timeZone fetch error silently", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      vi.mocked(Registration.findById).mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: "507f1f77bcf86cd799439011",
            userId: "507f1f77bcf86cd799439012",
            eventId: "507f1f77bcf86cd799439088",
            eventSnapshot: { title: "Event", roleName: "Role" },
          }),
      } as any);

      vi.mocked(Event.findById).mockReturnValue({
        select: () => ({
          lean: () => Promise.reject(new Error("DB error")),
        }),
      } as any);

      const req = mockReq({}, { token: "valid-token" });
      const res = mockRes();

      await controller.validateRoleAssignmentRejection(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.event.timeZone).toBeUndefined();
    });
  });

  describe("rejectRoleAssignment", () => {
    it("should increment note_missing when note is whitespace only", async () => {
      const incrementSpy = vi.spyOn(RejectionMetricsService, "increment");

      const req = mockReq({ token: "some-token", note: "   " });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      expect(incrementSpy).toHaveBeenCalledWith("note_missing");
      expect(res.statusCode).toBe(400);
      expect(res.data.code).toBe("NOTE_REQUIRED");
    });

    it("should increment note_missing when note is not a string", async () => {
      const incrementSpy = vi.spyOn(RejectionMetricsService, "increment");

      const req = mockReq({ token: "some-token", note: 12345 });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      expect(incrementSpy).toHaveBeenCalledWith("note_missing");
      expect(res.statusCode).toBe(400);
    });

    it("should emit socket event on successful rejection", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const deleteOne = vi.fn().mockResolvedValue(undefined);
      vi.mocked(Registration.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        registeredBy: "507f1f77bcf86cd799439012",
        eventId: "507f1f77bcf86cd799439099",
        eventSnapshot: { title: "Event", roleName: "Helper" },
        deleteOne,
      } as any);

      vi.mocked(User.findById).mockReturnValue({
        lean: () => Promise.resolve(null),
      } as any);

      const socketSpy = vi.mocked(socketService.emitEventUpdate);

      const req = mockReq({ token: "valid-token", note: "Can't make it" });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      expect(socketSpy).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439099",
        "role_rejected",
        expect.objectContaining({
          roleName: "Helper",
          userId: "507f1f77bcf86cd799439012",
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it("should handle socket emit error gracefully", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const deleteOne = vi.fn().mockResolvedValue(undefined);
      vi.mocked(Registration.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        registeredBy: "507f1f77bcf86cd799439012",
        eventId: "507f1f77bcf86cd799439099",
        eventSnapshot: { title: "Event", roleName: "Helper" },
        deleteOne,
      } as any);

      vi.mocked(User.findById).mockReturnValue({
        lean: () => Promise.resolve(null),
      } as any);

      vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
        throw new Error("Socket error");
      });

      const req = mockReq({ token: "valid-token", note: "Reason here" });
      const res = mockRes();

      // Should not throw
      await controller.rejectRoleAssignment(req, res);

      expect(res.statusCode).toBe(200);
    });

    it("should increment replay metric when registration already removed", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      vi.mocked(Registration.findById).mockResolvedValue(null);

      const incrementSpy = vi.spyOn(RejectionMetricsService, "increment");

      const req = mockReq({ token: "valid-token", note: "Reason" });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      expect(incrementSpy).toHaveBeenCalledWith("replay");
      expect(res.statusCode).toBe(410);
      expect(res.data.code).toBe("ASSIGNMENT_ALREADY_REMOVED");
    });

    it("should handle trio notification failure gracefully", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const deleteOne = vi.fn().mockResolvedValue(undefined);
      vi.mocked(Registration.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        registeredBy: "507f1f77bcf86cd799439013", // Different from assignee
        eventId: "507f1f77bcf86cd799439099",
        eventSnapshot: { title: "Event", roleName: "Helper" },
        deleteOne,
      } as any);

      vi.mocked(User.findById).mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: "507f1f77bcf86cd799439013",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          }),
      } as any);

      vi.mocked(
        TrioNotificationService.createEventRoleAssignmentRejectedTrio,
      ).mockRejectedValue(new Error("Notification error"));

      const req = mockReq({ token: "valid-token", note: "Can't attend" });
      const res = mockRes();

      // Should not throw
      await controller.rejectRoleAssignment(req, res);

      expect(res.statusCode).toBe(200);
    });

    it("should truncate note to 1000 characters", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const deleteOne = vi.fn().mockResolvedValue(undefined);
      vi.mocked(Registration.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        registeredBy: "507f1f77bcf86cd799439013",
        eventId: "507f1f77bcf86cd799439099",
        eventSnapshot: { title: "Event", roleName: "Helper" },
        deleteOne,
      } as any);

      vi.mocked(User.findById).mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: "507f1f77bcf86cd799439013",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          }),
      } as any);

      const trioSpy = vi
        .mocked(TrioNotificationService.createEventRoleAssignmentRejectedTrio)
        .mockResolvedValue({ success: true } as any);

      const longNote = "A".repeat(2000);
      const req = mockReq({ token: "valid-token", note: longNote });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      expect(trioSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          noteText: expect.any(String),
        }),
      );
      expect(trioSpy.mock.calls[0]?.[0]?.noteText?.length).toBe(1000);
    });

    it("should handle missing assigner user gracefully", async () => {
      vi.mocked(tokenUtil.verifyRoleAssignmentRejectionToken).mockReturnValue({
        valid: true,
        payload: {
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        },
      } as any);

      const deleteOne = vi.fn().mockResolvedValue(undefined);
      vi.mocked(Registration.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        registeredBy: "507f1f77bcf86cd799439013",
        eventId: "507f1f77bcf86cd799439099",
        eventSnapshot: { title: "Event", roleName: "Helper" },
        deleteOne,
      } as any);

      // Return null for assigner user
      vi.mocked(User.findById).mockReturnValue({
        lean: () => Promise.resolve(null),
      } as any);

      const trioSpy = vi.mocked(
        TrioNotificationService.createEventRoleAssignmentRejectedTrio,
      );

      const req = mockReq({ token: "valid-token", note: "Can't make it" });
      const res = mockRes();

      await controller.rejectRoleAssignment(req, res);

      // Should not call trio when assigner is not found
      expect(trioSpy).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });
});
