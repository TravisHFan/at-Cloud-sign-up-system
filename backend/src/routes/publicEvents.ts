import { Router } from "express";
import Event, { IEvent } from "../models/Event";
import { serializePublicEvent } from "../utils/publicEventSerializer";
import PublicEventController from "../controllers/publicEventController";
import { publicRegistrationRateLimit } from "../middleware/publicRateLimit";
import {
  getOrSetPublicEventsList,
  PublicEventsListParams,
} from "../services/PublicEventsListCache";
import Registration from "../models/Registration";
import { ValidationUtils } from "../utils/validationUtils";
import { authenticateOptional } from "../middleware/auth";

const router = Router();

// GET /api/public/events (listing)
router.get("/events", async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const pageSizeRaw = parseInt(String(req.query.pageSize || "10"), 10) || 10;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 50);
    const type =
      typeof req.query.type === "string" ? req.query.type : undefined;
    const dateFrom =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const sort =
      typeof req.query.sort === "string" ? req.query.sort : "startAsc";

    const params: PublicEventsListParams = {
      page,
      pageSize,
      type,
      dateFrom,
      dateTo,
      q,
      sort,
    };

    const entry = await getOrSetPublicEventsList(params, async () => {
      const filter: Record<string, unknown> = { publish: true };
      if (type) filter.type = type;
      if (dateFrom || dateTo) {
        if (dateFrom)
          filter.date = {
            ...(filter.date as Record<string, unknown>),
            $gte: dateFrom,
          };
        if (dateTo)
          filter.date = {
            ...(filter.date as Record<string, unknown>),
            $lte: dateTo,
          };
      }
      // Basic search (fallback simple regex – could upgrade to $text if index configured)
      if (q) {
        const safe = ValidationUtils.sanitizeString(q).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        filter.title = { $regex: safe, $options: "i" };
      }

      const sortObj: Record<string, 1 | -1> = {};
      if (sort === "startDesc") {
        sortObj.date = -1;
        sortObj.time = -1;
      } else {
        sortObj.date = 1;
        sortObj.time = 1;
      }

      const total = await Event.countDocuments(filter);
      const events = await Event.find(filter)
        .sort(sortObj)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select(
          "title publicSlug date endDate time endTime location flyerUrl roles publish"
        )
        .lean();

      // Collect capacity for open roles
      const roleMap: { [eventId: string]: { roleId: string; max: number }[] } =
        {};
      const roleIds: { eventId: string; roleId: string }[] = [];
      for (const ev of events) {
        const openRoles = (ev.roles || []).filter(
          (r: { openToPublic?: boolean }) => r.openToPublic
        );
        roleMap[(ev as { _id: { toString: () => string } })._id.toString()] =
          openRoles.map((r: { id: string; maxParticipants: number }) => ({
            roleId: r.id,
            max: r.maxParticipants,
          }));
        for (const r of openRoles) {
          roleIds.push({
            eventId: (ev as { _id: { toString: () => string } })._id.toString(),
            roleId: r.id,
          });
        }
      }
      let occupancy: Record<string, number> = {};
      if (roleIds.length) {
        const occ = await Registration.aggregate<{
          _id: { eventId: string; roleId: string };
          count: number;
        }>([
          {
            $match: {
              eventId: { $in: events.map((e: { _id: unknown }) => e._id) },
              roleId: { $in: roleIds.map((r) => r.roleId) },
              status: "active",
            },
          },
          {
            $group: {
              _id: { eventId: "$eventId", roleId: "$roleId" },
              count: { $sum: 1 },
            },
          },
        ]);
        occupancy = occ.reduce<Record<string, number>>((acc, row) => {
          const k = `${row._id.eventId}:${row._id.roleId}`;
          acc[k] = row.count;
          return acc;
        }, {});
      }

      const items = events.map((ev: Record<string, unknown>) => {
        const evId = (ev._id as { toString: () => string }).toString();
        const openRoles = roleMap[evId] || [];
        let capacityRemaining = 0;
        for (const r of openRoles) {
          const used = occupancy[`${evId}:${r.roleId}`] || 0;
          capacityRemaining += Math.max(0, r.max - used);
        }
        const startISO = `${ev.date}T${ev.time}:00Z`;
        const endISO = `${ev.endDate || ev.date}T${ev.endTime}:00Z`;
        return {
          title: ev.title,
          slug: ev.publicSlug,
          start: startISO,
          end: endISO,
          location: ev.location || "Online",
          flyerUrl: ev.flyerUrl,
          rolesOpen: openRoles.length,
          capacityRemaining,
        };
      });

      return {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        items,
      };
    });

    if (req.headers["if-none-match"] === entry.etag) {
      return res.status(304).set("ETag", entry.etag).send();
    }
    return res
      .status(200)
      .set("ETag", entry.etag)
      .json({ success: true, data: entry.payload });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Failed to list public events" });
  }
});

// GET /api/public/events/:slug
router.get("/events/:slug", authenticateOptional, async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Missing slug" });
    }
    const event = await Event.findOne({
      publicSlug: slug,
      publish: true,
    }).lean();
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Public event not found" });
    }

    // event is a plain object due to .lean(); we assert required fields for serializer
    const payload = await serializePublicEvent(event as unknown as IEvent);
    return res.status(200).json({
      success: true,
      data: { ...payload, isAuthenticated: !!req.user },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to load public event" });
  }
});

// POST /api/public/events/:slug/register
router.post(
  "/events/:slug/register",
  publicRegistrationRateLimit,
  PublicEventController.register
);

export default router;
