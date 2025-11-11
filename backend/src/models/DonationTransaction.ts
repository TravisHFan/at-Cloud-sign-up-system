import mongoose, { Document, Schema, Model } from "mongoose";

export type TransactionStatus = "completed" | "failed" | "refunded";

export interface IDonationTransaction extends Document {
  donationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number; // in cents
  type: "one-time" | "recurring";
  status: TransactionStatus;
  giftDate: Date; // when payment was processed
  stripePaymentIntentId: string;

  // Payment method used for this transaction
  paymentMethod?: {
    cardBrand?: string;
    last4?: string;
  };

  // Error information for failed transactions
  failureReason?: string;
  failureCode?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const DonationTransactionSchema = new Schema<IDonationTransaction>(
  {
    donationId: {
      type: Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      index: true,
    },
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
    },
    type: {
      type: String,
      enum: ["one-time", "recurring"],
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "failed", "refunded"],
      required: true,
      default: "completed",
      index: true,
    },
    giftDate: {
      type: Date,
      required: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Payment method
    paymentMethod: {
      cardBrand: String,
      last4: String,
    },

    // Error details
    failureReason: String,
    failureCode: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
DonationTransactionSchema.index({ userId: 1, giftDate: -1 }); // User history sorted by date
DonationTransactionSchema.index({ userId: 1, status: 1 });
DonationTransactionSchema.index({ donationId: 1, createdAt: -1 });

const DonationTransaction: Model<IDonationTransaction> =
  mongoose.model<IDonationTransaction>(
    "DonationTransaction",
    DonationTransactionSchema
  );

export default DonationTransaction;
