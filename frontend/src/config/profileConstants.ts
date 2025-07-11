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
  roleInAtCloud: "System Administrator", // Fixed: Added roleInAtCloud to match AuthContext
  isAtCloudLeader: "Yes" as const, // Fixed: Changed from "No" to "Yes" to match AuthContext
  homeAddress: "123 Main St, City, State 12345",
  company: "Tech Company Inc.",
  avatar: null, // No custom avatar, will use gender-specific default
  systemAuthorizationLevel: "Super Admin", // Fixed: Changed from "Administrator" to "Super Admin"
} as const;

// File upload constraints
export const AVATAR_UPLOAD_CONFIG = {
  acceptedTypes: "image/*",
  maxFileSize: 5 * 1024 * 1024, // 5MB
} as const;
