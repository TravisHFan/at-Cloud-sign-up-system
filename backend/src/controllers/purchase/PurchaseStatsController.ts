import { Request, Response } from "express";
import Purchase from "../../models/Purchase";

/**
 * PurchaseStatsController
 * Handles admin payment statistics
 */
class PurchaseStatsController {
  /**
   * Get payment statistics for admin dashboard
   * GET /api/admin/purchases/stats
   */
  static async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      // Check admin role
      if (
        req.user.role !== "Super Admin" &&
        req.user.role !== "Administrator"
      ) {
        res.status(403).json({
          success: false,
          message: "Only Super Admin and Administrator can access this.",
        });
        return;
      }

      // Get all completed purchases (excluding refunded ones)
      const completedPurchases = await Purchase.find({ status: "completed" });

      // Calculate total revenue (in cents) - completed purchases only
      const totalRevenue = completedPurchases.reduce(
        (sum, purchase) => sum + purchase.finalPrice,
        0
      );

      // Calculate refunded revenue separately
      const refundedPurchases = await Purchase.find({
        status: { $in: ["refunded", "refund_processing"] },
      });
      const refundedRevenue = refundedPurchases.reduce(
        (sum, purchase) => sum + purchase.finalPrice,
        0
      );

      // Calculate pending and failed revenue
      const pendingPurchases = await Purchase.find({ status: "pending" });
      const pendingRevenue = pendingPurchases.reduce(
        (sum, purchase) => sum + purchase.finalPrice,
        0
      );

      const failedPurchases = await Purchase.find({ status: "failed" });
      const failedRevenue = failedPurchases.reduce(
        (sum, purchase) => sum + purchase.finalPrice,
        0
      );

      // Net revenue = total revenue - refunded revenue
      const netRevenue = totalRevenue;

      // Count purchases by status
      const statusCounts = await Purchase.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusMap: Record<string, number> = {};
      statusCounts.forEach((item) => {
        statusMap[item._id] = item.count;
      });

      // Get recent purchases (last 30 days) - excluding refunded
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentPurchases = await Purchase.countDocuments({
        status: "completed",
        purchaseDate: { $gte: thirtyDaysAgo },
      });

      const recentRevenue = await Purchase.aggregate([
        {
          $match: {
            status: "completed",
            purchaseDate: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$finalPrice" },
          },
        },
      ]);

      // Count refunds in last 30 days
      const recentRefunds = await Purchase.countDocuments({
        status: { $in: ["refunded", "refund_processing"] },
        refundInitiatedAt: { $gte: thirtyDaysAgo },
      });

      const recentRefundedRevenue = await Purchase.aggregate([
        {
          $match: {
            status: { $in: ["refunded", "refund_processing"] },
            refundInitiatedAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$finalPrice" },
          },
        },
      ]);

      // Count unique buyers
      const uniqueBuyers = await Purchase.distinct("userId", {
        status: "completed",
      });

      // Class Rep statistics
      const classRepCount = await Purchase.countDocuments({
        status: "completed",
        isClassRep: true,
      });

      // Promo code usage
      const promoCodeUsage = await Purchase.countDocuments({
        status: "completed",
        promoCode: { $exists: true, $ne: "" },
      });

      res.status(200).json({
        success: true,
        data: {
          stats: {
            totalRevenue: netRevenue, // in cents - excluding refunded
            totalPurchases: statusMap.completed || 0,
            pendingPurchases: statusMap.pending || 0,
            pendingRevenue, // in cents - pending amount
            failedPurchases: statusMap.failed || 0,
            failedRevenue, // in cents - failed amount
            refundedPurchases:
              (statusMap.refunded || 0) + (statusMap.refund_processing || 0),
            refundedRevenue, // in cents - total refunded amount
            uniqueBuyers: uniqueBuyers.length,
            classRepPurchases: classRepCount,
            promoCodeUsage,
            last30Days: {
              purchases: recentPurchases,
              revenue: recentRevenue[0]?.total || 0,
              refunds: recentRefunds,
              refundedRevenue: recentRefundedRevenue[0]?.total || 0,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error fetching payment stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment statistics.",
      });
    }
  }
}

export default PurchaseStatsController;
