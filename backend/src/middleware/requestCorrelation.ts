/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Request Correlation Middleware
 * Adds a unique correlation ID to each request for distributed tracing
 */

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export interface CorrelationOptions {
  headerName?: string;
  propertyName?: string;
  generator?: () => string;
}

const DEFAULT_OPTIONS: Required<CorrelationOptions> = {
  headerName: "x-correlation-id",
  propertyName: "correlationId",
  generator: () => randomUUID(),
};

/**
 * Middleware to add correlation ID to requests
 *
 * Features:
 * - Uses existing correlation ID from request header if present
 * - Generates new UUID if no correlation ID provided
 * - Adds correlation ID to response headers
 * - Attaches correlation ID to request object for use in controllers/services
 *
 * @param options Configuration options for correlation behavior
 */
export const requestCorrelation = (
  options: CorrelationOptions = {}
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if correlation ID already exists in request headers (normalize header value)
    const headerVal = req.headers[config.headerName];
    const incomingId = Array.isArray(headerVal)
      ? headerVal[0]
      : (headerVal as string | undefined);
    let correlationId = incomingId;

    // Generate new correlation ID if none provided
    if (!correlationId) {
      correlationId = config.generator();
    }

    // Attach correlation ID to request object
    req.correlationId = correlationId;

    // Add correlation ID to response headers for client tracking
    res.setHeader(config.headerName, correlationId);

    next();
  };
};

/**
 * Helper function to get correlation ID from request
 */
export const getCorrelationId = (req: Request): string | undefined => {
  return req.correlationId;
};

/**
 * Helper function to create a correlation context for logging
 */
export const createCorrelationContext = (req: Request) => {
  return {
    correlationId: getCorrelationId(req),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  };
};
