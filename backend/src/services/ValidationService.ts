/**
 * Validation Service
 * Centralizes all validation logic
 * Follows Single Responsibility Principle
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidationService {
  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email) {
      errors.push("Email is required");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push("Invalid email format");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password) {
      errors.push("Password is required");
    } else {
      if (password.length < 6) {
        errors.push("Password must be at least 6 characters long");
      }
      if (password.length > 100) {
        errors.push("Password must be less than 100 characters");
      }
      // Add more password strength rules as needed
      // if (!/(?=.*[a-z])/.test(password)) {
      //   errors.push("Password must contain at least one lowercase letter");
      // }
      // if (!/(?=.*[A-Z])/.test(password)) {
      //   errors.push("Password must contain at least one uppercase letter");
      // }
      // if (!/(?=.*\d)/.test(password)) {
      //   errors.push("Password must contain at least one number");
      // }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate username
   */
  static validateUsername(username: string): ValidationResult {
    const errors: string[] = [];

    if (!username) {
      errors.push("Username is required");
    } else {
      if (username.length < 3) {
        errors.push("Username must be at least 3 characters long");
      }
      if (username.length > 30) {
        errors.push("Username must be less than 30 characters");
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        errors.push(
          "Username can only contain letters, numbers, dots, hyphens, and underscores"
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate name (first name, last name)
   */
  static validateName(name: string, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (!name) {
      errors.push(`${fieldName} is required`);
    } else {
      if (name.length < 1) {
        errors.push(`${fieldName} cannot be empty`);
      }
      if (name.length > 50) {
        errors.push(`${fieldName} must be less than 50 characters`);
      }
      if (!/^[a-zA-Z\s'-]+$/.test(name)) {
        errors.push(
          `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate MongoDB ObjectId
   */
  static validateObjectId(
    id: string,
    fieldName: string = "ID"
  ): ValidationResult {
    const errors: string[] = [];

    if (!id) {
      errors.push(`${fieldName} is required`);
    } else {
      // Simple MongoDB ObjectId validation (24 hex characters)
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        errors.push(`Invalid ${fieldName} format`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phone: string): ValidationResult {
    const errors: string[] = [];

    if (phone) {
      // Basic phone validation - can be enhanced based on requirements
      const phoneRegex = /^\+?[1-9]\d{0,15}$/;
      if (!phoneRegex.test(phone.replace(/[\s()-]/g, ""))) {
        errors.push("Invalid phone number format");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date
   */
  static validateDate(dateString: string, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (!dateString) {
      errors.push(`${fieldName} is required`);
    } else {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid ${fieldName} format`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(page: any, limit: any): ValidationResult {
    const errors: string[] = [];

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      errors.push("Page must be a positive integer");
    }

    if (isNaN(limitNum) || limitNum < 1) {
      errors.push("Limit must be a positive integer");
    }

    if (limitNum > 100) {
      errors.push("Limit cannot exceed 100");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate URL
   */
  static validateUrl(url: string, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (url) {
      try {
        new URL(url);
      } catch {
        errors.push(`Invalid ${fieldName} format`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate array of strings
   */
  static validateStringArray(
    arr: any,
    fieldName: string,
    required: boolean = false
  ): ValidationResult {
    const errors: string[] = [];

    if (required && (!arr || !Array.isArray(arr) || arr.length === 0)) {
      errors.push(`${fieldName} is required and must be a non-empty array`);
    } else if (arr && !Array.isArray(arr)) {
      errors.push(`${fieldName} must be an array`);
    } else if (arr && Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== "string") {
          errors.push(`${fieldName}[${i}] must be a string`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate user creation data
   */
  static validateUserCreation(userData: any): ValidationResult {
    const allErrors: string[] = [];

    // Validate required fields
    const emailValidation = this.validateEmail(userData.email);
    allErrors.push(...emailValidation.errors);

    const usernameValidation = this.validateUsername(userData.username);
    allErrors.push(...usernameValidation.errors);

    const passwordValidation = this.validatePassword(userData.password);
    allErrors.push(...passwordValidation.errors);

    // Validate optional fields
    if (userData.firstName) {
      const firstNameValidation = this.validateName(
        userData.firstName,
        "First name"
      );
      allErrors.push(...firstNameValidation.errors);
    }

    if (userData.lastName) {
      const lastNameValidation = this.validateName(
        userData.lastName,
        "Last name"
      );
      allErrors.push(...lastNameValidation.errors);
    }

    if (userData.phone) {
      const phoneValidation = this.validatePhoneNumber(userData.phone);
      allErrors.push(...phoneValidation.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Validate user update data
   */
  static validateUserUpdate(userData: any): ValidationResult {
    const allErrors: string[] = [];

    // Validate only provided fields
    if (userData.email !== undefined) {
      const emailValidation = this.validateEmail(userData.email);
      allErrors.push(...emailValidation.errors);
    }

    if (userData.username !== undefined) {
      const usernameValidation = this.validateUsername(userData.username);
      allErrors.push(...usernameValidation.errors);
    }

    if (userData.firstName !== undefined) {
      const firstNameValidation = this.validateName(
        userData.firstName,
        "First name"
      );
      allErrors.push(...firstNameValidation.errors);
    }

    if (userData.lastName !== undefined) {
      const lastNameValidation = this.validateName(
        userData.lastName,
        "Last name"
      );
      allErrors.push(...lastNameValidation.errors);
    }

    if (userData.phone !== undefined) {
      const phoneValidation = this.validatePhoneNumber(userData.phone);
      allErrors.push(...phoneValidation.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Validate event creation data
   */
  static validateEventCreation(eventData: any): ValidationResult {
    const allErrors: string[] = [];

    // Validate required fields
    if (!eventData.title) {
      allErrors.push("Event title is required");
    } else if (eventData.title.length > 200) {
      allErrors.push("Event title must be less than 200 characters");
    }

    if (!eventData.description) {
      allErrors.push("Event description is required");
    }

    const startDateValidation = this.validateDate(
      eventData.startDate,
      "Start date"
    );
    allErrors.push(...startDateValidation.errors);

    const endDateValidation = this.validateDate(eventData.endDate, "End date");
    allErrors.push(...endDateValidation.errors);

    // Validate date logic
    if (eventData.startDate && eventData.endDate) {
      const startDate = new Date(eventData.startDate);
      const endDate = new Date(eventData.endDate);
      if (endDate < startDate) {
        allErrors.push("End date cannot be before start date");
      }
    }

    if (eventData.capacity !== undefined) {
      const capacity = parseInt(eventData.capacity);
      if (isNaN(capacity) || capacity < 1) {
        allErrors.push("Capacity must be a positive integer");
      }
    }

    if (eventData.location && eventData.location.length > 500) {
      allErrors.push("Location must be less than 500 characters");
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Combine multiple validation results
   */
  static combineValidationResults(
    ...results: ValidationResult[]
  ): ValidationResult {
    const allErrors: string[] = [];

    for (const result of results) {
      allErrors.push(...result.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}
