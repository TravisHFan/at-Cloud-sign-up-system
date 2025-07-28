import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ROLES, UserRole, RoleUtils } from "../utils/roleUtils";

export interface IUser extends Document {
  // Basic Authentication
  username: string;
  email: string;
  phone?: string;
  password: string;

  // Profile Information (matches frontend signUpSchema)
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  avatar?: string;

  // Address Information
  homeAddress?: string;

  // @Cloud Ministry Specific Fields
  isAtCloudLeader: boolean;
  roleInAtCloud?: string; // Required if isAtCloudLeader is true

  // Professional Information
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;

  // System Authorization (matches frontend role system)
  role: UserRole; // "Super Admin" | "Administrator" | "Leader" | "Participant"

  // Account Status
  isActive: boolean;
  isVerified: boolean;
  emailNotifications: boolean;

  // Verification & Security
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Login Tracking
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  hasReceivedWelcomeMessage: boolean; // Track if user has received welcome message

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isAccountLocked(): boolean;
  canChangeRole(newRole: UserRole, changedBy: IUser): boolean;
  getFullName(): string;
  getDisplayName(): string;
  updateLastLogin(): Promise<void>;
}

const userSchema: Schema = new Schema(
  {
    // Basic Authentication
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, underscores, and hyphens",
      ],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
      validate: {
        validator: function (value: string) {
          if (!value || value === "") return true; // Allow empty string
          // More flexible phone validation - allow various formats
          const cleanPhone = value.replace(/[\s\-\(\)\+]/g, "");
          return /^\d{7,15}$/.test(cleanPhone);
        },
        message: "Please provide a valid phone number",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false, // Don't include password in queries by default
      validate: {
        validator: function (password: string) {
          // Password must contain at least one uppercase, one lowercase, one number
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      },
    },

    // Profile Information
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    avatar: {
      type: String,
      default: "/default-avatar-male.jpg", // Default fallback
    },

    // @Cloud Ministry Specific Fields
    isAtCloudLeader: {
      type: Boolean,
      default: false,
    },
    roleInAtCloud: {
      type: String,
      trim: true,
      maxlength: [100, "Role in @Cloud cannot exceed 100 characters"],
      validate: {
        validator: function (value: string) {
          // roleInAtCloud is required if isAtCloudLeader is true
          if (this.isAtCloudLeader && !value) {
            return false;
          }
          return true;
        },
        message: "Role in @Cloud is required for @Cloud leaders",
      },
    },

    // Professional Information
    occupation: {
      type: String,
      trim: true,
      maxlength: [100, "Occupation cannot exceed 100 characters"],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    weeklyChurch: {
      type: String,
      trim: true,
      maxlength: [100, "Weekly church cannot exceed 100 characters"],
    },
    churchAddress: {
      type: String,
      trim: true,
      maxlength: [200, "Church address cannot exceed 200 characters"],
    },

    // Address Information
    homeAddress: {
      type: String,
      trim: true,
      maxlength: [200, "Home address cannot exceed 200 characters"],
    },

    // System Authorization
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.PARTICIPANT,
      required: [true, "User role is required"],
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailNotifications: {
      type: Boolean,
      default: true, // Users opt-in to email notifications by default
    },

    // Verification & Security
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // Login Tracking
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    hasReceivedWelcomeMessage: {
      type: Boolean,
      default: false, // New users haven't received welcome message yet
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).password;
        delete (ret as any).emailVerificationToken;
        delete (ret as any).emailVerificationExpires;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetExpires;
        return ret;
      },
    },
  }
);

// Indexes for performance (email and username already have unique indexes from schema)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ emailNotifications: 1 });
userSchema.index({ isAtCloudLeader: 1 });
userSchema.index({ createdAt: -1 });

// Compound indexes
userSchema.index({ isActive: 1, isVerified: 1 });
userSchema.index({ isActive: 1, isVerified: 1, emailNotifications: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isAtCloudLeader: 1, role: 1 });

// Text search index
userSchema.index({
  username: "text",
  firstName: "text",
  lastName: "text",
  email: "text",
  occupation: "text",
  company: "text",
});

// Virtual for account locked status
userSchema.virtual("isLocked").get(function (this: IUser) {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre<IUser>("save", async function (next) {
  // Only hash password if it's modified
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save middleware for @Cloud leader validation
userSchema.pre<IUser>("save", function (next) {
  // If user is not an @Cloud leader, clear the roleInAtCloud field
  if (!this.isAtCloudLeader) {
    this.roleInAtCloud = undefined;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return resetToken;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return resetToken;
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  });
};

// Check if account is locked
userSchema.methods.isAccountLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Check if user can change role
userSchema.methods.canChangeRole = function (
  newRole: UserRole,
  changedBy: IUser
): boolean {
  return RoleUtils.canPromoteUser(changedBy.role, this.role, newRole);
};

// Get full name
userSchema.methods.getFullName = function (): string {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  } else if (this.firstName) {
    return this.firstName;
  } else if (this.lastName) {
    return this.lastName;
  }
  return this.username;
};

// Get display name for UI
userSchema.methods.getDisplayName = function (): string {
  const fullName = this.getFullName();
  return fullName !== this.username ? fullName : `@${this.username}`;
};

// Update last login
userSchema.methods.updateLastLogin = async function (): Promise<void> {
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function (identifier: string) {
  return this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    isActive: true,
  });
};

// Legacy notification methods removed - now using unified Message system
// All notification functionality moved to UnifiedMessageController

// Legacy system message methods removed - now using unified Message system
// All system message functionality moved to UnifiedMessageController

// Get unread notification counts - Unified Message System
userSchema.methods.getUnreadCounts = function (): {
  total: number;
} {
  // Note: Unread counts are now managed by the unified Message system
  // Use UnifiedMessageController.getUnreadCounts() instead
  return {
    total: 0, // Deprecated - use Message.getUnreadCountsForUser()
  };
};

// Clean up expired notifications - Unified Message System
userSchema.methods.cleanupExpiredItems = function (): {
  removedNotifications: number;
  removedMessages: number;
} {
  // Note: Expiration is now managed by the unified Message system
  // Expired messages are automatically handled by TTL indexes
  return { removedNotifications: 0, removedMessages: 0 };
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function (identifier: string) {
  return this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    isActive: true,
  });
};

// Static method to get user statistics
userSchema.statics.getUserStats = async function () {
  const pipeline = [
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
        },
        verifiedCount: {
          $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
        },
        atCloudLeaderCount: {
          $sum: { $cond: [{ $eq: ["$isAtCloudLeader", true] }, 1, 0] },
        },
      },
    },
  ];

  const stats = await this.aggregate(pipeline);

  return {
    totalUsers: stats.reduce((sum, stat) => sum + stat.count, 0),
    activeUsers: stats.reduce((sum, stat) => sum + stat.activeCount, 0),
    verifiedUsers: stats.reduce((sum, stat) => sum + stat.verifiedCount, 0),
    atCloudLeaders: stats.reduce(
      (sum, stat) => sum + stat.atCloudLeaderCount,
      0
    ),
    roleDistribution: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>),
  };
};

export default mongoose.model<IUser>("User", userSchema);
