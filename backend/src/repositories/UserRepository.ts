/**
 * User Repository
 * Handles all database operations for User model
 * Implements Single Responsibility Principle
 */

import { BaseRepository } from "./BaseRepository";
import User, { IUser } from "../models/User";
import { FilterQuery } from "mongoose";

export interface UserFilterOptions {
  isActive?: boolean;
  role?: string;
  department?: string;
  searchTerm?: string;
  emailVerified?: boolean;
}

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return await this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<IUser | null> {
    return await this.findOne({ username });
  }

  /**
   * Find user by reset password token
   */
  async findByResetToken(token: string): Promise<IUser | null> {
    return await this.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
  }

  /**
   * Find user by verification token
   */
  async findByVerificationToken(token: string): Promise<IUser | null> {
    return await this.findOne({ verificationToken: token });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const filter: FilterQuery<IUser> = { email: email.toLowerCase() };
    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }
    return await this.exists(filter);
  }

  /**
   * Check if username exists
   */
  async usernameExists(
    username: string,
    excludeUserId?: string
  ): Promise<boolean> {
    const filter: FilterQuery<IUser> = { username };
    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }
    return await this.exists(filter);
  }

  /**
   * Find users with advanced filtering
   */
  async findUsersWithFilter(
    options: UserFilterOptions,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    users: IUser[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const filter: FilterQuery<IUser> = {};

    // Apply filters
    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    if (options.role) {
      filter.role = options.role;
    }

    if (options.department) {
      filter.department = options.department;
    }

    if (options.emailVerified !== undefined) {
      filter.emailVerified = options.emailVerified;
    }

    // Search functionality
    if (options.searchTerm) {
      const searchRegex = new RegExp(options.searchTerm, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ];
    }

    const result = await this.findWithPagination(filter, page, limit, {
      sort: { createdAt: -1 },
      select: "-password -resetPasswordToken -verificationToken",
    });

    return {
      users: result.documents,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  /**
   * Get users by role
   */
  async findByRole(role: string): Promise<IUser[]> {
    return await this.findMany(
      { role, isActive: true },
      {
        sort: { createdAt: -1 },
        select: "-password -resetPasswordToken -verificationToken",
      }
    );
  }

  /**
   * Get users by department
   */
  async findByDepartment(department: string): Promise<IUser[]> {
    return await this.findMany(
      { department, isActive: true },
      {
        sort: { createdAt: -1 },
        select: "-password -resetPasswordToken -verificationToken",
      }
    );
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<IUser | null> {
    return await this.update(userId, { lastLogin: new Date() });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: any
  ): Promise<IUser | null> {
    return await this.update(userId, { preferences });
  }

  /**
   * Update user notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: any
  ): Promise<IUser | null> {
    return await this.update(userId, { notificationSettings: settings });
  }

  /**
   * Soft delete user (deactivate)
   */
  async softDelete(userId: string): Promise<IUser | null> {
    return await this.update(userId, {
      isActive: false,
      deletedAt: new Date(),
    });
  }

  /**
   * Restore soft deleted user
   */
  async restore(userId: string): Promise<IUser | null> {
    return await this.update(userId, {
      isActive: true,
      $unset: { deletedAt: "" },
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    usersByRole: Array<{ role: string; count: number }>;
  }> {
    const [totalUsers, activeUsers, verifiedUsers, usersByRole] =
      await Promise.all([
        this.count({}),
        this.count({ isActive: true }),
        this.count({ emailVerified: true }),
        this.aggregate([
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $project: { role: "$_id", count: 1, _id: 0 } },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      usersByRole,
    };
  }

  /**
   * Find users created within date range
   */
  async findUsersByDateRange(startDate: Date, endDate: Date): Promise<IUser[]> {
    return await this.findMany(
      {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      {
        sort: { createdAt: -1 },
        select: "-password -resetPasswordToken -verificationToken",
      }
    );
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(
    filter: FilterQuery<IUser>,
    update: any
  ): Promise<number> {
    return await this.updateMany(filter, update);
  }
}
