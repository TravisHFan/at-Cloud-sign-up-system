import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  gender: "male" | "female" | "other";
  birthDate: Date;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  profileImage?: string;
  role: "user" | "admin" | "moderator";
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  isActive: boolean;
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      profileVisibility: "public" | "private" | "friends";
      showEmail: boolean;
      showPhone: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateVerificationToken(): string;
  generatePasswordResetToken(): string;
}

const userSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false, // Don't include password in queries by default
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: [true, "Gender is required"],
    },
    birthDate: {
      type: Date,
      required: [true, "Birth date is required"],
      validate: {
        validator: function (value: Date) {
          return value < new Date();
        },
        message: "Birth date must be in the past",
      },
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[\d\s-()]+$/, "Please enter a valid phone number"],
    },
    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
      },
      zipCode: {
        type: String,
        required: [true, "ZIP code is required"],
        trim: true,
      },
      country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
        default: "United States",
      },
    },
    profileImage: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
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
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
      privacy: {
        profileVisibility: {
          type: String,
          enum: ["public", "private", "friends"],
          default: "public",
        },
        showEmail: {
          type: Boolean,
          default: false,
        },
        showPhone: {
          type: Boolean,
          default: false,
        },
      },
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

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
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
userSchema.methods.generateVerificationToken = function (): string {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function (): string {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return token;
};

export default mongoose.model<IUser>("User", userSchema);
