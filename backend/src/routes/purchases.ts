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

// Get user's purchase history
router.get("/my-purchases", PurchaseController.getMyPurchases);

// Check if user has access to a program
router.get("/check-access/:programId", PurchaseController.checkProgramAccess);

// Get specific purchase details
router.get("/:id", PurchaseController.getPurchaseById);

// Get purchase receipt
router.get("/:id/receipt", PurchaseController.getPurchaseReceipt);

export default router;
