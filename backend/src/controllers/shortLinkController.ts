import { Request, Response } from "express";
import ShortLinkService from "../services/ShortLinkService";
import { createLogger } from "../services/LoggerService";

const log = createLogger("ShortLinkController");

export class ShortLinkController {
  /** POST /api/public/short-links
   * Body: { eventId: string }
   * Requires auth. Returns existing active link (200) or newly created (201).
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }
      const { eventId } = req.body || {};
      if (!eventId || typeof eventId !== "string") {
        res
          .status(400)
          .json({ success: false, message: "eventId is required" });
        return;
      }
      const result = await ShortLinkService.getOrCreateForEvent(
        eventId,
        req.user.id || req.user._id
      );
      const baseUrl = process.env.PUBLIC_SHORT_BASE_URL || ""; // optionally inject absolute base
      const shortPath = `/s/${result.shortLink.key}`;
      const fullUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}${shortPath}`
        : shortPath;
      res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        data: {
          key: result.shortLink.key,
          eventId: result.shortLink.eventId,
          slug: result.shortLink.targetSlug,
          expiresAt: result.shortLink.expiresAt,
          url: fullUrl,
        },
      });
    } catch (error: any) {
      log.error(
        "Failed to create short link",
        error as Error | undefined,
        undefined,
        {
          eventId: req.body?.eventId,
          userId: (req as any).user?.id,
        }
      );
      const msg =
        typeof error?.message === "string"
          ? error.message
          : "Failed to create short link";
      if (/not found/i.test(msg)) {
        res.status(404).json({ success: false, message: msg });
        return;
      }
      if (/not published|no public roles|Invalid eventId/i.test(msg)) {
        res.status(400).json({ success: false, message: msg });
        return;
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to create short link" });
    }
  }

  /** GET /api/public/short-links/:key — status lookup (JSON) */
  static async resolve(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      if (!key) {
        res.status(400).json({ success: false, message: "Missing key" });
        return;
      }
      const result = await ShortLinkService.resolveKey(key);
      if (result.status === "active") {
        res.status(200).json({
          success: true,
          data: {
            status: "active",
            slug: result.slug,
            eventId: result.eventId,
          },
        });
        return;
      }
      if (result.status === "expired") {
        res
          .status(410)
          .json({
            success: false,
            status: "expired",
            message: "Short link expired",
          });
        return;
      }
      res
        .status(404)
        .json({
          success: false,
          status: "not_found",
          message: "Short link not found",
        });
    } catch (error) {
      log.error(
        "Failed to resolve short link",
        error as Error | undefined,
        undefined,
        {
          key: req.params?.key,
        }
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to resolve short link" });
    }
  }
}

export default ShortLinkController;
