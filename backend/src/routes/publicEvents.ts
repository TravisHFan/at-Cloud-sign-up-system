import { Router } from "express";
import Event from "../models/Event";
import { serializePublicEvent } from "../utils/publicEventSerializer";

const router = Router();

// GET /api/public/events/:slug
router.get("/events/:slug", async (req, res) => {
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
    const payload = await serializePublicEvent(event as unknown as any);
    return res.status(200).json({ success: true, data: payload });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to load public event" });
  }
});

export default router;
