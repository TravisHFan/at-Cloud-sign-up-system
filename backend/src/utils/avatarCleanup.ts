import fs from "fs";
import path from "path";
import { createLogger } from "../services/LoggerService";

const log = createLogger("AvatarCleanup");

/**
 * Check if an avatar URL represents an uploaded file (not a default avatar)
 */
export const isUploadedAvatar = (
  avatarUrl: string | null | undefined
): boolean => {
  if (!avatarUrl) return false;
  return avatarUrl.includes("/uploads/avatars/");
};

/**
 * Delete an old avatar file from the filesystem
 */
export const deleteOldAvatarFile = async (
  avatarUrl: string | null | undefined
): Promise<boolean> => {
  if (!avatarUrl || !isUploadedAvatar(avatarUrl)) {
    // Skip silently for console; add structured debug for observability
    try {
      log.debug("Skip deleting avatar: not an uploaded avatar", undefined, {
        hasUrl: Boolean(avatarUrl),
        avatarUrl,
      });
    } catch {}
    return false;
  }

  try {
    const filename = path.basename(avatarUrl);
    // Use the correct uploads directory based on environment
    let uploadsDir: string;
    if (process.env.UPLOAD_DESTINATION) {
      uploadsDir = path.join(
        process.env.UPLOAD_DESTINATION.replace(/\/$/, ""),
        "avatars"
      );
    } else {
      uploadsDir =
        process.env.NODE_ENV === "production"
          ? "/uploads/avatars"
          : path.join(process.cwd(), "uploads/avatars");
    }

    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted old avatar: ${filename}`);
      log.info("Old avatar deleted", undefined, { filename, uploadsDir });
      return true;
    }

    // File doesn't exist, consider it already cleaned up
    log.debug(
      "Old avatar file not found; treated as already cleaned up",
      undefined,
      {
        filename,
        uploadsDir,
      }
    );
    return false;
  } catch (error) {
    console.error("Error deleting avatar file:", error);
    log.error("Error deleting avatar file", error as Error);
    return false;
  }
};

/**
 * Cleanup old avatar file for a user
 */
export const cleanupOldAvatar = async (
  userId: string,
  oldAvatarUrl: string | null | undefined
): Promise<boolean> => {
  if (!oldAvatarUrl || !isUploadedAvatar(oldAvatarUrl)) {
    // Not an uploaded avatar; nothing to cleanup. Structured debug only.
    try {
      log.debug("No cleanup needed for avatar", undefined, {
        userId,
        hasUrl: Boolean(oldAvatarUrl),
        oldAvatarUrl,
      });
    } catch {}
    return false;
  }

  try {
    console.log(`Cleaning up old avatar for user ${userId}: ${oldAvatarUrl}`);
    log.info("Cleaning up old avatar for user", undefined, {
      userId,
      oldAvatarUrl,
    });
    return await deleteOldAvatarFile(oldAvatarUrl);
  } catch (error) {
    console.error(`Error cleaning up old avatar for user ${userId}:`, error);
    log.error(
      "Error cleaning up old avatar for user",
      error as Error,
      undefined,
      {
        userId,
        oldAvatarUrl,
      }
    );
    return false;
  }
};
