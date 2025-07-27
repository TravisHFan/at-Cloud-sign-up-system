import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";
import {
  compressUploadedImage,
  includeCompressionInfo,
} from "./imageCompression";

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "uploads/";

    // Only avatar uploads are supported
    if (file.fieldname === "avatar") {
      uploadPath += "avatars/";
    } else {
      cb(new Error("Unsupported upload field"), "");
      return;
    }

    cb(null, uploadPath);
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
export const uploadAvatar = [
  multer({
    storage,
    fileFilter: imageFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for original upload
    },
  }).single("avatar"),
  compressUploadedImage, // Compress after upload
  includeCompressionInfo, // Add compression info to response
];

// Helper function to get file URL (for avatar uploads only)
export const getFileUrl = (req: Request, filepath: string): string => {
  // Return relative path for frontend proxy compatibility
  return `/uploads/${filepath}`;
};
