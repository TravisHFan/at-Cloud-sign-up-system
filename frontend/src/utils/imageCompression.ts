// Image compression utility for optimizing file uploads
export interface CompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  outputFormat: "image/jpeg" | "image/png" | "image/webp";
}

export const DEFAULT_AVATAR_COMPRESSION: CompressionConfig = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.8, // 80% quality for good balance
  outputFormat: "image/jpeg",
};

export const DEFAULT_EVENT_IMAGE_COMPRESSION: CompressionConfig = {
  maxWidth: 800,
  maxHeight: 600,
  quality: 0.85, // Slightly higher quality for event images
  outputFormat: "image/jpeg",
};

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

          // Create new file with compressed data
          const compressedFile = new File([blob], file.name, {
            type: config.outputFormat,
            lastModified: Date.now(),
          });

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
