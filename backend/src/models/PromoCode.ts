import mongoose, { Schema, Document, Model } from "mongoose";

// Instance methods interface
interface IPromoCodeMethods {
  canBeUsedForProgram(programId: string | mongoose.Types.ObjectId): {
    valid: boolean;
    reason?: string;
  };
  markAsUsed(
    programId: mongoose.Types.ObjectId,
    userId?: mongoose.Types.ObjectId,
    userName?: string,
    userEmail?: string,
    programTitle?: string
  ): Promise<IPromoCode>;
  deactivate(): Promise<IPromoCode>;
  reactivate(): Promise<IPromoCode>;
}

// Static methods interface
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface IPromoCodeModel extends Model<IPromoCode, {}, IPromoCodeMethods> {
  generateUniqueCode(): Promise<string>;
  findValidCodesForUser(
    userId: mongoose.Types.ObjectId | string,
    programId?: mongoose.Types.ObjectId | string
  ): Promise<IPromoCode[]>;
}

export interface IPromoCode extends Document, IPromoCodeMethods {
  // Core identification
  code: string; // "X8K9P2L4" - 8 character unique code
  type: "bundle_discount" | "staff_access" | "reward";

  // Discount configuration
  discountAmount?: number; // For bundle_discount: dollar amount (e.g., 50 for $50 off)
  discountPercent?: number; // For staff_access/reward: typically 100 for staff, 10-100 for reward

  // General code fields (for staff codes not tied to a specific user)
  isGeneral?: boolean; // True for general staff codes (no owner, all programs, unlimited uses)
  description?: string; // Description for general codes (required if isGeneral)

  // Ownership & restrictions
  ownerId?: mongoose.Types.ObjectId; // User who owns/can use this code (optional for general codes)
  allowedProgramIds?: mongoose.Types.ObjectId[]; // For staff_access: specific programs (empty = all programs)
  excludedProgramId?: mongoose.Types.ObjectId; // For bundle_discount: can't use on the program that generated this code

  // Status tracking
  isActive: boolean; // Can this code be used? (admin can deactivate)
  isUsed: boolean; // Has this code been redeemed?
  expiresAt?: Date; // When this code expires (optional, no expiry if null)

  // Usage tracking
  usedAt?: Date; // When the code was actually used (deprecated for general codes, use usageHistory)
  usedForProgramId?: mongoose.Types.ObjectId; // Which program it was used for (deprecated for general codes)
  usageHistory?: Array<{
    userId: mongoose.Types.ObjectId;
    userName: string;
    userEmail: string;
    usedAt: Date;
    programId?: mongoose.Types.ObjectId;
    programTitle?: string;
  }>; // For general staff codes: track all users who used this code

  // Metadata
  createdAt: Date;
  createdBy: string; // "system" for auto-generated bundle codes, or admin user ID for staff codes
  updatedAt: Date;

  // Virtual fields
  isExpired: boolean;
  isValid: boolean;
}

const promoCodeSchema = new Schema<
  IPromoCode,
  IPromoCodeModel,
  IPromoCodeMethods
