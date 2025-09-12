import { describe, it, expect, vi, beforeEach } from "vitest";
import * as tokenUtil from "../../../src/utils/roleAssignmentRejectionToken";
import * as controller from "../../../src/controllers/roleAssignmentRejectionController";
import Registration from "../../../src/models/Registration";
import User from "../../../src/models/User";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";

vi.mock("../../../src/models/Registration");
vi.mock("../../../src/models/User");
vi.mock("../../../src/services/notifications/TrioNotificationService");

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

describe("rejectRoleAssignment notification emission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits trio notification when assigner differs from assignee", async () => {
    // Arrange token verification success
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439011",
        assigneeId: "507f1f77bcf86cd799439012",
      },
    } as any);

    // Mock registration document
    const deleteOne = vi.fn().mockResolvedValue(undefined);
    (Registration.findById as any).mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      userId: "507f1f77bcf86cd799439012",
      registeredBy: "507f1f77bcf86cd799439013",
      eventId: "507f1f77bcf86cd799439099",
      eventSnapshot: { title: "Evt", roleName: "Speaker" },
      deleteOne,
    });

    // Mock users
    (User.findById as any).mockImplementation((id: string) => ({
      lean: () =>
        Promise.resolve({
          _id: id,
          firstName: "F" + id.slice(-2),
          lastName: "L" + id.slice(-2),
          username: "u" + id.slice(-2),
          role: "Participant",
        }),
    }));

    const trioSpy = vi
      .spyOn(TrioNotificationService, "createEventRoleAssignmentRejectedTrio")
      .mockResolvedValue({ success: true } as any);

    const req = mockReq({ token: "tok", note: "Reason" });
    const res = mockRes();

    // Act
    await controller.rejectRoleAssignment(req, res);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.data?.status).toBe("rejected");
    expect(trioSpy).toHaveBeenCalledTimes(1);
    const callArg = trioSpy.mock.calls[0][0];
    expect(callArg.roleName).toBe("Speaker");
    expect(callArg.event.id).toBe("507f1f77bcf86cd799439099");
  });

  it("does not emit trio when assigner is same as assignee (self-signup case)", async () => {
    vi.spyOn(tokenUtil, "verifyRoleAssignmentRejectionToken").mockReturnValue({
      valid: true,
      payload: {
        assignmentId: "507f1f77bcf86cd799439021",
        assigneeId: "507f1f77bcf86cd799439022",
      },
    } as any);

    const deleteOne = vi.fn().mockResolvedValue(undefined);
    (Registration.findById as any).mockResolvedValue({
      _id: "507f1f77bcf86cd799439021",
      userId: "507f1f77bcf86cd799439022",
      registeredBy: "507f1f77bcf86cd799439022",
      eventId: "507f1f77bcf86cd799439099",
      eventSnapshot: { title: "Evt2", roleName: "Helper" },
      deleteOne,
    });

    (User.findById as any).mockImplementation((id: string) => ({
      lean: () =>
        Promise.resolve({
          _id: id,
          firstName: "F",
          lastName: "L",
          username: "u",
          role: "Participant",
        }),
    }));

    const trioSpy = vi
      .spyOn(TrioNotificationService, "createEventRoleAssignmentRejectedTrio")
      .mockResolvedValue({ success: true } as any);

    const req = mockReq({ token: "tok2", note: "Busy" });
    const res = mockRes();
    await controller.rejectRoleAssignment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data?.status).toBe("rejected");
    expect(trioSpy).not.toHaveBeenCalled();
  });
});
