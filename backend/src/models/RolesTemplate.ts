import mongoose, { Schema, Document } from "mongoose";

// Role Template Interface (similar to IEventRole but for templates)
export interface ITemplateRole {
  name: string;
  description: string;
  maxParticipants: number;
  openToPublic?: boolean;
  agenda?: string;
  startTime?: string; // Optional role-specific start time (HH:mm format)
  endTime?: string; // Optional role-specific end time (HH:mm format)
}

export interface IRolesTemplate extends Document {
  name: string; // Template name (e.g., "Standard Conference", "Small Workshop")
  eventType: string; // One of: Conference, Webinar, Effective Communication Workshop, Mentor Circle
  roles: ITemplateRole[]; // Array of role definitions
  createdBy: mongoose.Types.ObjectId; // Reference to User who created the template
  createdAt: Date;
  updatedAt: Date;
}

// Template Role Schema (embedded in RolesTemplate)
const templateRoleSchema = new Schema<ITemplateRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: 1,
    },
    openToPublic: {
      type: Boolean,
      default: false,
    },
    agenda: {
      type: String,
      trim: true,
      default: "",
    },
    startTime: {
      type: String,
      trim: true,
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "startTime must be in HH:mm format",
      ],
    },
    endTime: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "endTime must be in HH:mm format"],
    },
  },
  { _id: false }
);

// Main RolesTemplate Schema
const rolesTemplateSchema = new Schema<IRolesTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "Conference",
        "Webinar",
        "Effective Communication Workshop",
        "Mentor Circle",
      ],
      index: true,
    },
    roles: {
      type: [templateRoleSchema],
      required: true,
      validate: {
        validator: function (roles: ITemplateRole[]) {
          return roles.length > 0;
        },
        message: "Template must have at least one role",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
rolesTemplateSchema.index({ eventType: 1, createdAt: -1 });
rolesTemplateSchema.index({ createdBy: 1, createdAt: -1 });

// Compound index for finding templates by event type and creator
rolesTemplateSchema.index({ eventType: 1, createdBy: 1 });

// Use existing model if already compiled (prevents "Cannot overwrite model" errors in tests)
const RolesTemplate =
  mongoose.models.RolesTemplate ||
  mongoose.model<IRolesTemplate>("RolesTemplate", rolesTemplateSchema);

export default RolesTemplate;
