import { Request, Response } from "express";
import mongoose from "mongoose";
import Event from "../../models/Event";
import type { IEvent } from "../../models/Event";
import AuditLog from "../../models/AuditLog";
import { generateUniquePublicSlug } from "../../utils/publicSlug";
import { serializePublicEvent } from "../../utils/publicEventSerializer";
import { Logger } from "../../services/LoggerService";

const logger = Logger.getInstance().child("PublishingController");

/**
 * PublishingController
 *
 * Handles event publishing and unpublishing operations.
 * Manages public visibility, slug generation, and cache invalidation.
 */
export class PublishingController {
  /**
   * Publish an event making it publicly accessible via its publicSlug.
   * Rules:
   *  - Event must exist and user must be authorized (handled by route middleware)
   *  - Must have at least one role with openToPublic=true
   *  - If already published, idempotently return current public payload (do not change slug)
   *  - On first publish, generate a stable slug from title + short random suffix if none exists
   *  - Set publish=true and publishedAt (preserve original first publish timestamp if already set)
   */
  static async publishEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid event id" });
        return;
      }
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }
      // Validation (extended rules)
      const { validateEventForPublish } = await import(
        "../../utils/validatePublish"
      );
      const validation = validateEventForPublish(event as unknown as IEvent);
      if (!validation.valid) {
        // Detect aggregate missing necessary publish fields error
        const aggregate = validation.errors.find(
          (e) => e.code === "MISSING_REQUIRED_FIELDS"
        );
        if (aggregate) {
          // Extract missing list from per-field errors (exclude aggregate placeholder itself)
          const missing = validation.errors
            .filter((e) => e.code === "MISSING" && e.field !== "__aggregate__")
            .map((e) => e.field);
          res.status(422).json({
            success: false,
            code: "MISSING_REQUIRED_FIELDS",
            format: event.format,
            missing,
            message: aggregate.message,
            errors: validation.errors,
          });
        } else {
          res.status(400).json({
            success: false,
            message: "Publish validation failed",
            errors: validation.errors,
          });
        }
        return;
      }
      if (!event.publicSlug) {
        event.publicSlug = await generateUniquePublicSlug(event.title);
      }
      // Preserve first publishedAt across unpublish/re-publish cycles.
      const wasPreviouslyPublished = !!event.publishedAt; // original state
      event.publish = true;
      if (!wasPreviouslyPublished) {
        // First ever publish
        event.publishedAt = new Date();
      }
      await event.save();
      // NOTE: auto-unpublish flag only applies on update mutations; publish endpoint
      // never auto-unpublishes, so no notification logic is required here.
      try {
        const { bumpPublicEventsListVersion } = await import(
          "../../services/PublicEventsListCache"
        );
        bumpPublicEventsListVersion();
      } catch {}
      // Audit log
      try {
        await AuditLog.create({
          action: "EventPublished",
          actorId: req.user?._id || null,
          eventId: event._id,
          // Include eventId inside metadata as tests query on metadata.eventId
          metadata: {
            publicSlug: event.publicSlug,
            eventId: event._id.toString(),
          },
        });
      } catch {
        // non-blocking
      }
      // Return serialized public payload
      const payload = await serializePublicEvent(event as unknown as IEvent);
      res.status(200).json({ success: true, data: payload });
    } catch (err) {
      try {
        logger.error("Failed to publish event", err as Error);
      } catch {
        // swallow logging error
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to publish event" });
    }
  }

  /**
   * Unpublish an event. Makes the public endpoint return 404.
   * - Keeps publicSlug stable (so future republish keeps same URL)
   * - Sets publish=false; keeps publishedAt timestamp (history) but could be nullified if product decides
   */
  static async unpublishEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid event id" });
        return;
      }
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }
      if (!event.publish) {
        // Idempotent: already unpublished
        res.status(200).json({ success: true, message: "Already unpublished" });
        return;
      }
      event.publish = false;
      await event.save();
      try {
        const { bumpPublicEventsListVersion } = await import(
          "../../services/PublicEventsListCache"
        );
        bumpPublicEventsListVersion();
      } catch {}
      // Expire all short links for this event (non-blocking failure) and record metrics
      try {
        const { ShortLinkService } = await import(
          "../../services/ShortLinkService"
        );
        const { shortLinkExpireCounter } = await import(
          "../../services/PrometheusMetricsService"
        );
        const expired = await ShortLinkService.expireAllForEvent(
          event._id.toString()
        );
        if (expired > 0) {
          try {
            shortLinkExpireCounter.inc();
          } catch {}
        }
      } catch (e) {
        try {
          logger.warn("Failed to expire short links on unpublish", undefined, {
            eventId: id,
            error: (e as Error)?.message,
          });
        } catch {}
      }
      // Audit log
      try {
        await AuditLog.create({
          action: "EventUnpublished",
          actorId: req.user?._id || null,
          eventId: event._id,
          metadata: { publicSlug: event.publicSlug },
        });
      } catch {
        // swallow audit error
      }
      res.status(200).json({ success: true, message: "Event unpublished" });
    } catch (err) {
      try {
        logger.error("Failed to unpublish event", err as Error);
      } catch {
        // swallow logging error
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to unpublish event" });
    }
  }
}
