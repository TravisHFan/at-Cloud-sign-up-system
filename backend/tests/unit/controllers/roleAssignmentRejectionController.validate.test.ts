import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import * as tokenUtil from "../../../src/utils/roleAssignmentRejectionToken";
import * as controller from "../../../src/controllers/roleAssignmentRejectionController";
import Registration from "../../../src/models/Registration";
import Event from "../../../src/models/Event";
import { RejectionMetricsService } from "../../../src/services/RejectionMetricsService";

vi.mock("../../../src/models/Registration");
vi.mock("../../../src/models/Event");
vi.mock("../../../src/services/RejectionMetricsService");
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

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

describe("validateRoleAssignmentRejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 410 if token is missing", async () => {
    const req = mockReq({}, { token: "" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.data).toEqual({
      success: false,
      code: "ASSIGNMENT_REJECTION_TOKEN_INVALID",
    });
    expect(RejectionMetricsService.increment).toHaveBeenCalledWith("invalid");
  });

  it("should return 410 if token is not provided in query", async () => {
    const req = mockReq({}, {});
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.data).toEqual({
      success: false,
      code: "ASSIGNMENT_REJECTION_TOKEN_INVALID",
    });
    expect(RejectionMetricsService.increment).toHaveBeenCalledWith("invalid");
  });

  it("should return 410 if token is invalid", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: false,
      reason: "invalid",
    } as any);

    const req = mockReq({}, { token: "invalid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
    expect(RejectionMetricsService.increment).toHaveBeenCalledWith("invalid");
  });

  it("should return 410 if token is expired", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: false,
      reason: "expired",
    } as any);

    const req = mockReq({}, { token: "expired-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
    expect(RejectionMetricsService.increment).toHaveBeenCalledWith("expired");
  });

  it("should return 410 if assignmentId is not a valid ObjectId", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "not-valid",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
  });

  it("should return 410 if assigneeId is not a valid ObjectId", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "not-valid",
      },
    } as any);

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
  });

  it("should return 410 if registration not found", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    (Registration.findById as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
  });

  it("should return 410 if userId does not match assigneeId", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    (Registration.findById as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439099", // different from assigneeId
        eventId: "507f1f77bcf86cd799439050",
        eventSnapshot: { title: "Test Event", roleName: "Speaker" },
      }),
    });

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(410);
  });

  it("should return success with event info when token and registration are valid", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    (Registration.findById as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        eventId: "507f1f77bcf86cd799439050",
        eventSnapshot: {
          title: "Test Event",
          date: "2025-01-01",
          time: "10:00",
          roleName: "Speaker",
        },
      }),
    });

    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439050",
          timeZone: "America/New_York",
        }),
      }),
    });

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({
      success: true,
      event: {
        id: "507f1f77bcf86cd799439050",
        title: "Test Event",
        date: "2025-01-01",
        time: "10:00",
        roleName: "Speaker",
        timeZone: "America/New_York",
      },
      role: "Speaker",
    });
  });

  it("should handle Event.findById failure gracefully", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    (Registration.findById as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        eventId: "507f1f77bcf86cd799439050",
        eventSnapshot: {
          title: "Test Event",
          date: "2025-01-01",
          time: "10:00",
          roleName: "Speaker",
        },
      }),
    });

    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error("DB error")),
      }),
    });

    const req = mockReq({}, { token: "valid-token" });
    const res = mockRes();

    await controller.validateRoleAssignmentRejection(req, res);

    // Should still return success, just without timeZone
    expect(res.statusCode).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.event.timeZone).toBeUndefined();
  });
});
