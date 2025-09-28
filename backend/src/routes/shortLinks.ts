import { Router } from "express";
import ShortLinkController from "../controllers/shortLinkController";
import { shortLinkCreationRateLimit } from "../middleware/publicRateLimit";
// NOTE: We intentionally do NOT require auth for public short-link creation anymore.
// Frontend share modal is visible to anonymous visitors on a published event page.
// The controller will internally allow unauthenticated requests and attribute them
// to a sentinel user id so metrics still function.

const router = Router();

// POST /api/public/short-links  (create or fetch existing)
router.post("/", shortLinkCreationRateLimit, ShortLinkController.create);

// GET /api/public/short-links/:key  (status lookup)
router.get("/:key", ShortLinkController.resolve);

export default router;
