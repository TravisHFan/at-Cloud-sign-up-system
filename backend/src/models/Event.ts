import mongoose, { Schema, Document } from "mongoose";

// Event Role Interface (matches frontend EventRole)
export interface IEventRole {
  id: string; // UUID for the role
  name: string;
  description: string;
  maxParticipants: number;
}

// Event Organizer Detail Interface (extends OrganizerDetail)
export interface IOrganizerDetail {
  userId?: mongoose.Types.ObjectId;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar?: string;
  gender?: "male" | "female";
}

export interface IEvent extends Document {
  // Basic Information
  title: string;
  type: string; // One of: Conference, Webinar, Workshop, Mentor Circle
  date: string; // Format: "YYYY-MM-DD"
  time: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
  location: string;

  // Organizer Information
  organizer: string; // Display string
  organizerDetails?: IOrganizerDetail[];
  hostedBy?: string; // e.g., "@Cloud Marketplace Ministry"
  createdBy: mongoose.Types.ObjectId; // Reference to User who created the event

  // Event Content
  purpose: string; // Event description/purpose
  agenda?: string; // Event agenda and schedule
  format: string; // e.g., "Hybrid Participation"
  disclaimer?: string; // Optional disclaimer terms

  // Role-based System (core feature)
  roles: IEventRole[]; // Array of event roles with signups

  // Statistics (calculated fields)
  signedUp: number; // Total number of role signups across all roles
  totalSlots: number; // Total capacity across all roles

  // Optional fields
  description?: string;
  attendees?: number; // For completed events
  status: "upcoming" | "ongoing" | "completed" | "cancelled";

  // Virtual Event Support
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;

  // Event Reminder System
  "24hReminderSent"?: boolean;
  "24hReminderSentAt"?: Date;
  "24hReminderProcessingBy"?: string;

  // Workshop-specific fields
  workshopGroupTopics?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    E?: string;
    F?: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateSignedUp(): Promise<number>;
  calculateTotalSlots(): number;
}

const eventRoleSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Role name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, "Role description cannot exceed 300 characters"],
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: [1, "Maximum participants must be at least 1"],
      max: [100, "Maximum participants cannot exceed 100"],
    },
  },
  { _id: false }
);

const organizerDetailSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
  },
  { _id: false }
);

const eventSchema: Schema = new Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Event title cannot exceed 200 characters"],
    },
    type: {
      type: String,
      required: [true, "Event type is required"],
      trim: true,
      enum: {
        values: ["Conference", "Webinar", "Workshop", "Mentor Circle"],
        message:
          "Event type must be one of: Conference, Webinar, Workshop, Mentor Circle",
      },
      maxlength: [100, "Event type cannot exceed 100 characters"],
    },
    date: {
      type: String,
      required: [true, "Event date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    time: {
      type: String,
      required: [true, "Event start time is required"],
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    endTime: {
      type: String,
      required: [true, "Event end time is required"],
      match: [/^\d{2}:\d{2}$/, "End time must be in HH:MM format"],
    },
    location: {
      type: String,
      required: [
        function () {
          // Location is required for In-person and Hybrid events, but not for Online events
          return (
            this.format === "In-person" ||
            this.format === "Hybrid Participation"
          );
        },
        "Event location is required for in-person and hybrid events",
      ],
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },

    // Organizer Information
    organizer: {
      type: String,
      required: [true, "Organizer information is required"],
      trim: true,
      maxlength: [300, "Organizer information cannot exceed 300 characters"],
    },
    organizerDetails: [organizerDetailSchema],
    hostedBy: {
      type: String,
      trim: true,
      maxlength: [200, "Hosted by information cannot exceed 200 characters"],
      default: "@Cloud Marketplace Ministry",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Event creator is required"],
    },

    // Event Content
    purpose: {
      type: String,
      required: [true, "Event purpose is required"],
      trim: true,
      maxlength: [1000, "Purpose cannot exceed 1000 characters"],
    },
    agenda: {
      type: String,
      trim: true,
      maxlength: [2000, "Agenda cannot exceed 2000 characters"],
    },
    format: {
      type: String,
      required: [true, "Event format is required"],
      enum: {
        values: ["In-person", "Online", "Hybrid Participation"],
        message:
          "Format must be one of: In-person, Online, or Hybrid Participation",
      },
      trim: true,
      maxlength: [100, "Format cannot exceed 100 characters"],
    },
    disclaimer: {
      type: String,
      trim: true,
      maxlength: [1000, "Disclaimer cannot exceed 1000 characters"],
    },

    // Role-based System
    roles: {
      type: [eventRoleSchema],
      required: true,
      validate: {
        validator: function (roles: IEventRole[]) {
          return roles.length > 0;
        },
        message: "Event must have at least one role",
      },
    },

    // Statistics
    signedUp: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSlots: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Optional fields
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    attendees: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },

    // Virtual Event Support
    isHybrid: {
      type: Boolean,
      default: false,
    },
    zoomLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string | undefined | null) {
          // Allow undefined, null, empty string, or whitespace-only
          if (
            value === undefined ||
            value === null ||
            value === "" ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
          // If a non-empty value is provided, it must be a valid URL
          const isValid =
            typeof value === "string" && /^https?:\/\/.+/.test(value);
          return isValid;
        },
        message: "Zoom link must be a valid URL",
      },
    },
    meetingId: {
      type: String,
      trim: true,
    },
    passcode: {
      type: String,
      trim: true,
    },
    requirements: {
      type: String,
      trim: true,
      maxlength: [500, "Requirements cannot exceed 500 characters"],
    },
    materials: {
      type: String,
      trim: true,
      maxlength: [500, "Materials cannot exceed 500 characters"],
    },

    // Workshop-specific fields
    workshopGroupTopics: {
      type: new Schema(
        {
          A: { type: String, trim: true, maxlength: 200 },
          B: { type: String, trim: true, maxlength: 200 },
          C: { type: String, trim: true, maxlength: 200 },
          D: { type: String, trim: true, maxlength: 200 },
          E: { type: String, trim: true, maxlength: 200 },
          F: { type: String, trim: true, maxlength: 200 },
        },
        { _id: false }
      ),
      default: undefined,
    },

    // Event Reminder System Fields
    "24hReminderSent": {
      type: Boolean,
      default: false,
    },
    "24hReminderSentAt": {
      type: Date,
    },
    "24hReminderProcessingBy": {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
eventSchema.index({ createdBy: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ createdAt: -1 });

// Compound indexes
eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ createdBy: 1, status: 1 });

// Text search index
eventSchema.index({
  title: "text",
  purpose: "text",
  description: "text",
});

// Calculate signed up count using Registration collection
eventSchema.methods.calculateSignedUp = async function (): Promise<number> {
  const Registration = mongoose.model("Registration");
  const count = await Registration.countDocuments({
    eventId: this._id,
    status: "active",
  });
  return count;
};

// Calculate total slots across all roles
eventSchema.methods.calculateTotalSlots = function (): number {
  return this.roles.reduce((total: number, role: IEventRole) => {
    return total + role.maxParticipants;
  }, 0);
};

// Pre-save middleware to update statistics
eventSchema.pre<IEvent>("save", async function (next) {
  this.signedUp = await this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();
  next();
});

// Handle model re-compilation in test environments
export default mongoose.models.Event ||
  mongoose.model<IEvent>("Event", eventSchema);
