import { Router } from "express";
import { FeedbackController } from "../controllers/feedbackController";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/feedback - Submit feedback (authenticated users only)
router.post(
  "/",
  authenticate, // Require authentication
  FeedbackController.submitFeedback
);

export default router;
