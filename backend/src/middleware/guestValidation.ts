import { body, ValidationChain, validationResult } from "express-validator";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * Validation rules for guest registration
 */
export const guestRegistrationValidation: ValidationChain[] = [
  // Full Name validation
  body("fullName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Full name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  // Gender validation
  body("gender")
    .isIn(["male", "female"])
    .withMessage('Gender must be either "male" or "female"'),

  // Email validation
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    // Preserve dots and plus-addressing; only trim + lowercase
    .trim()
    .toLowerCase()
    .isLength({ max: 255 })
    .withMessage("Email must be less than 255 characters"),

  // Phone validation (optional)
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("Phone number must be between 10 and 20 characters")
    .matches(/^[\d\s+().-]+$/)
    .withMessage(
      "Phone number can only contain numbers, spaces, hyphens, plus signs, parentheses, and periods"
    ),

  // Optional notes validation
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be less than 500 characters"),
];

/**
 * Validation rules for guest registration update
 */
export const guestUpdateValidation: ValidationChain[] = [
  // Full Name validation (optional for updates)
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Full name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  // Gender validation (optional for updates)
  body("gender")
    .optional()
    .isIn(["male", "female"])
    .withMessage('Gender must be either "male" or "female"'),

  // Phone validation (optional for updates)
  body("phone")
    // allow clearing with empty string
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("Phone number must be between 10 and 20 characters")
    .matches(/^[\d\s+().-]+$/)
    .withMessage(
      "Phone number can only contain numbers, spaces, hyphens, plus signs, parentheses, and periods"
    ),

  // Optional notes validation
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be less than 500 characters"),
];

/**
 * Validation rules for guest email lookup
 */
export const guestEmailValidation: ValidationChain[] = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    // Preserve dots and plus-addressing; only trim + lowercase
    .trim()
    .toLowerCase(),
];

/**
 * Validation rules for guest cancellation
 */
export const guestCancellationValidation: ValidationChain[] = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cancellation reason must be less than 500 characters"),
];

/**
 * Custom validation functions
 */

/**
 * Validates phone number format more strictly
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");

  // Check if it's a valid length (typically 10-15 digits)
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return false;
  }

  // Basic format validation
  return /^[\d\s+().-]+$/.test(phone);
};

/**
 * Validates full name format
 */
export const isValidFullName = (name: string): boolean => {
  const trimmedName = name.trim();

  // Must contain at least first and last name (space between)
  if (!trimmedName.includes(" ")) {
    return false;
  }

  // Check character restrictions
  return /^[a-zA-Z\s'-]+$/.test(trimmedName);
};

/**
 * Sanitizes guest input data
 */
type GuestInput = {
  fullName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export const sanitizeGuestInput = (data: unknown) => {
  const d = (data || {}) as GuestInput;
  return {
    fullName: typeof d.fullName === "string" ? d.fullName.trim() : d.fullName,
    gender: typeof d.gender === "string" ? d.gender.toLowerCase() : d.gender,
    email: typeof d.email === "string" ? d.email.toLowerCase().trim() : d.email,
    phone: typeof d.phone === "string" ? d.phone.trim() : d.phone,
    notes: typeof d.notes === "string" ? d.notes.trim() || undefined : d.notes,
  };
};

/**
 * Shared middleware: sanitize guest-related request body
 * Applies light, lossless normalization so controllers receive clean inputs.
 */
export const sanitizeGuestBody = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Only sanitize when body exists
    if (req && (req as unknown as { body?: unknown }).body) {
      const r = req as unknown as { body?: unknown };
      r.body = {
        ...(r.body as object),
        ...sanitizeGuestInput(r.body),
      } as unknown as Request["body"];
    }
  } catch {
    // Be defensive; never fail sanitization
  }
  next();
};

/**
 * Shared middleware: sanitize cancellation request body (trims optional reason)
 */
export const sanitizeCancellationBody = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const r = req as unknown as { body?: { reason?: unknown } };
    if (r?.body && typeof r.body.reason === "string") {
      r.body.reason = r.body.reason.trim();
    }
  } catch {
    // noop
  }
  next();
};

