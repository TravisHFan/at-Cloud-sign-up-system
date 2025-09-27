import { Router } from "express";
import ShortLinkController from "../controllers/shortLinkController";
import { requireAuth } from "../utils/authUtils";
import { shortLinkCreationRateLimit } from "../middleware/publicRateLimit";

const router = Router();

// POST /api/public/short-links  (create or fetch existing)
router.post(
  "/",
  requireAuth(),
  shortLinkCreationRateLimit,
  ShortLinkController.create
);

// GET /api/public/short-links/:key  (status lookup)
router.get("/:key", ShortLinkController.resolve);

export default router;
