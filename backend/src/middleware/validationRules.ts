import { body, param, query, ValidationChain } from "express-validator";

export class ValidationRules {
  // User validation rules
  static userRegistration(): ValidationChain[] {
    return [
      body("username")
        .isLength({ min: 3, max: 20 })
        .withMessage("Username must be between 3 and 20 characters")
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage(
          "Username can only contain letters, numbers, and underscores"
        ),

      body("email").isEmail().withMessage("Please provide a valid email"),

      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]/)
        .withMessage(
          "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),

      body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),

      body("firstName")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("First name must be between 1 and 50 characters"),

      body("lastName")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("Last name must be between 1 and 50 characters"),

      body("gender")
        .optional()
        .isIn(["male", "female"])
        .withMessage("Gender must be either 'male' or 'female'"),

      body("isAtCloudLeader")
        .isBoolean()
        .withMessage("isAtCloudLeader must be a boolean"),

      body("roleInAtCloud")
        .if(body("isAtCloudLeader").equals("true"))
        .notEmpty()
        .withMessage(
          "Role in @Cloud is required when user is an @Cloud co-worker"
        ),

      body("phone")
        .optional()
        .isMobilePhone("any")
        .withMessage("Please provide a valid phone number"),

      body("acceptTerms")
        .equals("true")
        .withMessage("You must accept the terms and conditions"),
    ];
  }

  static userLogin(): ValidationChain[] {
    return [
      body("emailOrUsername")
        .notEmpty()
        .withMessage("Email or username is required"),

      body("password").notEmpty().withMessage("Password is required"),

      body("rememberMe")
        .optional()
        .isBoolean()
        .withMessage("Remember me must be a boolean"),
    ];
  }

  static userProfileUpdate(): ValidationChain[] {
    return [
      body("username")
        .optional()
        .isLength({ min: 3, max: 20 })
        .withMessage("Username must be between 3 and 20 characters"),

      body("email")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid email"),

      body("firstName")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("First name must be between 1 and 50 characters"),

      body("lastName")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("Last name must be between 1 and 50 characters"),

      body("gender")
        .optional()
        .isIn(["male", "female"])
        .withMessage("Gender must be either 'male' or 'female'"),

      body("phone")
        .optional()
        .isMobilePhone("any")
        .withMessage("Please provide a valid phone number"),
    ];
  }

  // Event validation rules
  static eventCreation(): ValidationChain[] {
    return [
      body("title")
        .isLength({ min: 5, max: 100 })
        .withMessage("Event title must be between 5 and 100 characters"),

      body("type").notEmpty().withMessage("Event type is required"),

      body("date")
        .isDate()
        .withMessage("Please provide a valid date")
        .custom((value) => {
          const eventDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (eventDate < today) {
            throw new Error("Event date cannot be in the past");
          }
          return true;
        }),

      body("time")
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage("Please provide a valid time in HH:MM format"),

      body("endTime")
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage("Please provide a valid end time in HH:MM format")
        .custom((value, { req }) => {
          const startTime: string | undefined = req.body.time;
          const startDate: string | undefined = req.body.date;
          const endDate: string | undefined = req.body.endDate || req.body.date;
          // Only enforce time ordering when start and end are on the same date
          const sameDay = !!startDate && !!endDate && startDate === endDate;
          if (sameDay && startTime && value <= startTime) {
            throw new Error("End time must be after start time");
          }
          return true;
        }),

      body("location")
        .isLength({ min: 5, max: 200 })
        .withMessage("Location must be between 5 and 200 characters"),

      body("organizer")
        .isLength({ min: 2, max: 100 })
        .withMessage("Organizer name must be between 2 and 100 characters"),

      body("purpose")
        .isLength({ min: 10, max: 1000 })
        .withMessage("Purpose must be between 10 and 1000 characters"),

      body("format").notEmpty().withMessage("Event format is required"),

      body("roles")
        .isArray({ min: 1 })
        .withMessage("At least one role is required"),

      body("roles.*.name")
        .isLength({ min: 2, max: 50 })
        .withMessage("Role name must be between 2 and 50 characters"),

      body("roles.*.description")
        .isLength({ min: 5, max: 200 })
        .withMessage("Role description must be between 5 and 200 characters"),

      body("roles.*.maxParticipants")
        .isInt({ min: 1, max: 100 })
        .withMessage("Max participants must be between 1 and 100"),
    ];
  }

  // Common validation rules
  static mongoId(): ValidationChain[] {
    return [param("id").isMongoId().withMessage("Please provide a valid ID")];
  }

  static pagination(): ValidationChain[] {
    return [
      query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

      query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    ];
  }

  static search(): ValidationChain[] {
    return [
      query("q")
        .isLength({ min: 1, max: 100 })
        .withMessage("Search query must be between 1 and 100 characters"),
    ];
  }
}

export default ValidationRules;
