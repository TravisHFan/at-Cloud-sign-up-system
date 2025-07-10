/**
 * Utility functions for handling user avatars
 */

export const getAvatarUrl = (
  customAvatar: string | null,
  gender: "male" | "female"
): string => {
  // If user has a custom avatar, use it
  if (customAvatar) {
    return customAvatar;
  }

  // Otherwise, use gender-specific default avatar
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
