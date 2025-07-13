import mongoose, { Schema, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  category:
    | "technology"
    | "business"
    | "health"
    | "education"
    | "sports"
    | "entertainment"
    | "other";
  type:
    | "conference"
    | "workshop"
    | "seminar"
    | "meetup"
    | "webinar"
    | "networking"
    | "other";
  startDate: Date;
  endDate: Date;
  location: {
    type: "physical" | "virtual" | "hybrid";
    address?: {
      venue: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    virtualLink?: string;
    virtualPlatform?: string;
  };
  organizer: mongoose.Types.ObjectId;
  speakers: {
    name: string;
    title: string;
    bio?: string;
    image?: string;
    socialLinks?: {
      linkedin?: string;
      twitter?: string;
      website?: string;
    };
  }[];
  capacity: number;
  registeredUsers: mongoose.Types.ObjectId[];
  waitingList: mongoose.Types.ObjectId[];
  registrationDeadline: Date;
  price: {
    type: "free" | "paid";
    amount?: number;
    currency?: string;
  };
  agenda: {
    time: string;
    title: string;
    description?: string;
    speaker?: string;
    duration: number; // in minutes
  }[];
  tags: string[];
  images: string[];
  status: "draft" | "published" | "cancelled" | "completed";
  requirements?: string[];
  targetAudience?: string[];
  contactInfo: {
    email: string;
    phone?: string;
    website?: string;
  };
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  isPublic: boolean;
  allowWaitingList: boolean;
  sendReminders: boolean;
  feedbackSurvey?: {
    isEnabled: boolean;
    questions: {
      question: string;
      type: "rating" | "text" | "multiple-choice";
      options?: string[];
      required: boolean;
    }[];
  };
  analytics: {
    views: number;
    registrations: number;
    cancellations: number;
    attendance?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Event title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
      maxlength: [2000, "Event description cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      enum: [
        "technology",
        "business",
        "health",
        "education",
        "sports",
        "entertainment",
        "other",
      ],
      required: [true, "Event category is required"],
    },
    type: {
      type: String,
      enum: [
        "conference",
        "workshop",
        "seminar",
        "meetup",
        "webinar",
        "networking",
        "other",
      ],
      required: [true, "Event type is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Event start date is required"],
      validate: {
        validator: function (value: Date) {
          return value > new Date();
        },
        message: "Event start date must be in the future",
      },
    },
    endDate: {
      type: Date,
      required: [true, "Event end date is required"],
      validate: {
        validator: function (this: IEvent, value: Date) {
          return value > this.startDate;
        },
        message: "Event end date must be after start date",
      },
    },
    location: {
      type: {
        type: String,
        enum: ["physical", "virtual", "hybrid"],
        required: [true, "Location type is required"],
      },
      address: {
        venue: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
      virtualLink: String,
      virtualPlatform: String,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Event organizer is required"],
    },
    speakers: [
      {
        name: {
          type: String,
          required: [true, "Speaker name is required"],
          trim: true,
        },
        title: {
          type: String,
          required: [true, "Speaker title is required"],
          trim: true,
        },
        bio: {
          type: String,
          trim: true,
          maxlength: [500, "Speaker bio cannot exceed 500 characters"],
        },
        image: String,
        socialLinks: {
          linkedin: String,
          twitter: String,
          website: String,
        },
      },
    ],
    capacity: {
      type: Number,
      required: [true, "Event capacity is required"],
      min: [1, "Event capacity must be at least 1"],
      max: [10000, "Event capacity cannot exceed 10,000"],
    },
    registeredUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    waitingList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    registrationDeadline: {
      type: Date,
      required: [true, "Registration deadline is required"],
      validate: {
        validator: function (this: IEvent, value: Date) {
          return value <= this.startDate;
        },
        message:
          "Registration deadline must be before or equal to event start date",
      },
    },
    price: {
      type: {
        type: String,
        enum: ["free", "paid"],
        default: "free",
      },
      amount: {
        type: Number,
        min: 0,
        validate: {
          validator: function (this: any) {
            if (this.price.type === "paid") {
              return this.price.amount != null && this.price.amount > 0;
            }
            return true;
          },
          message: "Amount is required for paid events",
        },
      },
      currency: {
        type: String,
        default: "USD",
        validate: {
          validator: function (this: any) {
            if (this.price.type === "paid") {
              return this.price.currency != null;
            }
            return true;
          },
          message: "Currency is required for paid events",
        },
      },
    },
    agenda: [
      {
        time: {
          type: String,
          required: [true, "Agenda time is required"],
        },
        title: {
          type: String,
          required: [true, "Agenda title is required"],
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        speaker: {
          type: String,
          trim: true,
        },
        duration: {
          type: Number,
          required: [true, "Agenda duration is required"],
          min: [5, "Minimum duration is 5 minutes"],
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [30, "Tag cannot exceed 30 characters"],
      },
    ],
    images: [String],
    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "completed"],
      default: "draft",
    },
    requirements: [
      {
        type: String,
        trim: true,
        maxlength: [200, "Requirement cannot exceed 200 characters"],
      },
    ],
    targetAudience: [
      {
        type: String,
        trim: true,
        maxlength: [100, "Target audience cannot exceed 100 characters"],
      },
    ],
    contactInfo: {
      email: {
        type: String,
        required: [true, "Contact email is required"],
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Please enter a valid email address",
        ],
      },
      phone: String,
      website: String,
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    allowWaitingList: {
      type: Boolean,
      default: true,
    },
    sendReminders: {
      type: Boolean,
      default: true,
    },
    feedbackSurvey: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      questions: [
        {
          question: {
            type: String,
            required: [true, "Survey question is required"],
            trim: true,
          },
          type: {
            type: String,
            enum: ["rating", "text", "multiple-choice"],
            required: [true, "Question type is required"],
          },
          options: [String],
          required: {
            type: Boolean,
            default: false,
          },
        },
      ],
    },
    analytics: {
      views: {
        type: Number,
        default: 0,
      },
      registrations: {
        type: Number,
        default: 0,
      },
      cancellations: {
        type: Number,
        default: 0,
      },
      attendance: Number,
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
eventSchema.index({ startDate: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ "location.type": 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ title: "text", description: "text" }); // Text search

// Compound indexes
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ category: 1, startDate: 1 });
eventSchema.index({ organizer: 1, status: 1 });

// Virtual for available spots
eventSchema.virtual("availableSpots").get(function (this: IEvent) {
  return this.capacity - this.registeredUsers.length;
});

// Virtual for is full
eventSchema.virtual("isFull").get(function (this: IEvent) {
  return this.registeredUsers.length >= this.capacity;
});

// Pre-save middleware to update analytics
eventSchema.pre<IEvent>("save", function (next) {
  if (this.isModified("registeredUsers")) {
    this.analytics.registrations = this.registeredUsers.length;
  }
  next();
});

export default mongoose.model<IEvent>("Event", eventSchema);
