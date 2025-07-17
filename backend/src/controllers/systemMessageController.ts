import { Request, Response } from "express";
import SystemMessage, { ISystemMessage } from "../models/SystemMessage";
import User, { IUser } from "../models/User";
import mongoose from "mongoose";
import {
  ApiResponse,
  AuthenticatedRequest,
  parsePaginationParams,
  createErrorResponse,
  createSuccessResponse,
} from "../types/api";
import { AuthUtils } from "../utils/authUtils";
import { ValidationUtils } from "../utils/validationUtils";

export class SystemMessageController {
  // Get all system messages for current user with pagination
  static async getSystemMessages(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      // Parse pagination parameters using shared helper
      const { page, limit, skip } = parsePaginationParams(req);

      // Build query for messages user can see
      const messageQuery = {
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
      };

      // Get total count for pagination
      const totalMessages = await SystemMessage.countDocuments(messageQuery);
      const totalPages = Math.ceil(totalMessages / limit);

      // Get paginated messages
      const messages = await SystemMessage.find(messageQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform messages to include isRead status for this user
      const transformedMessages = messages.map((message) => {
        const isRead =
          message.readByUsers?.some(
            (userId) => userId.toString() === user.id
          ) || false;

        return {
          ...message,
          isRead,
          // Remove readByUsers array from response for privacy
          readByUsers: undefined,
        };
      });

      const response = createSuccessResponse(
        {
          systemMessages: transformedMessages,
          totalMessages,
        },
        "System messages retrieved successfully",
        {
          currentPage: page,
          totalPages,
          totalItems: totalMessages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      );

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Error getting system messages:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve system messages"));
    }
  }

  // Mark system message as read
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { messageId } = req.params;

      // Validate messageId format
      const { isValid: isValidId, error } = AuthUtils.validateObjectId(
        messageId,
        "message ID"
      );
      if (!isValidId) {
        res.status(400).json(createErrorResponse(error!, 400));
        return;
      }

      // Check if message exists and user can access it
      const existingMessage = await SystemMessage.findOne({
        _id: messageId,
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
      });

      if (!existingMessage) {
        res.status(404).json({
          success: false,
          message: "System message not found or access denied",
        } as ApiResponse);
        return;
      }

      // Mark as read (only if not already read)
      const message = await SystemMessage.findByIdAndUpdate(
        messageId,
        { $addToSet: { readByUsers: user.id } },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: "System message marked as read",
      } as ApiResponse);
    } catch (error: any) {
      console.error("Error marking system message as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark system message as read",
      } as ApiResponse);
    }
  }

  // Mark all system messages as read
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user || !user.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse);
        return;
      }

      // More efficient bulk update - mark all accessible messages as read in one operation
      const updateResult = await SystemMessage.updateMany(
        {
          isActive: true,
          $or: [
            { targetUserId: { $exists: false } }, // Global messages
            { targetUserId: user.id }, // Messages targeted to this user
          ],
          readByUsers: { $ne: user.id }, // Only update messages not already read
        },
        { $addToSet: { readByUsers: user.id } }
      );

      res.status(200).json({
        success: true,
        data: {
          markedAsRead: updateResult.modifiedCount,
        },
        message: `Successfully marked ${updateResult.modifiedCount} messages as read`,
      } as ApiResponse);
    } catch (error: any) {
      console.error("Error marking all system messages as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark all system messages as read",
      } as ApiResponse);
    }
  }

  // Create a new system message (admin only)
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      // Validate and sanitize input
      const { isValid: validInput, sanitizedData } =
        ValidationUtils.validateSystemMessageInput(req, res);
      if (!validInput || !sanitizedData) return;

      const { title, content, type, priority, targetUserId, expiresAt } =
        sanitizedData;

      // Check if target user exists (if targetUserId provided)
      let targetUser = null;
      if (targetUserId) {
        targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          res
            .status(404)
            .json(createErrorResponse("Target user not found", 404));
          return;
        }

        // Check if this is a welcome message and if user already received one
        if (
          title.includes("Welcome to @Cloud") &&
          targetUser.hasReceivedWelcomeMessage
        ) {
          res
            .status(200)
            .json(
              createSuccessResponse(
                null,
                "Welcome message already sent to this user"
              )
            );
          return;
        }
      }

      const message = new SystemMessage({
        title,
        content,
        type,
        priority,
        targetUserId,
        creator: user.id,
        expiresAt,
        isActive: true,
        readByUsers: [],
      });

      await message.save();

      // If this is a welcome message, mark user as having received it
      if (title.includes("Welcome to @Cloud") && targetUserId && targetUser) {
        await User.findByIdAndUpdate(targetUserId, {
          hasReceivedWelcomeMessage: true,
        });
      }

      res
        .status(201)
        .json(
          createSuccessResponse(
            { systemMessage: message },
            "System message created successfully"
          )
        );
    } catch (error: any) {
      console.error("Error creating system message:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to create system message"));
    }
  }

  // Delete/deactivate a system message (admin only)
  static async deleteSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { messageId } = req.params;

      if (!user || !user.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse);
        return;
      }

      // Validate messageId format
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        res.status(400).json({
          success: false,
          message: "Invalid message ID format",
        } as ApiResponse);
        return;
      }

      const message = await SystemMessage.findByIdAndUpdate(
        messageId,
        { isActive: false },
        { new: true }
      );

      if (!message) {
        res.status(404).json({
          success: false,
          message: "System message not found",
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        message: "System message deleted successfully",
      } as ApiResponse);
    } catch (error: any) {
      console.error("Error deleting system message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete system message",
      } as ApiResponse);
    }
  }

  // Get unread count for system messages
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user || !user.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse);
        return;
      }

      const unreadCount = await SystemMessage.countDocuments({
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
        readByUsers: { $ne: user.id }, // Not read by this user
      });

      res.status(200).json({
        success: true,
        data: { unreadCount },
        message: "Unread count retrieved successfully",
      } as ApiResponse);
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get unread count",
      } as ApiResponse);
    }
  }

  // Check if user has received welcome message
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user || !user.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse);
        return;
      }

      const userData = await User.findById(user.id).select(
        "hasReceivedWelcomeMessage"
      );

      if (!userData) {
        res.status(404).json({
          success: false,
          message: "User not found",
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          hasReceivedWelcomeMessage:
            userData.hasReceivedWelcomeMessage || false,
        },
        message: "Welcome message status retrieved successfully",
      } as ApiResponse);
    } catch (error: any) {
      console.error("Error checking welcome message status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check welcome message status",
      } as ApiResponse);
    }
  }
}
