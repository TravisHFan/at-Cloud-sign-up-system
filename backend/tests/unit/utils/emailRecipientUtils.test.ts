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

  it("getActiveVerifiedUsers without excludeEmail omits email filter", async () => {
    User.select.mockResolvedValueOnce([
      { email: "b@x.com", firstName: "B", lastName: "B" },
    ]);
    await EmailRecipientUtils.getActiveVerifiedUsers();
    expect(User.find).toHaveBeenCalledWith({
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName");
  });

  it("getEventCoOrganizers returns empty when no organizerDetails", async () => {
    const res = await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "u1",
      organizerDetails: [],
    } as any);
    expect(res).toEqual([]);
  });

  it("getEventCoOrganizers returns empty when organizerDetails is undefined", async () => {
    const res = await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "u1",
      // organizerDetails omitted
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

  it("getEventCoOrganizers handles createdBy as populated user object with id string", async () => {
    User.select.mockResolvedValueOnce([
      { email: "co2@x.com", firstName: "C2", lastName: "L2" },
    ]);
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: { id: "main123" },
      organizerDetails: [{ userId: "main123" }, { userId: "co123" }],
    } as any);
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["co123"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
  });

  it("getEventCoOrganizers handles createdBy as ObjectId-like with toString()", async () => {
    User.select.mockResolvedValueOnce([
      { email: "co3@x.com", firstName: "C3", lastName: "L3" },
    ]);
    const objectId = { toString: () => "abc123" } as any;
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: objectId,
      organizerDetails: [{ userId: "abc123" }, { userId: "xyz789" }],
    } as any);
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["xyz789"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
  });

  it("getEventCoOrganizers handles createdBy object with _id field", async () => {
    User.select.mockResolvedValueOnce([
      { email: "co4@x.com", firstName: "C4", lastName: "L4" },
    ]);
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: { _id: { toString: () => "owner1" } },
      organizerDetails: [
        { userId: { toString: () => "owner1" } },
        { userId: { toString: () => "helper1" } },
      ],
    } as any);
    // Verify only the non-owner co-organizer remains in $in
    expect(User.find).toHaveBeenCalledTimes(1);
    const call = User.find.mock.calls[0][0];
    expect(call).toMatchObject({
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(call._id.$in).toHaveLength(1);
    expect(typeof call._id.$in[0].toString).toBe("function");
    expect(call._id.$in[0].toString()).toBe("helper1");
  });

  it("getEventCoOrganizers falls back to String(createdBy) when given a plain object", async () => {
    // createdBy lacks id/_id and has default toString => "[object Object]"
    User.select.mockResolvedValueOnce([
      { email: "co5@x.com", firstName: "C5", lastName: "L5" },
    ]);
    const plainObject = { foo: "bar" } as any;
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: plainObject,
      organizerDetails: [{ userId: "u10" }, { userId: "u20" }],
    } as any);
    // Since String(createdBy) !== any userId, both remain co-organizers
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["u10", "u20"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName");
  });

  it("getEventCoOrganizers returns [] when no co-organizers after excluding main organizer", async () => {
    const res = await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "owner42",
      organizerDetails: [{ userId: "owner42" }],
    } as any);
    // Early return branch: no DB call when $in is empty
    expect(res).toEqual([]);
    expect(User.find).not.toHaveBeenCalled();
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

  it("getUserById returns null when not found", async () => {
    User.lean.mockResolvedValueOnce(null);
    const res = await EmailRecipientUtils.getUserById("missing");
    expect(User.findOne).toHaveBeenCalledWith({
      _id: "missing",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(res).toBeNull();
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

  it("getUserByEmail returns user when found", async () => {
    const fake = { email: "foo@x.com", firstName: "Foo", lastName: "Bar" };
    User.lean.mockResolvedValueOnce(fake);
    const res = await EmailRecipientUtils.getUserByEmail("FOO@X.COM");
    expect(User.findOne).toHaveBeenCalledWith({
      email: "foo@x.com",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName");
    expect(res).toEqual(fake);
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

  it("getUsersByRole handles array input", async () => {
    User.select.mockResolvedValueOnce([
      {
        email: "a@x.com",
        firstName: "A",
        lastName: "D",
        role: "Administrator",
      },
      { email: "s@x.com", firstName: "S", lastName: "A", role: "Super Admin" },
    ]);
    await EmailRecipientUtils.getUsersByRole(["Administrator", "Super Admin"]);
    expect(User.find).toHaveBeenCalledWith({
      role: { $in: ["Administrator", "Super Admin"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
  });

  it("getSystemAuthorizationChangeRecipients excludes changed user and targets admin roles", async () => {
    User.select.mockResolvedValueOnce([
      {
        email: "admin@x.com",
        firstName: "Admin",
        lastName: "One",
        role: "Administrator",
      },
    ]);
    await EmailRecipientUtils.getSystemAuthorizationChangeRecipients("user123");
    expect(User.find).toHaveBeenCalledWith({
      _id: { $ne: "user123" },
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith("email firstName lastName role");
  });

  it("getRoleInAtCloudChangeRecipients queries @Cloud leaders and admins", async () => {
    User.select.mockResolvedValueOnce([
      {
        email: "lead@x.com",
        firstName: "Lead",
        lastName: "Er",
        role: "Leader",
        roleInAtCloud: "Worship",
      },
    ]);
    await EmailRecipientUtils.getRoleInAtCloudChangeRecipients();
    expect(User.find).toHaveBeenCalledWith({
      $or: [
        { role: "Super Admin" },
        { role: { $in: ["Administrator", "Leader"] }, isAtCloudLeader: true },
      ],
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });
    expect(User.select).toHaveBeenCalledWith(
      "email firstName lastName role roleInAtCloud"
    );
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

  it("getEventParticipants skips entries with invalid email addresses", async () => {
    (Registration.find as any).mockResolvedValueOnce([
      {
        userSnapshot: {
          email: "invalid-email",
          firstName: "Bad",
          lastName: "Email",
        },
        userId: "bad1",
      },
      {
        userSnapshot: {
          email: "good@x.com",
          firstName: "Good",
          lastName: "Email",
        },
        userId: "good1",
      },
    ]);

    const res = await EmailRecipientUtils.getEventParticipants("e2");
    expect(res).toEqual([
      {
        email: "good@x.com",
        firstName: "Good",
        lastName: "Email",
        _id: "good1",
      },
    ]);
  });

  it("getEventParticipants handles userSnapshot without userId and filters out legacy user failing flags", async () => {
    const legacyReg = {
      userSnapshot: null,
      userId: {
        _id: "legacyId",
        email: "legacy@x.com",
        firstName: "Old",
        lastName: "User",
        isActive: true,
        isVerified: false, // fails flags
        emailNotifications: true,
      },
      populate: vi.fn().mockResolvedValue(undefined),
    };
    (Registration.find as any).mockResolvedValueOnce([
      {
        userSnapshot: {
          email: "snap@x.com",
          firstName: "Snap",
          lastName: "Shot",
        },
        userId: undefined, // missing userId -> _id should be undefined
      },
      legacyReg,
    ]);

    const res = await EmailRecipientUtils.getEventParticipants("e3");
    expect(legacyReg.populate).toHaveBeenCalled();
    expect(res).toEqual([
      {
        email: "snap@x.com",
        firstName: "Snap",
        lastName: "Shot",
        _id: undefined,
      },
    ]);
  });

  it("getEventParticipants defaults missing names from snapshot to empty strings", async () => {
    (Registration.find as any).mockResolvedValueOnce([
      {
        userSnapshot: {
          email: "only@x.com",
        },
        userId: "u9",
      },
    ]);
    const res = await EmailRecipientUtils.getEventParticipants("e4");
    expect(res).toEqual([
      { email: "only@x.com", firstName: "", lastName: "", _id: "u9" },
    ]);
  });
});
