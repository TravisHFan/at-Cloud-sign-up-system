import mongoose, { Schema, Document } from "mongoose";

// Registration action types for audit trail (simplified)
export type RegistrationAction =
  | "registered"
  | "role_changed"
  | "moved_between_roles"
  | "updated_notes"
  | "admin_removed"
  | "admin_added"
  | "assigned";

// Simplified registration status (no cancelled status - just delete the record)
export type RegistrationStatus =
  | "active" // Default status for all registrations
  | "waitlisted" // If role is full, put on waitlist
  | "no_show" // For completed events - user didn't attend
  | "attended"; // For completed events - user attended

// Interface for Registration document (individual user-event-role relationship)
export interface IRegistration extends Document {
  // Core relationships
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  roleId: string; // The specific role within the event

  // User snapshot (for performance and historical data)
  userSnapshot: {
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
    avatar?: string;
    gender?: "male" | "female";
  };

  // Event snapshot (for historical data)
  eventSnapshot: {
    title: string;
    date: string;
    time: string;
    location: string;
    type: string;
    roleName: string;
    roleDescription: string;
  };

  // Registration details (simplified)
  status: RegistrationStatus;
  registrationDate: Date;
  // Removed cancelledDate - when user cancels, we delete the record

  // Participant-specific data
  notes?: string; // Notes about this specific participant
  specialRequirements?: string; // Dietary, accessibility, etc.
  attendanceConfirmed?: boolean; // For completed events

  // Audit trail
  actionHistory: Array<{
    action: RegistrationAction;
    performedBy: mongoose.Types.ObjectId; // User who performed the action
    performedAt: Date;
    details?: string; // Additional context
    previousValue?: any; // For tracking changes
    newValue?: any; // For tracking changes
  }>;

  // Metadata
  registeredBy: mongoose.Types.ObjectId; // Who registered this user (self or admin)
  ipAddress?: string; // For audit purposes
  userAgent?: string; // Browser info for audit

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods (simplified - no cancel method, just delete the record)
  updateNotes(notes: string, updatedBy: mongoose.Types.ObjectId): Promise<void>;
  changeRole(
    newRoleId: string,
    newRoleName: string,
    changedBy: mongoose.Types.ObjectId
  ): Promise<void>;
  confirmAttendance(confirmedBy: mongoose.Types.ObjectId): Promise<void>;
  addAuditEntry(
    action: RegistrationAction,
    performedBy: mongoose.Types.ObjectId,
    details?: string,
    previousValue?: any,
    newValue?: any
  ): void;
}

// Interface for aggregated event statistics
export interface IEventRegistrationStats {
  eventId: mongoose.Types.ObjectId;
  totalRegistrations: number;
  activeRegistrations: number;
  waitlistedRegistrations: number;
  attendedCount: number;
  noShowCount: number;
  registrationsByRole: Array<{
    roleId: string;
    roleName: string;
    registeredCount: number;
    activeCount: number;
    maxParticipants: number;
    availableSlots: number;
  }>;
  registrationsByDate: Array<{
    date: string;
    count: number;
  }>;
}

const actionHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "registered",
        "role_changed",
        "moved_between_roles",
        "updated_notes",
        "admin_removed",
        "admin_added",
        "assigned",
      ],
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      maxlength: [500, "Action details cannot exceed 500 characters"],
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const userSnapshotSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    systemAuthorizationLevel: {
      type: String,
      enum: ["Super Admin", "Administrator", "Leader", "Participant"],
    },
    roleInAtCloud: {
      type: String,
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

const eventSnapshotSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    time: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    roleName: {
      type: String,
      required: true,
      trim: true,
    },
    roleDescription: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const registrationSchema: Schema = new Schema(
  {
    // Core relationships
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    roleId: {
      type: String,
      required: [true, "Role ID is required"],
      trim: true,
    },

    // Snapshots for historical data
    userSnapshot: {
      type: userSnapshotSchema,
      required: true,
    },
    eventSnapshot: {
      type: eventSnapshotSchema,
      required: true,
    },

    // Registration details (simplified)
    status: {
      type: String,
      enum: ["active", "waitlisted", "no_show", "attended"], // Removed "cancelled"
      default: "active",
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    // Removed cancelledDate field

    // Participant-specific data
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    specialRequirements: {
      type: String,
      trim: true,
      maxlength: [500, "Special requirements cannot exceed 500 characters"],
    },
    attendanceConfirmed: {
      type: Boolean,
      default: false,
    },

    // Audit trail
    actionHistory: {
      type: [actionHistorySchema],
      default: [],
    },

    // Metadata
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Registered by user ID is required"],
    },
    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string) {
          if (!value) return true; // Optional field
          // Basic IP validation (IPv4 and IPv6)
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
          const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(value) || ipv6Regex.test(value);
        },
        message: "Invalid IP address format",
      },
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent cannot exceed 500 characters"],
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
registrationSchema.index({ userId: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ roleId: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ registrationDate: -1 });

// Compound indexes for common queries
registrationSchema.index(
  { userId: 1, eventId: 1, roleId: 1 },
  { unique: true }
); // Prevent duplicate registrations
registrationSchema.index({ eventId: 1, status: 1 });
registrationSchema.index({ userId: 1, status: 1 });
registrationSchema.index({ eventId: 1, roleId: 1, status: 1 });
registrationSchema.index({ registeredBy: 1, registrationDate: -1 });

// Text search index for notes and special requirements
registrationSchema.index({
  notes: "text",
  specialRequirements: "text",
  "userSnapshot.username": "text",
  "eventSnapshot.title": "text",
});

// Add audit entry method
registrationSchema.methods.addAuditEntry = function (
  action: RegistrationAction,
  performedBy: mongoose.Types.ObjectId,
  details?: string,
  previousValue?: any,
  newValue?: any
): void {
  this.actionHistory.push({
    action,
    performedBy,
    performedAt: new Date(),
    details,
    previousValue,
    newValue,
  });
};

// Update notes method
registrationSchema.methods.updateNotes = async function (
  notes: string,
  updatedBy: mongoose.Types.ObjectId
): Promise<void> {
  const previousNotes = this.notes;
  this.notes = notes;

  this.addAuditEntry(
    "updated_notes",
    updatedBy,
    "Notes updated",
    { notes: previousNotes },
    { notes: notes }
  );

  await this.save();
};

// Change role method
registrationSchema.methods.changeRole = async function (
  newRoleId: string,
  newRoleName: string,
  changedBy: mongoose.Types.ObjectId
): Promise<void> {
  const previousRole = {
    roleId: this.roleId,
    roleName: this.eventSnapshot.roleName,
  };

  this.roleId = newRoleId;
  this.eventSnapshot.roleName = newRoleName;

  this.addAuditEntry(
    "role_changed",
    changedBy,
    `Role changed from ${previousRole.roleName} to ${newRoleName}`,
    previousRole,
    { roleId: newRoleId, roleName: newRoleName }
  );

  await this.save();
};

// Confirm attendance method
registrationSchema.methods.confirmAttendance = async function (
  confirmedBy: mongoose.Types.ObjectId
): Promise<void> {
  if (this.status !== "active") {
    throw new Error("Can only confirm attendance for active registrations");
  }

  this.attendanceConfirmed = true;
  this.status = "attended";

  this.addAuditEntry(
    "updated_notes",
    confirmedBy,
    "Attendance confirmed",
    { attendanceConfirmed: false, status: "active" },
    { attendanceConfirmed: true, status: "attended" }
  );

  await this.save();
};

// Pre-save middleware to add initial audit entry
registrationSchema.pre<IRegistration>("save", function (next) {
  if (this.isNew) {
    this.addAuditEntry(
      "registered",
      this.registeredBy,
      `Registered for role: ${this.eventSnapshot.roleName}`
    );
  }
  next();
});

// Static method to get event registration statistics
registrationSchema.statics.getEventStats = async function (
  eventId: mongoose.Types.ObjectId
): Promise<IEventRegistrationStats> {
  const pipeline = [
    { $match: { eventId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        roles: {
          $push: {
            roleId: "$roleId",
            roleName: "$eventSnapshot.roleName",
          },
        },
      },
    },
  ];

  const statusCounts = await this.aggregate(pipeline);

  // Get role-specific statistics
  const roleStats = await this.aggregate([
    { $match: { eventId } },
    {
      $group: {
        _id: {
          roleId: "$roleId",
          roleName: "$eventSnapshot.roleName",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: {
          roleId: "$_id.roleId",
          roleName: "$_id.roleName",
        },
        statusCounts: {
          $push: {
            status: "$_id.status",
            count: "$count",
          },
        },
        totalCount: { $sum: "$count" },
      },
    },
  ]);

  // Process the results
  const totalRegistrations = statusCounts.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const activeRegistrations =
    statusCounts.find((item) => item._id === "active")?.count || 0;
  const waitlistedRegistrations =
    statusCounts.find((item) => item._id === "waitlisted")?.count || 0;
  const attendedCount =
    statusCounts.find((item) => item._id === "attended")?.count || 0;
  const noShowCount =
    statusCounts.find((item) => item._id === "no_show")?.count || 0;

  const registrationsByRole = roleStats.map((role) => {
    const activeCount =
      role.statusCounts.find((s: any) => s.status === "active")?.count || 0;

    return {
      roleId: role._id.roleId,
      roleName: role._id.roleName,
      registeredCount: role.totalCount,
      activeCount,
      maxParticipants: 0, // This would need to be fetched from Event model
      availableSlots: 0, // This would need to be calculated
    };
  });

  return {
    eventId,
    totalRegistrations,
    activeRegistrations,
    waitlistedRegistrations,
    attendedCount,
    noShowCount,
    registrationsByRole,
    registrationsByDate: [], // This would require additional aggregation by date
  };
};

// Handle model re-compilation in test environments
export default mongoose.models.Registration ||
  mongoose.model<IRegistration>("Registration", registrationSchema);
