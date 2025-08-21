import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export interface IGuestRegistration extends Document {
  // Event Association
  eventId: mongoose.Types.ObjectId;
  roleId: string;

  // Guest Information
  fullName: string;
  gender: "male" | "female";
  email: string;
  phone: string;

  // Registration Metadata
  registrationDate: Date;
  ipAddress?: string;
  userAgent?: string;
  status: "active" | "cancelled";
  notes?: string;

  // Event Snapshot (for historical reference)
  eventSnapshot: {
    title: string;
    date: Date;
    location: string;
    roleName: string;
  };

  // Migration Support
  migratedToUserId?: mongoose.Types.ObjectId;
  migrationDate?: Date;
  migrationStatus: "pending" | "completed" | "declined";

  // Self-service manage token
  manageToken?: string; // hashed token stored
  manageTokenExpires?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  toPublicJSON(): any;
  toAdminJSON(): any;
  generateManageToken(): string; // returns raw token
}

export interface IGuestRegistrationModel
  extends mongoose.Model<IGuestRegistration> {
  findActiveByEvent(eventId: string): Promise<IGuestRegistration[]>;
  findByEmailAndStatus(
    email: string,
    status?: string
  ): Promise<IGuestRegistration[]>;
  countActiveRegistrations(eventId: string, roleId?: string): Promise<number>;
  findEligibleForMigration(email: string): Promise<IGuestRegistration[]>;
}

const GuestRegistrationSchema: Schema = new Schema(
  {
    // Event Association
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    roleId: {
      type: String,
      required: true,
      index: true,
    },

    // Guest Information
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female"],
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 20,
    },

    // Registration Metadata
    registrationDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "cancelled"],
      default: "active",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Event Snapshot
    eventSnapshot: {
      title: {
        type: String,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      location: {
        type: String,
        required: true,
      },
      roleName: {
        type: String,
        required: true,
      },
    },

    // Migration Support
    migratedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    migrationDate: {
      type: Date,
      default: null,
    },
    migrationStatus: {
      type: String,
      enum: ["pending", "completed", "declined"],
      default: "pending",
    },

    // Self-service manage token (hashed) and expiry
    manageToken: {
      type: String,
      index: true,
      default: undefined,
    },
    manageTokenExpires: {
      type: Date,
      default: undefined,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "guestregistrations",
  }
);

// Compound indexes for performance
GuestRegistrationSchema.index({ eventId: 1, roleId: 1 });
GuestRegistrationSchema.index({ email: 1, status: 1 });
GuestRegistrationSchema.index({ eventId: 1, status: 1 });
GuestRegistrationSchema.index({ migrationStatus: 1, email: 1 });
GuestRegistrationSchema.index({ manageToken: 1, manageTokenExpires: 1 });

// Instance methods
GuestRegistrationSchema.methods.toPublicJSON = function () {
  const guestRegistration = this.toObject();

  // Remove sensitive data for public display
  delete guestRegistration.ipAddress;
  delete guestRegistration.userAgent;
  // Never expose manage token fields
  delete guestRegistration.manageToken;
  delete guestRegistration.manageTokenExpires;
  delete guestRegistration.__v;

  return guestRegistration;
};

GuestRegistrationSchema.methods.toAdminJSON = function () {
  const guestRegistration = this.toObject();
  // Admin JSON should also avoid exposing raw/hashed tokens
  delete guestRegistration.manageToken;
  delete guestRegistration.manageTokenExpires;
  delete guestRegistration.__v;
  return guestRegistration;
};

// Generate and set a new manage token (returns raw token)
GuestRegistrationSchema.methods.generateManageToken = function (): string {
  const raw = crypto.randomBytes(24).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  this.manageToken = hashed;
  // 30 days validity window
  this.manageTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return raw;
};

// Static methods
GuestRegistrationSchema.statics.findActiveByEvent = function (eventId: string) {
  return this.find({
    eventId: new mongoose.Types.ObjectId(eventId),
    status: "active",
  });
};

GuestRegistrationSchema.statics.findByEmailAndStatus = function (
  email: string,
  status?: string
) {
  const query: any = { email: email.toLowerCase() };
  if (status) {
    query.status = status;
  }
  return this.find(query);
};

GuestRegistrationSchema.statics.countActiveRegistrations = function (
  eventId: string,
  roleId?: string
) {
  const query: any = {
    eventId: new mongoose.Types.ObjectId(eventId),
    status: "active",
  };
  if (roleId) {
    query.roleId = roleId;
  }
  return this.countDocuments(query);
};

GuestRegistrationSchema.statics.findEligibleForMigration = function (
  email: string
) {
  return this.find({
    email: email.toLowerCase(),
    status: "active",
    migrationStatus: "pending",
  }).populate("eventId", "title date location");
};

// Maintenance: unset expired manage tokens without deleting registrations
GuestRegistrationSchema.statics.purgeExpiredManageTokens = async function () {
  const now = new Date();
  await this.updateMany(
    {
      manageTokenExpires: { $lt: now },
      manageToken: { $exists: true },
    },
    {
      $unset: { manageToken: "", manageTokenExpires: "" },
    }
  );
};

// Pre-save middleware
GuestRegistrationSchema.pre("save", function (this: IGuestRegistration, next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }

  // Trim and validate fullName
  if (this.fullName) {
    this.fullName = this.fullName.trim();
  }

  next();
});

// Pre-update middleware
GuestRegistrationSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  const update = this.getUpdate() as any;

  if (update.email) {
    update.email = update.email.toLowerCase();
  }

  if (update.fullName) {
    update.fullName = update.fullName.trim();
  }

  next();
});

export default (mongoose.models.GuestRegistration ||
  mongoose.model<IGuestRegistration, IGuestRegistrationModel>(
    "GuestRegistration",
    GuestRegistrationSchema
  )) as IGuestRegistrationModel;
