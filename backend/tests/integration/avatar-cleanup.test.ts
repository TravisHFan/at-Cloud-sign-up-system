import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  isUploadedAvatar,
  deleteOldAvatarFile,
  cleanupOldAvatar,
} from "../../src/utils/avatarCleanup";

// Test setup
const uploadsDir = path.join(__dirname, "../../uploads/avatars");

// Create a simple test image buffer (1x1 pixel JPEG)
const createTestImage = (): Buffer => {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4,
    0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x0c,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0xb2, 0xc0,
    0x07, 0xff, 0xd9,
  ]);
};

// Helper function to create a test file
const createTestFile = (filename: string): string => {
  const filePath = path.join(uploadsDir, filename);
  const testImageBuffer = createTestImage();

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, testImageBuffer);
  return `/uploads/avatars/${filename}`;
};

// Helper function to check if file exists
const fileExists = (avatarUrl: string): boolean => {
  const filename = path.basename(avatarUrl);
  return fs.existsSync(path.join(uploadsDir, filename));
};

describe("Avatar Cleanup Feature Tests", () => {
  afterEach(() => {
    // Clean up any test files
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith("test-") || file.includes("cleanup-test")) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    }
  });

  describe("Avatar Cleanup Utility Functions", () => {
    describe("isUploadedAvatar", () => {
      it("should return true for uploaded avatar files", () => {
        expect(
          isUploadedAvatar(
            "/uploads/avatars/compressed_1234567890_user-avatar.jpg"
          )
        ).toBe(true);
        expect(
          isUploadedAvatar("/uploads/avatars/compressed_9876543210_avatar.png")
        ).toBe(true);
      });

      it("should return false for default avatar files", () => {
        expect(isUploadedAvatar("/default-avatar-male.jpg")).toBe(false);
        expect(isUploadedAvatar("/default-avatar-female.jpg")).toBe(false);
        expect(isUploadedAvatar("default-avatar-male.jpg")).toBe(false);
      });

      it("should return false for null or undefined values", () => {
        expect(isUploadedAvatar(null)).toBe(false);
        expect(isUploadedAvatar(undefined)).toBe(false);
        expect(isUploadedAvatar("")).toBe(false);
      });

      it("should return false for non-upload paths", () => {
        expect(isUploadedAvatar("/some/other/path/image.jpg")).toBe(false);
        expect(isUploadedAvatar("http://example.com/avatar.jpg")).toBe(false);
      });
    });

    describe("deleteOldAvatarFile", () => {
      it("should successfully delete existing uploaded avatar file", async () => {
        // Create a test avatar file
        const avatarUrl = createTestFile("test-cleanup-delete.jpg");

        // Verify file exists
        expect(fileExists(avatarUrl)).toBe(true);

        // Delete the file
        const result = await deleteOldAvatarFile(avatarUrl);

        // Verify deletion
        expect(result).toBe(true);
        expect(fileExists(avatarUrl)).toBe(false);
      });

      it("should return false when trying to delete non-existent file", async () => {
        const result = await deleteOldAvatarFile(
          "/uploads/avatars/non-existent-file.jpg"
        );
        expect(result).toBe(false);
      });

      it("should return false when trying to delete default avatar", async () => {
        const result = await deleteOldAvatarFile("/default-avatar-male.jpg");
        expect(result).toBe(false);
      });

      it("should handle invalid file paths gracefully", async () => {
        expect(await deleteOldAvatarFile("")).toBe(false);
        expect(await deleteOldAvatarFile(null)).toBe(false);
        expect(await deleteOldAvatarFile(undefined)).toBe(false);
      });
    });

    describe("cleanupOldAvatar", () => {
      it("should cleanup old uploaded avatar file", async () => {
        // Create a test avatar file
        const avatarUrl = createTestFile("test-cleanup-old.jpg");

        // Verify file exists
        expect(fileExists(avatarUrl)).toBe(true);

        // Cleanup old avatar
        const result = await cleanupOldAvatar("test-user-id", avatarUrl);

        // Verify cleanup
        expect(result).toBe(true);
        expect(fileExists(avatarUrl)).toBe(false);
      });

      it("should not cleanup default avatars", async () => {
        // Try to cleanup default avatar
        const result = await cleanupOldAvatar(
          "test-user-id",
          "/default-avatar-male.jpg"
        );

        // Should not attempt cleanup
        expect(result).toBe(false);
      });

      it("should handle cleanup for non-existent files gracefully", async () => {
        const result = await cleanupOldAvatar(
          "test-user-id",
          "/uploads/avatars/non-existent.jpg"
        );
        expect(result).toBe(false);
      });

      it("should handle invalid user IDs gracefully", async () => {
        const avatarUrl = createTestFile("test-cleanup-invalid-user.jpg");
        const result = await cleanupOldAvatar("invalid-user-id", avatarUrl);

        // Should handle gracefully - file should be deleted since it's a valid uploaded avatar
        expect(result).toBe(true);
        expect(fileExists(avatarUrl)).toBe(false);
      });
    });
  });

  describe("File System Integration", () => {
    it("should handle file permission errors gracefully", async () => {
      // Create a test file
      const avatarUrl = createTestFile("test-permission-error.jpg");
      const fileName = path.basename(avatarUrl);
      const filePath = path.join(uploadsDir, fileName);

      // Make file read-only to simulate permission error (on macOS this might not work as expected)
      try {
        fs.chmodSync(filePath, 0o444); // Read-only

        const result = await deleteOldAvatarFile(avatarUrl);

        // Should handle gracefully - result may vary based on permissions
        expect(typeof result).toBe("boolean");
      } finally {
        // Restore permissions and clean up
        try {
          fs.chmodSync(filePath, 0o644);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle missing uploads directory gracefully", async () => {
      // Try to delete a file when the uploads directory structure might not exist
      const result = await deleteOldAvatarFile(
        "/uploads/avatars/missing-dir-file.jpg"
      );
      expect(result).toBe(false);
    });
  });
});
