/**
 * Event Repository
 * Handles all database operations for Event model
 * Implements Single Responsibility Principle
 */

import { BaseRepository } from "./BaseRepository";
import Event, { IEvent } from "../models/Event";
import { FilterQuery } from "mongoose";

export interface EventFilterOptions {
  status?: string;
  category?: string;
  isActive?: boolean;
  searchTerm?: string;
  organizerId?: string;
  startDateRange?: { start: Date; end: Date };
  endDateRange?: { start: Date; end: Date };
  tags?: string[];
  minCapacity?: number;
  maxCapacity?: number;
}

export class EventRepository extends BaseRepository<IEvent> {
  constructor() {
    super(Event);
  }

  /**
   * Find events by organizer
   */
  async findByOrganizer(organizerId: string): Promise<IEvent[]> {
    return await this.findMany(
      { organizer: organizerId },
      {
        sort: { createdAt: -1 },
        populate: "organizer registrations.user",
      }
    );
  }

  /**
   * Find events by status
   */
  async findByStatus(status: string): Promise<IEvent[]> {
    return await this.findMany(
      { status },
      {
        sort: { startDate: 1 },
        populate: "organizer",
      }
    );
  }

  /**
   * Find upcoming events
   */
  async findUpcomingEvents(limit: number = 10): Promise<IEvent[]> {
    return await this.findMany(
      {
        startDate: { $gte: new Date() },
        status: { $in: ["draft", "published"] },
        isActive: true,
      },
      {
        sort: { startDate: 1 },
        limit,
        populate: "organizer",
      }
    );
  }

  /**
   * Find past events
   */
  async findPastEvents(limit: number = 10): Promise<IEvent[]> {
    return await this.findMany(
      {
        endDate: { $lt: new Date() },
        isActive: true,
      },
      {
        sort: { endDate: -1 },
        limit,
        populate: "organizer",
      }
    );
  }

