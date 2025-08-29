import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import {
  compressUploadedImage,
  includeCompressionInfo,
} from "./imageCompression";

// Get the base upload path based on environment
const getUploadBasePath = (): string => {
  // Allow explicit override via environment variable
  if (process.env.UPLOAD_DESTINATION) {
    return process.env.UPLOAD_DESTINATION;
  }

  // In production on Render, use the mounted disk path
  if (process.env.NODE_ENV === "production") {
    return "/uploads/";
  }
  // In development, use relative path
  return "uploads/";
};

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = getUploadBasePath();

    // Only avatar uploads are supported
    if (file.fieldname === "avatar") {
      uploadPath += "avatars/";
    } else {
      cb(new Error("Unsupported upload field"), "");
      return;
    }

    // Ensure the directory exists
    try {
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});

// File filter for images only (avatars)
const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

// Configure multer instances with compression
const uploadMiddleware = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for original upload
  },
}).single("avatar");

// Error handling wrapper for multer
const handleUploadErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If request isn't multipart/form-data, short-circuit with a clear 400
  const contentType = (req.headers["content-type"] || "")
    .toString()
    .toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    res.status(400).json({
      success: false,
      message:
        "No file uploaded. Please submit as multipart/form-data with field 'avatar'.",
    });
    return;
  }

  uploadMiddleware(req, res, (err: unknown) => {
    if (err) {
      console.error("Upload error:", err);

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 10MB.",
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
        return;
      }

      // Other errors (like directory creation)
      res.status(500).json({
        success: false,
        message: `Server error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      return;
    }
    next();
  });
};

export const uploadAvatar = [
  handleUploadErrors,
  compressUploadedImage, // Compress after upload
  includeCompressionInfo, // Add compression info to response
];

// Helper function to get file URL (for avatar uploads only)
export const getFileUrl = (req: Request, filepath: string): string => {
  // In production, return full backend URL
  if (process.env.NODE_ENV === "production") {
    const backendUrl =
      process.env.BACKEND_URL ||
      "https://at-cloud-sign-up-system-backend.onrender.com";
    return `${backendUrl}/uploads/${filepath}`;
  }

  // In development, return relative path for frontend proxy compatibility
  return `/uploads/${filepath}`;
};
