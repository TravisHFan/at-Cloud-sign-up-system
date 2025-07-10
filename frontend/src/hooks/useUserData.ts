import { useState } from "react";
import type { User, SystemRole } from "../types/management";

// Mock data - this will be replaced with API calls later
const initialMockUsers: User[] = [
  {
    id: 1,
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    role: "Administrator",
    atCloudRole: "I'm an @Cloud Leader",
    joinDate: "2025-01-15",
    gender: "male",
    avatar: null, // Uses default male avatar
  },
  {
    id: 2,
    username: "jane_smith",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    role: "Leader",
    atCloudRole: "I'm an @Cloud Leader",
    joinDate: "2025-02-01",
    gender: "female",
    avatar: "/@Cloud.jpg", // Example custom avatar (using the logo as demo)
  },
  {
    id: 3,
    username: "alice_brown",
    firstName: "Alice",
    lastName: "Brown",
    email: "alice@example.com",
    role: "Participant", // Changed from "User"
    atCloudRole: "Regular Participant",
    joinDate: "2025-03-10",
    gender: "female",
    avatar: null, // Uses default female avatar
  },
  {
    id: 4,
    username: "sarah_davis",
    firstName: "Sarah",
    lastName: "Davis",
    email: "sarah@example.com",
    role: "Leader",
    atCloudRole: "I'm an @Cloud Leader",
    joinDate: "2025-02-20",
    gender: "female",
    avatar: null, // Uses default female avatar
  },
  {
    id: 5,
    username: "mike_johnson",
    firstName: "Mike",
    lastName: "Johnson",
    email: "mike@example.com",
    role: "Participant", // Changed from "User"
    atCloudRole: "Regular Participant",
    joinDate: "2025-03-05",
    gender: "male",
    avatar: null, // Uses default male avatar
  },
];

export const useUserData = () => {
  const [users, setUsers] = useState<User[]>(initialMockUsers);

  // User management functions
  const promoteUser = (userId: number, newRole: SystemRole) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    );
    console.log(`User ${userId} promoted to ${newRole}`);
  };

  const demoteUser = (userId: number, newRole: SystemRole) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    );
    console.log(`User ${userId} demoted to ${newRole}`);
  };

  const deleteUser = (userId: number) => {
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
