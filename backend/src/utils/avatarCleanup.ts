import fs from "fs";
import path from "path";

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
    return false;
  }

  try {
    const filename = path.basename(avatarUrl);
    // Use the correct uploads directory based on environment
    let uploadsDir: string;
    if (process.env.UPLOAD_DESTINATION) {
      uploadsDir = path.join(process.env.UPLOAD_DESTINATION.replace(/\/$/, ''), 'avatars');
    } else {
      uploadsDir = process.env.NODE_ENV === 'production' 
        ? '/uploads/avatars' 
        : path.join(process.cwd(), "uploads/avatars");
    }
    
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted old avatar: ${filename}`);
      return true;
    }

    // File doesn't exist, consider it already cleaned up
    return false;
  } catch (error) {
    console.error("Error deleting avatar file:", error);
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
    return false;
  }

  try {
    console.log(`Cleaning up old avatar for user ${userId}: ${oldAvatarUrl}`);
    return await deleteOldAvatarFile(oldAvatarUrl);
  } catch (error) {
    console.error(`Error cleaning up old avatar for user ${userId}:`, error);
    return false;
  }
};
