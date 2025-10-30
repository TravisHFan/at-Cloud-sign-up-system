import { Request, Response } from "express";
import { User } from "../../models";
import { hasPermission, PERMISSIONS } from "../../utils/roleUtils";
import { CachePatterns } from "../../services";

/**
 * UserListingController
 * Handles getAllUsers - paginated user listing with filtering and sorting
 */
export default class UserListingController {
  /**
   * Get all users (admin only with pagination and filtering)
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required. Invalid or missing token.",
        });
        return;
      }

      // Check permissions - allow roles with VIEW_USER_PROFILES to access community users list
      // (Admins also have this permission via role mapping.)
      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_USER_PROFILES)) {
        res.status(403).json({
          success: false,
          error: "Insufficient permissions to view user profiles.",
        });
        return;
      }

      const {
        page = 1,
        limit = 20,
        role,
        isActive,
        isVerified,
        isAtCloudLeader,
        gender,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Sanitize and enforce pagination inputs
      let pageNumber = parseInt(page as string);
      let limitNumber = parseInt(limit as string);

      if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;
      if (isNaN(limitNumber) || limitNumber < 1) limitNumber = 20;
      // Enforce maximum page size of 20 (business rule)
      if (limitNumber > 20) limitNumber = 20;
      const skip = (pageNumber - 1) * limitNumber;

      // Build filter object
      const filter: Record<string, unknown> & {
        $text?: { $search: string };
      } = {};

      if (role) {
        filter.role = role;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      }

      if (isVerified !== undefined) {
        filter.isVerified = isVerified === "true";
      }

      if (isAtCloudLeader !== undefined) {
        filter.isAtCloudLeader = isAtCloudLeader === "true";
      }

      if (gender) {
        filter.gender = gender;
      }

      // Search functionality - use regex for partial matching
      if (search) {
        const searchTerm = search as string;
        // Use regex search for partial matches in key fields
        filter.$or = [
          { firstName: { $regex: searchTerm, $options: "i" } },
          { lastName: { $regex: searchTerm, $options: "i" } },
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
          { occupation: { $regex: searchTerm, $options: "i" } },
          { company: { $regex: searchTerm, $options: "i" } },
        ];
      }

      // Create cache key based on filter parameters
      const cacheKey = `users-${JSON.stringify({
        page: pageNumber,
        limit: limitNumber,
        role,
        isActive,
        isVerified,
        isAtCloudLeader,
        gender,
        search,
        sortBy,
        sortOrder,
      })}`;

      // Try to get from cache first
      const cachedResult = await CachePatterns.getUserListing(
        cacheKey,
        async () => {
          let users;

          // Special handling for role sorting - use aggregation pipeline
          if (sortBy === "role") {
            const pipeline = [
              // Match stage (equivalent to filter)
              { $match: filter },
              // Add computed field for role hierarchy
              {
                $addFields: {
                  roleHierarchy: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$role", "Participant"] }, then: 0 },
                        { case: { $eq: ["$role", "Guest Expert"] }, then: 1 },
                        { case: { $eq: ["$role", "Leader"] }, then: 2 },
                        { case: { $eq: ["$role", "Administrator"] }, then: 3 },
                        { case: { $eq: ["$role", "Super Admin"] }, then: 4 },
                      ],
                      default: 0,
                    },
                  },
                },
              },
              // Sort by hierarchy (desc = high to low, asc = low to high)
              {
                $sort: {
                  roleHierarchy: (sortOrder === "desc" ? -1 : 1) as 1 | -1,
                  _id: 1 as const,
                },
              },
              // Remove the computed field
              {
                $project: {
                  roleHierarchy: 0,
                  password: 0,
                  emailVerificationToken: 0,
                  passwordResetToken: 0,
                },
              },
              // Pagination
              { $skip: skip },
              { $limit: limitNumber },
            ];

            users = await User.aggregate(pipeline);
          } else {
            // Standard sorting for other fields
            const sort: Record<string, 1 | -1> = {};
            sort[String(sortBy)] = sortOrder === "desc" ? -1 : 1;
            // Add secondary sort by _id to ensure stable sorting
            sort["_id"] = 1;

            users = await User.find(filter)
              .sort(sort)
              .skip(skip)
              .limit(limitNumber)
              .select("-password -emailVerificationToken -passwordResetToken");
          }

          const totalUsers = await User.countDocuments(filter);
          const totalPages = Math.ceil(totalUsers / limitNumber);

          return {
            users,
            pagination: {
              currentPage: pageNumber,
              totalPages,
              totalUsers,
              hasNext: pageNumber < totalPages,
              hasPrev: pageNumber > 1,
            },
          };
        }
      );

      res.status(200).json({
        success: true,
        data: cachedResult,
      });
    } catch (error: unknown) {
      console.error("Get all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users.",
      });
    }
  }
}
