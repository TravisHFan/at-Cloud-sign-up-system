import mongoose, { Schema, Document } from "mongoose";

export interface IAnnualMembership extends Document {
  title: string;
  programs: mongoose.Types.ObjectId[];
  price: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const annualMembershipSchema = new Schema<IAnnualMembership>(
  {
    title: {
      type: String,
      required: [true, "Annual membership title is required"],
      trim: true,
      maxlength: [200, "Annual membership title cannot exceed 200 characters"],
    },
    programs: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Program",
        },
      ],
      validate: {
        validator: function (programs: mongoose.Types.ObjectId[] | undefined) {
          return Array.isArray(programs) && programs.length > 0;
        },
        message: "At least one program is required",
      },
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Annual membership price must be >= 0"],
      max: [100000, "Annual membership price must be <= 100000"],
      validate: {
        validator: Number.isInteger,
        message: "Annual membership price must be an integer",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { _id?: unknown; __v?: unknown },
      ) {
        (ret as { id?: string }).id = ret._id as unknown as string;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

annualMembershipSchema.index({ title: "text" });
annualMembershipSchema.index({ programs: 1, isActive: 1 });

const AnnualMembership =
  (mongoose.models.AnnualMembership as mongoose.Model<IAnnualMembership>) ||
  mongoose.model<IAnnualMembership>(
    "AnnualMembership",
    annualMembershipSchema,
  );

export default AnnualMembership;
