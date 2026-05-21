// Image compression utility for optimizing file uploads
export interface CompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  outputFormat: "image/jpeg" | "image/png" | "image/webp";
  skipIfLarger?: boolean;
}

export const DEFAULT_AVATAR_COMPRESSION: CompressionConfig = {
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.82,
  outputFormat: "image/webp",
  skipIfLarger: true,
};

export const DEFAULT_EVENT_IMAGE_COMPRESSION: CompressionConfig = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  outputFormat: "image/webp",
  skipIfLarger: true,
};

const EXTENSION_BY_MIME: Record<CompressionConfig["outputFormat"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function filenameForMimeType(filename: string, mimeType: string): string {
  const extension =
    EXTENSION_BY_MIME[mimeType as CompressionConfig["outputFormat"]];
  if (!extension) return filename;

  const cleanName = filename.replace(/\.[^/.]+$/, "");
  return `${cleanName || "image"}.${extension}`;
}

export function canCompressImagesInBrowser(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof window !== "undefined" &&
    typeof Image !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof File !== "undefined"
  );
}

/**
 * Compresses an image file using HTML5 Canvas
 * @param file - The original image file
 * @param config - Compression configuration
 * @returns Promise that resolves to the compressed file
 */
export function compressImage(
  file: File,
  config: CompressionConfig = DEFAULT_AVATAR_COMPRESSION
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!canCompressImagesInBrowser()) {
      reject(new Error("Browser image compression is not available"));
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > config.maxWidth) {
          height = (height * config.maxWidth) / width;
          width = config.maxWidth;
        }
      } else {
        if (height > config.maxHeight) {
          width = (width * config.maxHeight) / height;
          height = config.maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas context not available"));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            reject(new Error("Image compression failed"));
            return;
          }

          if (config.skipIfLarger && blob.size >= file.size) {
            resolve(file);
            return;
          }

          // Create new file with compressed data
          const outputType = blob.type || config.outputFormat;
          const compressedFile = new File(
            [blob],
            filenameForMimeType(file.name, outputType),
            {
              type: outputType,
              lastModified: Date.now(),
            }
          );

          resolve(compressedFile);
        },
        config.outputFormat,
        config.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
}

/**
 * Formats file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "250 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Calculates compression ratio percentage
 * @param originalSize - Original file size in bytes
 * @param compressedSize - Compressed file size in bytes
 * @returns Compression ratio as percentage (e.g., 75 for 75% reduction)
 */
export function getCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
