import mongoose, { Schema, Document } from "mongoose";

// Event Participant Interface (matches frontend EventParticipant)
export interface IEventParticipant {
  userId: mongoose.Types.ObjectId;
  username: string;
  firstName?: string;
  lastName?: string;
  systemAuthorizationLevel?: string; // Super Admin, Administrator, Leader, Participant
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female";
  notes?: string;
}

// Event Role Interface (matches frontend EventRole)
export interface IEventRole {
  id: string; // UUID for the role
  name: string;
  description: string;
  maxParticipants: number;
  currentSignups: IEventParticipant[];
}

// Event Organizer Detail Interface (matches frontend OrganizerDetail)
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
  type: string; // e.g., "Effective Communication Workshop Series"
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

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateSignedUp(): number;
  calculateTotalSlots(): number;
  addUserToRole(
    userId: mongoose.Types.ObjectId,
    roleId: string,
    userData: Partial<IEventParticipant>
  ): Promise<void>;
  addUserToRoleWithSession(
    userId: mongoose.Types.ObjectId,
    roleId: string,
    userData: Partial<IEventParticipant>,
    session: mongoose.ClientSession
  ): Promise<void>;
  removeUserFromRole(
    userId: mongoose.Types.ObjectId,
    roleId: string
  ): Promise<void>;
  removeUserFromRoleWithSession(
    userId: mongoose.Types.ObjectId,
    roleId: string,
    session: mongoose.ClientSession
  ): Promise<void>;
  moveUserBetweenRoles(
    userId: mongoose.Types.ObjectId,
    fromRoleId: string,
    toRoleId: string
  ): Promise<void>;
  moveUserBetweenRolesWithSession(
    userId: mongoose.Types.ObjectId,
    fromRoleId: string,
    toRoleId: string,
    session: mongoose.ClientSession
  ): Promise<void>;
}

const eventParticipantSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  { _id: false }
);

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
    currentSignups: [eventParticipantSchema],
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
      required: [true, "Event location is required"],
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
        validator: function (value: string) {
          if (!value) return true; // Optional field
          return /^https?:\/\/.+/.test(value);
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

// Calculate signed up count (total role signups across all roles)
eventSchema.methods.calculateSignedUp = function (): number {
  let totalSignups = 0;
  this.roles.forEach((role: IEventRole) => {
    totalSignups += role.currentSignups.length;
  });
  return totalSignups;
};

// Calculate total slots across all roles
eventSchema.methods.calculateTotalSlots = function (): number {
  return this.roles.reduce((total: number, role: IEventRole) => {
    return total + role.maxParticipants;
  }, 0);
};

// Add user to a specific role
eventSchema.methods.addUserToRole = async function (
  userId: mongoose.Types.ObjectId,
  roleId: string,
  userData: Partial<IEventParticipant>
): Promise<void> {
  const role = this.roles.find((r: IEventRole) => r.id === roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  // Check if user is already in this role
  const existingSignup = role.currentSignups.find(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );
  if (existingSignup) {
    throw new Error("User is already signed up for this role");
  }

  // Check if role is full
  if (role.currentSignups.length >= role.maxParticipants) {
    throw new Error("Role is already full");
  }

  // Add user to role
  role.currentSignups.push({
    userId,
    username: userData.username || "",
    firstName: userData.firstName,
    lastName: userData.lastName,
    systemAuthorizationLevel: userData.systemAuthorizationLevel,
    roleInAtCloud: userData.roleInAtCloud,
    avatar: userData.avatar,
    gender: userData.gender,
    notes: userData.notes,
  });

  // Update statistics
  this.signedUp = this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();

  await this.save();
};

// Add user to role with session support (for transactions)
eventSchema.methods.addUserToRoleWithSession = async function (
  userId: mongoose.Types.ObjectId,
  roleId: string,
  userData: Partial<IEventParticipant>,
  session: mongoose.ClientSession
): Promise<void> {
  const role = this.roles.find((r: IEventRole) => r.id === roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  // Check if user is already in this role
  const existingSignup = role.currentSignups.find(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );
  if (existingSignup) {
    throw new Error("User is already signed up for this role");
  }

  // Check if role is full
  if (role.currentSignups.length >= role.maxParticipants) {
    throw new Error("Role is already full");
  }

  // Add user to role
  role.currentSignups.push({
    userId,
    username: userData.username || "",
    firstName: userData.firstName,
    lastName: userData.lastName,
    systemAuthorizationLevel: userData.systemAuthorizationLevel,
    roleInAtCloud: userData.roleInAtCloud,
    avatar: userData.avatar,
    gender: userData.gender,
    notes: userData.notes,
  });

  // Update statistics
  this.signedUp = this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();

  await this.save({ session });
};

// Remove user from a specific role
eventSchema.methods.removeUserFromRole = async function (
  userId: mongoose.Types.ObjectId,
  roleId: string
): Promise<void> {
  const role = this.roles.find((r: IEventRole) => r.id === roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  const signupIndex = role.currentSignups.findIndex(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );

  if (signupIndex === -1) {
    throw new Error("User is not signed up for this role");
  }

  // Remove user from role
  role.currentSignups.splice(signupIndex, 1);

  // Update statistics
  this.signedUp = this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();

  await this.save();
};

// Remove user from role with session support (for transactions)
eventSchema.methods.removeUserFromRoleWithSession = async function (
  userId: mongoose.Types.ObjectId,
  roleId: string,
  session: mongoose.ClientSession
): Promise<void> {
  const role = this.roles.find((r: IEventRole) => r.id === roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  const signupIndex = role.currentSignups.findIndex(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );

  if (signupIndex === -1) {
    throw new Error("User is not signed up for this role");
  }

  // Remove user from role
  role.currentSignups.splice(signupIndex, 1);

  // Update statistics
  this.signedUp = this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();

  await this.save({ session });
};

// Move user between roles
eventSchema.methods.moveUserBetweenRoles = async function (
  userId: mongoose.Types.ObjectId,
  fromRoleId: string,
  toRoleId: string
): Promise<void> {
  const fromRole = this.roles.find((r: IEventRole) => r.id === fromRoleId);
  const toRole = this.roles.find((r: IEventRole) => r.id === toRoleId);

  if (!fromRole || !toRole) {
    throw new Error("One or both roles not found");
  }

  if (toRole.currentSignups.length >= toRole.maxParticipants) {
    throw new Error("Target role is already full");
  }

  const signupIndex = fromRole.currentSignups.findIndex(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );

  if (signupIndex === -1) {
    throw new Error("User is not signed up for the source role");
  }

  // Move user
  const userSignup = fromRole.currentSignups[signupIndex];
  fromRole.currentSignups.splice(signupIndex, 1);
  toRole.currentSignups.push(userSignup);

  // Statistics don't change as it's the same user
  await this.save();
};

// Move user between roles with session support (for transactions)
eventSchema.methods.moveUserBetweenRolesWithSession = async function (
  userId: mongoose.Types.ObjectId,
  fromRoleId: string,
  toRoleId: string,
  session: mongoose.ClientSession
): Promise<void> {
  const fromRole = this.roles.find((r: IEventRole) => r.id === fromRoleId);
  const toRole = this.roles.find((r: IEventRole) => r.id === toRoleId);

  if (!fromRole || !toRole) {
    throw new Error("One or both roles not found");
  }

  if (toRole.currentSignups.length >= toRole.maxParticipants) {
    throw new Error("Target role is already full");
  }

  const signupIndex = fromRole.currentSignups.findIndex(
    (signup: IEventParticipant) =>
      signup.userId.toString() === userId.toString()
  );

  if (signupIndex === -1) {
    throw new Error("User is not signed up for the source role");
  }

  // Move user
  const userSignup = fromRole.currentSignups[signupIndex];
  fromRole.currentSignups.splice(signupIndex, 1);
  toRole.currentSignups.push(userSignup);

  // Statistics don't change as it's the same user
  await this.save({ session });
};

// Pre-save middleware to update statistics
eventSchema.pre<IEvent>("save", function (next) {
  this.signedUp = this.calculateSignedUp();
  this.totalSlots = this.calculateTotalSlots();
  next();
});

export default mongoose.model<IEvent>("Event", eventSchema);
