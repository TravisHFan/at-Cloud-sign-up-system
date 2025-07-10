// Profile form constants
export const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const AT_CLOUD_ROLE_OPTIONS = [
  { value: "Regular Participant", label: "Regular Participant" },
  { value: "I'm an @Cloud Leader", label: "I'm an @Cloud Leader" },
] as const;

// Default avatar placeholder - now handled by gender-specific avatars
export const DEFAULT_AVATAR_URL = "/default-avatar-male.jpg"; // Default fallback

// Mock user data - this will come from auth context later
export const MOCK_USER_DATA = {
  username: "john_doe",
  firstName: "John",
  lastName: "Doe",
  gender: "male" as const,
  email: "john@example.com",
  phone: "+1234567890",
  roleInAtCloud: "Software Engineer", // What they do professionally
  atCloudRole: "Regular Participant", // Their role in @Cloud organization
  homeAddress: "123 Main St, City, State 12345",
  company: "Tech Company Inc.",
  avatar: null, // No custom avatar, will use gender-specific default
  systemRole: "Administrator", // This determines access level
} as const;

// File upload constraints
export const AVATAR_UPLOAD_CONFIG = {
  acceptedTypes: "image/*",
  maxFileSize: 5 * 1024 * 1024, // 5MB
} as const;
