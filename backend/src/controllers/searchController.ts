import { Request, Response } from "express";
import { User, Event } from "../models";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";

export class SearchController {
  // Search users
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { q: query } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: "Search query is required.",
        });
        return;
      }

      // Build search criteria
      const searchCriteria: any = {
        isActive: true,
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { weeklyChurch: { $regex: query, $options: 'i' } },
          { occupation: { $regex: query, $options: 'i' } },
          { company: { $regex: query, $options: 'i' } }
        ]
      };

      // Add filters
      if (req.query.role) {
        searchCriteria.role = req.query.role;
      }
      if (req.query.isAtCloudLeader !== undefined) {
        searchCriteria.isAtCloudLeader = req.query.isAtCloudLeader === 'true';
      }
      if (req.query.weeklyChurch) {
        searchCriteria.weeklyChurch = { $regex: req.query.weeklyChurch, $options: 'i' };
      }

      // Check if user can view sensitive information
      const canViewSensitive = hasPermission(req.user.role, PERMISSIONS.VIEW_USER_PROFILES);
      
      const selectFields = canViewSensitive 
        ? '-password' 
        : 'username firstName lastName avatar role isAtCloudLeader weeklyChurch';

      const [users, totalUsers] = await Promise.all([
        User.find(searchCriteria)
          .select(selectFields)
          .sort({ firstName: 1, lastName: 1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        User.countDocuments(searchCriteria)
      ]);

      const totalPages = Math.ceil(totalUsers / limit);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: page,
            totalPages,
            totalUsers,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
      });
    } catch (error: any) {
      console.error("Search users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search users.",
      });
    }
  }

  // Search events
  static async searchEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { q: query } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: "Search query is required.",
        });
        return;
      }

      // Build search criteria
      const searchCriteria: any = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { location: { $regex: query, $options: 'i' } },
          { organizer: { $regex: query, $options: 'i' } },
          { purpose: { $regex: query, $options: 'i' } },
          { type: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } }
        ]
      };

      // Add filters
      if (req.query.type) {
        searchCriteria.type = req.query.type;
      }
      if (req.query.format) {
        searchCriteria.format = req.query.format;
      }
      if (req.query.status) {
        const now = new Date();
        if (req.query.status === 'upcoming') {
          searchCriteria.date = { $gte: now };
        } else if (req.query.status === 'past') {
          searchCriteria.date = { $lt: now };
        }
      }
      if (req.query.dateFrom) {
        searchCriteria.date = { ...searchCriteria.date, $gte: new Date(req.query.dateFrom as string) };
      }
      if (req.query.dateTo) {
        searchCriteria.date = { ...searchCriteria.date, $lte: new Date(req.query.dateTo as string) };
      }

      const [events, totalEvents] = await Promise.all([
        Event.find(searchCriteria)
          .sort({ date: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Event.countDocuments(searchCriteria)
      ]);

      const totalPages = Math.ceil(totalEvents / limit);

      res.status(200).json({
        success: true,
        data: {
          events,
          pagination: {
            currentPage: page,
            totalPages,
            totalEvents,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
      });
    } catch (error: any) {
      console.error("Search events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search events.",
      });
    }
  }

  // Global search (users and events)
  static async globalSearch(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { q: query } = req.query;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: "Search query is required.",
        });
        return;
      }

      // Search users
      const userSearchCriteria = {
        isActive: true,
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { weeklyChurch: { $regex: query, $options: 'i' } }
        ]
      };

      // Search events
      const eventSearchCriteria = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { location: { $regex: query, $options: 'i' } },
          { organizer: { $regex: query, $options: 'i' } },
          { type: { $regex: query, $options: 'i' } }
        ]
      };

      const canViewSensitive = hasPermission(req.user.role, PERMISSIONS.VIEW_USER_PROFILES);
      const userSelectFields = canViewSensitive 
        ? '-password' 
        : 'username firstName lastName avatar role isAtCloudLeader weeklyChurch';

      const [users, events] = await Promise.all([
        User.find(userSearchCriteria)
          .select(userSelectFields)
          .limit(limit)
          .lean(),
        Event.find(eventSearchCriteria)
          .limit(limit)
          .lean()
      ]);

      res.status(200).json({
        success: true,
        data: {
          users,
          events,
          totalResults: users.length + events.length
        },
      });
    } catch (error: any) {
      console.error("Global search error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform global search.",
      });
    }
  }
}