  /**
   * Find events with advanced filtering
   */
  async findEventsWithFilter(
    options: EventFilterOptions,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    events: IEvent[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const filter: FilterQuery<IEvent> = {};

    // Apply filters
    if (options.status) {
      filter.status = options.status;
    }

    if (options.category) {
      filter.category = options.category;
    }

    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    if (options.organizerId) {
      filter.organizer = options.organizerId;
    }

    // Date range filters
    if (options.startDateRange) {
      filter.startDate = {
        $gte: options.startDateRange.start,
        $lte: options.startDateRange.end,
      };
    }

    if (options.endDateRange) {
      filter.endDate = {
        $gte: options.endDateRange.start,
        $lte: options.endDateRange.end,
      };
    }

    // Capacity filters
    if (options.minCapacity !== undefined) {
      filter.capacity = { ...filter.capacity, $gte: options.minCapacity };
    }

    if (options.maxCapacity !== undefined) {
      filter.capacity = { ...filter.capacity, $lte: options.maxCapacity };
    }

    // Tags filter
    if (options.tags && options.tags.length > 0) {
      filter.tags = { $in: options.tags };
    }

    // Search functionality
    if (options.searchTerm) {
      const searchRegex = new RegExp(options.searchTerm, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { tags: searchRegex },
      ];
    }

    const result = await this.findWithPagination(filter, page, limit, {
      sort: { startDate: 1 },
      populate: "organizer",
    });

    return {
      events: result.documents,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  /**
   * Find events by category
   */
  async findByCategory(category: string): Promise<IEvent[]> {
    return await this.findMany(
      { category, isActive: true },
      {
        sort: { startDate: 1 },
        populate: "organizer",
      }
    );
  }

  /**
   * Find events by tags
   */
  async findByTags(tags: string[]): Promise<IEvent[]> {
    return await this.findMany(
      { tags: { $in: tags }, isActive: true },
      {
        sort: { startDate: 1 },
        populate: "organizer",
      }
    );
  }

  /**
   * Find events within date range
   */
  async findEventsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<IEvent[]> {
    return await this.findMany(
      {
        $or: [
          {
            startDate: { $gte: startDate, $lte: endDate },
          },
          {
            endDate: { $gte: startDate, $lte: endDate },
          },
          {
            startDate: { $lte: startDate },
            endDate: { $gte: endDate },
          },
        ],
        isActive: true,
      },
      {
        sort: { startDate: 1 },
        populate: "organizer",
      }
    );
  }

  /**
   * Check if user is registered for event
   */
  async isUserRegistered(eventId: string, userId: string): Promise<boolean> {
    const event = await this.findOne({
      _id: eventId,
      "roles.currentSignups.userId": userId,
    });
    return !!event;
  }

  /**
   * Get event registration count
   */
  async getRegistrationCount(eventId: string): Promise<number> {
    const event = await this.findById(eventId);
    if (!event?.roles) return 0;

    return event.roles.reduce((total, role) => {
      return total + (role.currentSignups?.length || 0);
    }, 0);
  }

  /**
   * Add user registration to event role
   */
  async addRegistration(
    eventId: string,
    userId: string,
    roleId: string,
    participantData: any
  ): Promise<IEvent | null> {
    const event = await this.findById(eventId);
    if (!event) return null;

    const role = event.roles.find((r) => r.id === roleId);
    if (!role) return null;

    // Check if user is already registered
    const existingSignup = role.currentSignups.find(
      (signup) => signup.userId.toString() === userId.toString()
    );
    if (existingSignup) return event;

    // Check capacity
    if (role.currentSignups.length >= role.maxParticipants) {
      throw new Error("Role is at maximum capacity");
    }

    // Add the signup
    role.currentSignups.push({
      userId,
      ...participantData,
    });

    return await event.save();
  }

  /**
   * Remove user registration from event
   */
  async removeRegistration(
    eventId: string,
    userId: string
  ): Promise<IEvent | null> {
    const event = await this.findById(eventId);
    if (!event) return null;

    // Remove user from all roles
    event.roles.forEach((role) => {
      const signupIndex = role.currentSignups.findIndex(
        (signup) => signup.userId.toString() === userId.toString()
      );
      if (signupIndex !== -1) {
        role.currentSignups.splice(signupIndex, 1);
      }
    });

    return await event.save();
  }

  /**
   * Update event status
   */
  async updateStatus(eventId: string, status: string): Promise<IEvent | null> {
    return await this.update(eventId, { status });
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<{
    totalEvents: number;
    activeEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    eventsByStatus: Array<{ status: string; count: number }>;
    eventsByCategory: Array<{ category: string; count: number }>;
    totalRegistrations: number;
  }> {
    const now = new Date();

    const [
      totalEvents,
      activeEvents,
      upcomingEvents,
      pastEvents,
      eventsByStatus,
      eventsByCategory,
      registrationStats,
    ] = await Promise.all([
      this.count({}),
      this.count({ isActive: true }),
      this.count({
        startDate: { $gte: now },
        isActive: true,
      }),
      this.count({
        endDate: { $lt: now },
        isActive: true,
      }),
      this.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      this.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $project: { category: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      this.aggregate([
        { $unwind: "$roles" },
        { $unwind: "$roles.currentSignups" },
        { $group: { _id: null, totalRegistrations: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalEvents,
      activeEvents,
      upcomingEvents,
      pastEvents,
      eventsByStatus,
      eventsByCategory,
      totalRegistrations: registrationStats[0]?.totalRegistrations || 0,
    };
  }

  /**
   * Find events that need status updates (e.g., started, ended)
   */
  async findEventsNeedingStatusUpdate(): Promise<{
    eventsToStart: IEvent[];
    eventsToEnd: IEvent[];
  }> {
    const now = new Date();

    const [eventsToStart, eventsToEnd] = await Promise.all([
      this.findMany({
        startDate: { $lte: now },
        status: "published",
        isActive: true,
      }),
      this.findMany({
        endDate: { $lte: now },
        status: "in-progress",
        isActive: true,
      }),
    ]);

    return {
      eventsToStart,
      eventsToEnd,
    };
  }

  /**
   * Get popular events (most registrations)
   */
  async getPopularEvents(limit: number = 10): Promise<IEvent[]> {
    return await this.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          registrationCount: {
            $sum: {
              $map: {
                input: "$roles",
                as: "role",
                in: { $size: "$$role.currentSignups" },
              },
            },
          },
        },
      },
      { $sort: { registrationCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
    ]);
  }

  /**
   * Bulk update event statuses
   */
  async bulkUpdateEventStatuses(): Promise<{
    startedEvents: number;
    endedEvents: number;
  }> {
    const now = new Date();

    const [startedEvents, endedEvents] = await Promise.all([
      this.updateMany(
        {
          startDate: { $lte: now },
          status: "published",
          isActive: true,
        },
        { status: "in-progress" }
      ),
      this.updateMany(
        {
          endDate: { $lte: now },
          status: "in-progress",
          isActive: true,
        },
        { status: "completed" }
      ),
    ]);

    return {
      startedEvents,
      endedEvents,
    };
  }
}
