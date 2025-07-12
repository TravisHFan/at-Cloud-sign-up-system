// Centralized mock user data to maintain consistency across the application
// This will be replaced with API calls when backend is integrated

export interface MockUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "Super Admin" | "Administrator" | "Leader" | "Participant";
  isAtCloudLeader: "Yes" | "No";
  roleInAtCloud?: string;
  joinDate: string;
  gender: "male" | "female";
  avatar?: string | null;
  phone?: string;
  homeAddress?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
  systemAuthorizationLevel?: string; // For profile compatibility
}

// Core mock users - consistent across all parts of the application
export const MOCK_USERS: MockUser[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000", // Current user
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    role: "Super Admin",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "System Administrator",
    joinDate: "2025-01-15",
    gender: "male",
    avatar: null,
    phone: "+1234567890",
    homeAddress: "123 Main St, City, State 12345",
    occupation: "Software Engineer",
    company: "Tech Company Inc.",
    weeklyChurch: "Grace Community Church",
    churchAddress: "456 Church Ave, Downtown, State 12345",
    systemAuthorizationLevel: "Super Admin",
  },
  {
    id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    username: "jane_smith",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    role: "Leader",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "Event Director",
    joinDate: "2025-02-01",
    gender: "female",
    avatar: null,
    occupation: "Project Manager",
    weeklyChurch: "Grace Community Church", // Changed to same as first user
    churchAddress: "456 Church Ave, Downtown, State 12345", // Same address
  },
  {
    id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    username: "alice_brown",
    firstName: "Alice",
    lastName: "Brown",
    email: "alice@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-10",
    gender: "female",
    avatar: null,
    occupation: "Software Engineer", // Changed to same as first user
    weeklyChurch: "Grace Community Church", // Changed to same as first user
    churchAddress: "456 Church Ave, Downtown, State 12345", // Same address
  },
  {
    id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    username: "sarah_davis",
    firstName: "Sarah",
    lastName: "Davis",
    email: "sarah@example.com",
    role: "Leader",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "IT Director",
    joinDate: "2025-02-20",
    gender: "female",
    avatar: null,
    occupation: "Project Manager", // Changed to same as second user
    weeklyChurch: "First Baptist Church", // Different church
    churchAddress: "789 Baptist Rd, Northside, State 12345",
  },
  {
    id: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
    username: "mike_johnson",
    firstName: "Mike",
    lastName: "Johnson",
    email: "mike@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-05",
    gender: "male",
    avatar: null,
    occupation: "Software Engineer", // Changed to same as first user
    weeklyChurch: "First Baptist Church", // Same as fourth user
    churchAddress: "789 Baptist Rd, Northside, State 12345",
  },
  {
    id: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
    username: "alex_martinez",
    firstName: "Alex",
    lastName: "Martinez",
    email: "alex.martinez@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-15",
    gender: "male",
    avatar: null,
    occupation: "Teacher", // Same as seventh user
    weeklyChurch: "Grace Community Church", // Same as first user
    churchAddress: "456 Church Ave, Downtown, State 12345", // Same address
  },
  {
    id: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
    username: "sarah_wilson",
    firstName: "Sarah",
    lastName: "Wilson",
    email: "sarah.wilson@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-18",
    gender: "female",
    avatar: null,
    occupation: "Teacher",
    weeklyChurch: "New Life Assembly",
    churchAddress: "567 Assembly Dr, Valley View, State 12345",
  },
  {
    id: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
    username: "robert_thompson",
    firstName: "Robert",
    lastName: "Thompson",
    email: "robert.thompson@example.com",
    role: "Administrator",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "Technical Lead",
    joinDate: "2025-01-20",
    gender: "male",
    avatar: null,
    occupation: "Project Manager", // Same as second user
    weeklyChurch: "City Methodist Church",
    churchAddress: "321 Methodist Way, Central District, State 12345",
  },
  {
    id: "6ba7b817-9dad-11d1-80b4-00c04fd430c8",
    username: "david_brown",
    firstName: "David",
    lastName: "Brown",
    email: "david.brown@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-20",
    gender: "male",
    avatar: null,
    occupation: "I'm Retired",
    weeklyChurch: "Riverside Community Church",
    churchAddress: "123 River Rd, Riverside, State 12345",
  },
];

// Current user (matches AuthContext)
export const CURRENT_USER = MOCK_USERS[0];

// Super Admin user (for system messages)
export const SUPER_ADMIN_USER = MOCK_USERS[0];

// Helper functions
export const getUserById = (id: string) =>
  MOCK_USERS.find((user) => user.id === id);
export const getUserByUsername = (username: string) =>
  MOCK_USERS.find((user) => user.username === username);
export const getAllUsers = () => MOCK_USERS;
export const getNonCurrentUsers = () =>
  MOCK_USERS.filter((user) => user.id !== CURRENT_USER.id);

// User lookup utilities for email services
export const findUserByEmail = (email: string): MockUser | null => {
  const user = MOCK_USERS.find(
    (user) => user.email.toLowerCase() === email.toLowerCase()
  );
  return user || null;
};

export const findUserById = (id: string): MockUser | null => {
  const user = MOCK_USERS.find((user) => user.id === id);
  return user || null;
};

export const getAllAdminUsers = (): MockUser[] => {
  return MOCK_USERS.filter(
    (user) => user.role === "Super Admin" || user.role === "Administrator"
  );
};

// User ID constants for consistency
export const USER_IDS = {
  CURRENT_USER: "550e8400-e29b-41d4-a716-446655440000",
  JANE_SMITH: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  ALICE_BROWN: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  SARAH_DAVIS: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  MIKE_JOHNSON: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
  ALEX_MARTINEZ: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
  SARAH_WILSON: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
  ROBERT_THOMPSON: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
  DAVID_BROWN: "6ba7b817-9dad-11d1-80b4-00c04fd430c8",
} as const;
