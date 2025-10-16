import mongoose, { Schema, Document } from "mongoose";

export interface IBillingInfo {
  fullName: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface IPaymentMethod {
  type: "card" | "other";
  cardBrand?: string; // e.g., "visa", "mastercard"
  last4?: string; // Last 4 digits of card
  cardholderName?: string;
}

export interface IPurchase extends Document {
  // Core purchase info
  userId: mongoose.Types.ObjectId;
  programId: mongoose.Types.ObjectId;
  orderNumber: string; // Unique order number (e.g., "ORD-20250114-XXXXX")

  // Pricing breakdown (all values in cents)
  fullPrice: number; // Original full price in cents (e.g., 9999 = $99.99)
  classRepDiscount: number; // Class Rep discount in cents (0 if not selected)
  earlyBirdDiscount: number; // Early Bird discount in cents (0 if not applicable)
  finalPrice: number; // Actual amount charged in cents (fullPrice - discounts)

  // Flags
  isClassRep: boolean; // Whether user selected Class Rep option
  isEarlyBird: boolean; // Whether Early Bird discount was applied

  // Billing and payment
  billingInfo: IBillingInfo;
  paymentMethod: IPaymentMethod;

  // Stripe integration
  stripeSessionId?: string; // Stripe Checkout Session ID
  stripePaymentIntentId?: string; // Stripe Payment Intent ID

  // Status
  status: "pending" | "completed" | "failed" | "refunded";

  // Timestamps
  purchaseDate: Date; // When the purchase was completed
  createdAt: Date;
  updatedAt: Date;
}

const billingInfoSchema = new Schema<IBillingInfo>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    zipCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    type: {
      type: String,
      required: true,
      enum: ["card", "other"],
      default: "card",
    },
    cardBrand: { type: String, trim: true, maxlength: 50 },
    last4: { type: String, trim: true, maxlength: 4 },
    cardholderName: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const purchaseSchema = new Schema<IPurchase>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    fullPrice: {
      type: Number,
      required: true,
      min: 0,
      max: 100000, // 0-100000 cents ($0-$1000)
    },
    classRepDiscount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100000, // 0-100000 cents ($0-$1000)
    },
    earlyBirdDiscount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100000, // 0-100000 cents ($0-$1000)
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
      max: 100000, // 0-100000 cents ($0-$1000)
    },
    isClassRep: {
      type: Boolean,
      required: true,
      default: false,
    },
    isEarlyBird: {
      type: Boolean,
      required: true,
      default: false,
    },
    billingInfo: {
      type: billingInfoSchema,
      required: true,
    },
    paymentMethod: {
      type: paymentMethodSchema,
      required: true,
    },
    stripeSessionId: {
      type: String,
      trim: true,
      maxlength: 255,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (
        _doc,
        ret: Record<string, unknown> & { _id?: unknown; __v?: unknown }
      ) {
        (ret as { id?: string }).id = ret._id as unknown as string;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for efficient queries
purchaseSchema.index({ userId: 1, programId: 1 });
purchaseSchema.index({ status: 1, purchaseDate: -1 });

// Static method to generate unique order number
purchaseSchema.statics.generateOrderNumber =
  async function (): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD

    // Find the latest order number for today
    const prefix = `ORD-${dateStr}`;
    const latestOrder = await this.findOne({
      orderNumber: new RegExp(`^${prefix}`),
    }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (latestOrder) {
      const match = latestOrder.orderNumber.match(/-(\d+)$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    // Pad sequence to 5 digits
    const sequenceStr = sequence.toString().padStart(5, "0");
    return `${prefix}-${sequenceStr}`;
  };

// Use existing model if already compiled (fixes test re-import issues)
const Purchase =
  mongoose.models.Purchase ||
  mongoose.model<IPurchase>("Purchase", purchaseSchema);

export default Purchase;
