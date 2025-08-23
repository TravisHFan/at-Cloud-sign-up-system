// Profile form constants

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const AT_CLOUD_LEADER_OPTIONS = [
  { value: "No", label: "No" },
  { value: "Yes", label: "Yes" },
] as const;

// File upload constraints
export const AVATAR_UPLOAD_CONFIG = {
  acceptedTypes: "image/*",
  maxFileSize: 5 * 1024 * 1024, // 5MB
} as const;
