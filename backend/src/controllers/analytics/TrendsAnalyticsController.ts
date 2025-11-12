import { Request, Response } from "express";
import Purchase from "../../models/Purchase";
import DonationTransaction from "../../models/DonationTransaction";

/**
 * TrendsAnalyticsController
 * Handles time-series financial trends analytics
 */
export default class TrendsAnalyticsController {
  static async getTrends(req: Request, res: Response): Promise<void> {
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

      const { period = "6months" } = req.query;

      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case "6months":
          startDate.setMonth(now.getMonth() - 6);
          break;
        case "12months":
          startDate.setMonth(now.getMonth() - 12);
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
        case "custom":
          // Custom date range from query params
          const { startDate: customStart, endDate: customEnd } = req.query;
          if (customStart && typeof customStart === "string") {
            startDate = new Date(customStart);
          }
          if (customEnd && typeof customEnd === "string") {
            now.setTime(new Date(customEnd).getTime());
          }
          break;
        default:
          startDate.setMonth(now.getMonth() - 6);
      }

      // Aggregate program purchases by month
      const programTrends = await Purchase.aggregate([
        {
          $match: {
            status: "completed",
            purchaseDate: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$purchaseDate" },
              month: { $month: "$purchaseDate" },
            },
            revenue: { $sum: "$finalPrice" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]);

      // Aggregate donation transactions by month
      const donationTrends = await DonationTransaction.aggregate([
        {
          $match: {
            status: "completed",
            giftDate: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$giftDate" },
              month: { $month: "$giftDate" },
            },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]);

      // Create a map of all months in the range
      const monthsMap = new Map<
        string,
        { programRevenue: number; donationRevenue: number }
      >();

      // Initialize all months in range with zero values
      const current = new Date(startDate);
      while (current <= now) {
        const key = `${current.getFullYear()}-${String(
          current.getMonth() + 1
        ).padStart(2, "0")}`;
        monthsMap.set(key, { programRevenue: 0, donationRevenue: 0 });
        current.setMonth(current.getMonth() + 1);
      }

      // Fill in program revenue
      programTrends.forEach((item) => {
        const key = `${item._id.year}-${String(item._id.month).padStart(
          2,
          "0"
        )}`;
        const existing = monthsMap.get(key) || {
          programRevenue: 0,
          donationRevenue: 0,
        };
        existing.programRevenue = item.revenue;
        monthsMap.set(key, existing);
      });

      // Fill in donation revenue
      donationTrends.forEach((item) => {
        const key = `${item._id.year}-${String(item._id.month).padStart(
          2,
          "0"
        )}`;
        const existing = monthsMap.get(key) || {
          programRevenue: 0,
          donationRevenue: 0,
        };
        existing.donationRevenue = item.revenue;
        monthsMap.set(key, existing);
      });

      // Convert to arrays
      const sortedKeys = Array.from(monthsMap.keys()).sort();
      const labels = sortedKeys.map((key) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      });

      const programRevenue = sortedKeys.map(
        (key) => monthsMap.get(key)?.programRevenue || 0
      );
      const donationRevenue = sortedKeys.map(
        (key) => monthsMap.get(key)?.donationRevenue || 0
      );
      const combinedRevenue = sortedKeys.map(
        (key) =>
          (monthsMap.get(key)?.programRevenue || 0) +
          (monthsMap.get(key)?.donationRevenue || 0)
      );

      res.status(200).json({
        success: true,
        data: {
          period: period as string,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          labels,
          programRevenue, // in cents
          donationRevenue, // in cents
          combinedRevenue, // in cents
        },
      });
    } catch (error) {
      console.error("Error in getTrends:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch financial trends",
      });
    }
  }
}
