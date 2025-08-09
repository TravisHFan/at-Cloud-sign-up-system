import { describe, it, beforeEach, expect, vi } from "vitest";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";

// Mock models (hoisted by Vitest)
vi.mock("../../../src/models/User", () => ({
  default: {
    find: vi.fn().mockReturnThis(),
    findOne: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn(),
  },
}));

vi.mock("../../../src/models/Registration", () => ({
  default: {
    find: vi.fn(),
  },
}));

describe("EmailRecipientUtils", () => {
  let User: any;
  let Registration: any;

  beforeEach(async () => {
    // Import mocked modules within async beforeEach to avoid top-level await
    User = (await import("../../../src/models/User")).default as any;
    Registration = (await import("../../../src/models/Registration"))
      .default as any;
    vi.clearAllMocks();
  });

  it("getAdminUsers filters by roles and flags", async () => {
    User.select.mockResolvedValueOnce([
      { email: "sa@x.com", firstName: "S", lastName: "A", role: "Super Admin" },
      {
        email: "ad@x.com",
        firstName: "A",
        lastName: "D",
        role: "Administrator",
      },
    ]);
    const res = await EmailRecipientUtils.getAdminUsers();
    expect(User.find).toHaveBeenCalledWith({
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName role");
    expect(res.length).toBe(2);
  });

  it("getActiveVerifiedUsers handles excludeEmail", async () => {
    User.select.mockResolvedValueOnce([
      { email: "a@x.com", firstName: "A", lastName: "A" },
    ]);
    await EmailRecipientUtils.getActiveVerifiedUsers("skip@x.com");
    expect(User.find).toHaveBeenCalledWith({
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      email: { $ne: "skip@x.com" },
    });
  });

  it("getEventCoOrganizers returns empty when no organizerDetails", async () => {
    const res = await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "u1",
      organizerDetails: [],
    } as any);
    expect(res).toEqual([]);
  });

  it("getEventCoOrganizers queries by userIds excluding main organizer (string id)", async () => {
    User.select.mockResolvedValueOnce([
      { email: "co1@x.com", firstName: "C1", lastName: "L1" },
    ]);
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "u1",
      organizerDetails: [{ userId: "u1" }, { userId: "u2" }],
    } as any);
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["u2"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
  });

  it("getUserById returns user when found and flags true", async () => {
    const fake = { email: "u@x.com", firstName: "U", lastName: "X" };
    User.lean.mockResolvedValueOnce(fake);
    const res = await EmailRecipientUtils.getUserById("uid");
    expect(User.findOne).toHaveBeenCalledWith({
      _id: "uid",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName");
    expect(res).toEqual(fake);
  });

  it("getUserByEmail lowercases input and returns null when not found", async () => {
    User.lean.mockResolvedValueOnce(null);
    const res = await EmailRecipientUtils.getUserByEmail("USER@X.COM");
    expect(User.findOne).toHaveBeenCalledWith({
      email: "user@x.com",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(res).toBeNull();
  });

  it("getUsersByRole accepts string or array", async () => {
    User.select.mockResolvedValueOnce([
      { email: "l@x.com", firstName: "L", lastName: "E", role: "Leader" },
    ]);
    await EmailRecipientUtils.getUsersByRole("Leader");
    expect(User.find).toHaveBeenCalledWith({
      role: { $in: ["Leader"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
  });

  it("getAtCloudLeaders filters leaders with flags", async () => {
    User.select.mockResolvedValueOnce([
      { email: "c@x.com", firstName: "C", lastName: "L", role: "Leader" },
    ]);
    await EmailRecipientUtils.getAtCloudLeaders();
    expect(User.find).toHaveBeenCalledWith({
      isAtCloudLeader: true,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith(
      "email firstName lastName role roleInAtCloud"
    );
  });

  it("getEventParticipants builds recipients from userSnapshot, and falls back to populate path", async () => {
    // Two regs: one with userSnapshot (current), one legacy populate path
    (Registration.find as any).mockResolvedValueOnce([
      {
        userSnapshot: {
          email: "p1@x.com",
          firstName: "P1",
          lastName: "X",
        },
        userId: "p1id",
      },
      {
        userSnapshot: null,
        userId: {
          _id: "p2id",
          email: "p2@x.com",
          firstName: "P2",
          lastName: "Y",
          isActive: true,
          isVerified: true,
          emailNotifications: true,
        },
        populate: vi.fn().mockResolvedValue(undefined),
      },
    ]);

    const res = await EmailRecipientUtils.getEventParticipants("e1");
    expect(Registration.find).toHaveBeenCalledWith({
      eventId: "e1",
      $or: [
        { status: "approved" },
        { status: "confirmed" },
        { status: "active" },
      ],
    });
    expect(res).toEqual([
      { email: "p1@x.com", firstName: "P1", lastName: "X", _id: "p1id" },
      { email: "p2@x.com", firstName: "P2", lastName: "Y", _id: "p2id" },
    ]);
  });
});
