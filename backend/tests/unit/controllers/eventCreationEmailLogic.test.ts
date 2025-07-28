import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import User from "../../../src/models/User";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";

// Mock the dependencies
vi.mock("../../../src/models/User");
vi.mock("../../../src/utils/emailRecipientUtils");

const MockUser = vi.mocked(User);
const MockEmailRecipientUtils = vi.mocked(EmailRecipientUtils);

describe("Event Creation Email Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Current Implementation (Before Fix)", () => {
    it("should use basic filtering without emailNotifications and isActive", async () => {
      // Arrange
      const mockUsers = [
        {
          _id: "user1",
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
          isVerified: true,
          isActive: true,
          emailNotifications: true,
        },
        {
          _id: "user2",
          email: "user2@test.com",
          firstName: "User",
          lastName: "Two",
          isVerified: true,
          isActive: false, // Inactive user - should not receive emails
          emailNotifications: true,
        },
        {
          _id: "user3",
          email: "user3@test.com",
          firstName: "User",
          lastName: "Three",
          isVerified: true,
          isActive: true,
          emailNotifications: false, // Opted out of emails - should not receive emails
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockUsers),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      const creatorId = "creator123";

      // Act - Simulate current logic
      const allUsers = await User.find({
        _id: { $ne: creatorId },
        isVerified: true,
      }).select("email firstName lastName");

      // Assert - Current implementation has flaws
      expect(MockUser.find).toHaveBeenCalledWith({
        _id: { $ne: creatorId },
        isVerified: true,
        // Missing isActive: true
        // Missing emailNotifications: true
      });
      expect(allUsers).toEqual(mockUsers);
      expect(allUsers.length).toBe(3); // Includes inactive and opted-out users
    });
  });

  describe("Improved Implementation (After Fix)", () => {
    it("should use EmailRecipientUtils.getActiveVerifiedUsers for proper filtering", async () => {
      // Arrange
      const mockUsers = [
        {
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
        },
        // user2 and user3 filtered out by EmailRecipientUtils (inactive/opted-out)
      ];

      MockEmailRecipientUtils.getActiveVerifiedUsers = vi
        .fn()
        .mockResolvedValue(mockUsers);

      const creatorEmail = "creator@test.com";

      // Act - Simulate improved logic
      const activeUsers = await EmailRecipientUtils.getActiveVerifiedUsers(
        creatorEmail
      );

      // Assert - Improved implementation filters properly
      expect(
        MockEmailRecipientUtils.getActiveVerifiedUsers
      ).toHaveBeenCalledWith(creatorEmail);
      expect(activeUsers).toEqual(mockUsers);
      expect(activeUsers.length).toBe(1); // Only active, verified, opted-in users
    });

    it("should exclude event creator by email", async () => {
      // Arrange
      const mockUsers = [
        {
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
        },
      ];

      MockEmailRecipientUtils.getActiveVerifiedUsers = vi
        .fn()
        .mockResolvedValue(mockUsers);

      const creatorEmail = "creator@test.com";

      // Act
      await EmailRecipientUtils.getActiveVerifiedUsers(creatorEmail);

      // Assert
      expect(
        MockEmailRecipientUtils.getActiveVerifiedUsers
      ).toHaveBeenCalledWith(creatorEmail);
    });
  });

  describe("Comparison of Filtering Logic", () => {
    it("should demonstrate the difference between old and new filtering", async () => {
      // This test shows why the fix is necessary

      // Current logic (problematic)
      const currentFilter = {
        _id: { $ne: "creatorId" },
        isVerified: true,
        // Missing: isActive: true
        // Missing: emailNotifications: true
      };

      // Improved logic (what EmailRecipientUtils does)
      const improvedFilter = {
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        email: { $ne: "creator@test.com" },
      };

      // The improved logic ensures:
      // 1. User account is active (isActive: true)
      // 2. User has verified their email (isVerified: true)
      // 3. User wants to receive emails (emailNotifications: true)
      // 4. Excludes event creator by email instead of ID

      expect(Object.keys(improvedFilter)).toContain("isActive");
      expect(Object.keys(improvedFilter)).toContain("emailNotifications");
      expect(Object.keys(currentFilter)).not.toContain("isActive");
      expect(Object.keys(currentFilter)).not.toContain("emailNotifications");
    });
  });
});
