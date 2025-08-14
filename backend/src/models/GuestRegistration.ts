import mongoose, { Document, Schema } from "mongoose";

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

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  toPublicJSON(): any;
  toAdminJSON(): any;
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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

// Instance methods
GuestRegistrationSchema.methods.toPublicJSON = function () {
  const guestRegistration = this.toObject();

  // Remove sensitive data for public display
  delete guestRegistration.ipAddress;
  delete guestRegistration.userAgent;
  delete guestRegistration.__v;

  return guestRegistration;
};

GuestRegistrationSchema.methods.toAdminJSON = function () {
  const guestRegistration = this.toObject();
  delete guestRegistration.__v;
  return guestRegistration;
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
