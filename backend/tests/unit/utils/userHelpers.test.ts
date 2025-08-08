import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserFields, getUserMethods } from "../../../src/utils/userHelpers";

describe("userHelpers", () => {
  describe("getUserFields", () => {
    it("should extract all user fields from a complete user object", () => {
      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        gender: "male",
        avatar: "avatar.jpg",
        homeAddress: "123 Main St",
        phone: "+1234567890",
        role: "Participant",
        isAtCloudLeader: true,
        roleInAtCloud: "Youth Leader",
        occupation: "Software Engineer",
        company: "Tech Corp",
        weeklyChurch: "Grace Church",
        churchAddress: "456 Church Ave",
        isActive: true,
        isVerified: true,
        lastLogin: new Date("2024-01-15"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
        // Extra fields that should be ignored
        password: "hashedpassword",
        extraField: "should not appear",
      };

      const result = getUserFields(mockUser);

      expect(result).toEqual({
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        gender: "male",
        avatar: "avatar.jpg",
        homeAddress: "123 Main St",
        phone: "+1234567890",
        role: "Participant",
        isAtCloudLeader: true,
        roleInAtCloud: "Youth Leader",
        occupation: "Software Engineer",
        company: "Tech Corp",
        weeklyChurch: "Grace Church",
        churchAddress: "456 Church Ave",
        isActive: true,
        isVerified: true,
        lastLogin: new Date("2024-01-15"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      });

      // Verify excluded fields are not present
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("extraField");
    });

    it("should extract user fields with minimal data", () => {
      const mockUser = {
        _id: "user456",
        username: "minimaluser",
        email: "minimal@example.com",
      };

      const result = getUserFields(mockUser);

      expect(result).toEqual({
        _id: "user456",
        username: "minimaluser",
        email: "minimal@example.com",
        firstName: undefined,
        lastName: undefined,
        gender: undefined,
        avatar: undefined,
        homeAddress: undefined,
        phone: undefined,
        role: undefined,
        isAtCloudLeader: undefined,
        roleInAtCloud: undefined,
        occupation: undefined,
        company: undefined,
        weeklyChurch: undefined,
        churchAddress: undefined,
        isActive: undefined,
        isVerified: undefined,
        lastLogin: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

    it("should handle null and undefined values in user fields", () => {
      const mockUser = {
        _id: "user789",
        username: "nulluser",
        email: "null@example.com",
        firstName: null,
        lastName: null,
        gender: null,
        avatar: null,
        homeAddress: null,
        phone: null,
        role: null,
        isAtCloudLeader: null,
        roleInAtCloud: null,
        occupation: null,
        company: null,
        weeklyChurch: null,
        churchAddress: null,
        isActive: null,
        isVerified: null,
        lastLogin: null,
        createdAt: null,
        updatedAt: null,
      };

      const result = getUserFields(mockUser);

      expect(result).toEqual({
        _id: "user789",
        username: "nulluser",
        email: "null@example.com",
        firstName: null,
        lastName: null,
        gender: null,
        avatar: null,
        homeAddress: null,
        phone: null,
        role: null,
        isAtCloudLeader: null,
        roleInAtCloud: null,
        occupation: null,
        company: null,
        weeklyChurch: null,
        churchAddress: null,
        isActive: null,
        isVerified: null,
        lastLogin: null,
        createdAt: null,
        updatedAt: null,
      });
    });

    it("should handle empty object input", () => {
      const mockUser = {};

      const result = getUserFields(mockUser);

      expect(result).toEqual({
        _id: undefined,
        username: undefined,
        email: undefined,
        firstName: undefined,
        lastName: undefined,
        gender: undefined,
        avatar: undefined,
        homeAddress: undefined,
        phone: undefined,
        role: undefined,
        isAtCloudLeader: undefined,
        roleInAtCloud: undefined,
        occupation: undefined,
        company: undefined,
        weeklyChurch: undefined,
        churchAddress: undefined,
        isActive: undefined,
        isVerified: undefined,
        lastLogin: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

    it("should preserve data types for all fields", () => {
      const mockUser = {
        _id: "user123",
        username: "typeuser",
        email: "type@example.com",
        firstName: "Type",
        lastName: "Test",
        gender: "female",
        avatar: "avatar.png",
        homeAddress: "789 Type St",
        phone: "+9876543210",
        role: "Administrator",
        isAtCloudLeader: false,
        roleInAtCloud: "Technical Lead",
        occupation: "Designer",
        company: "Design Studio",
        weeklyChurch: "Faith Church",
        churchAddress: "321 Faith Ave",
        isActive: false,
        isVerified: false,
        lastLogin: new Date("2024-02-01"),
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-02-01"),
      };

      const result = getUserFields(mockUser);

      expect(typeof result._id).toBe("string");
      expect(typeof result.username).toBe("string");
      expect(typeof result.email).toBe("string");
      expect(typeof result.firstName).toBe("string");
      expect(typeof result.lastName).toBe("string");
      expect(typeof result.gender).toBe("string");
      expect(typeof result.avatar).toBe("string");
      expect(typeof result.homeAddress).toBe("string");
      expect(typeof result.phone).toBe("string");
      expect(typeof result.role).toBe("string");
      expect(typeof result.isAtCloudLeader).toBe("boolean");
      expect(typeof result.roleInAtCloud).toBe("string");
      expect(typeof result.occupation).toBe("string");
      expect(typeof result.company).toBe("string");
      expect(typeof result.weeklyChurch).toBe("string");
      expect(typeof result.churchAddress).toBe("string");
      expect(typeof result.isActive).toBe("boolean");
      expect(typeof result.isVerified).toBe("boolean");
      expect(result.lastLogin).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("getUserMethods", () => {
    let mockUser: any;

    beforeEach(() => {
      mockUser = {
        comparePassword: vi.fn().mockResolvedValue(true),
        generateEmailVerificationToken: vi.fn().mockReturnValue("verify-token"),
        generatePasswordResetToken: vi.fn().mockReturnValue("reset-token"),
        incrementLoginAttempts: vi.fn().mockResolvedValue(undefined),
        resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
        isAccountLocked: vi.fn().mockReturnValue(false),
        save: vi
          .fn()
          .mockResolvedValue({ _id: "mock-id", updatedAt: new Date() }),
      };
    });

    it("should extract and bind all user methods", () => {
      const result = getUserMethods(mockUser);

      expect(result).toHaveProperty("comparePassword");
      expect(result).toHaveProperty("generateEmailVerificationToken");
      expect(result).toHaveProperty("generatePasswordResetToken");
      expect(result).toHaveProperty("incrementLoginAttempts");
      expect(result).toHaveProperty("resetLoginAttempts");
      expect(result).toHaveProperty("updateLastLogin");
      expect(result).toHaveProperty("isAccountLocked");
      expect(result).toHaveProperty("save");

      expect(typeof result.comparePassword).toBe("function");
      expect(typeof result.generateEmailVerificationToken).toBe("function");
      expect(typeof result.generatePasswordResetToken).toBe("function");
      expect(typeof result.incrementLoginAttempts).toBe("function");
      expect(typeof result.resetLoginAttempts).toBe("function");
      expect(typeof result.updateLastLogin).toBe("function");
      expect(typeof result.isAccountLocked).toBe("function");
      expect(typeof result.save).toBe("function");
    });

    it("should properly bind methods to preserve context", async () => {
      const result = getUserMethods(mockUser);

      // Test that methods are callable and properly bound
      const compareResult = await result.comparePassword("testpassword");
      expect(compareResult).toBe(true);
      expect(mockUser.comparePassword).toHaveBeenCalledWith("testpassword");

      const verifyToken = result.generateEmailVerificationToken();
      expect(verifyToken).toBe("verify-token");
      expect(mockUser.generateEmailVerificationToken).toHaveBeenCalled();

      const resetToken = result.generatePasswordResetToken();
      expect(resetToken).toBe("reset-token");
      expect(mockUser.generatePasswordResetToken).toHaveBeenCalled();

      await result.incrementLoginAttempts();
      expect(mockUser.incrementLoginAttempts).toHaveBeenCalled();

      await result.resetLoginAttempts();
      expect(mockUser.resetLoginAttempts).toHaveBeenCalled();

      await result.updateLastLogin();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();

      const isLocked = result.isAccountLocked();
      expect(isLocked).toBe(false);
      expect(mockUser.isAccountLocked).toHaveBeenCalled();

      const saveResult = await result.save();
      expect(saveResult).toEqual(
        expect.objectContaining({ updatedAt: expect.any(Date) })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should handle missing methods with optional chaining", () => {
      const userWithoutMethods = {};

      const result = getUserMethods(userWithoutMethods);

      expect(result.comparePassword).toBeUndefined();
      expect(result.generateEmailVerificationToken).toBeUndefined();
      expect(result.generatePasswordResetToken).toBeUndefined();
      expect(result.incrementLoginAttempts).toBeUndefined();
      expect(result.resetLoginAttempts).toBeUndefined();
      expect(result.updateLastLogin).toBeUndefined();
      expect(result.isAccountLocked).toBeUndefined();
      expect(result.save).toBeUndefined();
    });

    it("should handle partially available methods", () => {
      const partialUser: any = {
        comparePassword: vi.fn().mockResolvedValue(true),
        // Other methods missing
      };
      partialUser.save = vi.fn().mockResolvedValue(partialUser);

      const result = getUserMethods(partialUser);

      expect(typeof result.comparePassword).toBe("function");
      expect(result.generateEmailVerificationToken).toBeUndefined();
      expect(result.generatePasswordResetToken).toBeUndefined();
      expect(result.incrementLoginAttempts).toBeUndefined();
      expect(result.resetLoginAttempts).toBeUndefined();
      expect(result.updateLastLogin).toBeUndefined();
      expect(result.isAccountLocked).toBeUndefined();
      expect(typeof result.save).toBe("function");
    });

    it("should handle null/undefined methods", () => {
      const userWithNullMethods = {
        comparePassword: null,
        generateEmailVerificationToken: undefined,
        generatePasswordResetToken: vi.fn().mockReturnValue("token"),
        incrementLoginAttempts: null,
        resetLoginAttempts: undefined,
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
        isAccountLocked: null,
        save: undefined,
      };

      const result = getUserMethods(userWithNullMethods);

      expect(result.comparePassword).toBeUndefined();
      expect(result.generateEmailVerificationToken).toBeUndefined();
      expect(typeof result.generatePasswordResetToken).toBe("function");
      expect(result.incrementLoginAttempts).toBeUndefined();
      expect(result.resetLoginAttempts).toBeUndefined();
      expect(typeof result.updateLastLogin).toBe("function");
      expect(result.isAccountLocked).toBeUndefined();
      expect(result.save).toBeUndefined();
    });

    it("should preserve method signatures and return values", async () => {
      const complexUser = {
        comparePassword: vi
          .fn()
          .mockImplementation(async (password: string) => {
            return password === "correctpassword";
          }),
        generateEmailVerificationToken: vi.fn().mockImplementation(() => {
          return "email-verification-" + Date.now();
        }),
        generatePasswordResetToken: vi.fn().mockImplementation(() => {
          return "password-reset-" + Date.now();
        }),
        incrementLoginAttempts: vi.fn().mockImplementation(async () => {
          complexUser.loginAttempts = (complexUser.loginAttempts || 0) + 1;
        }),
        resetLoginAttempts: vi.fn().mockImplementation(async () => {
          complexUser.loginAttempts = 0;
        }),
        updateLastLogin: vi.fn().mockImplementation(async () => {
          complexUser.lastLogin = new Date() as any;
        }),
        isAccountLocked: vi.fn().mockImplementation(() => {
          return (complexUser.loginAttempts || 0) >= 5;
        }),
        save: vi.fn().mockImplementation(async () => {
          return { ...complexUser, updatedAt: new Date() };
        }),
        loginAttempts: 0,
        lastLogin: null,
      };

      const result = getUserMethods(complexUser);

      // Test comparePassword with different inputs
      expect(await result.comparePassword("wrongpassword")).toBe(false);
      expect(await result.comparePassword("correctpassword")).toBe(true);

      // Test token generation returns strings
      const emailToken = result.generateEmailVerificationToken();
      expect(typeof emailToken).toBe("string");
      expect(emailToken).toMatch(/^email-verification-\d+$/);

      const resetToken = result.generatePasswordResetToken();
      expect(typeof resetToken).toBe("string");
      expect(resetToken).toMatch(/^password-reset-\d+$/);

      // Test login attempt management
      expect(result.isAccountLocked()).toBe(false);
      await result.incrementLoginAttempts();
      expect(complexUser.loginAttempts).toBe(1);

      await result.resetLoginAttempts();
      expect(complexUser.loginAttempts).toBe(0);

      // Test updateLastLogin
      const beforeUpdate = complexUser.lastLogin;
      await result.updateLastLogin();
      expect(complexUser.lastLogin).not.toBe(beforeUpdate);
      expect(complexUser.lastLogin).toBeInstanceOf(Date);

      // Test save method returns updated object
      const saveResult = await result.save();
      expect(saveResult).toHaveProperty("updatedAt");
      expect(saveResult.updatedAt).toBeInstanceOf(Date);
    });

    it("should maintain proper this context when methods are called", async () => {
      // Create a user object that relies on 'this' context
      const contextUser = {
        username: "contexttest",
        loginAttempts: 2,

        // Method that uses 'this' context
        isAccountLocked: function () {
          return this.loginAttempts >= 5;
        },

        incrementLoginAttempts: function () {
          this.loginAttempts += 1;
          return Promise.resolve();
        },

        getUsername: function () {
          return this.username;
        },
      };

      const result = getUserMethods(contextUser) as any;

      // Test that 'this' context is preserved
      expect(result.isAccountLocked()).toBe(false);

      await result.incrementLoginAttempts();
      expect(contextUser.loginAttempts).toBe(3);

      // Test that bound method still has access to original object properties
      if (result.getUsername) {
        expect(result.getUsername()).toBe("contexttest");
      }
    });
  });

  describe("integration scenarios", () => {
    it("should work together to extract both fields and methods from the same user", () => {
      const completeUser: any = {
        // Fields
        _id: "integration123",
        username: "integrationuser",
        email: "integration@example.com",
        firstName: "Integration",
        lastName: "Test",
        role: "Leader",
        isActive: true,
        isVerified: true,

        // Methods
        comparePassword: vi.fn().mockResolvedValue(true),
        isAccountLocked: vi.fn().mockReturnValue(false),

        // Non-extracted fields
        password: "shouldnotappear",
        secretField: "alsoshouldnotappear",
      };
      completeUser.save = vi.fn().mockResolvedValue(completeUser);

      const fields = getUserFields(completeUser);
      const methods = getUserMethods(completeUser);

      // Verify fields extraction
      expect(fields._id).toBe("integration123");
      expect(fields.username).toBe("integrationuser");
      expect(fields.isActive).toBe(true);
      expect(fields).not.toHaveProperty("password");
      expect(fields).not.toHaveProperty("secretField");

      // Verify methods extraction
      expect(typeof methods.comparePassword).toBe("function");
      expect(typeof methods.save).toBe("function");
      expect(typeof methods.isAccountLocked).toBe("function");

      // Verify separation of concerns
      expect(fields).not.toHaveProperty("comparePassword");
      expect(methods).not.toHaveProperty("_id");
      expect(methods).not.toHaveProperty("username");
    });

    it("should handle mongoose-like user objects", () => {
      // Simulate a mongoose document-like object
      const mongooseUser: any = {
        _id: "mongoose123",
        username: "mongooseuser",
        email: "mongoose@example.com",
        firstName: "Mongoose",
        lastName: "User",
        toObject: () => mongooseUser,
        toJSON: () => ({ ...mongooseUser, id: mongooseUser._id }),
        comparePassword: vi.fn().mockResolvedValue(true),
        isAccountLocked: vi.fn().mockReturnValue(false),
        // Additional mongoose properties
        __v: 0,
        $__: {},
        $isNew: false,
      };
      mongooseUser.save = vi.fn().mockResolvedValue(mongooseUser);

      const fields = getUserFields(mongooseUser);
      const methods = getUserMethods(mongooseUser);

      // Should extract standard user fields
      expect(fields._id).toBe("mongoose123");
      expect(fields.username).toBe("mongooseuser");
      expect(fields.email).toBe("mongoose@example.com");

      // Should not include mongoose internal properties
      expect(fields).not.toHaveProperty("__v");
      expect(fields).not.toHaveProperty("$__");
      expect(fields).not.toHaveProperty("$isNew");
      expect(fields).not.toHaveProperty("toObject");
      expect(fields).not.toHaveProperty("toJSON");

      // Should extract methods
      expect(typeof methods.save).toBe("function");
      expect(typeof methods.comparePassword).toBe("function");
      expect(typeof methods.isAccountLocked).toBe("function");
    });
  });
});