>(
  {
    code: {
      type: String,
      required: [true, "Promo code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [8, "Promo code must be exactly 8 characters"],
      maxlength: [8, "Promo code must be exactly 8 characters"],
      match: [
        /^[A-Z0-9]{8}$/,
        "Promo code must be 8 uppercase alphanumeric characters",
      ],
      index: true, // Primary lookup field
    },
    type: {
      type: String,
      required: [true, "Promo code type is required"],
      enum: {
        values: ["bundle_discount", "staff_access", "reward"],
        message: "Type must be bundle_discount, staff_access, or reward",
      },
      index: true,
    },
    discountAmount: {
      type: Number,
      min: [1, "Discount amount must be at least 1 cent"],
      max: [50000, "Discount amount cannot exceed $500.00"], // In cents: $500.00 = 50000 cents
      validate: {
        validator: function (this: IPromoCode, value: number | undefined) {
          // For bundle_discount, discountAmount is required
          if (this.type === "bundle_discount") {
            return value !== undefined && value > 0;
          }
          return true;
        },
        message: "Bundle discount codes must have a discountAmount",
      },
    },
    discountPercent: {
      type: Number,
      min: [0, "Discount percent must be between 0 and 100"],
      max: [100, "Discount percent must be between 0 and 100"],
      validate: {
        validator: function (this: IPromoCode, value: number | undefined) {
          // For staff_access and reward, discountPercent is required
          if (this.type === "staff_access" || this.type === "reward") {
            return value !== undefined && value >= 0 && value <= 100;
          }
          return true;
        },
        message: "Staff access and reward codes must have a discountPercent",
      },
    },
    isGeneral: {
      type: Boolean,
      default: false,
      index: true, // For filtering general codes
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      validate: {
        validator: function (this: IPromoCode, value: string | undefined) {
          // Description is required for general codes
          if (this.isGeneral) {
            return value !== undefined && value.length > 0;
          }
          return true;
        },
        message: "Description is required for general codes",
      },
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function (this: IPromoCode) {
        // ownerId is required for personal codes, but not for general codes
        return !this.isGeneral;
      },
      index: true, // Frequently query codes by owner
    },
    allowedProgramIds: {
      type: [Schema.Types.ObjectId],
      ref: "Program",
      default: undefined, // undefined means all programs allowed
      validate: {
        validator: function (
          this: IPromoCode,
          value: mongoose.Types.ObjectId[] | undefined
        ) {
          // Only staff_access and reward codes can have allowedProgramIds
          if (value !== undefined && value.length > 0) {
            return this.type === "staff_access" || this.type === "reward";
          }
          return true;
        },
        message:
          "Only staff_access and reward codes can specify allowedProgramIds",
      },
    },
    excludedProgramId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      validate: {
        validator: function (
          this: IPromoCode,
          value: mongoose.Types.ObjectId | undefined
        ) {
          // Only bundle_discount codes can have excludedProgramId
          if (value !== undefined) {
            return this.type === "bundle_discount";
          }
          return true;
        },
        message: "Only bundle_discount codes can have excludedProgramId",
      },
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true, // Frequently filter by active status
    },
    isUsed: {
      type: Boolean,
      required: true,
      default: false,
      index: true, // Frequently filter by used status
    },
    expiresAt: {
      type: Date,
      index: true, // Used for cleanup jobs and expiry queries
      validate: {
        validator: function (value: Date | undefined) {
          // If expiresAt is set, it must be in the future at creation time
          if (value !== undefined && this.isNew) {
            return value > new Date();
          }
          return true;
        },
        message: "Expiration date must be in the future",
      },
    },
    usedAt: {
      type: Date,
      validate: {
        validator: function (this: IPromoCode, value: Date | undefined) {
          // usedAt should only be set if isUsed is true
          if (value !== undefined) {
            return this.isUsed === true;
          }
          return true;
        },
        message: "usedAt can only be set when isUsed is true",
      },
    },
    usedForProgramId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      validate: {
        validator: function (
          this: IPromoCode,
          value: mongoose.Types.ObjectId | undefined
        ) {
          // usedForProgramId should only be set if isUsed is true
          if (value !== undefined) {
            return this.isUsed === true;
          }
          return true;
        },
        message: "usedForProgramId can only be set when isUsed is true",
      },
    },
    usageHistory: {
      type: [
        {
          userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          userName: {
            type: String,
            required: true,
            trim: true,
          },
          userEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
          },
          usedAt: {
            type: Date,
            required: true,
            default: Date.now,
          },
          programId: {
            type: Schema.Types.ObjectId,
            ref: "Program",
          },
          programTitle: {
            type: String,
            trim: true,
          },
        },
      ],
      default: [],
      validate: {
        validator: function (this: IPromoCode) {
          // Only general staff codes should have usage history
          if (this.usageHistory && this.usageHistory.length > 0) {
            return this.isGeneral === true;
          }
          return true;
        },
        message: "Only general staff codes can have usage history",
      },
    },
    createdBy: {
      type: String,
      required: [true, "createdBy is required"],
      trim: true,
      maxlength: [100, "createdBy cannot exceed 100 characters"],
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    toJSON: { virtuals: true }, // Include virtual fields in JSON responses
    toObject: { virtuals: true }, // Include virtual fields when converting to plain object
  }
);

// ==================== INDEXES ====================

// Compound index for fast user queries (most common query pattern)
// Usage: Find all active, unused codes for a specific user
promoCodeSchema.index({ ownerId: 1, isActive: 1, isUsed: 1 });

// Compound index for filtering by type and status
// Usage: Admin view - show all active bundle codes
promoCodeSchema.index({ type: 1, isActive: 1 });

// Compound index for expiry cleanup jobs
// Usage: Find all expired codes for batch processing
promoCodeSchema.index({ expiresAt: 1, isUsed: 1 });

// ==================== VIRTUAL FIELDS ====================

