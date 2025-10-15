import { Router } from "express";
import { PurchaseController } from "../controllers/purchaseController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All purchase routes require authentication
router.use(authenticate);

// Create checkout session for program purchase
router.post(
  "/create-checkout-session",
  PurchaseController.createCheckoutSession
);

// Verify Stripe session and get purchase details
router.get("/verify-session/:sessionId", PurchaseController.verifySession);

// Get user's purchase history
router.get("/my-purchases", PurchaseController.getMyPurchases);

// Get user's pending purchases (with auto-cleanup of expired sessions)
router.get("/my-pending-purchases", PurchaseController.getMyPendingPurchases);

// Retry a pending purchase (creates new checkout session with duplicate check)
router.post("/retry/:id", PurchaseController.retryPendingPurchase);

// Check if user has access to a program
router.get("/check-access/:programId", PurchaseController.checkProgramAccess);

// Get specific purchase details
router.get("/:id", PurchaseController.getPurchaseById);

// Get purchase receipt
router.get("/:id/receipt", PurchaseController.getPurchaseReceipt);

// Cancel a pending purchase
router.delete("/:id", PurchaseController.cancelPendingPurchase);

// TEMPORARY: Manually complete purchase (for testing webhook issues)
// Remove this in production
router.post("/:id/complete", PurchaseController.manuallyCompletePurchase);

export default router;
