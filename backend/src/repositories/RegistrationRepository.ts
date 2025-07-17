/**
 * Registration Repository
 * Handles all database operations for Registration model
 * Implements Single Responsibility Principle
 */

import { BaseRepository } from "./BaseRepository";
import Registration, { IRegistration } from "../models/Registration";
import { FilterQuery } from "mongoose";

export interface RegistrationFilterOptions {
  status?: string;
  eventId?: string;
  userId?: string;
  searchTerm?: string;
  registrationDateRange?: { start: Date; end: Date };
  eventDateRange?: { start: Date; end: Date };
}

export class RegistrationRepository extends BaseRepository<IRegistration> {
  constructor() {
    super(Registration);
  }

  /**
   * Find registrations by user
   */
  async findByUser(userId: string): Promise<IRegistration[]> {
    return await this.findMany(
      { user: userId },
      {
        sort: { registrationDate: -1 },
        populate: "event user",
      }
    );
  }

  /**
   * Find registrations by event
   */
  async findByEvent(eventId: string): Promise<IRegistration[]> {
    return await this.findMany(
      { event: eventId },
      {
        sort: { registrationDate: -1 },
        populate: "event user",
      }
    );
  }

  /**
   * Find registration by user and event
   */
  async findByUserAndEvent(
    userId: string,
    eventId: string
  ): Promise<IRegistration | null> {
    return await this.findOne({
      user: userId,
      event: eventId,
    });
  }

  /**
   * Check if user is registered for event
   */
  async isUserRegistered(userId: string, eventId: string): Promise<boolean> {
    return await this.exists({
      user: userId,
      event: eventId,
    });
  }

  /**
   * Find registrations by status
   */
  async findByStatus(status: string): Promise<IRegistration[]> {
    return await this.findMany(
      { status },
      {
        sort: { registrationDate: -1 },
        populate: "event user",
      }
    );
  }

  /**
   * Find registrations with advanced filtering
   */
  async findRegistrationsWithFilter(
    options: RegistrationFilterOptions,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    registrations: IRegistration[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const filter: FilterQuery<IRegistration> = {};

    // Apply filters
    if (options.status) {
      filter.status = options.status;
    }

    if (options.eventId) {
      filter.event = options.eventId;
    }

    if (options.userId) {
      filter.user = options.userId;
    }

    // Registration date range filter
    if (options.registrationDateRange) {
      filter.registrationDate = {
        $gte: options.registrationDateRange.start,
        $lte: options.registrationDateRange.end,
      };
    }

    // Event date range filter (requires population)
    if (options.eventDateRange) {
      // This would need to be handled with aggregation for efficiency
      // For now, we'll leave it as a TODO for complex filtering
    }

    const result = await this.findWithPagination(filter, page, limit, {
      sort: { registrationDate: -1 },
      populate: "event user",
    });

    return {
      registrations: result.documents,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  /**
   * Get upcoming registrations for user
   */
  async getUpcomingRegistrationsForUser(
    userId: string
  ): Promise<IRegistration[]> {
    // This requires joining with Event model to check event dates
    return await this.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      {
        $match: {
          "eventData.startDate": { $gte: new Date() },
        },
      },
      { $sort: { "eventData.startDate": 1 } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$userData" },
    ]);
  }

  /**
   * Get past registrations for user
   */
  async getPastRegistrationsForUser(userId: string): Promise<IRegistration[]> {
    return await this.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      {
        $match: {
          "eventData.endDate": { $lt: new Date() },
        },
      },
      { $sort: { "eventData.endDate": -1 } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$userData" },
    ]);
  }

  /**
   * Update registration status
   */
  async updateStatus(
    registrationId: string,
    status: string
  ): Promise<IRegistration | null> {
    return await this.update(registrationId, { status });
  }

  /**
   * Cancel registration
   */
  async cancelRegistration(
    registrationId: string
  ): Promise<IRegistration | null> {
    return await this.update(registrationId, {
      status: "cancelled",
      cancelledAt: new Date(),
    });
  }

  /**
   * Confirm registration
   */
  async confirmRegistration(
    registrationId: string
  ): Promise<IRegistration | null> {
    return await this.update(registrationId, {
      status: "confirmed",
      confirmedAt: new Date(),
    });
  }

  /**
   * Mark registration as attended
   */
  async markAsAttended(registrationId: string): Promise<IRegistration | null> {
    return await this.update(registrationId, {
      status: "attended",
      attendedAt: new Date(),
    });
  }

  /**
   * Get registration statistics
   */
  async getRegistrationStats(): Promise<{
    totalRegistrations: number;
    confirmedRegistrations: number;
    cancelledRegistrations: number;
    attendedRegistrations: number;
    pendingRegistrations: number;
    registrationsByStatus: Array<{ status: string; count: number }>;
    registrationsThisMonth: number;
    registrationsThisWeek: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      attendedRegistrations,
      pendingRegistrations,
      registrationsByStatus,
      registrationsThisMonth,
      registrationsThisWeek,
    ] = await Promise.all([
      this.count({}),
      this.count({ status: "confirmed" }),
      this.count({ status: "cancelled" }),
      this.count({ status: "attended" }),
      this.count({ status: "pending" }),
      this.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      this.count({
        registrationDate: { $gte: startOfMonth },
      }),
      this.count({
        registrationDate: { $gte: startOfWeek },
      }),
    ]);

    return {
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      attendedRegistrations,
      pendingRegistrations,
      registrationsByStatus,
      registrationsThisMonth,
      registrationsThisWeek,
    };
  }

  /**
   * Get registrations by date range
   */
  async getRegistrationsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<IRegistration[]> {
    return await this.findMany(
      {
        registrationDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      {
        sort: { registrationDate: -1 },
        populate: "event user",
      }
    );
  }

  /**
   * Get most active users (most registrations)
   */
  async getMostActiveUsers(limit: number = 10): Promise<
    Array<{
      user: any;
      registrationCount: number;
    }>
  > {
    return await this.aggregate([
      {
        $group: {
          _id: "$user",
          registrationCount: { $sum: 1 },
        },
      },
      { $sort: { registrationCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          user: 1,
          registrationCount: 1,
        },
      },
    ]);
  }

  /**
   * Get event popularity (most registrations)
   */
  async getEventPopularity(limit: number = 10): Promise<
    Array<{
      event: any;
      registrationCount: number;
    }>
  > {
    return await this.aggregate([
      {
        $group: {
          _id: "$event",
          registrationCount: { $sum: 1 },
        },
      },
      { $sort: { registrationCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },
      {
        $project: {
          _id: 0,
          event: 1,
          registrationCount: 1,
        },
      },
    ]);
  }

  /**
   * Bulk update registration statuses
   */
  async bulkUpdateStatus(
    registrationIds: string[],
    status: string
  ): Promise<number> {
    return await this.updateMany({ _id: { $in: registrationIds } }, { status });
  }

  /**
   * Delete expired registrations
   */
  async deleteExpiredRegistrations(expiryDate: Date): Promise<number> {
    return await this.deleteMany({
      status: "pending",
      registrationDate: { $lt: expiryDate },
    });
  }

  /**
   * Get duplicate registrations (same user, same event)
   */
  async findDuplicateRegistrations(): Promise<
    Array<{
      user: string;
      event: string;
      count: number;
      registrations: string[];
    }>
  > {
    return await this.aggregate([
      {
        $group: {
          _id: { user: "$user", event: "$event" },
          count: { $sum: 1 },
          registrations: { $push: "$_id" },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          user: "$_id.user",
          event: "$_id.event",
          count: 1,
          registrations: 1,
        },
      },
    ]);
  }
}
