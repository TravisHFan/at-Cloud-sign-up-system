/**
 * Image Compression Middleware
 *
 * Automatically compresses uploaded images and ensures only
 * compressed versions are stored on the server.
 *
 * Usage: Apply after multer upload middleware
 */

import { Request, Response, NextFunction } from "express";
import { ImageCompressionService } from "../services/ImageCompressionService";
import path from "path";

// Extend Express Request type to include compression result
declare global {
  namespace Express {
    interface Request {
      compressionResult?: {
        originalSize: number;
        compressedSize: number;
        compressionRatio: number;
        dimensions: {
          width: number;
          height: number;
        };
      };
    }
  }
}

/**
 * Middleware to compress uploaded images
 * Must be used after multer upload middleware
 */
export const compressUploadedImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if no file uploaded
    if (!req.file) {
      next();
      return;
    }

    const originalPath = req.file.path;
    const fieldName = req.file.fieldname;

    console.log(`🖼️  Compressing uploaded ${fieldName}: ${req.file.filename}`);

    // Validate the image file first
    const validation = await ImageCompressionService.validateImageFile(
      originalPath
    );
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: `Invalid image file: ${validation.error}`,
      });
      return;
    }

    // Get compression profile for this field type
    const compressionConfig =
      ImageCompressionService.getCompressionProfile(fieldName);

    // Compress the image
    const compressionResult = await ImageCompressionService.compressImage(
      originalPath,
      compressionConfig
    );

    // Update req.file to point to compressed version
    req.file.path = compressionResult.compressedPath;
    req.file.filename = path.basename(compressionResult.compressedPath);
    req.file.size = compressionResult.compressedSize;

    // Store compression details for logging/response
    req.compressionResult = {
      originalSize: compressionResult.originalSize,
      compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio,
      dimensions: compressionResult.dimensions,
    };

    const originalSizeFormatted = ImageCompressionService.formatFileSize(
      compressionResult.originalSize
    );
    const compressedSizeFormatted = ImageCompressionService.formatFileSize(
      compressionResult.compressedSize
    );

    console.log(
      `✅ Image compressed successfully: ${originalSizeFormatted} → ${compressedSizeFormatted} ` +
        `(${compressionResult.compressionRatio}% reduction) ` +
        `[${compressionResult.dimensions.width}x${compressionResult.dimensions.height}]`
    );

    next();
  } catch (error) {
    console.error("❌ Image compression failed:", error);

    // Return error response
    res.status(500).json({
      success: false,
      message:
        "Image compression failed. Please try uploading a different image.",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

/**
 * Optional middleware to log compression statistics
 */
export const logCompressionStats = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.compressionResult && req.file) {
    const stats = req.compressionResult;
    console.log(`📊 Compression Stats for ${req.file.fieldname}:`, {
      originalSize: ImageCompressionService.formatFileSize(stats.originalSize),
      compressedSize: ImageCompressionService.formatFileSize(
        stats.compressedSize
      ),
      reduction: `${stats.compressionRatio}%`,
      dimensions: `${stats.dimensions.width}x${stats.dimensions.height}`,
      filename: req.file.filename,
    });
  }
  next();
};

/**
 * Middleware to add compression info to API response
 */
export const includeCompressionInfo = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Store original json method
  const originalJson = res.json;

  // Override json method to include compression info
  res.json = function (body: any) {
    if (req.compressionResult && body && typeof body === "object") {
      body.compressionInfo = {
        originalSize: ImageCompressionService.formatFileSize(
          req.compressionResult.originalSize
        ),
        compressedSize: ImageCompressionService.formatFileSize(
          req.compressionResult.compressedSize
        ),
        reduction: `${req.compressionResult.compressionRatio}%`,
        dimensions: req.compressionResult.dimensions,
      };
    }
    return originalJson.call(this, body);
  };

  next();
};

export default {
  compressUploadedImage,
  logCompressionStats,
  includeCompressionInfo,
};
