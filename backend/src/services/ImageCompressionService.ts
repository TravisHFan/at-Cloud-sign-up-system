/**
 * Server-Side Image Compression Service
 *
 * Ensures all uploaded images are compressed and optimized for storage.
 * Original files are never permanently stored - only compressed versions.
 *
 * Key Features:
 * - Automatic compression with Sharp
 * - Different compression profiles for different use cases
 * - Original file cleanup after compression
 * - Fallback error handling
 * - Size and format optimization
 */

import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
// import { Request } from "express"; // unused

export interface CompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: "jpeg" | "png" | "webp";
  progressive?: boolean;
  stripMetadata?: boolean;
}

export interface CompressionResult {
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: {
    width: number;
    height: number;
  };
}

// Compression profiles for different image types
export const COMPRESSION_PROFILES = {
  avatar: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 90, // Higher quality for better detail at small sizes
    format: "jpeg" as const,
    progressive: false, // Progressive can hurt small images
    stripMetadata: true,
  },
  eventImage: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 85,
    format: "jpeg" as const,
    progressive: true,
    stripMetadata: true,
  },
  thumbnail: {
    maxWidth: 150,
    maxHeight: 150,
    quality: 85, // Higher quality for thumbnails too
    format: "jpeg" as const,
    progressive: false,
    stripMetadata: true,
  },
} as const;

export class ImageCompressionService {
  /**
   * Compress an uploaded image file
   * @param originalPath Path to the original uploaded file
   * @param config Compression configuration
   * @returns Compression result with details
   */
  static async compressImage(
    originalPath: string,
    config: CompressionConfig
  ): Promise<CompressionResult> {
    try {
      // Get original file stats
      const originalStats = await fs.stat(originalPath);
      const originalSize = originalStats.size;

      // Generate compressed file path
      const parsedPath = path.parse(originalPath);
      const compressedPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}-compressed.${config.format}`
      );

      // Process image with Sharp - use better resampling for small images
      let sharpInstance = sharp(originalPath).resize(
        config.maxWidth,
        config.maxHeight,
        {
          fit: "inside",
          withoutEnlargement: true,
          kernel: "lanczos3", // Better quality for downscaling
        }
      );

      // Apply format-specific optimizations
      switch (config.format) {
        case "jpeg":
          sharpInstance = sharpInstance.jpeg({
            quality: config.quality,
            progressive: config.progressive || false,
            mozjpeg: true, // Use mozjpeg encoder for better compression
          });
          break;
        case "png":
          sharpInstance = sharpInstance.png({
            quality: config.quality,
            compressionLevel: 9,
            progressive: config.progressive || false,
          });
          break;
        case "webp":
          sharpInstance = sharpInstance.webp({
            quality: config.quality,
            effort: 6, // Higher effort for better compression
          });
          break;
      }

      // Strip metadata if requested
      if (config.stripMetadata) {
        sharpInstance = sharpInstance.withMetadata({
          exif: {},
          icc: "srgb", // Keep color profile
        });
      }

      // Save compressed image
      const compressedInfo = await sharpInstance.toFile(compressedPath);

      // Get compressed file size
      const compressedStats = await fs.stat(compressedPath);
      const compressedSize = compressedStats.size;

      // Calculate compression ratio
      const compressionRatio = Math.round(
        ((originalSize - compressedSize) / originalSize) * 100
      );

      // Clean up original file
      await fs.unlink(originalPath);

      return {
        compressedPath,
        originalSize,
        compressedSize,
        compressionRatio,
        dimensions: {
          width: compressedInfo.width,
          height: compressedInfo.height,
        },
      };
    } catch (error) {
      // Clean up files on error
      try {
        await fs.unlink(originalPath);
      } catch (cleanupError) {
        console.warn("Failed to clean up original file:", cleanupError);
      }

      throw new Error(
        `Image compression failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get compression profile based on field name
   */
  static getCompressionProfile(fieldName: string): CompressionConfig {
    switch (fieldName) {
      case "avatar":
        return COMPRESSION_PROFILES.avatar;
      case "image":
        return COMPRESSION_PROFILES.eventImage;
      default:
        return COMPRESSION_PROFILES.avatar; // Default fallback
    }
  }

  /**
   * Generate optimized filename for compressed image
   */
  static generateCompressedFilename(
    originalFilename: string,
    config: CompressionConfig
  ): string {
    const parsedPath = path.parse(originalFilename);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);

    return `${parsedPath.name}-${timestamp}-${random}-compressed.${config.format}`;
  }

  /**
   * Validate image file before processing
   */
  static async validateImageFile(filePath: string): Promise<{
    isValid: boolean;
    metadata?: sharp.Metadata;
    error?: string;
  }> {
    try {
      const metadata = await sharp(filePath).metadata();

      // Check if it's a valid image
      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: "Invalid image: missing dimensions",
        };
      }

      // Check reasonable size limits (not too small, not corrupted)
      if (metadata.width < 10 || metadata.height < 10) {
        return {
          isValid: false,
          error: "Image too small (minimum 10x10 pixels)",
        };
      }

      if (metadata.width > 10000 || metadata.height > 10000) {
        return {
          isValid: false,
          error: "Image too large (maximum 10000x10000 pixels)",
        };
      }

      return {
        isValid: true,
        metadata,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Image validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
}

export default ImageCompressionService;
