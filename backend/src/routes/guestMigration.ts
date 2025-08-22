import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { GuestMigrationController } from "../controllers/guestMigrationController";

const router = Router();

// All endpoints require an authenticated admin
router.use(authenticate, requireAdmin);

// GET /api/guest-migration/eligible?email=...
router.get("/eligible", GuestMigrationController.getEligibleByEmail);

// POST /api/guest-migration/validate { userId, email }
router.post("/validate", GuestMigrationController.validate);

// POST /api/guest-migration/perform { userId, email }
router.post("/perform", GuestMigrationController.perform);

export default router;
