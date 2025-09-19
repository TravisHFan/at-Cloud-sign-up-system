import mongoose, { Schema, Document } from "mongoose";

// A lightweight user snapshot stored in program mentors arrays
interface IUserRefLite {
  userId: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string;
  roleInAtCloud?: string;
}

export interface IProgram extends Document {
  title: string;
  programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;

  // Mentors (either flat or by circle depending on programType)
  mentors?: IUserRefLite[]; // for Effective Communication Workshops
  mentorsByCircle?: {
    E?: IUserRefLite[];
    M?: IUserRefLite[];
    B?: IUserRefLite[];
    A?: IUserRefLite[];
  }; // for EMBA Mentor Circles

  // Pricing
  fullPriceTicket: number; // 0-2000
  classRepDiscount?: number; // 0-2000 default 0
  earlyBirdDiscount?: number; // 0-2000 default 0

  // Event linkage (denormalized list for convenience)
  events?: mongoose.Types.ObjectId[];

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userRefLiteSchema = new Schema<IUserRefLite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    email: { type: String, trim: true, lowercase: true },
    gender: { type: String, enum: ["male", "female"] },
    avatar: { type: String, trim: true },
    roleInAtCloud: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const programSchema = new Schema<IProgram>(
  {
    title: {
      type: String,
      required: [true, "Program title is required"],
      trim: true,
      maxlength: [200, "Program title cannot exceed 200 characters"],
    },
    programType: {
      type: String,
      required: true,
      enum: ["EMBA Mentor Circles", "Effective Communication Workshops"],
    },
    hostedBy: {
      type: String,
      trim: true,
      maxlength: [200, "Hosted by information cannot exceed 200 characters"],
      default: "@Cloud Marketplace Ministry",
    },
    period: {
      type: new Schema(
        {
          startYear: { type: String, trim: true, maxlength: 4 },
          startMonth: { type: String, trim: true, maxlength: 2 },
          endYear: { type: String, trim: true, maxlength: 4 },
          endMonth: { type: String, trim: true, maxlength: 2 },
        },
        { _id: false }
      ),
      default: undefined,
    },
    introduction: {
      type: String,
      trim: true,
      maxlength: [2000, "Introduction cannot exceed 2000 characters"],
    },
    flyerUrl: {
      type: String,
      trim: true,
      maxlength: [500, "Flyer URL cannot exceed 500 characters"],
      validate: {
        validator: function (value: string | undefined | null) {
          if (value === undefined || value === null || value === "")
            return true;
          const v = String(value).trim();
          if (!v) return true;
          return /^https?:\/\//.test(v) || v.startsWith("/uploads/");
        },
        message:
          "Flyer URL must be an absolute http(s) URL or a path starting with /uploads/",
      },
      default: undefined,
    },

    // Mentors
    mentors: { type: [userRefLiteSchema], default: undefined },
    mentorsByCircle: {
      type: new Schema(
        {
          E: { type: [userRefLiteSchema], default: undefined },
          M: { type: [userRefLiteSchema], default: undefined },
          B: { type: [userRefLiteSchema], default: undefined },
          A: { type: [userRefLiteSchema], default: undefined },
        },
        { _id: false }
      ),
      default: undefined,
    },

    // Pricing
    fullPriceTicket: {
      type: Number,
      required: true,
      min: [0, "Full price must be >= 0"],
      max: [2000, "Full price must be <= 2000"],
      validate: {
        validator: Number.isInteger,
        message: "Full price must be an integer",
      },
    },
    classRepDiscount: {
      type: Number,
      default: 0,
      min: [0, "Class Rep discount must be >= 0"],
      max: [2000, "Class Rep discount must be <= 2000"],
      validate: {
        validator: Number.isInteger,
        message: "Class Rep discount must be an integer",
      },
    },
    earlyBirdDiscount: {
      type: Number,
      default: 0,
      min: [0, "Early Bird discount must be >= 0"],
      max: [2000, "Early Bird discount must be <= 2000"],
      validate: {
        validator: Number.isInteger,
        message: "Early Bird discount must be an integer",
      },
    },

    // Linked events
    events: [{ type: Schema.Types.ObjectId, ref: "Event" }],

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (
        _doc,
        ret: Record<string, unknown> & { _id?: unknown; __v?: unknown }
      ) {
        // create an 'id' copy and remove Mongo-specific fields
        (ret as { id?: string }).id = ret._id as unknown as string;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Composite validator: combined discounts cannot exceed full price
programSchema.pre("validate", function (next) {
  const p = this as unknown as IProgram;
  const classRep = p.classRepDiscount ?? 0;
  const early = p.earlyBirdDiscount ?? 0;
  if (p.fullPriceTicket - classRep - early < 0) {
    return next(
      new Error(
        "Combined discounts (classRepDiscount + earlyBirdDiscount) cannot exceed fullPriceTicket"
      )
    );
  }
  next();
});

// Indexes
programSchema.index({ programType: 1 });
programSchema.index({ createdBy: 1 });
programSchema.index({ createdAt: -1 });

export default mongoose.models.Program ||
  mongoose.model<IProgram>("Program", programSchema);