/**
 * Shared middleware: handle express-validator results consistently
 * Returns 400 with the same payload shape used across controllers.
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let errors: ReturnType<typeof validationResult> | undefined;
  try {
    errors = validationResult(req);
  } catch {
    errors = undefined;
  }
  if (!errors || typeof errors.isEmpty !== "function") {
    return next(); // If validator not wired (in certain tests), skip
  }
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validates guest registration uniqueness
 */
export const GUEST_MAX_ROLES_PER_EVENT = 3 as const;

export const validateGuestUniqueness = async (
  email: string,
  eventId: string,
  excludeId?: string
): Promise<{ isValid: boolean; message?: string; count?: number }> => {
  try {
    if (!email || typeof email !== "string" || email.trim() === "") {
      return {
        isValid: false,
        message: "Error validating guest registration uniqueness",
      };
    }

    const { GuestRegistration } = await import("../models");
    const baseQuery = {
      email: email.toLowerCase(),
      eventId: new mongoose.Types.ObjectId(eventId),
      status: "active",
    } as const;

    // Count active registrations for this guest & event
    const activeCount = await GuestRegistration.countDocuments(baseQuery);

    // If editing an existing registration (excludeId), we allow it unless after edit it would exceed limit.
    // For creation: disallow once they already have >= max registrations.
    if (activeCount >= GUEST_MAX_ROLES_PER_EVENT) {
      return {
        isValid: false,
        message: `This guest has reached the ${GUEST_MAX_ROLES_PER_EVENT}-role limit for this event.`,
        count: activeCount,
      };
    }

    return { isValid: true, count: activeCount };
  } catch {
    return {
      isValid: false,
      message: "Error validating guest registration uniqueness",
    };
  }
};

/**
 * Deprecated: global single-event access check (no longer enforced).
 * Kept for backward compatibility in case older migrations/tests reference it.
 */
export const validateGuestSingleEventAccess = async (
  email: string,
  excludeId?: string
): Promise<{ isValid: boolean; message?: string }> => {
  try {
    if (!email || typeof email !== "string" || email.trim() === "") {
      return {
        isValid: false,
        message: "Error validating guest single-event access",
      };
    }

    const { GuestRegistration } = await import("../models");

    const query: Record<string, unknown> = {
      email: email.toLowerCase(),
      status: "active",
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await GuestRegistration.findOne(query).lean();
    if (existing) {
      return {
        isValid: false,
        message:
          "A guest with this email already has an active registration for another event",
      };
    }

    return { isValid: true };
  } catch {
    return {
      isValid: false,
      message: "Error validating guest single-event access",
    };
  }
};

/**
 * Rate limiting validation for guest registrations
 */
// Persistent in-memory store for simple rate limiting (tests rely on this state)
const rateLimitStore: Map<string, number[]> = new Map();

// Test helper to reset rate limit state
export const __resetGuestRateLimitStore = () => rateLimitStore.clear();

// Injectable time provider for deterministic tests
let __nowProvider: () => number = () => Date.now();
export const __setGuestRateLimitNowProvider = (fn: (() => number) | null) => {
  __nowProvider = fn || (() => Date.now());
};

export const validateGuestRateLimit = (
  ipAddress: string,
  email: string
): { isValid: boolean; message?: string } => {
  // In production, use Redis or a distributed store. For now, use module-level Map.
  const currentTime = __nowProvider();
  const rateWindow = 60 * 60 * 1000; // 1 hour
  const maxAttempts = 5; // allowed attempts per ip+email per window

  const key = `${ipAddress}:${email}`;
  const attempts = rateLimitStore.get(key) || [];

  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(
    (time: number) => currentTime - time < rateWindow
  );

  if (recentAttempts.length >= maxAttempts) {
    return {
      isValid: false,
      message: "Too many registration attempts. Please try again later.",
    };
  }

  // Record current attempt
  recentAttempts.push(currentTime);
  rateLimitStore.set(key, recentAttempts);

  return { isValid: true };
};