// Check if code is expired (virtual field for convenience)
promoCodeSchema.virtual("isExpired").get(function (this: IPromoCode) {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

// Check if code is valid (not used, active, and not expired)
promoCodeSchema.virtual("isValid").get(function (this: IPromoCode) {
  if (this.isUsed || !this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
});

// ==================== INSTANCE METHODS ====================

// Validate if code can be used for a specific program
promoCodeSchema.methods.canBeUsedForProgram = function (
  this: IPromoCode,
  programId: string | mongoose.Types.ObjectId
): { valid: boolean; reason?: string } {
  const programIdStr = programId.toString();

  // Check if already used (skip for general codes - they can be reused)
  if (this.isUsed && !this.isGeneral) {
    return { valid: false, reason: "Code has already been used" };
  }

  // Check if active
  if (!this.isActive) {
    return { valid: false, reason: "Code is no longer active" };
  }

  // Check if expired
  if (this.expiresAt && this.expiresAt < new Date()) {
    return { valid: false, reason: "Code has expired" };
  }

  // Bundle discount specific validation
  if (this.type === "bundle_discount") {
    if (
      this.excludedProgramId &&
      this.excludedProgramId.toString() === programIdStr
    ) {
      return {
        valid: false,
        reason: "Cannot use bundle code on the program that generated it",
      };
    }
  }

  // Staff access specific validation
  if (this.type === "staff_access") {
    // If allowedProgramIds is specified (not empty), check if program is in the list
    if (this.allowedProgramIds && this.allowedProgramIds.length > 0) {
      const isAllowed = this.allowedProgramIds.some(
        (id) => id.toString() === programIdStr
      );
      if (!isAllowed) {
        return { valid: false, reason: "Code is not valid for this program" };
      }
    }
    // If allowedProgramIds is empty or undefined, code is valid for all programs
  }

  return { valid: true };
};

// Mark code as used
promoCodeSchema.methods.markAsUsed = async function (
  this: IPromoCode,
  programId: mongoose.Types.ObjectId,
  userId?: mongoose.Types.ObjectId,
  userName?: string,
  userEmail?: string,
  programTitle?: string
): Promise<IPromoCode> {
  if (this.isGeneral) {
    // For general codes: append to usage history instead of marking as used
    if (!userId || !userName || !userEmail) {
      throw new Error(
        "User information (userId, userName, userEmail) is required for general code usage tracking"
      );
    }

    if (!this.usageHistory) {
      this.usageHistory = [];
    }

    this.usageHistory.push({
      userId,
      userName,
      userEmail,
      usedAt: new Date(),
      programId,
      programTitle,
    });
  } else {
    // For personal codes: mark as used (old behavior)
    this.isUsed = true;
    this.usedAt = new Date();
    this.usedForProgramId = programId;
  }

  return await this.save();
};

// Deactivate code (admin action)
promoCodeSchema.methods.deactivate = async function (
  this: IPromoCode
): Promise<IPromoCode> {
  this.isActive = false;
  return await this.save();
};

// Reactivate code (admin action)
promoCodeSchema.methods.reactivate = async function (
  this: IPromoCode
): Promise<IPromoCode> {
  this.isActive = true;
  return await this.save();
};

// ==================== STATIC METHODS ====================

// Generate a unique random code
promoCodeSchema.statics.generateUniqueCode =
  async function (): Promise<string> {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters: I, O, 0, 1
    const codeLength = 8;
    let code: string;
    let exists = true;

    // Keep generating until we find a unique code
    while (exists) {
      code = "";
      for (let i = 0; i < codeLength; i++) {
        code += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      // Check if code already exists
      const existingCode = await this.findOne({ code });
      exists = !!existingCode;
    }

    return code!;
  };

// Find all valid codes for a user and program
promoCodeSchema.statics.findValidCodesForUser = async function (
  userId: mongoose.Types.ObjectId | string,
  programId?: mongoose.Types.ObjectId | string
): Promise<IPromoCode[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {
    ownerId: userId,
    isActive: true,
    isUsed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gte: new Date() } },
    ],
  };

  const codes = await this.find(query).sort({ createdAt: -1 });

  // If programId is provided, filter by program-specific rules
  if (programId) {
    return codes.filter((code: IPromoCode) => {
      const result = code.canBeUsedForProgram(programId);
      return result.valid;
    });
  }

  return codes;
};

// ==================== PRE-SAVE HOOKS ====================

// Validate that either discountAmount or discountPercent is set based on type
promoCodeSchema.pre("save", function (this: IPromoCode, next) {
  if (this.type === "bundle_discount" && !this.discountAmount) {
    return next(new Error("Bundle discount codes must have a discountAmount"));
  }

  if (this.type === "staff_access" && this.discountPercent === undefined) {
    return next(new Error("Staff access codes must have a discountPercent"));
  }

  next();
});

// ==================== EXPORT ====================

const PromoCode = (mongoose.models.PromoCode ||
  mongoose.model<IPromoCode, IPromoCodeModel>(
    "PromoCode",
    promoCodeSchema
  )) as IPromoCodeModel;

export default PromoCode;
