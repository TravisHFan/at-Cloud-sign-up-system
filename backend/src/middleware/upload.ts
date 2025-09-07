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

    // Support avatar and generic image uploads
    if (file.fieldname === "avatar") {
      uploadPath += "avatars/";
    } else if (file.fieldname === "image") {
      uploadPath += "images/";
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

// Separate middleware for generic image uploads
const uploadImageMiddleware = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
}).single("image");

// Error handling wrapper for multer (factory)
const makeHandleUploadErrors =
  (specificUpload: typeof uploadMiddleware) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // If request isn't multipart/form-data, short-circuit with a clear 400
    const contentType = (req.headers["content-type"] || "")
      .toString()
      .toLowerCase();
    if (!contentType.startsWith("multipart/form-data")) {
      res.status(400).json({
        success: false,
        message:
          "No file uploaded. Please submit as multipart/form-data with a supported image field.",
      });
      return;
    }

    specificUpload(req, res, (err: unknown) => {
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

const handleAvatarUploadErrors = makeHandleUploadErrors(uploadMiddleware);
const handleImageUploadErrors = makeHandleUploadErrors(uploadImageMiddleware);

export const uploadAvatar = [
  handleAvatarUploadErrors,
  compressUploadedImage, // Compress after upload
  includeCompressionInfo, // Add compression info to response
];

export const uploadImage = [
  handleImageUploadErrors,
  compressUploadedImage,
  includeCompressionInfo,
];

// Helper to compute an absolute base URL for the backend
const getBackendBaseUrl = (req: Request): string => {
  const configured = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (configured) return configured;

  // Be defensive: allow partially mocked Request objects in tests without loosening types
  type MaybeRequest = Partial<Pick<Request, "headers" | "protocol">> & {
    get?: (name: string) => string | undefined;
  };

  const maybeReq = req as MaybeRequest;
  const headers: Record<string, string | string[] | undefined> =
    (maybeReq.headers as Record<string, string | string[] | undefined>) ?? {};

  const getHeader = (name: string): string | undefined => {
    const v = headers[name];
    if (Array.isArray(v)) return v[0];
    return v as string | undefined;
  };

  const xfProto = getHeader("x-forwarded-proto");
  const proto = xfProto || maybeReq.protocol || "http";

  const hostFromGetter =
    typeof maybeReq.get === "function" ? maybeReq.get("host") : undefined;
  const host = hostFromGetter || getHeader("host") || "";

  if (!host) {
    // Fallback to relative style to preserve legacy tests when host not available
    return "";
  }
  return `${proto}://${host}`;
};

// Helper function to get a public, absolute file URL (works in emails)
export const getFileUrl = (
  req: Request,
  filepath: string,
  opts?: { absolute?: boolean }
): string => {
  const normalized = String(filepath || "").replace(/^\/+/, "");
  if (opts?.absolute) {
    const base = getBackendBaseUrl(req);
    if (!base) return `/uploads/${normalized}`;
    return `${base}/uploads/${normalized}`;
  }
  // Relative by default for frontend proxy compatibility
  return `/uploads/${normalized}`;
};
