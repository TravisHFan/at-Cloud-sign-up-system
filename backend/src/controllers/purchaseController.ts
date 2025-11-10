import { Request, Response } from "express";

export class PurchaseController {
  /**
   * Create a Stripe Checkout Session for program purchase
   * POST /api/purchases/create-checkout-session
   */
  static async createCheckoutSession(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchaseCheckoutController } = await import(
      "./purchase/PurchaseCheckoutController"
    );
    return PurchaseCheckoutController.createCheckoutSession(req, res);
  }

  /**
   * Verify Stripe session and get purchase details
   * GET /api/purchases/verify-session/:sessionId
   */
  static async verifySession(req: Request, res: Response): Promise<void> {
    const { default: PurchaseVerificationController } = await import(
      "./purchase/PurchaseVerificationController"
    );
    return PurchaseVerificationController.verifySession(req, res);
  }

  /**
   * Get user's purchase history
   * GET /api/purchases/my-purchases
   */
  static async getMyPurchases(req: Request, res: Response): Promise<void> {
    const { default: PurchaseHistoryController } = await import(
      "./purchase/PurchaseHistoryController"
    );
    return PurchaseHistoryController.getMyPurchases(req, res);
  }

  /**
   * Get user's pending purchases with auto-cleanup of expired sessions
   * GET /api/purchases/my-pending-purchases
   */
  static async getMyPendingPurchases(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchasePendingController } = await import(
      "./purchase/PurchasePendingController"
    );
    return PurchasePendingController.getMyPendingPurchases(req, res);
  }

  /**
   * Get a specific purchase by ID
   * GET /api/purchases/:id
   */
  static async getPurchaseById(req: Request, res: Response): Promise<void> {
    const { default: PurchaseRetrievalController } = await import(
      "./purchase/PurchaseRetrievalController"
    );
    return PurchaseRetrievalController.getPurchaseById(req, res);
  }

  /**
   * Get purchase receipt data
   * GET /api/purchases/:id/receipt
   */
  static async getPurchaseReceipt(req: Request, res: Response): Promise<void> {
    const { default: PurchaseReceiptController } = await import(
      "./purchase/PurchaseReceiptController"
    );
    return PurchaseReceiptController.getPurchaseReceipt(req, res);
  }

  /**
   * Check if user has access to a program
   * GET /api/purchases/check-access/:programId
   */
  static async checkProgramAccess(req: Request, res: Response): Promise<void> {
    const { default: PurchaseAccessController } = await import(
      "./purchase/PurchaseAccessController"
    );
    return PurchaseAccessController.checkProgramAccess(req, res);
  }

  /**
   * Retry a pending purchase - creates a new checkout session
   * POST /api/purchases/retry/:id
   * Validates that user hasn't already purchased the program
   */
  static async retryPendingPurchase(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchaseRetryController } = await import(
      "./purchase/PurchaseRetryController"
    );
    return PurchaseRetryController.retryPendingPurchase(req, res);
  }

  /**
   * Cancel a pending purchase
   * DELETE /api/purchases/:id
   * Only allows deleting pending purchases
   */
  static async cancelPendingPurchase(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchaseCancellationController } = await import(
      "./purchase/PurchaseCancellationController"
    );
    return PurchaseCancellationController.cancelPendingPurchase(req, res);
  }

  /**
   * Get all purchases for admin (Super Admin & Administrator only)
   * GET /api/admin/purchases
   * Supports pagination and search
   */
  static async getAllPurchasesAdmin(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchaseAdminController } = await import(
      "./purchase/PurchaseAdminController"
    );
    return PurchaseAdminController.getAllPurchasesAdmin(req, res);
  }

  /**
   * Get payment statistics for admin dashboard
   * GET /api/admin/purchases/stats
   */
  static async getPaymentStats(req: Request, res: Response): Promise<void> {
    const { default: PurchaseStatsController } = await import(
      "./purchase/PurchaseStatsController"
    );
    return PurchaseStatsController.getPaymentStats(req, res);
  }

  /**
   * Check refund eligibility for a purchase
   * GET /api/purchases/refund-eligibility/:purchaseId
   */
  static async checkRefundEligibility(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PurchaseRefundController } = await import(
      "./purchase/PurchaseRefundController"
    );
    return PurchaseRefundController.checkRefundEligibility(req, res);
  }

  /**
   * Initiate a refund for a completed purchase
   * POST /api/purchases/refund
   */
  static async initiateRefund(req: Request, res: Response): Promise<void> {
    const { default: PurchaseRefundController } = await import(
      "./purchase/PurchaseRefundController"
    );
    return PurchaseRefundController.initiateRefund(req, res);
  }
}

export default PurchaseController;
