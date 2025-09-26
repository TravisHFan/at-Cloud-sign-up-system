import { Types } from "mongoose";
import ShortLink, { IShortLink } from "../models/ShortLink";
import Event from "../models/Event";
import { generateUniqueShortKey } from "../utils/shortLinkKey";
import { createLogger } from "./LoggerService";

const log = createLogger("ShortLinkService");

export type ShortLinkCreationResult = {
  created: boolean;
  shortLink: IShortLink;
};

export class ShortLinkService {
  /**
   * Compute expiry for a short link: use event end date/time if possible, otherwise default +30 days.
   */
  static computeExpiry(event: {
    endDate?: string;
    endTime?: string;
    date?: string;
    time?: string;
  }): Date {
    try {
      if (event?.endDate && event?.endTime) {
        const iso = `${event.endDate}T${event.endTime}:00Z`; // assume stored as wall clock w/out TZ; treat as UTC fallback
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {}
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }

  /**
   * Get existing active short link for event (idempotent) or create a new one.
   * Validates publish status & at least one public role.
   */
  static async getOrCreateForEvent(
    eventId: string,
    userId: string
  ): Promise<ShortLinkCreationResult> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new Error("Invalid eventId");
    }

    const event = await Event.findById(eventId).select(
      "publish publicSlug roles date endDate time endTime"
    );
    if (!event) {
      throw new Error("Event not found");
    }
    if (!event.publish || !event.publicSlug) {
      throw new Error("Event is not published");
    }
    const hasPublicRole =
      Array.isArray(event.roles) &&
      event.roles.some((r: any) => r.openToPublic === true);
    if (!hasPublicRole) {
      throw new Error("Event has no public roles");
    }

    // Idempotent: return existing active (not expired) link if present
    const existing = await ShortLink.findOne({
      eventId: event._id,
      isExpired: false,
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      return { created: false, shortLink: existing };
    }

    const key = await generateUniqueShortKey();
    const expiresAt = ShortLinkService.computeExpiry({
      endDate: (event as any).endDate,
      endTime: (event as any).endTime,
      date: (event as any).date,
      time: (event as any).time,
    });

    const shortLink = await ShortLink.create({
      key,
      eventId: event._id,
      targetSlug: event.publicSlug,
      createdBy: new Types.ObjectId(userId),
      expiresAt,
      isExpired: false,
    });

    log.info("Short link created", undefined, {
      key,
      eventId: event._id.toString(),
      expiresAt: expiresAt.toISOString(),
    });

    return { created: true, shortLink };
  }

  /**
   * Resolve key into redirect target.
   * Returns: { status: "active" | "expired" | "not_found", slug?: string }
   */
  static async resolveKey(
    key: string
  ): Promise<
    | { status: "active"; slug: string; eventId: string }
    | { status: "expired" }
    | { status: "not_found" }
  > {
    const link = await ShortLink.getActiveByKey(key);
    if (link) {
      return {
        status: "active",
        slug: link.targetSlug,
        eventId: link.eventId.toString(),
      };
    }
    // Check if it ever existed (for 410 vs 404 differentiation)
    const anyLink = await ShortLink.findOne({ key }).select(
      "isExpired expiresAt"
    );
    if (!anyLink) {
      return { status: "not_found" };
    }
    return { status: "expired" };
  }

  /** Mark all links for an event expired (e.g. on unpublish) */
  static async expireAllForEvent(eventId: string): Promise<number> {
    if (!Types.ObjectId.isValid(eventId)) return 0;
    const res = await ShortLink.updateMany(
      { eventId: new Types.ObjectId(eventId), isExpired: false },
      { $set: { isExpired: true, expiresAt: new Date() } }
    );
    log.info("Expired short links for event", undefined, {
      eventId,
      modified: res.modifiedCount,
    });
    return res.modifiedCount || 0;
  }
}

export default ShortLinkService;
