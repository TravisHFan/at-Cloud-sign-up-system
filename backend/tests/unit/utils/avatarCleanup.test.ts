import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs and path first, before importing the module
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock("path", () => ({
  default: {
    basename: vi.fn((filepath: string) => {
      if (typeof filepath === "string") {
        return filepath.split("/").pop() || "";
      }
      return "";
    }),
    join: vi.fn((...args: string[]) => args.join("/")),
  },
  basename: vi.fn((filepath: string) => {
    if (typeof filepath === "string") {
      return filepath.split("/").pop() || "";
    }
    return "";
  }),
  join: vi.fn((...args: string[]) => args.join("/")),
}));

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

// Mock process.cwd()
vi.spyOn(process, "cwd").mockReturnValue("/mock/app/root");

// Now import the module being tested
import {
  isUploadedAvatar,
  deleteOldAvatarFile,
  cleanupOldAvatar,
} from "../../../src/utils/avatarCleanup";

// Import fs and path to access the mocked versions
import fs from "fs";
import path from "path";

describe("avatarCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("isUploadedAvatar", () => {
    it("should return true for uploaded avatar URLs", () => {
      expect(isUploadedAvatar("/uploads/avatars/user_123.jpg")).toBe(true);
      expect(
        isUploadedAvatar("http://example.com/uploads/avatars/test.png")
      ).toBe(true);
      expect(isUploadedAvatar("/api/uploads/avatars/custom.gif")).toBe(true);
    });

    it("should return false for non-uploaded avatar URLs", () => {
      expect(isUploadedAvatar("/default-avatar-male.jpg")).toBe(false);
      expect(isUploadedAvatar("/default-avatar-female.jpg")).toBe(false);
      expect(isUploadedAvatar("http://example.com/images/profile.jpg")).toBe(
        false
      );
    });

    it("should return false for null/undefined/empty strings", () => {
      expect(isUploadedAvatar(null)).toBe(false);
      expect(isUploadedAvatar(undefined)).toBe(false);
      expect(isUploadedAvatar("")).toBe(false);
    });

    it("should handle edge cases gracefully", () => {
      expect(isUploadedAvatar("/uploads/avatars/")).toBe(true);
      expect(isUploadedAvatar("/uploads/avatars/file.jpg")).toBe(true);
      expect(
        isUploadedAvatar("random string with /uploads/avatars/ somewhere")
      ).toBe(true);
    });
  });

  describe("deleteOldAvatarFile", () => {
    it("should return false for non-uploaded avatar URLs", async () => {
      const result = await deleteOldAvatarFile("/default-avatar-male.jpg");
      expect(result).toBe(false);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("should return false when file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await deleteOldAvatarFile("/uploads/avatars/missing.jpg");

      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should successfully delete existing uploaded avatar file", async () => {
      // Set up mocks for successful deletion
      vi.mocked(path.basename).mockReturnValue("user_123.jpg");
      vi.mocked(path.join).mockReturnValue(
        "/mock/path/uploads/avatars/user_123.jpg"
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

      const avatarUrl = "/uploads/avatars/user_123.jpg";
      const result = await deleteOldAvatarFile(avatarUrl);

      expect(result).toBe(true);
      expect(path.basename).toHaveBeenCalledWith(avatarUrl);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it("should handle file system errors gracefully", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await deleteOldAvatarFile("/uploads/avatars/error.jpg");

      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Error deleting avatar file:",
        expect.any(Error)
      );
    });
  });

  describe("cleanupOldAvatar", () => {
    it("should return false for non-uploaded avatars", async () => {
      const result1 = await cleanupOldAvatar(
        "user123",
        "/default-avatar-male.jpg"
      );
      const result2 = await cleanupOldAvatar("user123", null);
      const result3 = await cleanupOldAvatar("user123", "");

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("should successfully cleanup uploaded avatar with logging", async () => {
      // Mock path.basename to return the expected filename
      vi.mocked(path.basename).mockReturnValue("old.jpg");
      vi.mocked(path.join).mockReturnValue(
        "/mock/path/uploads/avatars/old.jpg"
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

      const result = await cleanupOldAvatar(
        "user123",
        "/uploads/avatars/old.jpg"
      );

      expect(result).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "Cleaning up old avatar for user user123: /uploads/avatars/old.jpg"
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "Successfully deleted old avatar: old.jpg"
      );
    });

    it("should handle cleanup errors with proper logging", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = await cleanupOldAvatar(
        "user123",
        "/uploads/avatars/error.jpg"
      );

      expect(result).toBe(false);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "Cleaning up old avatar for user user123: /uploads/avatars/error.jpg"
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Error deleting avatar file:",
        expect.any(Error)
      );
    });

    it("should return false when file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await cleanupOldAvatar(
        "user123",
        "/uploads/avatars/missing.jpg"
      );

      expect(result).toBe(false);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "Cleaning up old avatar for user user123: /uploads/avatars/missing.jpg"
      );
    });

    describe("integration scenarios", () => {
      it("should handle typical avatar update workflow", async () => {
        const userId = "user123";
        const oldAvatarUrl = "/uploads/avatars/old_avatar.jpg";

        // Mock path functions to return expected values
        vi.mocked(path.basename).mockReturnValue("old_avatar.jpg");
        vi.mocked(path.join).mockReturnValue(
          "/mock/path/uploads/avatars/old_avatar.jpg"
        );
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

        // Cleanup should succeed
        const result = await cleanupOldAvatar(userId, oldAvatarUrl);
        expect(result).toBe(true);

        // Verify proper logging
        expect(consoleSpy.log).toHaveBeenCalledWith(
          "Cleaning up old avatar for user user123: /uploads/avatars/old_avatar.jpg"
        );
        expect(consoleSpy.log).toHaveBeenCalledWith(
          "Successfully deleted old avatar: old_avatar.jpg"
        );

        // Verify file operations
        expect(path.basename).toHaveBeenCalledWith(oldAvatarUrl);
        expect(fs.existsSync).toHaveBeenCalled();
        expect(fs.unlinkSync).toHaveBeenCalled();
      });

      it("should handle gender change scenario (cleanup custom, ignore defaults)", async () => {
        const userId = "user456";
        const customAvatarUrl = "/uploads/avatars/custom_pic.png";
        const defaultAvatarUrl = "/default-avatar-female.jpg";

        // Mock path functions for custom avatar
        vi.mocked(path.basename).mockReturnValue("custom_pic.png");
        vi.mocked(path.join).mockReturnValue(
          "/mock/path/uploads/avatars/custom_pic.png"
        );
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

        // Should cleanup custom avatar
        const customResult = await cleanupOldAvatar(userId, customAvatarUrl);
        expect(customResult).toBe(true);

        // Should not attempt to cleanup default avatar
        const defaultResult = await cleanupOldAvatar(userId, defaultAvatarUrl);
        expect(defaultResult).toBe(false);

        // Verify calls - only custom avatar operations should have been made
        expect(fs.existsSync).toHaveBeenCalledTimes(1);
        expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
      });
    });
  });
});
