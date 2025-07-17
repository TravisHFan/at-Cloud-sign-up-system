/**
 * User Service
 * Handles all business logic for User operations
 * Follows Single Responsibility Principle and uses Dependency Injection
 */

import {
  BaseService,
  ServiceResult,
  PaginationOptions,
} from "./base/BaseService";
import { UserRepository } from "../repositories/UserRepository";
import { IUser } from "../models/User";
import { UserRole } from "../utils/roleUtils";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  department?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female";
  preferences?: any;
  notificationSettings?: any;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female";
  preferences?: any;
  notificationSettings?: any;
}

export interface UserSearchOptions extends PaginationOptions {
  role?: string;
  department?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  searchTerm?: string;
}

export class UserService extends BaseService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository = new UserRepository()) {
    super();
    this.userRepository = userRepository;
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      // Validate email uniqueness
      const emailExists = await this.userRepository.emailExists(userData.email);
      if (emailExists) {
        throw new Error("Email already exists");
      }

      // Validate username uniqueness
      const usernameExists = await this.userRepository.usernameExists(
        userData.username
      );
      if (usernameExists) {
        throw new Error("Username already exists");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");

      // Create user data
      const userToCreate = {
        ...userData,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        verificationToken,
        emailVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const user = await this.userRepository.create(userToCreate);

      // Remove sensitive data before returning
      return this.sanitizeOutput(user.toObject());
    }, "Failed to create user");
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(user.toObject());
    }, "Failed to get user");
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      if (!email || !email.includes("@")) {
        throw new Error("Invalid email format");
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(user.toObject());
    }, "Failed to get user by email");
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      if (!username) {
        throw new Error("Username is required");
      }

      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(user.toObject());
    }, "Failed to get user by username");
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    updateData: UpdateUserData
  ): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      // Check if user exists
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error("User not found");
      }

      // Validate email uniqueness if email is being updated
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await this.userRepository.emailExists(
          updateData.email,
          userId
        );
        if (emailExists) {
          throw new Error("Email already exists");
        }
        updateData.email = updateData.email.toLowerCase();
      }

      // Validate username uniqueness if username is being updated
      if (
        updateData.username &&
        updateData.username !== existingUser.username
      ) {
        const usernameExists = await this.userRepository.usernameExists(
          updateData.username,
          userId
        );
        if (usernameExists) {
          throw new Error("Username already exists");
        }
      }

      // Add updated timestamp
      const dataToUpdate = {
        ...updateData,
        updatedAt: new Date(),
      };

      const updatedUser = await this.userRepository.update(
        userId,
        dataToUpdate
      );
      if (!updatedUser) {
        throw new Error("Failed to update user");
      }

      return this.sanitizeOutput(updatedUser.toObject());
    }, "Failed to update user");
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string): Promise<ServiceResult<boolean>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const updatedUser = await this.userRepository.softDelete(userId);
      if (!updatedUser) {
        throw new Error("User not found");
      }

      return true;
    }, "Failed to delete user");
  }

  /**
   * Restore user
   */
  async restoreUser(userId: string): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const restoredUser = await this.userRepository.restore(userId);
      if (!restoredUser) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(restoredUser.toObject());
    }, "Failed to restore user");
  }

  /**
   * Search users with pagination
   */
  async searchUsers(options: UserSearchOptions): Promise<
    ServiceResult<{
      users: IUser[];
      pagination: any;
    }>
  > {
    return await this.executeWithErrorHandling(async () => {
      const { page = 1, limit = 10, ...filterOptions } = options;

      const result = await this.userRepository.findUsersWithFilter(
        filterOptions,
        page,
        limit
      );

      return {
        users: result.users.map((user) => this.sanitizeOutput(user.toObject())),
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalCount: result.totalCount,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      };
    }, "Failed to search users");
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<ServiceResult<IUser[]>> {
    return await this.executeWithErrorHandling(async () => {
      if (!role) {
        throw new Error("Role is required");
      }

      const users = await this.userRepository.findByRole(role);
      return users.map((user) => this.sanitizeOutput(user.toObject()));
    }, "Failed to get users by role");
  }

  /**
   * Get users by department
   */
  async getUsersByDepartment(
    department: string
  ): Promise<ServiceResult<IUser[]>> {
    return await this.executeWithErrorHandling(async () => {
      if (!department) {
        throw new Error("Department is required");
      }

      const users = await this.userRepository.findByDepartment(department);
      return users.map((user) => this.sanitizeOutput(user.toObject()));
    }, "Failed to get users by department");
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ServiceResult<boolean>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      // Get user with password
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Validate new password
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      const updatedUser = await this.userRepository.update(userId, {
        password: hashedNewPassword,
        updatedAt: new Date(),
      });

      return !!updatedUser;
    }, "Failed to update password");
  }

  /**
   * Verify user email
   */
  async verifyEmail(token: string): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      if (!token) {
        throw new Error("Verification token is required");
      }

      const user = await this.userRepository.findByVerificationToken(token);
      if (!user) {
        throw new Error("Invalid or expired verification token");
      }

      // Update user to verified
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        {
          emailVerified: true,
          verificationToken: undefined,
          updatedAt: new Date(),
        }
      );

      if (!updatedUser) {
        throw new Error("Failed to verify email");
      }

      return this.sanitizeOutput(updatedUser.toObject());
    }, "Failed to verify email");
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<ServiceResult<boolean>> {
    return await this.executeWithErrorHandling(async () => {
      if (!email || !email.includes("@")) {
        throw new Error("Invalid email format");
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return true;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with reset token
      await this.userRepository.update(user._id.toString(), {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
        updatedAt: new Date(),
      });

      // TODO: Send reset email
      // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

      return true;
    }, "Failed to request password reset");
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ServiceResult<boolean>> {
    return await this.executeWithErrorHandling(async () => {
      if (!token || !newPassword) {
        throw new Error("Token and new password are required");
      }

      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const user = await this.userRepository.findByResetToken(token);
      if (!user) {
        throw new Error("Invalid or expired reset token");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        {
          password: hashedPassword,
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
          updatedAt: new Date(),
        }
      );

      return !!updatedUser;
    }, "Failed to reset password");
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId: string): Promise<ServiceResult<boolean>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const updatedUser = await this.userRepository.updateLastLogin(userId);
      return !!updatedUser;
    }, "Failed to update last login");
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: any
  ): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const updatedUser = await this.userRepository.updatePreferences(
        userId,
        preferences
      );
      if (!updatedUser) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(updatedUser.toObject());
    }, "Failed to update preferences");
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: any
  ): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      const validation = this.validateObjectId(userId, "User ID");
      if (!validation.success) {
        throw new Error(validation.error);
      }

      const updatedUser = await this.userRepository.updateNotificationSettings(
        userId,
        settings
      );
      if (!updatedUser) {
        throw new Error("User not found");
      }

      return this.sanitizeOutput(updatedUser.toObject());
    }, "Failed to update notification settings");
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<ServiceResult<any>> {
    return await this.executeWithErrorHandling(async () => {
      const stats = await this.userRepository.getUserStats();
      return stats;
    }, "Failed to get user statistics");
  }

  /**
   * Validate user credentials for authentication
   */
  async validateCredentials(
    email: string,
    password: string
  ): Promise<ServiceResult<IUser>> {
    return await this.executeWithErrorHandling(async () => {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error("Invalid credentials");
      }

      if (!user.isActive) {
        throw new Error("Account is inactive");
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }

      return this.sanitizeOutput(user.toObject());
    }, "Failed to validate credentials");
  }

  /**
   * Bulk operations
   */
  async bulkUpdateUsers(
    userIds: string[],
    updateData: Partial<UpdateUserData>
  ): Promise<ServiceResult<number>> {
    return await this.executeWithErrorHandling(async () => {
      // Validate all user IDs
      for (const userId of userIds) {
        const validation = this.validateObjectId(userId, "User ID");
        if (!validation.success) {
          throw new Error(`Invalid user ID: ${userId}`);
        }
      }

      const updatedCount = await this.userRepository.bulkUpdateUsers(
        { _id: { $in: userIds } },
        { ...updateData, updatedAt: new Date() }
      );

      return updatedCount;
    }, "Failed to bulk update users");
  }
}
