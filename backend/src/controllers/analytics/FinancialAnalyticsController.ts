import { Request, Response } from "express";
import Purchase from "../../models/Purchase";
import DonationService from "../../services/DonationService";

/**
 * FinancialAnalyticsController
 * Handles combined financial analytics (programs + donations)
 */
export default class FinancialAnalyticsController {
  static async getFinancialSummary(req: Request, res: Response): Promise<void> {
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

      // Get program purchase stats
      const completedPurchases = await Purchase.find({ status: "completed" });
      const programRevenue = completedPurchases.reduce(
        (sum, p) => sum + p.finalPrice,
        0
      );
      const programPurchases = completedPurchases.length;
      const uniqueBuyers = new Set(
        completedPurchases.map((p) => p.userId.toString())
      ).size;

      // Last 30 days program stats
      const recentPurchases = await Purchase.find({
        status: "completed",
        purchaseDate: { $gte: thirtyDaysAgo },
      });
      const programLast30DaysRevenue = recentPurchases.reduce(
        (sum, p) => sum + p.finalPrice,
        0
      );
      const programLast30DaysPurchases = recentPurchases.length;

      // Get donation stats
      const donationStats = await DonationService.getAdminDonationStats();

      // Calculate combined totals
      const totalRevenue = programRevenue + donationStats.totalRevenue;
      const totalTransactions = programPurchases + donationStats.totalDonations;
      const uniqueParticipants = uniqueBuyers + donationStats.uniqueDonors; // Note: may have overlap
      const last30DaysRevenue =
        programLast30DaysRevenue + donationStats.last30Days.revenue;
      const last30DaysTransactions =
        programLast30DaysPurchases + donationStats.last30Days.donations;

      // Calculate growth rate (last 30 days vs all time)
      const avgDailyRevenueAllTime = totalRevenue / 365; // Rough estimate
      const avgDailyRevenueLast30 = last30DaysRevenue / 30;
      const growthRate =
        avgDailyRevenueAllTime > 0
          ? ((avgDailyRevenueLast30 - avgDailyRevenueAllTime) /
              avgDailyRevenueAllTime) *
            100
          : 0;

      // Calculate percentage of revenue from last 30 days
      const last30DaysPercentage =
        totalRevenue > 0 ? (last30DaysRevenue / totalRevenue) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          // Combined totals
          totalRevenue, // in cents
          totalTransactions,
          uniqueParticipants,
          growthRate, // percentage
          last30Days: {
            revenue: last30DaysRevenue, // in cents
            transactions: last30DaysTransactions,
            percentage: last30DaysPercentage, // percentage of all-time
          },
          // Program breakdown
          programs: {
            revenue: programRevenue, // in cents
            purchases: programPurchases,
            uniqueBuyers,
            last30Days: {
              revenue: programLast30DaysRevenue, // in cents
              purchases: programLast30DaysPurchases,
            },
          },
          // Donation breakdown
          donations: {
            revenue: donationStats.totalRevenue, // in cents
            gifts: donationStats.totalDonations,
            uniqueDonors: donationStats.uniqueDonors,
            last30Days: {
              revenue: donationStats.last30Days.revenue, // in cents
              donations: donationStats.last30Days.donations,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error in getFinancialSummary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch financial summary",
      });
    }
  }
}
