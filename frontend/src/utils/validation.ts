import * as yup from "yup";
import type { AtCloudLeaderStatus, Gender } from "../types";

// Common validation patterns
export const commonValidations = {
  // User fields
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .matches(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),

  firstName: yup
    .string()
    .required("First name is required")
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),

  lastName: yup
    .string()
    .required("Last name is required")
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),

  email: yup
    .string()
    .email("Please enter a valid email address")
    .required("Email is required")
    .max(100, "Email must not exceed 100 characters"),

  phone: yup
    .string()
    .notRequired()
    .matches(/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"),

  gender: yup
    .string()
    .required("Gender is required")
    .oneOf(["male", "female"] as Gender[], "Please select a valid gender"),

  // Password validations
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[0-9]/, "Password must contain at least one number")
    .matches(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),

  confirmPassword: (passwordField = "password") =>
    yup
      .string()
      .required("Please confirm your password")
      .oneOf([yup.ref(passwordField)], "Passwords must match"),

  currentPassword: yup.string().required("Current password is required"),

  // Role validations
  isAtCloudLeader: yup
    .string()
    .required("Please specify if you are an @Cloud Leader")
    .oneOf(["Yes", "No"] as AtCloudLeaderStatus[], "Please select Yes or No"),

  roleInAtCloud: yup.string().when("isAtCloudLeader", {
    is: "Yes",
    then: (schema) =>
      schema.required(
        "Role in @Cloud is required when you are an @Cloud Leader"
      ),
    otherwise: (schema) => schema.notRequired(),
  }),

  // Optional text fields
  homeAddress: yup
    .string()
    .notRequired()
    .max(200, "Home address must not exceed 200 characters"),

  company: yup
    .string()
    .notRequired()
    .max(100, "Company name must not exceed 100 characters"),

  // Event fields
  eventTitle: yup
    .string()
    .required("Event title is required")
    .min(3, "Event title must be at least 3 characters")
    .max(100, "Event title must not exceed 100 characters"),

  eventDescription: yup
    .string()
    .required("Event description is required")
    .min(10, "Event description must be at least 10 characters")
    .max(1000, "Event description must not exceed 1000 characters"),

  eventDate: yup.string().required("Event date is required"),

  eventTime: yup.string().required("Event time is required"),

  eventLocation: yup
    .string()
    .required("Event location is required")
    .max(200, "Event location must not exceed 200 characters"),

  maxParticipants: yup
    .number()
    .required("Maximum participants is required")
    .positive("Maximum participants must be a positive number")
    .integer("Maximum participants must be a whole number")
    .max(1000, "Maximum participants cannot exceed 1000"),
};

// Pre-built schemas for common forms
export const loginSchema = yup.object({
  username: commonValidations.username,
  password: yup.string().required("Password is required"), // Less strict for login
  rememberMe: yup.boolean().notRequired(),
});

export const signUpSchema = yup.object({
  username: commonValidations.username,
  firstName: commonValidations.firstName,
  lastName: commonValidations.lastName,
  email: commonValidations.email,
  password: commonValidations.password,
  confirmPassword: commonValidations.confirmPassword("password"),
  gender: commonValidations.gender,
  phone: commonValidations.phone,
  isAtCloudLeader: commonValidations.isAtCloudLeader,
  roleInAtCloud: commonValidations.roleInAtCloud,
  homeAddress: commonValidations.homeAddress,
  company: commonValidations.company,
});

export const profileSchema = yup.object({
  username: commonValidations.username,
  firstName: commonValidations.firstName,
  lastName: commonValidations.lastName,
  email: commonValidations.email,
  gender: commonValidations.gender,
  phone: commonValidations.phone,
  isAtCloudLeader: commonValidations.isAtCloudLeader,
  roleInAtCloud: commonValidations.roleInAtCloud,
  homeAddress: commonValidations.homeAddress,
  company: commonValidations.company,
});

export const changePasswordSchema = yup.object({
  currentPassword: commonValidations.currentPassword,
  newPassword: commonValidations.password,
  confirmPassword: commonValidations.confirmPassword("newPassword"),
});

export const eventSchema = yup.object({
  title: commonValidations.eventTitle,
  description: commonValidations.eventDescription,
  date: commonValidations.eventDate,
  time: commonValidations.eventTime,
  location: commonValidations.eventLocation,
  maxParticipants: commonValidations.maxParticipants,
  organizer: yup.string().required("Organizer is required"),
});

// Validation utilities
export const validateField = async (
  fieldName: string,
  value: any,
  schema: yup.ObjectSchema<any>
): Promise<{ isValid: boolean; error?: string }> => {
  try {
    await schema.validateAt(fieldName, { [fieldName]: value });
    return { isValid: true };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return { isValid: false, error: error.message };
    }
    return { isValid: false, error: "Validation failed" };
  }
};

export const validateForm = async (
  data: any,
  schema: yup.ObjectSchema<any>
): Promise<{ isValid: boolean; errors?: Record<string, string> }> => {
  try {
    await schema.validate(data, { abortEarly: false });
    return { isValid: true };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      const errors: Record<string, string> = {};
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message;
        }
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { form: "Validation failed" } };
  }
};
