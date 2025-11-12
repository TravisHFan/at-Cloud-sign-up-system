import { Request, Response } from "express";
import Purchase from "../../models/Purchase";
import Program from "../../models/Program";
import mongoose from "mongoose";

/**
 * ProgramAnalyticsController
 * Handles analytics for program purchases
 */
export default class ProgramAnalyticsController {
  static async getProgramAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Check authorization: Super Admin, Administrator, Leader
      if (!["Super Admin", "Administrator", "Leader"].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message:
            "Access restricted to Super Admin, Administrator, and Leader",
        });
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all programs to map IDs to types and titles
      const programs = await Program.find().select("_id title programType");
      const programMap = new Map(
        programs.map((p) => [
          p._id.toString(),
          { title: p.title, type: p.programType },
        ])
      );

      // Get all completed purchases
      const completedPurchases = await Purchase.find({ status: "completed" })
        .populate("programId", "title programType")
        .lean();

      // Calculate program type breakdown
      const programTypeStats: Record<
        string,
        { revenue: number; purchases: number; uniqueBuyers: Set<string> }
      > = {};

      completedPurchases.forEach((purchase: any) => {
        const programType = purchase.programId?.programType || "Unknown";
        if (!programTypeStats[programType]) {
          programTypeStats[programType] = {
            revenue: 0,
            purchases: 0,
            uniqueBuyers: new Set(),
          };
        }
        programTypeStats[programType].revenue += purchase.finalPrice;
        programTypeStats[programType].purchases += 1;
        programTypeStats[programType].uniqueBuyers.add(
          purchase.userId.toString()
        );
      });

      // Convert to response format
      const programTypeBreakdown = Object.entries(programTypeStats).map(
        ([type, stats]) => ({
          programType: type,
          revenue: stats.revenue,
          purchases: stats.purchases,
          uniqueBuyers: stats.uniqueBuyers.size,
        })
      );

      // Calculate engagement metrics
      const totalRevenue = completedPurchases.reduce(
        (sum, p) => sum + p.finalPrice,
        0
      );
      const totalPurchases = completedPurchases.length;
      const uniqueBuyers = new Set(
        completedPurchases.map((p) => p.userId.toString())
      ).size;

      const classRepPurchases = completedPurchases.filter(
        (p) => p.isClassRep
      ).length;
      const classRepRevenue = completedPurchases
        .filter((p) => p.isClassRep)
        .reduce((sum, p) => sum + p.finalPrice, 0);

      const promoCodePurchases = completedPurchases.filter(
        (p) => p.promoCode && p.promoCode.trim() !== ""
      ).length;
      const promoCodeUsageRate =
        totalPurchases > 0 ? (promoCodePurchases / totalPurchases) * 100 : 0;

      const earlyBirdPurchases = completedPurchases.filter(
        (p) => p.isEarlyBird
      ).length;
      const earlyBirdRate =
        totalPurchases > 0 ? (earlyBirdPurchases / totalPurchases) * 100 : 0;

      const avgProgramPrice =
        totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

      // Last 30 days metrics
      const recentPurchases = completedPurchases.filter(
        (p) => new Date(p.purchaseDate) >= thirtyDaysAgo
      );
      const last30DaysRevenue = recentPurchases.reduce(
        (sum, p) => sum + p.finalPrice,
        0
      );
      const last30DaysPurchases = recentPurchases.length;

      // Get failed/pending/refunded counts and amounts
      const [pendingCount, failedCount, refundedCount] = await Promise.all([
        Purchase.countDocuments({ status: "pending" }),
        Purchase.countDocuments({ status: "failed" }),
        Purchase.countDocuments({
          status: { $in: ["refunded", "refund_processing"] },
        }),
      ]);

      const [pendingRevenue, failedRevenue, refundedRevenue] =
        await Promise.all([
          Purchase.aggregate([
            { $match: { status: "pending" } },
            { $group: { _id: null, total: { $sum: "$finalPrice" } } },
          ]),
          Purchase.aggregate([
            { $match: { status: "failed" } },
            { $group: { _id: null, total: { $sum: "$finalPrice" } } },
          ]),
          Purchase.aggregate([
            {
              $match: {
                status: { $in: ["refunded", "refund_processing"] },
              },
            },
            { $group: { _id: null, total: { $sum: "$finalPrice" } } },
          ]),
        ]);

      res.status(200).json({
        success: true,
        data: {
          totalRevenue, // in cents
          totalPurchases,
          uniqueBuyers,
          avgProgramPrice, // in cents
          classRepPurchases,
          classRepRevenue, // in cents
          classRepRate:
            totalPurchases > 0 ? (classRepPurchases / totalPurchases) * 100 : 0,
          promoCodePurchases,
          promoCodeUsageRate, // percentage
          earlyBirdPurchases,
          earlyBirdRate, // percentage
          pendingPurchases: pendingCount,
          pendingRevenue: pendingRevenue[0]?.total || 0, // in cents
          failedPurchases: failedCount,
          failedRevenue: failedRevenue[0]?.total || 0, // in cents
          refundedPurchases: refundedCount,
          refundedRevenue: refundedRevenue[0]?.total || 0, // in cents
          last30Days: {
            revenue: last30DaysRevenue, // in cents
            purchases: last30DaysPurchases,
          },
          programTypeBreakdown,
        },
      });
    } catch (error) {
      console.error("Error in getProgramAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch program analytics",
      });
    }
  }
}
