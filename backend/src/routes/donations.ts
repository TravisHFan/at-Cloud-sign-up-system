import express from "express";
import DonationController from "../controllers/DonationController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

/**
 * All donation routes require authentication
 */

// Create a new donation
router.post("/create", authenticate, DonationController.createDonation);

// Retry checkout for a pending donation
router.post(
  "/:donationId/retry-checkout",
  authenticate,
  DonationController.retryDonationCheckout
);

// Get user's donation history
router.get("/my-donations", authenticate, DonationController.getMyDonations);

// Get user's scheduled donations
router.get(
  "/my-scheduled",
  authenticate,
  DonationController.getMyScheduledDonations
);

// Get user's donation stats
router.get("/stats", authenticate, DonationController.getStats);

// Edit a scheduled donation
router.put("/:id/edit", authenticate, DonationController.editDonation);

// Place donation on hold
router.put("/:id/hold", authenticate, DonationController.holdDonation);

// Resume donation from hold
router.put("/:id/resume", authenticate, DonationController.resumeDonation);

// Cancel donation
router.delete("/:id/cancel", authenticate, DonationController.cancelDonation);

export default router;
