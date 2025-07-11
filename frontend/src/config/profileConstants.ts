// Profile form constants
export const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const AT_CLOUD_LEADER_OPTIONS = [
  { value: "No", label: "No" },
  { value: "Yes", label: "Yes" },
] as const;

// Mock user data - this will come from auth context later
export const MOCK_USER_DATA = {
  id: "550e8400-e29b-41d4-a716-446655440000", // UUID - will come from backend
  username: "john_doe",
  firstName: "John",
  lastName: "Doe",
  gender: "male" as const,
  email: "john@example.com",
  phone: "+1234567890",
  roleInAtCloud: "", // Will only be filled if isAtCloudLeader is "Yes"
  isAtCloudLeader: "No" as const, // Changed from atCloudRole
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
