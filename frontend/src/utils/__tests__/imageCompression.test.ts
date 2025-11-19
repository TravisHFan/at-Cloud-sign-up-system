/**
 * Image Compression Utils Tests
 *
 * Tests image compression utilities:
 * - compressImage: HTML5 Canvas-based compression
 * - formatFileSize: Human-readable file sizes
 * - getCompressionRatio: Calculate compression percentage
 * - DEFAULT_AVATAR_COMPRESSION: Avatar config
 * - DEFAULT_EVENT_IMAGE_COMPRESSION: Event image config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  compressImage,
  formatFileSize,
  getCompressionRatio,
  DEFAULT_AVATAR_COMPRESSION,
  DEFAULT_EVENT_IMAGE_COMPRESSION,
  type CompressionConfig,
} from "../imageCompression";

describe("imageCompression", () => {
  describe("DEFAULT_AVATAR_COMPRESSION config", () => {
    it("should have correct avatar dimensions", () => {
      expect(DEFAULT_AVATAR_COMPRESSION.maxWidth).toBe(400);
      expect(DEFAULT_AVATAR_COMPRESSION.maxHeight).toBe(400);
    });

    it("should have 80% quality for avatars", () => {
      expect(DEFAULT_AVATAR_COMPRESSION.quality).toBe(0.8);
    });

    it("should use JPEG format for avatars", () => {
      expect(DEFAULT_AVATAR_COMPRESSION.outputFormat).toBe("image/jpeg");
    });
  });

  describe("DEFAULT_EVENT_IMAGE_COMPRESSION config", () => {
    it("should have correct event image dimensions", () => {
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.maxWidth).toBe(800);
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.maxHeight).toBe(600);
    });

    it("should have 85% quality for event images", () => {
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.quality).toBe(0.85);
    });

    it("should use JPEG format for event images", () => {
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.outputFormat).toBe("image/jpeg");
    });

    it("should have higher quality than avatars", () => {
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.quality).toBeGreaterThan(
        DEFAULT_AVATAR_COMPRESSION.quality
      );
    });

    it("should have larger dimensions than avatars", () => {
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.maxWidth).toBeGreaterThan(
        DEFAULT_AVATAR_COMPRESSION.maxWidth
      );
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.maxHeight).toBeGreaterThan(
        DEFAULT_AVATAR_COMPRESSION.maxHeight
      );
    });
  });

  describe("formatFileSize", () => {
    it("should format zero bytes", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
    });

    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(2048)).toBe("2 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(1572864)).toBe("1.5 MB");
      expect(formatFileSize(5242880)).toBe("5 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1073741824)).toBe("1 GB");
      expect(formatFileSize(1610612736)).toBe("1.5 GB");
    });

    it("should round to one decimal place", () => {
      expect(formatFileSize(1234567)).toBe("1.2 MB");
      expect(formatFileSize(987654321)).toBe("941.9 MB");
    });

    it("should handle small fractional values", () => {
      expect(formatFileSize(1100)).toBe("1.1 KB");
      expect(formatFileSize(1150)).toBe("1.1 KB");
    });

    it("should handle large values", () => {
      const tenGB = 10 * 1024 * 1024 * 1024;
      expect(formatFileSize(tenGB)).toBe("10 GB");
    });

    it("should handle edge case just below KB threshold", () => {
      expect(formatFileSize(1023)).toBe("1023 Bytes");
    });

    it("should handle edge case just at KB threshold", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    it("should handle typical image file sizes", () => {
      expect(formatFileSize(250 * 1024)).toBe("250 KB"); // 250 KB image
      expect(formatFileSize(2 * 1024 * 1024)).toBe("2 MB"); // 2 MB image
    });
  });

  describe("getCompressionRatio", () => {
    it("should calculate 50% compression", () => {
      const result = getCompressionRatio(1000, 500);
      expect(result).toBe(50);
    });

    it("should calculate 75% compression", () => {
      const result = getCompressionRatio(1000, 250);
      expect(result).toBe(75);
    });

    it("should calculate 90% compression", () => {
      const result = getCompressionRatio(1000, 100);
      expect(result).toBe(90);
    });

    it("should calculate 25% compression", () => {
      const result = getCompressionRatio(1000, 750);
      expect(result).toBe(25);
    });

    it("should handle no compression (same size)", () => {
      const result = getCompressionRatio(1000, 1000);
      expect(result).toBe(0);
    });

    it("should handle larger compressed size (expansion)", () => {
      const result = getCompressionRatio(1000, 1500);
      expect(result).toBe(-50); // Negative indicates expansion
    });

    it("should handle zero original size", () => {
      const result = getCompressionRatio(0, 500);
      expect(result).toBe(0);
    });

    it("should handle zero compressed size (100% compression)", () => {
      const result = getCompressionRatio(1000, 0);
      expect(result).toBe(100);
    });

    it("should round to nearest integer", () => {
      const result = getCompressionRatio(1000, 667);
      expect(result).toBe(33); // 33.3% rounds to 33
    });

    it("should handle realistic image compression scenarios", () => {
      // 5MB original to 1MB compressed (80% reduction)
      const result = getCompressionRatio(5 * 1024 * 1024, 1 * 1024 * 1024);
      expect(result).toBe(80);
    });

    it("should handle small file sizes", () => {
      const result = getCompressionRatio(100, 50);
      expect(result).toBe(50);
    });

    it("should handle large file sizes", () => {
      const tenMB = 10 * 1024 * 1024;
      const twoMB = 2 * 1024 * 1024;
      const result = getCompressionRatio(tenMB, twoMB);
      expect(result).toBe(80);
    });
  });

  describe("compressImage", () => {
    let mockCanvas: any;
    let mockContext: any;
    let mockURL: any;
    let originalImage: typeof Image;
    let originalURL: typeof URL;

    beforeEach(() => {
      // Save originals
      originalImage = window.Image;
      originalURL = window.URL;

      // Mock canvas and context
      mockContext = {
        drawImage: vi.fn(),
      };

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
        toBlob: vi.fn((callback, format) => {
          // Simulate successful compression
          const blob = new Blob(["fake image data"], { type: format });
          callback(blob);
        }),
      };

      // Mock document.createElement for canvas
      vi.spyOn(document, "createElement").mockReturnValue(mockCanvas);

      // Mock Image constructor that auto-triggers onload
      window.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src: string = "";

        set src(value: string) {
          this._src = value;
          // Auto-trigger onload after a microtask
          Promise.resolve().then(() => {
            if (this.onload) this.onload();
          });
        }

        get src() {
          return this._src;
        }

        get width() {
          return 800;
        }

        get height() {
          return 600;
        }
      } as any;

      // Mock URL.createObjectURL and revokeObjectURL
      mockURL = {
        createObjectURL: vi.fn(() => "blob:mock-url"),
        revokeObjectURL: vi.fn(),
      };
      window.URL = mockURL as any;
    });

    afterEach(() => {
      // Restore originals
      window.Image = originalImage;
      window.URL = originalURL;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should compress image with default config", async () => {
      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      const result = await compressImage(file);

      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe("test.jpg");
    });

    it("should use custom compression config", async () => {
      const file = new File(["fake image"], "custom.png", {
        type: "image/png",
      });

      const customConfig: CompressionConfig = {
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.6,
        outputFormat: "image/png",
      };

      await compressImage(file, customConfig);

      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        "image/png",
        0.6
      );
    });

    it("should handle image load error", async () => {
      // Mock Image that triggers error
      window.Image = class MockErrorImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src: string = "";

        set src(value: string) {
          this._src = value;
          // Auto-trigger onerror
          Promise.resolve().then(() => {
            if (this.onerror) this.onerror();
          });
        }

        get src() {
          return this._src;
        }

        get width() {
          return 800;
        }

        get height() {
          return 600;
        }
      } as any;

      const file = new File(["fake image"], "error.jpg", {
        type: "image/jpeg",
      });

      await expect(compressImage(file)).rejects.toThrow("Failed to load image");
    });

    it("should handle canvas context not available", async () => {
      mockCanvas.getContext = vi.fn(() => null);

      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      await expect(compressImage(file)).rejects.toThrow(
        "Canvas context not available"
      );
    });

    it("should handle blob creation failure", async () => {
      mockCanvas.toBlob = vi.fn((callback) => {
        callback(null); // Simulate blob creation failure
      });

      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      await expect(compressImage(file)).rejects.toThrow(
        "Image compression failed"
      );
    });

    it("should create object URL from file", async () => {
      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      await compressImage(file);

      expect(mockURL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it("should revoke object URL after processing", async () => {
      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      await compressImage(file);

      expect(mockURL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("should revoke object URL on error", async () => {
      // Mock Image that triggers error
      window.Image = class MockErrorImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src: string = "";

        set src(value: string) {
          this._src = value;
          // Auto-trigger onerror
          Promise.resolve().then(() => {
            if (this.onerror) this.onerror();
          });
        }

        get src() {
          return this._src;
        }

        get width() {
          return 800;
        }

        get height() {
          return 600;
        }
      } as any;

      const file = new File(["fake image"], "test.jpg", {
        type: "image/jpeg",
      });

      await expect(compressImage(file)).rejects.toThrow();
      expect(mockURL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should have sensible default configs for different use cases", () => {
      // Avatar should be smaller and faster
      expect(DEFAULT_AVATAR_COMPRESSION.maxWidth).toBeLessThan(
        DEFAULT_EVENT_IMAGE_COMPRESSION.maxWidth
      );

      // Event images should have better quality
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.quality).toBeGreaterThan(
        DEFAULT_AVATAR_COMPRESSION.quality
      );

      // Both should use JPEG for good compression
      expect(DEFAULT_AVATAR_COMPRESSION.outputFormat).toBe("image/jpeg");
      expect(DEFAULT_EVENT_IMAGE_COMPRESSION.outputFormat).toBe("image/jpeg");
    });

    it("should calculate realistic compression ratios", () => {
      // Typical avatar: 2MB to 400KB (80% reduction)
      const avatarRatio = getCompressionRatio(2 * 1024 * 1024, 400 * 1024);
      expect(avatarRatio).toBeGreaterThan(70);

      // Typical event image: 5MB to 800KB (84% reduction)
      const eventRatio = getCompressionRatio(5 * 1024 * 1024, 800 * 1024);
      expect(eventRatio).toBeGreaterThan(80);
    });

    it("should format various file sizes correctly", () => {
      const sizes = [
        { bytes: 50 * 1024, expected: "50 KB" },
        { bytes: 500 * 1024, expected: "500 KB" },
        { bytes: 1.5 * 1024 * 1024, expected: "1.5 MB" },
        { bytes: 10 * 1024 * 1024, expected: "10 MB" },
      ];

      sizes.forEach(({ bytes, expected }) => {
        expect(formatFileSize(bytes)).toBe(expected);
      });
    });
  });
});
