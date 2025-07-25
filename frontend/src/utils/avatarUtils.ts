/**
 * Utility functions for handling user avatars
 */

/**
 * Utility functions for handling user avatars
 */

export const getAvatarUrl = (
  customAvatar: string | null,
  gender: "male" | "female"
): string => {
  // Check if customAvatar is actually a default avatar (bad data from backend)
  const isDefaultAvatar =
    customAvatar === "/default-avatar-male.jpg" ||
    customAvatar === "/default-avatar-female.jpg";

  // If user has a real custom avatar (not a default one), use it
  if (customAvatar && !isDefaultAvatar) {
    // Convert full URL to relative path for proxy compatibility
    // This handles both development (with full URLs) and production scenarios
    if (
      customAvatar.startsWith("http://") ||
      customAvatar.startsWith("https://")
    ) {
      // Extract the path part from full URL (e.g., "/uploads/avatars/...")
      const url = new URL(customAvatar);
      return url.pathname;
    }
    // Already a relative path, use as is
    return customAvatar;
  }

  // Otherwise, use gender-specific default avatar based on actual gender
  return gender === "male"
    ? "/default-avatar-male.jpg"
    : "/default-avatar-female.jpg";
};

export const getAvatarAlt = (
  firstName: string,
  lastName: string,
  hasCustomAvatar: boolean
): string => {
  const fullName = `${firstName} ${lastName}`;
  return hasCustomAvatar ? `${fullName} avatar` : `${fullName} default avatar`;
};
