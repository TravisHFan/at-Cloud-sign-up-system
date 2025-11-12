import express from "express";
import DonationController from "../controllers/DonationController";
import ReceiptController from "../controllers/donations/ReceiptController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = express.Router();

/**
 * All donation routes require authentication
 */
router.use(authenticate);

// Admin routes
router.get("/admin/all", requireAdmin, DonationController.getAllDonations);
router.get("/admin/stats", requireAdmin, DonationController.getAdminStats);

// Create a new donation
router.post("/create", DonationController.createDonation);

// Retry checkout for a pending donation
router.post(
  "/:donationId/retry-checkout",
  DonationController.retryDonationCheckout
);

// Get user's donation history
router.get("/my-donations", DonationController.getMyDonations);

// Get user's scheduled donations
router.get("/my-scheduled", DonationController.getMyScheduledDonations);

// Get user's donation stats
router.get("/stats", DonationController.getStats);

// Get donation receipt data
router.get("/receipt", ReceiptController.getReceipt);

// Get available years for receipts
router.get("/receipt/years", ReceiptController.getAvailableYears);

// Edit a scheduled donation
router.put("/:id/edit", DonationController.editDonation);

// Place donation on hold
router.put("/:id/hold", DonationController.holdDonation);

// Resume donation from hold
router.put("/:id/resume", DonationController.resumeDonation);

// Cancel donation
router.delete("/:id/cancel", DonationController.cancelDonation);

export default router;
