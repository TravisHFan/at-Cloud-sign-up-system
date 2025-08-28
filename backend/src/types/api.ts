import { Request } from "express";
import { IUser } from "../models/User";

// Standard API response interface - to be used across all controllers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
  statusCode?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    timestamp?: string;
    requestId?: string;
    version?: string;
  };
}

// Extended Request interface with typed authenticated user
export interface AuthenticatedRequest extends Request {
  user: IUser & { id: string };
}

// Pagination parameters interface
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// Standard pagination helper
export const parsePaginationParams = (req: Request): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// Standard error response creator
export const createErrorResponse = (
  message: string,
  statusCode: number = 500
): ApiResponse => ({
  success: false,
  message,
  statusCode,
  meta: {
    timestamp: new Date().toISOString(),
  },
});

// Standard success response creator
export const createSuccessResponse = <T>(
  data?: T,
  message: string = "Operation successful",
  pagination?: ApiResponse<T>["pagination"]
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  pagination,
  meta: {
    timestamp: new Date().toISOString(),
  },
});
