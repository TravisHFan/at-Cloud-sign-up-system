import { Router } from "express";
import ShortLinkController from "../controllers/shortLinkController";
import { requireAuth } from "../utils/authUtils";

const router = Router();

// POST /api/public/short-links  (create or fetch existing)
router.post("/", requireAuth(), ShortLinkController.create);

// GET /api/public/short-links/:key  (status lookup)
router.get("/:key", ShortLinkController.resolve);

export default router;
