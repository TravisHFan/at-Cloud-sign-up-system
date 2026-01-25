import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE importing the service
vi.mock("../../../../src/models/User", () => {
  return {
    default: {
      findOne: vi.fn(),
    },
  };
});

vi.mock("../../../../src/models/Registration", () => {
  const mockRegistrationInstance = {
    _id: { toString: () => "new-reg-id" },
    save: vi.fn().mockResolvedValue(undefined),
  };
  const MockRegistration = vi.fn(() => mockRegistrationInstance);
  (MockRegistration as any).findOne = vi.fn();
  (MockRegistration as any).countDocuments = vi.fn();
  return { default: MockRegistration };
});

vi.mock("../../../../src/models/GuestRegistration", () => {
  const mockGuestInstance = {
    _id: { toString: () => "new-guest-id" },
    save: vi.fn().mockResolvedValue(undefined),
  };
  const MockGuestRegistration = vi.fn(() => mockGuestInstance);
  (MockGuestRegistration as any).find = vi.fn();
  return { default: MockGuestRegistration };
});

vi.mock("../../../../src/services/CapacityService", () => ({
  CapacityService: {
    getRoleOccupancy: vi.fn().mockResolvedValue({ total: 0, capacity: 10 }),
    isRoleFull: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../../../../src/services/LockService", () => ({
  lockService: {
    withLock: vi.fn().mockImplementation(async (key, callback) => {
      await callback();
    }),
  },
}));

vi.mock("../../../../src/middleware/guestValidation", () => ({
  GUEST_MAX_ROLES_PER_EVENT: 1,
}));

vi.mock("../../../../src/utils/roleRegistrationLimits", () => ({
  getMaxRolesPerEvent: vi.fn().mockReturnValue(3), // Users can have max 3 roles
}));

import { RegistrationHelper } from "../../../../src/controllers/publicEvent/RegistrationHelper";
import User from "../../../../src/models/User";
import Registration from "../../../../src/models/Registration";
import GuestRegistration from "../../../../src/models/GuestRegistration";
import { CapacityService } from "../../../../src/services/CapacityService";
import { lockService } from "../../../../src/services/LockService";
import { getMaxRolesPerEvent } from "../../../../src/utils/roleRegistrationLimits";

describe("RegistrationHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    (CapacityService.getRoleOccupancy as any).mockResolvedValue({
      total: 0,
      capacity: 10,
    });
    (CapacityService.isRoleFull as any).mockReturnValue(false);
    (User.findOne as any).mockResolvedValue(null);
    (Registration.findOne as any).mockResolvedValue(null);
    (Registration.countDocuments as any).mockResolvedValue(0);
    (GuestRegistration.find as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  const createMockEvent = (overrides = {}) => ({
    _id: { toString: () => "event-123" },
    title: "Test Event",
    date: "2030-06-15",
    time: "10:00",
    location: "Main Hall",
    type: "Workshop",
    roles: [{ id: "role-1", name: "Participant", capacity: 10 }],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const createMockRole = (overrides = {}) => ({
    id: "role-1",
    name: "Participant",
    description: "Test role",
    openToPublic: true,
    capacity: 10,
    ...overrides,
  });

  const createMockAttendee = (overrides = {}) => ({
    name: "John Doe",
    email: "john@example.com",
    phone: "555-1234",
    ...overrides,
  });

  describe("executeRegistrationWithLock", () => {
    describe("lock acquisition", () => {
      it("should acquire lock with correct key based on event and email", async () => {
        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee({ email: "Test@Example.com" });

        await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(lockService.withLock).toHaveBeenCalledWith(
          "public-register:event-123:$test@example.com",
          expect.any(Function),
          10000
        );
      });

      it("should handle empty email in lock key", async () => {
        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee({ email: undefined });

        // This will likely fail validation earlier, but tests the code path
        try {
          await RegistrationHelper.executeRegistrationWithLock(
            event,
            "role-1",
            role,
            attendee
          );
        } catch {
          // Expected to fail due to undefined email
        }

        expect(lockService.withLock).toHaveBeenCalledWith(
          "public-register:event-123:$",
          expect.any(Function),
          10000
        );
      });
    });

    describe("existing user registration", () => {
      it("should return duplicate flag when user already registered for same role", async () => {
        const existingUser = {
          _id: { toString: () => "user-123" },
          email: "john@example.com",
          username: "johnd",
          firstName: "John",
          lastName: "Doe",
          role: "User",
        };
        (User.findOne as any).mockResolvedValue(existingUser);

        const existingReg = { _id: { toString: () => "existing-reg-123" } };
        (Registration.findOne as any).mockResolvedValue(existingReg);

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.duplicate).toBe(true);
        expect(result.registrationId).toBe("existing-reg-123");
        expect(result.registrationType).toBe("user");
      });

      it("should create new registration for existing user on new role", async () => {
        const existingUser = {
          _id: { toString: () => "user-123" },
          email: "john@example.com",
          username: "johnd",
          firstName: "John",
          lastName: "Doe",
          role: "User",
          roleInAtCloud: "member",
          avatar: "avatar.jpg",
          gender: "male",
        };
        (User.findOne as any).mockResolvedValue(existingUser);
        (Registration.findOne as any).mockResolvedValue(null);
        (Registration.countDocuments as any).mockResolvedValue(0);

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.duplicate).toBe(false);
        expect(result.registrationId).toBe("new-reg-id");
        expect(result.registrationType).toBe("user");
        expect(Registration).toHaveBeenCalled();
      });

      it("should enforce user role limit and return limitReached", async () => {
        const existingUser = {
          _id: { toString: () => "user-123" },
          email: "john@example.com",
          role: "User",
        };
        (User.findOne as any).mockResolvedValue(existingUser);
        (Registration.findOne as any).mockResolvedValue(null);
        (Registration.countDocuments as any).mockResolvedValue(3); // At limit
        (getMaxRolesPerEvent as any).mockReturnValue(3);

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.limitReached).toBe(true);
        expect(result.limitReachedFor).toBe("user");
        expect(result.userLimit).toBe(3);
        expect(result.registrationId).toBeNull();
      });
    });

    describe("guest registration", () => {
      it("should return duplicate flag for guest already registered to same role", async () => {
        (User.findOne as any).mockResolvedValue(null); // No matching user

        const existingGuestReg = {
          _id: { toString: () => "guest-reg-123" },
          roleId: "role-1",
        };
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([existingGuestReg]),
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.duplicate).toBe(true);
        expect(result.registrationId).toBe("guest-reg-123");
        expect(result.registrationType).toBe("guest");
      });

      it("should enforce guest max roles per event limit", async () => {
        (User.findOne as any).mockResolvedValue(null);

        // Guest already has 1 registration (different role)
        const existingGuestReg = {
          _id: { toString: () => "guest-reg-456" },
          roleId: "other-role",
        };
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([existingGuestReg]),
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.limitReached).toBe(true);
        expect(result.limitReachedFor).toBe("guest");
        expect(result.registrationId).toBeNull();
      });

      it("should create new guest registration when no existing registration", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.duplicate).toBe(false);
        expect(result.registrationId).toBe("new-guest-id");
        expect(result.registrationType).toBe("guest");
        expect(GuestRegistration).toHaveBeenCalled();
      });
    });

    describe("capacity checks", () => {
      it("should throw error when role is at full capacity (after duplicate check)", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });
        (CapacityService.isRoleFull as any).mockReturnValue(true);

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        await expect(
          RegistrationHelper.executeRegistrationWithLock(
            event,
            "role-1",
            role,
            attendee
          )
        ).rejects.toThrow("Role at full capacity");
      });

      it("should recheck capacity before user registration save", async () => {
        const existingUser = {
          _id: { toString: () => "user-123" },
          email: "john@example.com",
          username: "johnd",
          firstName: "John",
          lastName: "Doe",
          role: "User",
        };
        (User.findOne as any).mockResolvedValue(existingUser);
        (Registration.findOne as any).mockResolvedValue(null);
        (Registration.countDocuments as any).mockResolvedValue(0);

        // First call (initial check) returns not full, second call (before save) returns full
        let callCount = 0;
        (CapacityService.isRoleFull as any).mockImplementation(() => {
          callCount++;
          return callCount > 1; // Full on second check
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        await expect(
          RegistrationHelper.executeRegistrationWithLock(
            event,
            "role-1",
            role,
            attendee
          )
        ).rejects.toThrow("Role at full capacity");
      });

      it("should recheck capacity before guest registration save", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });

        // Returns not full first, then full on subsequent checks
        let callCount = 0;
        (CapacityService.isRoleFull as any).mockImplementation(() => {
          callCount++;
          return callCount > 1; // Full on second check
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        await expect(
          RegistrationHelper.executeRegistrationWithLock(
            event,
            "role-1",
            role,
            attendee
          )
        ).rejects.toThrow("Role at full capacity");
      });

      it("should update capacityAfter after successful registration", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });
        (CapacityService.getRoleOccupancy as any)
          .mockResolvedValueOnce({ total: 5, capacity: 10 }) // Before
          .mockResolvedValueOnce({ total: 5, capacity: 10 }) // Recheck before save
          .mockResolvedValueOnce({ total: 6, capacity: 10 }); // After

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.capacityBefore).toBe(5);
        expect(result.capacityAfter).toBe(6);
      });
    });

    describe("event save", () => {
      it("should call event.save after successful registration", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(event.save).toHaveBeenCalled();
      });

      it("should handle event without save method", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });

        const event = createMockEvent({ save: undefined });
        const role = createMockRole();
        const attendee = createMockAttendee();

        // Should not throw
        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.registrationId).toBe("new-guest-id");
      });
    });

    describe("email normalization", () => {
      it("should normalize email to lowercase for user lookup", async () => {
        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee({ email: "TEST@EXAMPLE.COM" });

        await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(User.findOne).toHaveBeenCalledWith({
          email: "test@example.com",
        });
      });

      it("should normalize email to lowercase for guest lookup", async () => {
        (User.findOne as any).mockResolvedValue(null);

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee({ email: "TEST@EXAMPLE.COM" });

        await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(GuestRegistration.find).toHaveBeenCalledWith(
          {
            eventId: event._id,
            email: "test@example.com",
            status: "active",
          },
          { _id: 1, roleId: 1 }
        );
      });
    });

    describe("return values", () => {
      it("should return all expected fields on successful guest registration", async () => {
        (User.findOne as any).mockResolvedValue(null);
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        });
        (CapacityService.getRoleOccupancy as any)
          .mockResolvedValueOnce({ total: 3, capacity: 10 })
          .mockResolvedValueOnce({ total: 3, capacity: 10 })
          .mockResolvedValueOnce({ total: 4, capacity: 10 });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result).toEqual({
          registrationId: "new-guest-id",
          registrationType: "guest",
          duplicate: false,
          capacityBefore: 3,
          capacityAfter: 4,
          limitReached: false,
          limitReachedFor: null,
          userLimit: null,
        });
      });

      it("should return null registrationId when limit reached", async () => {
        (User.findOne as any).mockResolvedValue(null);

        const existingGuestReg = {
          _id: { toString: () => "guest-reg-456" },
          roleId: "other-role",
        };
        (GuestRegistration.find as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue([existingGuestReg]),
        });

        const event = createMockEvent();
        const role = createMockRole();
        const attendee = createMockAttendee();

        const result = await RegistrationHelper.executeRegistrationWithLock(
          event,
          "role-1",
          role,
          attendee
        );

        expect(result.registrationId).toBeNull();
        expect(result.registrationType).toBeNull();
        expect(result.limitReached).toBe(true);
      });
    });
  });
});
