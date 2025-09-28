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

// Allow base62 for auto-generated keys. For custom keys we also support '-' and '_' (tests rely on this).
const BASE62_CUSTOM_REGEX = /^[0-9A-Za-z_-]+$/;

const shortLinkSchema = new Schema<IShortLink>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      minlength: 6,
      // Auto-generated keys remain 6-8 chars; increase max to 16 to accommodate custom keys (tests use 13)
      maxlength: 16,
      validate: [
        {
          validator: (v: string) => BASE62_CUSTOM_REGEX.test(v),
          message: "ShortLink key must be alphanumeric, hyphen or underscore",
        },
      ],
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
