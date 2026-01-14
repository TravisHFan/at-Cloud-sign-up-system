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

vi.mock("../../../src/models/GuestRegistration", () => ({
  default: {
    find: vi.fn(),
  },
}));

describe("EmailRecipientUtils", () => {
  let User: any;
  let Registration: any;
  let GuestRegistration: any;

  beforeEach(async () => {
    // Import mocked modules within async beforeEach to avoid top-level await
    User = (await import("../../../src/models/User")).default as any;
    Registration = (await import("../../../src/models/Registration"))
      .default as any;
    GuestRegistration = (await import("../../../src/models/GuestRegistration"))
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
      { _id: "u2", email: "co1@x.com", firstName: "C1", lastName: "L1" },
    ]);
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: "u1",
      organizerDetails: [{ userId: "u1" }, { userId: "u2" }],
    } as any);
    // Co-organizers are notified regardless of emailNotifications preference
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["u2"] },
      isActive: true,
      isVerified: true,
    });
  });

  it("getEventCoOrganizers handles createdBy as populated user object with id string", async () => {
    User.select.mockResolvedValueOnce([
      { _id: "co123", email: "co2@x.com", firstName: "C2", lastName: "L2" },
    ]);
    await EmailRecipientUtils.getEventCoOrganizers({
      createdBy: { id: "main123" },
      organizerDetails: [{ userId: "main123" }, { userId: "co123" }],
    } as any);
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["co123"] },
      isActive: true,
      isVerified: true,
    });
  });

  it("getEventCoOrganizers handles createdBy as ObjectId-like with toString()", async () => {
    User.select.mockResolvedValueOnce([
      { _id: "xyz789", email: "co3@x.com", firstName: "C3", lastName: "L3" },
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
    });
  });

  it("getEventCoOrganizers handles createdBy object with _id field", async () => {
    User.select.mockResolvedValueOnce([
      {
        _id: { toString: () => "helper1" },
        email: "co4@x.com",
        firstName: "C4",
        lastName: "L4",
      },
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
    });
    expect(call._id.$in).toHaveLength(1);
    expect(typeof call._id.$in[0].toString).toBe("function");
    expect(call._id.$in[0].toString()).toBe("helper1");
  });

  it("getEventCoOrganizers falls back to String(createdBy) when given a plain object", async () => {
    // createdBy lacks id/_id and has default toString => "[object Object]"
    User.select.mockResolvedValueOnce([
      { _id: "u10", email: "co5@x.com", firstName: "C5", lastName: "L5" },
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
    });
    expect(User.select).toHaveBeenCalledWith("_id email firstName lastName");
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

  it("getRoleInAtCloudChangeRecipients queries @Cloud co-workers and admins", async () => {
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

  describe("getEventGuests", () => {
    it("returns guests with valid emails", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "guest1@example.com", fullName: "John Doe" },
        { email: "guest2@example.com", fullName: "Jane Smith" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event123");

      expect(GuestRegistration.find).toHaveBeenCalledWith({
        eventId: "event123",
        status: "active",
      });
      expect(res).toEqual([
        { email: "guest1@example.com", firstName: "John", lastName: "Doe" },
        { email: "guest2@example.com", firstName: "Jane", lastName: "Smith" },
      ]);
    });

    it("returns empty array when no guests found", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getEventGuests("event456");

      expect(res).toEqual([]);
    });

    it("skips guests with invalid emails (null)", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: null, fullName: "Invalid Guest" },
        { email: "valid@example.com", fullName: "Valid Guest" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event789");

      expect(res).toEqual([
        { email: "valid@example.com", firstName: "Valid", lastName: "Guest" },
      ]);
    });

    it("skips guests with emails missing @ symbol", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "notanemail", fullName: "Bad Email" },
        { email: "good@test.com", fullName: "Good Email" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event999");

      expect(res).toEqual([
        { email: "good@test.com", firstName: "Good", lastName: "Email" },
      ]);
    });

    it("skips guests with non-string emails", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: 123, fullName: "Number Email" },
        { email: "string@test.com", fullName: "String Email" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event111");

      expect(res).toEqual([
        { email: "string@test.com", firstName: "String", lastName: "Email" },
      ]);
    });

    it("handles fullName with single word (no last name)", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "single@test.com", fullName: "SingleName" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event222");

      expect(res).toEqual([
        { email: "single@test.com", firstName: "SingleName", lastName: "" },
      ]);
    });

    it("handles fullName with multiple words (multi-part last name)", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "multi@test.com", fullName: "Mary Jane Van Dyke" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event333");

      expect(res).toEqual([
        {
          email: "multi@test.com",
          firstName: "Mary",
          lastName: "Jane Van Dyke",
        },
      ]);
    });

    it("handles empty or null fullName", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "empty@test.com", fullName: "" },
        { email: "null@test.com", fullName: null },
        { email: "undef@test.com" },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event444");

      expect(res).toEqual([
        { email: "empty@test.com", firstName: "", lastName: "" },
        { email: "null@test.com", firstName: "", lastName: "" },
        { email: "undef@test.com", firstName: "", lastName: "" },
      ]);
    });

    it("trims whitespace from fullName", async () => {
      (GuestRegistration.find as any).mockResolvedValueOnce([
        { email: "space@test.com", fullName: "  John   Doe  " },
      ]);

      const res = await EmailRecipientUtils.getEventGuests("event555");

      expect(res).toEqual([
        { email: "space@test.com", firstName: "John", lastName: "Doe" },
      ]);
    });
  });

  describe("getEventAllOrganizers", () => {
    it("returns main organizer and co-organizers", async () => {
      // Main organizer query: findOne -> select (returns resolved value)
      User.select
        .mockResolvedValueOnce({
          _id: { toString: () => "main1" },
          email: "main@test.com",
          firstName: "Main",
          lastName: "Org",
        })
        // Co-organizers query: find -> select (returns array)
        .mockResolvedValueOnce([
          {
            _id: { toString: () => "co1" },
            email: "co1@test.com",
            firstName: "Co",
            lastName: "One",
          },
        ]);

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "main1",
        organizerDetails: [{ userId: "main1" }, { userId: "co1" }],
      } as any);

      expect(res).toHaveLength(2);
      expect(res[0]).toMatchObject({
        email: "main@test.com",
        firstName: "Main",
        lastName: "Org",
      });
      expect(res[1]).toMatchObject({
        email: "co1@test.com",
        firstName: "Co",
        lastName: "One",
      });
    });

    it("returns only main organizer when no co-organizers exist", async () => {
      User.select.mockResolvedValueOnce({
        _id: { toString: () => "solo1" },
        email: "solo@test.com",
        firstName: "Solo",
        lastName: "Leader",
      });

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "solo1",
        organizerDetails: [],
      } as any);

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "solo@test.com",
        firstName: "Solo",
        lastName: "Leader",
      });
    });

    it("returns only main organizer when organizerDetails is undefined", async () => {
      User.select.mockResolvedValueOnce({
        _id: { toString: () => "onlyMain" },
        email: "only@test.com",
        firstName: "Only",
        lastName: "Main",
      });

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "onlyMain",
      } as any);

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ email: "only@test.com" });
    });

    it("returns empty when main organizer not found and no co-organizers", async () => {
      User.select.mockResolvedValueOnce(null);

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "missing1",
        organizerDetails: [],
      } as any);

      expect(res).toEqual([]);
    });

    it("returns only co-organizers when main organizer is inactive/not found", async () => {
      // Main organizer query returns null
      User.select
        .mockResolvedValueOnce(null)
        // Co-organizers query returns valid users
        .mockResolvedValueOnce([
          {
            _id: { toString: () => "active-co" },
            email: "active-co@test.com",
            firstName: "Active",
            lastName: "Co",
          },
        ]);

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "inactive-main",
        organizerDetails: [
          { userId: "inactive-main" },
          { userId: "active-co" },
        ],
      } as any);

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "active-co@test.com",
        firstName: "Active",
        lastName: "Co",
      });
    });

    it("handles null mainOrganizerId when createdBy cannot be extracted", async () => {
      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: null,
        organizerDetails: [],
      } as any);

      expect(res).toEqual([]);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("handles co-organizers with null/undefined userIds", async () => {
      User.select
        .mockResolvedValueOnce({
          _id: { toString: () => "main2" },
          email: "main2@test.com",
          firstName: "Main",
          lastName: "Two",
        })
        .mockResolvedValueOnce([
          {
            _id: { toString: () => "valid-co" },
            email: "valid-co@test.com",
            firstName: "Valid",
            lastName: "Co",
          },
        ]);

      const res = await EmailRecipientUtils.getEventAllOrganizers({
        createdBy: "main2",
        organizerDetails: [
          { userId: "main2" },
          { userId: null },
          { userId: undefined },
          { userId: "valid-co" },
        ],
      } as any);

      expect(res).toHaveLength(2);
    });
  });

  describe("edge cases for extractIdString helper", () => {
    it("getEventCoOrganizers handles createdBy with _id as string", async () => {
      User.select.mockResolvedValueOnce([
        { _id: "co99", email: "co99@x.com", firstName: "Co", lastName: "99" },
      ]);
      await EmailRecipientUtils.getEventCoOrganizers({
        createdBy: { _id: "mainStringId" },
        organizerDetails: [{ userId: "mainStringId" }, { userId: "co99" }],
      } as any);
      expect(User.find).toHaveBeenCalledWith({
        _id: { $in: ["co99"] },
        isActive: true,
        isVerified: true,
      });
    });
  });

  describe("getProgramParticipants", () => {
    let Program: any;
    let Purchase: any;

    beforeEach(async () => {
      // Mock Program model
      vi.doMock("../../../src/models/Program", () => ({
        default: {
          findById: vi.fn(),
        },
      }));

      // Mock Purchase model
      vi.doMock("../../../src/models/Purchase", () => ({
        default: {
          find: vi.fn().mockReturnThis(),
          populate: vi.fn(),
        },
      }));

      // Re-import mocked modules
      Program = (await import("../../../src/models/Program")).default as any;
      Purchase = (await import("../../../src/models/Purchase")).default as any;
    });

    it("returns empty array when program not found", async () => {
      Program.findById.mockResolvedValueOnce(null);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "nonexistent-program-id"
      );

      expect(res).toEqual([]);
    });

    it("returns mentors when includeMentors is true", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [{ userId: "mentor1" }, { userId: "mentor2" }],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "mentor1" },
          email: "mentor1@test.com",
          firstName: "Mentor",
          lastName: "One",
        },
        {
          _id: { toString: () => "mentor2" },
          email: "mentor2@test.com",
          firstName: "Mentor",
          lastName: "Two",
        },
      ]);

      Purchase.populate.mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: true, includeClassReps: false, includeMentees: false }
      );

      expect(res).toHaveLength(2);
      expect(res[0]).toMatchObject({
        email: "mentor1@test.com",
        role: "mentor",
      });
      expect(res[1]).toMatchObject({
        email: "mentor2@test.com",
        role: "mentor",
      });
    });

    it("excludes mentors when includeMentors is false", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [{ userId: "mentor1" }],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        {
          includeMentors: false,
          includeClassReps: false,
          includeMentees: false,
        }
      );

      expect(res).toHaveLength(0);
      // User.find should not be called for mentors
    });

    it("returns class reps from purchases", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: true,
          userId: {
            _id: { toString: () => "classrep1" },
            email: "classrep1@test.com",
            firstName: "Class",
            lastName: "Rep",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: false, includeClassReps: true, includeMentees: false }
      );

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "classrep1@test.com",
        role: "classRep",
      });
    });

    it("returns mentees from purchases", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "mentee1" },
            email: "mentee1@test.com",
            firstName: "Mentee",
            lastName: "One",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: false, includeClassReps: false, includeMentees: true }
      );

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "mentee1@test.com",
        role: "mentee",
      });
    });

    it("skips users with email notifications disabled", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "user1" },
            email: "user1@test.com",
            firstName: "User",
            lastName: "One",
            isActive: true,
            isVerified: true,
            emailNotifications: false, // disabled
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("skips inactive users", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "user1" },
            email: "user1@test.com",
            firstName: "User",
            lastName: "One",
            isActive: false, // inactive
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("skips unverified users", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "user1" },
            email: "user1@test.com",
            firstName: "User",
            lastName: "One",
            isActive: true,
            isVerified: false, // not verified
            emailNotifications: true,
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("skips purchases with null userId", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: null,
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("skips purchases with user missing email", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "user1" },
            email: null, // no email
            firstName: "User",
            lastName: "One",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("includes admin-enrolled mentees", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: ["admin-mentee1"], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([]);

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "admin-mentee1" },
          email: "adminmentee@test.com",
          firstName: "Admin",
          lastName: "Mentee",
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: false, includeClassReps: false, includeMentees: true }
      );

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "adminmentee@test.com",
        role: "mentee",
      });
    });

    it("includes admin-enrolled class reps", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: ["admin-classrep1"] },
      });

      Purchase.populate.mockResolvedValueOnce([]);

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "admin-classrep1" },
          email: "adminclassrep@test.com",
          firstName: "Admin",
          lastName: "ClassRep",
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: false, includeClassReps: true, includeMentees: false }
      );

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        email: "adminclassrep@test.com",
        role: "classRep",
      });
    });

    it("deduplicates admin-enrolled users already in purchases", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: ["mentee1"], classReps: [] },
      });

      // Mentee from purchase
      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "mentee1" },
            email: "mentee1@test.com",
            firstName: "Mentee",
            lastName: "One",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      // Same mentee from admin enrollment
      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "mentee1" },
          email: "mentee1@test.com",
          firstName: "Mentee",
          lastName: "One",
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      // Should only have one entry (deduplicated)
      expect(res).toHaveLength(1);
      expect(res[0].email).toBe("mentee1@test.com");
    });

    it("deduplicates admin class reps already in purchases", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: [], classReps: ["classrep1"] },
      });

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: true,
          userId: {
            _id: { toString: () => "classrep1" },
            email: "classrep1@test.com",
            firstName: "Class",
            lastName: "Rep",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "classrep1" },
          email: "classrep1@test.com",
          firstName: "Class",
          lastName: "Rep",
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeClassReps: true }
      );

      expect(res).toHaveLength(1);
      expect(res[0].email).toBe("classrep1@test.com");
    });

    it("uses default options (all participant types included)", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [{ userId: "mentor1" }],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "mentor1" },
          email: "mentor1@test.com",
          firstName: "Mentor",
          lastName: "One",
        },
      ]);

      Purchase.populate.mockResolvedValueOnce([
        {
          isClassRep: false,
          userId: {
            _id: { toString: () => "mentee1" },
            email: "mentee1@test.com",
            firstName: "Mentee",
            lastName: "One",
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          },
        },
      ]);

      // Call without options - should use defaults (all true)
      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id"
      );

      expect(res).toHaveLength(2);
    });

    it("handles mentor with no email", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [{ userId: "mentor1" }],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "mentor1" },
          email: null, // no email
          firstName: "Mentor",
          lastName: "One",
        },
      ]);

      Purchase.populate.mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: true }
      );

      expect(res).toHaveLength(0);
    });

    it("handles admin-enrolled user with no email", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [],
        adminEnrollments: { mentees: ["user1"], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([]);

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "user1" },
          email: null, // no email
          firstName: "User",
          lastName: "One",
        },
      ]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentees: true }
      );

      expect(res).toHaveLength(0);
    });

    it("handles program with no mentors array", async () => {
      Program.findById.mockResolvedValueOnce({
        // mentors is undefined
        adminEnrollments: { mentees: [], classReps: [] },
      });

      Purchase.populate.mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: true }
      );

      expect(res).toHaveLength(0);
    });

    it("handles mentors with null userId values", async () => {
      Program.findById.mockResolvedValueOnce({
        mentors: [
          { userId: null },
          { userId: undefined },
          { userId: "mentor1" },
        ],
        adminEnrollments: { mentees: [], classReps: [] },
      });

      User.select.mockResolvedValueOnce([
        {
          _id: { toString: () => "mentor1" },
          email: "mentor1@test.com",
          firstName: "Mentor",
          lastName: "One",
        },
      ]);

      Purchase.populate.mockResolvedValueOnce([]);

      const res = await EmailRecipientUtils.getProgramParticipants(
        "program-id",
        { includeMentors: true, includeClassReps: false, includeMentees: false }
      );

      // Only mentor1 should be returned (nulls filtered)
      expect(res).toHaveLength(1);
      expect(res[0].email).toBe("mentor1@test.com");
    });
  });
});
