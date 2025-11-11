import mongoose, { Document, Schema, Model } from "mongoose";

export type DonationType = "one-time" | "recurring";

export type DonationFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export type DonationStatus =
  | "pending" // Awaiting payment confirmation
  | "scheduled" // One-time donation scheduled for future
  | "active" // Recurring donation active
  | "on_hold" // Recurring donation paused
  | "completed" // All payments completed
  | "cancelled" // Cancelled by user
  | "failed"; // Payment failed

export interface IDonation extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number; // in cents
  type: DonationType;
  frequency?: DonationFrequency;
  status: DonationStatus;

  // Dates
  giftDate?: Date; // for one-time donations
  startDate?: Date; // for recurring
  nextPaymentDate?: Date;
  endDate?: Date;
  lastGiftDate?: Date;

  // End conditions for recurring
  endAfterOccurrences?: number;
  currentOccurrence?: number;
  remainingOccurrences?: number;

  // Stripe references
  stripePaymentIntentId?: string; // one-time
  stripeSubscriptionId?: string; // recurring
  stripeCustomerId: string;

  // Payment method
  paymentMethod?: {
    type: string;
    cardBrand?: string;
    last4?: string;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100, // $1.00 minimum
      max: 99999900, // $999,999.00 maximum
    },
    type: {
      type: String,
      enum: ["one-time", "recurring"],
      required: true,
    },
    frequency: {
      type: String,
      enum: ["weekly", "biweekly", "monthly", "quarterly", "annually"],
      required: function (this: IDonation) {
        return this.type === "recurring";
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "scheduled",
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "failed",
      ],
      required: true,
      default: "pending",
      index: true,
    },

    // Dates
    giftDate: {
      type: Date,
      required: function (this: IDonation) {
        return this.type === "one-time";
      },
    },
    startDate: {
      type: Date,
      required: function (this: IDonation) {
        return this.type === "recurring";
      },
    },
    nextPaymentDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    lastGiftDate: {
      type: Date,
    },

    // End conditions
    endAfterOccurrences: {
      type: Number,
      min: 1,
    },
    currentOccurrence: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingOccurrences: {
      type: Number,
      min: 0,
    },

    // Stripe references
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },

    // Payment method
    paymentMethod: {
      type: {
        type: String,
        default: "card",
      },
      cardBrand: String,
      last4: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
DonationSchema.index({ userId: 1, status: 1 });
DonationSchema.index({ userId: 1, type: 1 });
DonationSchema.index({ nextPaymentDate: 1 });

// Virtual for calculating remaining occurrences if not set
DonationSchema.virtual("calculatedRemainingOccurrences").get(function (
  this: IDonation
) {
  if (this.endAfterOccurrences && this.currentOccurrence !== undefined) {
    return Math.max(0, this.endAfterOccurrences - this.currentOccurrence);
  }
  return this.remainingOccurrences;
});

const Donation: Model<IDonation> = mongoose.model<IDonation>(
  "Donation",
  DonationSchema
);

export default Donation;
