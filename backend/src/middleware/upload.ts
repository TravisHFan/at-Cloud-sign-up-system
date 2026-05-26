import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import {
  compressUploadedImage,
  includeCompressionInfo,
} from "./imageCompression";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const normalizeUploadBasePath = (basePath: string): string => {
  const normalized = basePath.trim().replace(/[\\/]+$/, "");
  return normalized ? `${normalized}${path.sep}` : "";
};

// Get the base upload path based on environment
const getUploadBasePath = (): string => {
  // Allow explicit override via environment variable
  const uploadDestination = process.env.UPLOAD_DESTINATION?.trim();
  if (
    uploadDestination &&
    uploadDestination !== "undefined" &&
    uploadDestination !== "null"
  ) {
    return normalizeUploadBasePath(uploadDestination);
  }

  // In production on Render, use the mounted disk path
  if (process.env.NODE_ENV === "production") {
    return normalizeUploadBasePath("/uploads");
  }
  // In development, use relative path
  return normalizeUploadBasePath("uploads");
};

const getUploadDirectory = (subdirectory: "avatars" | "images"): string =>
  normalizeUploadBasePath(path.join(getUploadBasePath(), subdirectory));

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath: string;

    // Support avatar and generic image uploads
    if (file.fieldname === "avatar") {
      uploadPath = getUploadDirectory("avatars");
    } else if (file.fieldname === "image") {
      uploadPath = getUploadDirectory("images");
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

// File filter for supported raster images only. SVG is intentionally excluded:
// uploads are rendered to WebP, so accepting SVG adds risk without value here.
const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPEG, PNG, WebP, GIF, AVIF, HEIC, or HEIF image files are allowed"
      )
    );
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

        if (
          err instanceof Error &&
          err.message.includes("image files are allowed")
        ) {
          res.status(400).json({
            success: false,
            message: err.message,
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
  const backendUrl = process.env.BACKEND_URL?.trim();
  const configured =
    backendUrl && backendUrl !== "undefined" && backendUrl !== "null"
      ? backendUrl.replace(/\/+$/, "")
      : "";
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
