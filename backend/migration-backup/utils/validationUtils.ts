import { Request, Response } from "express";
import mongoose from "mongoose";
import { createErrorResponse } from "../types/api";

/**
 * Input validation utilities for controllers
 */
export class ValidationUtils {
  /**
   * Validates required fields are present and not empty
   */
  static validateRequiredFields(
    req: Request,
    res: Response,
    fields: string[]
  ): { isValid: boolean; missingFields?: string[] } {
    const missingFields: string[] = [];

    for (const field of fields) {
      const value = req.body[field];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      res
        .status(400)
        .json(
          createErrorResponse(
            `Missing required fields: ${missingFields.join(", ")}`,
            400
          )
        );
      return { isValid: false, missingFields };
    }

    return { isValid: true };
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates phone number format (basic validation)
   */
  static validatePhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
  }

  /**
   * Validates MongoDB ObjectId
   */
  static validateObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Validates pagination parameters
   */
  static validatePaginationParams(req: Request): {
    page: number;
    limit: number;
    skip: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;

    if (page < 1) {
      page = 1;
      errors.push("Page number must be greater than 0");
    }

    if (limit < 1) {
      limit = 20;
      errors.push("Limit must be greater than 0");
    }

    if (limit > 100) {
      limit = 100;
      errors.push("Limit cannot exceed 100");
    }

    const skip = (page - 1) * limit;

    return { page, limit, skip, errors };
  }

  /**
   * Sanitizes string input (trim and basic cleaning)
   */
  static sanitizeString(input: string): string {
    if (typeof input !== "string") return "";
    return input.trim().replace(/\s+/g, " "); // Remove extra whitespace
  }

  /**
   * Validates and sanitizes user input for system messages
   */
  static validateSystemMessageInput(
    req: Request,
    res: Response
  ): {
    isValid: boolean;
    sanitizedData?: {
      title: string;
      content: string;
      type: string;
      priority: string;
      targetUserId?: string;
      expiresAt?: Date;
    };
  } {
    const { title, content, type, priority, targetUserId, expiresAt } =
      req.body;

    // Validate required fields
    const { isValid: requiredValid } = this.validateRequiredFields(req, res, [
      "title",
      "content",
    ]);
    if (!requiredValid) return { isValid: false };

    // Validate targetUserId if provided
    if (targetUserId && !this.validateObjectId(targetUserId)) {
      res
        .status(400)
        .json(createErrorResponse("Invalid target user ID format", 400));
      return { isValid: false };
    }

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | undefined;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt <= new Date()) {
        res
          .status(400)
          .json(createErrorResponse("Invalid expiration date", 400));
        return { isValid: false };
      }
    }

    // Sanitize and validate string lengths
    const sanitizedTitle = this.sanitizeString(title);
    const sanitizedContent = this.sanitizeString(content);

    if (sanitizedTitle.length > 255) {
      res
        .status(400)
        .json(createErrorResponse("Title too long (max 255 characters)", 400));
      return { isValid: false };
    }

    if (sanitizedContent.length > 5000) {
      res
        .status(400)
        .json(
          createErrorResponse("Content too long (max 5000 characters)", 400)
        );
      return { isValid: false };
    }

    // Validate enum values
    const validTypes = ["info", "warning", "error", "success", "announcement"];
    const validPriorities = ["low", "medium", "high", "critical"];

    const sanitizedType = type && validTypes.includes(type) ? type : "info";
    const sanitizedPriority =
      priority && validPriorities.includes(priority) ? priority : "medium";

    return {
      isValid: true,
      sanitizedData: {
        title: sanitizedTitle,
        content: sanitizedContent,
        type: sanitizedType,
        priority: sanitizedPriority,
        targetUserId: targetUserId || undefined,
        expiresAt: parsedExpiresAt,
      },
    };
  }
}
