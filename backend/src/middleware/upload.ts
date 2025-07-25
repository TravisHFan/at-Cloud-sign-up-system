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

    // Determine upload path based on file type
    if (file.fieldname === "avatar") {
      uploadPath += "avatars/";
    } else if (file.fieldname === "image") {
      uploadPath += "events/";
    } else if (file.fieldname === "attachment") {
      uploadPath += "attachments/";
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

// File filter for images
const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

// File filter for general attachments
const attachmentFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/x-rar-compressed",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"));
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

export const uploadEventImage = [
  multer({
    storage,
    fileFilter: imageFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  }).single("image"),
  compressUploadedImage, // Compress after upload
  includeCompressionInfo, // Add compression info to response
];

export const uploadAttachment = multer({
  storage,
  fileFilter: attachmentFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (no compression for attachments)
  },
}).single("attachment");

// Helper function to get file URL
export const getFileUrl = (req: Request, filepath: string): string => {
  // Return relative path for frontend proxy compatibility
  return `/uploads/${filepath}`;
};
