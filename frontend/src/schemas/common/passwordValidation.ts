import * as yup from "yup";

/**
 * Centralized Password Validation
 * Used by all password-related forms: signup, change password, reset password
 * Ensures consistent validation logic and user experience across the application
 */

// Standard password validation - matches signup page requirements (special char optional)
export const passwordValidation = {
  // Primary password field (for signup, reset, new password)
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  // New password field (for change password, reset password)
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  // Current password (for change password)
  currentPassword: yup.string().required("Current password is required"),

  // Confirm password with dynamic field reference
  confirmPassword: (refField: string = "password") =>
    yup
      .string()
      .required("Please confirm your password")
      .oneOf([yup.ref(refField)], "Passwords must match"),
};

/**
 * Password Requirements for UI Display
 * Used by PasswordRequirements component across all forms
 */
export const passwordRequirements = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password: string) => password.length >= 8,
    required: true,
  },
  {
    id: "lowercase",
    label: "Contains lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
    required: true,
  },
  {
    id: "uppercase",
    label: "Contains uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
    required: true,
  },
  {
    id: "number",
    label: "Contains number",
    test: (password: string) => /\d/.test(password),
    required: true,
  },
  {
    id: "special",
    label: "Contains special character (@$!%*?&) - recommended",
    test: (password: string) => /[@$!%*?&]/.test(password),
    required: false,
  },
];

/**
 * Helper function to validate password requirements
 * Returns array of met/unmet requirements for UI display
 */
export const getPasswordRequirementStatus = (password: string) => {
  return passwordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
};
