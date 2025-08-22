import { body, ValidationChain } from "express-validator";
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
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must be less than 255 characters"),

  // Phone validation
  body("phone")
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
    .optional()
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
    .normalizeEmail(),
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
export const sanitizeGuestInput = (data: any) => {
  return {
    fullName: data.fullName?.trim(),
    gender: data.gender?.toLowerCase(),
    email: data.email?.toLowerCase().trim(),
    phone: data.phone?.trim(),
    notes: data.notes?.trim() || undefined,
  };
};

/**
 * Validates guest registration uniqueness
 */
export const validateGuestUniqueness = async (
  email: string,
  eventId: string,
  excludeId?: string
): Promise<{ isValid: boolean; message?: string }> => {
  try {
    // Guard against invalid inputs
    if (!email || typeof email !== "string" || email.trim() === "") {
      return {
        isValid: false,
        message: "Error validating guest registration uniqueness",
      };
    }

    const { GuestRegistration } = await import("../models");

    const query: any = {
      email: email.toLowerCase(),
      eventId: new mongoose.Types.ObjectId(eventId),
      status: "active",
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingRegistration = await GuestRegistration.findOne(query);

    if (existingRegistration) {
      return {
        isValid: false,
        message: "A guest with this email is already registered for this event",
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      message: "Error validating guest registration uniqueness",
    };
  }
};

/**
 * Enforce single-event access for guests
 * Ensures a guest email has at most one active guest registration across ALL events
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

    const query: any = {
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
  } catch (error) {
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
