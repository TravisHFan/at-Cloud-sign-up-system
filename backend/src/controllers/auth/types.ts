/**
 * Shared types and helpers for authentication controllers
 * Extracted from authController.ts
 */

import mongoose from "mongoose";

// Lightweight helpers to avoid `any` while preserving runtime behavior
export type LoggerLike = {
  error: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
};

export type UserDocLike = {
  _id: mongoose.Types.ObjectId | string;
  username?: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  role?: string;
  isAtCloudLeader?: boolean;
  isVerified?: boolean;
  roleInAtCloud?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  homeAddress?: string;
  churchAddress?: string;
  avatar?: string;
  lastLogin?: Date | string;
  isActive?: boolean;
  // account and security fields used in flows below
  emailVerificationToken?: string;
  emailVerificationExpires?: Date | string;
  password?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date | string;
  generateEmailVerificationToken: () => string;
  isAccountLocked?: () => boolean;
  comparePassword?: (pwd: string) => Promise<boolean>;
  incrementLoginAttempts?: () => Promise<void>;
  resetLoginAttempts?: () => Promise<void>;
  updateLastLogin?: () => Promise<void>;
  save: () => Promise<void>;
};

// Local helper to normalize IDs to string without using `any`
export const toIdString = (val: unknown): string => {
  if (typeof val === "string") return val;
  if (
    val &&
    typeof (val as { toString?: () => string }).toString === "function"
  ) {
    return (val as { toString: () => string }).toString();
  }
  return String(val ?? "");
};

// Interface for registration request (matches frontend signUpSchema)
export interface RegisterRequest {
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  homeAddress?: string;
  isAtCloudLeader: boolean;
  roleInAtCloud?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
  acceptTerms: boolean;
}

// Interface for login request
export interface LoginRequest {
  emailOrUsername: string;
  password: string;
  rememberMe?: boolean;
}
