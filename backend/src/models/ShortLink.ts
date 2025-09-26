import mongoose, { Schema, Document, Model } from "mongoose";

// ShortLink interface
export interface IShortLink extends Document {
  key: string; // base62 short key (6-8 chars)
  eventId: mongoose.Types.ObjectId; // reference to Event
  targetSlug: string; // event.publicSlug at creation time (for fast redirect composition)
  createdBy: mongoose.Types.ObjectId; // user who generated it
  createdAt: Date;
  expiresAt: Date; // when redirect should be considered invalid (event end or unpublish)
  isExpired: boolean; // explicit flag (maintained by sweeper / lifecycle)
}

export interface IShortLinkModel extends Model<IShortLink> {
  getActiveByKey(key: string): Promise<IShortLink | null>;
}

const BASE62_REGEX = /^[0-9A-Za-z]+$/;

const shortLinkSchema = new Schema<IShortLink>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      minlength: 6,
      maxlength: 12, // allow future extension; generator currently produces 6-8
      validate: {
        validator: (v: string) => BASE62_REGEX.test(v),
        message: "ShortLink key must be base62",
      },
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    targetSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      immutable: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
    timestamps: false, // we explicitly store createdAt only; updatedAt not needed
  }
);

// Static helpers
shortLinkSchema.statics.getActiveByKey = function (
  this: mongoose.Model<IShortLink>,
  key: string
) {
  return this.findOne({
    key,
    isExpired: false,
    expiresAt: { $gt: new Date() },
  });
};

const ShortLink =
  (mongoose.models.ShortLink as IShortLinkModel) ||
  mongoose.model<IShortLink, IShortLinkModel>("ShortLink", shortLinkSchema);

export default ShortLink;
