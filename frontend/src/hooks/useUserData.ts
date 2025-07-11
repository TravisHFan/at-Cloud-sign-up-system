import { useState } from "react";
import type { User, SystemRole } from "../types/management";

// Mock data - this will be replaced with API calls later
const initialMockUsers: User[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    role: "Super Admin", // Fixed: Changed from "Administrator" to "Super Admin"
    isAtCloudLeader: "Yes", // Fixed: Changed from "No" to "Yes" to match AuthContext
    roleInAtCloud: "System Administrator", // Added to match AuthContext
    joinDate: "2025-01-15",
    gender: "male",
    avatar: null, // Uses default male avatar
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
    avatar: null, // Uses default female avatar
  },
  {
    id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    username: "alice_brown",
    firstName: "Alice",
    lastName: "Brown",
    email: "alice@example.com",
    role: "Participant", // Changed from "User"
    isAtCloudLeader: "No",
    joinDate: "2025-03-10",
    gender: "female",
    avatar: null, // Uses default female avatar
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
    avatar: null, // Uses default female avatar
  },
  {
    id: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
    username: "mike_johnson",
    firstName: "Mike",
    lastName: "Johnson",
    email: "mike@example.com",
    role: "Participant", // Changed from "User"
    isAtCloudLeader: "No",
    joinDate: "2025-03-05",
    gender: "male",
    avatar: null, // Uses default male avatar
  },
  {
    id: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
    username: "alex_tech",
    firstName: "Alex",
    lastName: "Martinez",
    email: "alex.martinez@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-15",
    gender: "male",
    avatar: null, // Uses default male avatar
  },
  {
    id: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
    username: "sarah_tech",
    firstName: "Sarah",
    lastName: "Wilson",
    email: "sarah.wilson@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2025-03-18",
    gender: "female",
    avatar: null, // Uses default female avatar
  },
  {
    id: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
    username: "robert_admin",
    firstName: "Robert",
    lastName: "Thompson",
    email: "robert.thompson@example.com",
    role: "Administrator",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "Operations Manager",
    joinDate: "2025-01-20",
    gender: "male",
    avatar: null, // Uses default male avatar
  },
];

export const useUserData = () => {
  const [users, setUsers] = useState<User[]>(initialMockUsers);

  // User management functions
  const promoteUser = (userId: string, newRole: SystemRole) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    );
    console.log(`User ${userId} promoted to ${newRole}`);
  };

  const demoteUser = (userId: string, newRole: SystemRole) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    );
    console.log(`User ${userId} demoted to ${newRole}`);
  };

  const deleteUser = (userId: string) => {
    setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    console.log(`User ${userId} deleted`);
  };

  return {
    users,
    promoteUser,
    demoteUser,
    deleteUser,
  };
};
