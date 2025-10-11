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
    // In production, preserve absolute URLs from backend
    // In development, convert to relative path for proxy compatibility
    if (
      customAvatar.startsWith("http://") ||
      customAvatar.startsWith("https://")
    ) {
      try {
        // In production, if it's a backend URL, keep it absolute
        if (
          import.meta.env.PROD &&
          customAvatar.includes("backend.onrender.com")
        ) {
          return customAvatar;
        }
        // In development, extract the path part from full URL (e.g., "/uploads/avatars/...")
        const url = new URL(customAvatar);
        return url.pathname + url.search; // Include query params (cache-busting timestamp)
      } catch (error) {
        // If URL parsing fails, return as-is (likely already a relative path)
        console.warn("Failed to parse avatar URL:", customAvatar, error);
        return customAvatar;
      }
    }
    // Already a relative path, use as is
    return customAvatar;
  }

  // Otherwise, use gender-specific default avatar based on actual gender
  return gender === "male"
    ? "/default-avatar-male.jpg"
    : "/default-avatar-female.jpg";
};

/**
 * Get avatar URL with cache busting for fresh uploads
 */
export const getAvatarUrlWithCacheBust = (
  customAvatar: string | null,
  gender: "male" | "female"
): string => {
  const baseUrl = getAvatarUrl(customAvatar, gender);

  // Add cache busting only for uploaded avatars (not default avatars)
  if (customAvatar && !customAvatar.includes("default-avatar")) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}t=${Date.now()}`;
  }

  return baseUrl;
};

export const getAvatarAlt = (
  firstName: string,
  lastName: string,
  hasCustomAvatar: boolean
): string => {
  const fullName = `${firstName} ${lastName}`;
  return hasCustomAvatar ? `${fullName} avatar` : `${fullName} default avatar`;
};
