/**
 * Core type definitions for the @Cloud Event Sign-up System
 * This file centralizes all shared types to ensure consistency across the application
 */

// Base User Types
export type SystemAuthorizationLevel =
  | "Super Admin"
  | "Administrator"
  | "Leader"
  | "Participant";
export type AtCloudLeaderStatus = "Yes" | "No";
export type Gender = "male" | "female";

// Core User Interface (for authentication and profile)
export interface User {
  id: string; // UUID from backend
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender: Gender;
  avatar?: string | null;

  // Role Information
  role: SystemAuthorizationLevel; // System-level authorization level
  isAtCloudLeader: AtCloudLeaderStatus;
  roleInAtCloud?: string; // Only present if isAtCloudLeader is "Yes"

  // Profile Information
  homeAddress?: string;
  occupation?: string; // User's profession or occupation
  company?: string;
  weeklyChurch?: string; // Which church do you attend weekly?
  churchAddress?: string; // Church's full address

  // System Information
  joinDate?: string;
  lastLogin?: string;
}

// Authentication User (minimal subset for auth context)
export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: SystemAuthorizationLevel;
  isAtCloudLeader: AtCloudLeaderStatus;
  roleInAtCloud?: string;
  gender: Gender;
  avatar?: string | null;
  weeklyChurch?: string;
  churchAddress?: string;
  occupation?: string;
}

// Event Organizer (for event management)
export interface EventOrganizer {
  id: string; // User ID
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: SystemAuthorizationLevel;
  roleInAtCloud?: string;
  gender: Gender;
  avatar: string | null;
}

// Form Data Types
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpFormData {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
  phone?: string;
  isAtCloudLeader: AtCloudLeaderStatus;
  roleInAtCloud?: string;
  homeAddress?: string;
  company?: string;
}

export interface ProfileFormData {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender;
  phone?: string;
  isAtCloudLeader: AtCloudLeaderStatus;
  roleInAtCloud?: string;
  homeAddress?: string;
  company?: string;
}

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Event Types
export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer: string; // Display string
  organizerDetails: EventOrganizer[];
  maxParticipants: number;
  currentParticipants: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  category: string;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, any>;
}

// UI State Types
export interface LoadingState {
  isLoading: boolean;
  error?: AppError | null;
}

export interface FormState<T = any> extends LoadingState {
  data: T;
  isDirty: boolean;
  isSubmitting: boolean;
}

// Navigation Types
export interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  requiresAuth?: boolean;
  allowedRoles?: SystemAuthorizationLevel[];
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Constants
export const SYSTEM_AUTHORIZATION_LEVELS: SystemAuthorizationLevel[] = [
  "Super Admin",
  "Administrator",
  "Leader",
  "Participant",
];
export const AT_CLOUD_LEADER_OPTIONS: AtCloudLeaderStatus[] = ["Yes", "No"];
export const GENDER_OPTIONS: Gender[] = ["male", "female"];
