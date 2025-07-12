import { useState } from "react";
import type { User, SystemAuthorizationLevel } from "../types/management";
import { MOCK_USERS } from "../data/mockUserData";

// Convert centralized users to management User type
const initialMockUsers: User[] = MOCK_USERS.map((user) => ({
  id: user.id,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isAtCloudLeader: user.isAtCloudLeader,
  roleInAtCloud: user.roleInAtCloud,
  joinDate: user.joinDate,
  gender: user.gender,
  avatar: user.avatar,
  homeAddress: user.homeAddress,
  company: user.company,
  weeklyChurch: user.weeklyChurch,
  churchAddress: user.churchAddress,
}));

export const useUserData = () => {
  const [users, setUsers] = useState<User[]>(initialMockUsers);

  // User management functions
  const promoteUser = (userId: string, newRole: SystemAuthorizationLevel) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    );
    console.log(`User ${userId} promoted to ${newRole}`);
  };

  const demoteUser = (userId: string, newRole: SystemAuthorizationLevel) => {
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
