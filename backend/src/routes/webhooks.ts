import { Router } from "express";
import { WebhookController } from "../controllers/webhookController";

const router = Router();

// Stripe webhook endpoint - requires raw body for signature verification
// Note: This route should be registered with express.raw() middleware in app.ts
router.post("/stripe", WebhookController.handleStripeWebhook);

export default router;
