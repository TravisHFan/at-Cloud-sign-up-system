import { body, param, query, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

// Middleware to handle validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
    return;
  }
  next();
};

// User validation rules
export const validateUserRegistration = [
  body("username")
    .isLength({ min: 3, max: 20 })
    .withMessage("Username must be between 3 and 20 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("firstName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name is required and must be less than 50 characters"),

  body("lastName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name is required and must be less than 50 characters"),

  body("gender")
    .isIn(["male", "female"])
    .withMessage("Gender must be either 'male' or 'female'"),

  body("isAtCloudLeader")
    .isBoolean()
    .withMessage("isAtCloudLeader must be a boolean value"),

  body("roleInAtCloud")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Role in @Cloud must be less than 100 characters"),

  handleValidationErrors,
];

export const validateUserLogin = [
  body("emailOrUsername")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username or email is required"),

  body("password").isLength({ min: 1 }).withMessage("Password is required"),

  handleValidationErrors,
];

export const validateUserUpdate = [
  body("firstName")
    .optional()
    .trim()
    .custom((value) => {
      if (value === "") return true; // Allow empty string
      if (value.length < 1 || value.length > 50) {
        throw new Error("First name must be between 1 and 50 characters");
      }
      return true;
    }),

  body("lastName")
    .optional()
    .trim()
    .custom((value) => {
      if (value === "") return true; // Allow empty string
      if (value.length < 1 || value.length > 50) {
        throw new Error("Last name must be between 1 and 50 characters");
      }
      return true;
    }),

  // Remove email validation for profile updates - email changes should be handled separately

  body("phone")
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value === "") return true; // Allow empty string
      // More flexible phone validation - allow various formats
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, "");
      if (!/^\d{7,15}$/.test(cleanPhone)) {
        throw new Error("Please provide a valid phone number");
      }
      return true;
    }),

  body("gender")
    .optional()
    .custom((value) => {
      if (!value || value === "") return true; // Allow empty string
      if (!["male", "female"].includes(value)) {
        throw new Error("Gender must be either 'male' or 'female'");
      }
      return true;
    }),

  // Add validation for other profile fields
  body("occupation")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Occupation must be less than 100 characters"),

  body("company")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company must be less than 100 characters"),

  body("weeklyChurch")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Weekly church must be less than 100 characters"),

  body("roleInAtCloud")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Role in @Cloud must be less than 100 characters"),

  body("isAtCloudLeader")
    .optional()
    .isBoolean()
    .withMessage("isAtCloudLeader must be a boolean value"),

  body("emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("emailNotifications must be a boolean value"),

  body("smsNotifications")
    .optional()
    .isBoolean()
    .withMessage("smsNotifications must be a boolean value"),

  body("pushNotifications")
    .optional()
    .isBoolean()
    .withMessage("pushNotifications must be a boolean value"),

  handleValidationErrors,
];

// Event validation rules
export const validateEventCreation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Event title must be between 3 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),

  body("date").isISO8601().toDate().withMessage("Please provide a valid date"),

  body("time")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Time must be in HH:MM format"),

  body("location")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Location must be between 3 and 200 characters"),

  body("type")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Event type is required"),

  body("format")
    .isIn(["In-person", "Online", "Hybrid Participation"])
    .withMessage(
      "Format must be 'In-person', 'Online', or 'Hybrid Participation'"
    ),

  body("roles")
    .isArray({ min: 1 })
    .withMessage("Event must have at least one role"),

  body("roles.*.name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Role name must be between 2 and 100 characters"),

  body("roles.*.maxParticipants")
    .isInt({ min: 1, max: 100 })
    .withMessage("Max participants must be between 1 and 100"),

  handleValidationErrors,
];

// Search validation rules
export const validateSearch = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

// Parameter validation rules
export const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid ID format"),

  handleValidationErrors,
];

// Message validation rules
export const validateMessage = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Message content must be between 1 and 10000 characters"),

  body("receiverId").optional().isMongoId().withMessage("Invalid receiver ID"),

  handleValidationErrors,
];

// Notification validation rules
export const validateNotification = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Notification title must be between 1 and 200 characters"),

  body("message")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Notification message must be between 1 and 1000 characters"),

  body("type")
    .isIn(["email", "sms", "push", "in-app"])
    .withMessage("Type must be 'email', 'sms', 'push', or 'in-app'"),

  body("category")
    .isIn([
      "registration",
      "reminder",
      "cancellation",
      "update",
      "system",
      "marketing",
    ])
    .withMessage("Category must be valid notification category"),

  handleValidationErrors,
];

// Password reset validation
export const validateForgotPassword = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

export const validateResetPassword = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),
];

// Alias for handleValidationErrors
export const validateError = handleValidationErrors;
