/**
 * ImageCompressionService Tests
 *
 * Comprehensive test suite for image compression functionality including:
 * - Image compression with different profiles
 * - File validation and error handling
 * - Metadata processing and optimization
 * - File system operations and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

// Mock external dependencies
vi.mock("sharp");
vi.mock("fs/promises");

import sharp from "sharp";
import fs from "fs/promises";
import {
  ImageCompressionService,
  COMPRESSION_PROFILES,
  type CompressionConfig,
  type CompressionResult,
} from "../../../src/services/ImageCompressionService";

describe("ImageCompressionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("compressImage", () => {
    describe("Success scenarios", () => {
      it("should successfully compress an image with default settings", async () => {
        // Mock file system operations
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1000000 } as any);
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 500000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        // Mock Sharp operations
        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValueOnce({
            width: 400,
            height: 300,
            size: 500000,
          }),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.compressImage(
          "/test/image.jpg",
          COMPRESSION_PROFILES.avatar
        );

        expect(result).toEqual({
          compressedPath: "/test/image-compressed.jpeg",
          originalSize: 1000000,
          compressedSize: 500000,
          compressionRatio: 50,
          dimensions: {
            width: 400,
            height: 300,
          },
        });

        expect(sharp).toHaveBeenCalledWith("/test/image.jpg");
        expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 400, {
          fit: "inside",
          withoutEnlargement: true,
          kernel: "lanczos3",
        });
        expect(fs.unlink).toHaveBeenCalledWith("/test/image.jpg");
      });

      it("should compress image with JPEG format correctly", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 2000000 } as any);
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 800000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValueOnce({
            width: 800,
            height: 600,
            size: 800000,
          }),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const config = COMPRESSION_PROFILES.eventImage;
        await ImageCompressionService.compressImage("/test/event.jpg", config);

        expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
          quality: 85,
          progressive: true,
          mozjpeg: true,
        });
      });

      it("should compress image with PNG format correctly", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1500000 } as any);
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 600000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          png: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValueOnce({
            width: 150,
            height: 150,
            size: 600000,
          }),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const config: CompressionConfig = {
          maxWidth: 150,
          maxHeight: 150,
          quality: 90,
          format: "png",
          stripMetadata: true,
        };

        await ImageCompressionService.compressImage("/test/image.png", config);

        expect(mockSharpInstance.png).toHaveBeenCalledWith({
          quality: 90,
          compressionLevel: 9,
          progressive: false,
        });
      });

      it("should compress image with WebP format correctly", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1200000 } as any);
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 400000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          webp: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValueOnce({
            width: 400,
            height: 300,
            size: 400000,
          }),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const config: CompressionConfig = {
          maxWidth: 400,
          maxHeight: 400,
          quality: 80,
          format: "webp",
          stripMetadata: true,
        };

        await ImageCompressionService.compressImage("/test/image.webp", config);

        expect(mockSharpInstance.webp).toHaveBeenCalledWith({
          quality: 80,
          effort: 6,
        });
      });

      it("should handle metadata stripping correctly", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1000000 } as any);
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 500000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValueOnce({
            width: 400,
            height: 300,
            size: 500000,
          }),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const config: CompressionConfig = {
          ...COMPRESSION_PROFILES.avatar,
          stripMetadata: true,
        };

        await ImageCompressionService.compressImage("/test/image.jpg", config);

        expect(mockSharpInstance.withMetadata).toHaveBeenCalledWith({
          exif: {},
          icc: "srgb",
        });
      });
    });

    describe("Error handling", () => {
      it("should handle Sharp processing errors", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1000000 } as any);
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi
            .fn()
            .mockRejectedValueOnce(new Error("Sharp processing failed")),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        await expect(
          ImageCompressionService.compressImage(
            "/test/image.jpg",
            COMPRESSION_PROFILES.avatar
          )
        ).rejects.toThrow("Image compression failed: Sharp processing failed");

        expect(fs.unlink).toHaveBeenCalledWith("/test/image.jpg");
      });

      it("should handle file system errors gracefully", async () => {
        vi.mocked(fs.stat).mockRejectedValueOnce(new Error("File not found"));
        vi.mocked(fs.unlink).mockResolvedValueOnce();

        await expect(
          ImageCompressionService.compressImage(
            "/test/nonexistent.jpg",
            COMPRESSION_PROFILES.avatar
          )
        ).rejects.toThrow("Image compression failed: File not found");
      });

      it("should handle cleanup errors gracefully", async () => {
        vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1000000 } as any);
        vi.mocked(fs.unlink).mockRejectedValueOnce(new Error("Cleanup failed"));

        const mockSharpInstance = {
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          withMetadata: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockRejectedValueOnce(new Error("Processing failed")),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const consoleSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        await expect(
          ImageCompressionService.compressImage(
            "/test/image.jpg",
            COMPRESSION_PROFILES.avatar
          )
        ).rejects.toThrow("Image compression failed: Processing failed");

        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to clean up original file:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });
  });

  describe("getCompressionProfile", () => {
    it("should return avatar profile for avatar field", () => {
      const profile = ImageCompressionService.getCompressionProfile("avatar");
      expect(profile).toEqual(COMPRESSION_PROFILES.avatar);
    });

    it("should return event image profile for image field", () => {
      const profile = ImageCompressionService.getCompressionProfile("image");
      expect(profile).toEqual(COMPRESSION_PROFILES.eventImage);
    });

    it("should return avatar profile as default fallback", () => {
      const profile = ImageCompressionService.getCompressionProfile("unknown");
      expect(profile).toEqual(COMPRESSION_PROFILES.avatar);
    });

    it("should handle empty string field name", () => {
      const profile = ImageCompressionService.getCompressionProfile("");
      expect(profile).toEqual(COMPRESSION_PROFILES.avatar);
    });
  });

  describe("generateCompressedFilename", () => {
    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1642694400000);
      vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should generate filename with timestamp and random number", () => {
      const filename = ImageCompressionService.generateCompressedFilename(
        "test-image.jpg",
        COMPRESSION_PROFILES.avatar
      );

      expect(filename).toBe(
        "test-image-1642694400000-123456789-compressed.jpeg"
      );
    });

    it("should preserve original filename base and use config format", () => {
      const filename = ImageCompressionService.generateCompressedFilename(
        "my-photo.png",
        COMPRESSION_PROFILES.eventImage
      );

      expect(filename).toBe("my-photo-1642694400000-123456789-compressed.jpeg");
    });

    it("should handle complex filenames", () => {
      const filename = ImageCompressionService.generateCompressedFilename(
        "user-avatar-2023-01-01.jpeg",
        { ...COMPRESSION_PROFILES.avatar, format: "webp" }
      );

      expect(filename).toBe(
        "user-avatar-2023-01-01-1642694400000-123456789-compressed.webp"
      );
    });
  });

  describe("validateImageFile", () => {
    describe("Valid images", () => {
      it("should validate a normal image successfully", async () => {
        const mockMetadata = {
          width: 1920,
          height: 1080,
          format: "jpeg",
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/image.jpg"
        );

        expect(result).toEqual({
          isValid: true,
          metadata: mockMetadata,
        });
      });

      it("should validate minimum size images", async () => {
        const mockMetadata = {
          width: 10,
          height: 10,
          format: "png",
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/small.png"
        );

        expect(result.isValid).toBe(true);
      });

      it("should validate maximum size images", async () => {
        const mockMetadata = {
          width: 10000,
          height: 10000,
          format: "jpeg",
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/large.jpg"
        );

        expect(result.isValid).toBe(true);
      });
    });

    describe("Invalid images", () => {
      it("should reject images without dimensions", async () => {
        const mockMetadata = {
          format: "jpeg",
          // Missing width and height
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/invalid.jpg"
        );

        expect(result).toEqual({
          isValid: false,
          error: "Invalid image: missing dimensions",
        });
      });

      it("should reject images that are too small", async () => {
        const mockMetadata = {
          width: 5,
          height: 8,
          format: "png",
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/tiny.png"
        );

        expect(result).toEqual({
          isValid: false,
          error: "Image too small (minimum 10x10 pixels)",
        });
      });

      it("should reject images that are too large", async () => {
        const mockMetadata = {
          width: 15000,
          height: 12000,
          format: "jpeg",
        };

        const mockSharpInstance = {
          metadata: vi.fn().mockResolvedValueOnce(mockMetadata),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/huge.jpg"
        );

        expect(result).toEqual({
          isValid: false,
          error: "Image too large (maximum 10000x10000 pixels)",
        });
      });

      it("should handle Sharp metadata errors", async () => {
        const mockSharpInstance = {
          metadata: vi
            .fn()
            .mockRejectedValueOnce(new Error("Corrupted image file")),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/corrupted.jpg"
        );

        expect(result).toEqual({
          isValid: false,
          error: "Image validation failed: Corrupted image file",
        });
      });

      it("should handle unknown Sharp errors", async () => {
        const mockSharpInstance = {
          metadata: vi.fn().mockRejectedValueOnce("String error"),
        };
        vi.mocked(sharp).mockReturnValueOnce(mockSharpInstance as any);

        const result = await ImageCompressionService.validateImageFile(
          "/test/unknown-error.jpg"
        );

        expect(result).toEqual({
          isValid: false,
          error: "Image validation failed: Unknown error",
        });
      });
    });
  });

  describe("formatFileSize", () => {
    it("should format zero bytes", () => {
      expect(ImageCompressionService.formatFileSize(0)).toBe("0 Bytes");
    });

    it("should format bytes correctly", () => {
      expect(ImageCompressionService.formatFileSize(500)).toBe("500 Bytes");
      expect(ImageCompressionService.formatFileSize(999)).toBe("999 Bytes");
    });

    it("should format kilobytes correctly", () => {
      expect(ImageCompressionService.formatFileSize(1024)).toBe("1 KB");
      expect(ImageCompressionService.formatFileSize(1536)).toBe("1.5 KB");
      expect(ImageCompressionService.formatFileSize(102400)).toBe("100 KB");
    });

    it("should format megabytes correctly", () => {
      expect(ImageCompressionService.formatFileSize(1048576)).toBe("1 MB");
      expect(ImageCompressionService.formatFileSize(1572864)).toBe("1.5 MB");
      expect(ImageCompressionService.formatFileSize(10485760)).toBe("10 MB");
    });

    it("should format gigabytes correctly", () => {
      expect(ImageCompressionService.formatFileSize(1073741824)).toBe("1 GB");
      expect(ImageCompressionService.formatFileSize(1610612736)).toBe("1.5 GB");
      expect(ImageCompressionService.formatFileSize(10737418240)).toBe("10 GB");
    });

    it("should handle decimal precision correctly", () => {
      expect(ImageCompressionService.formatFileSize(1234567)).toBe("1.2 MB");
      expect(ImageCompressionService.formatFileSize(1234567890)).toBe("1.1 GB");
    });
  });

  describe("COMPRESSION_PROFILES", () => {
    it("should have valid avatar profile", () => {
      expect(COMPRESSION_PROFILES.avatar).toEqual({
        maxWidth: 400,
        maxHeight: 400,
        quality: 90,
        format: "jpeg",
        progressive: false,
        stripMetadata: true,
      });
    });

    it("should have valid event image profile", () => {
      expect(COMPRESSION_PROFILES.eventImage).toEqual({
        maxWidth: 800,
        maxHeight: 600,
        quality: 85,
        format: "jpeg",
        progressive: true,
        stripMetadata: true,
      });
    });

    it("should have valid thumbnail profile", () => {
      expect(COMPRESSION_PROFILES.thumbnail).toEqual({
        maxWidth: 150,
        maxHeight: 150,
        quality: 85,
        format: "jpeg",
        progressive: false,
        stripMetadata: true,
      });
    });
  });
});
