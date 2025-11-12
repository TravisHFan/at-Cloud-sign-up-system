import { Request, Response } from "express";
import Donation from "../../models/Donation";
import DonationTransaction from "../../models/DonationTransaction";

/**
 * DonationAnalyticsController
 * Handles analytics for donations
 */
export default class DonationAnalyticsController {
  static async getDonationAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
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

      // Get completed donation transactions
      const completedTransactions = await DonationTransaction.find({
        status: "completed",
      }).lean();

      // Calculate one-time vs recurring breakdown
      const oneTimeGifts = completedTransactions.filter(
        (t) => t.type === "one-time"
      );
      const recurringGifts = completedTransactions.filter(
        (t) => t.type === "recurring"
      );

      const oneTimeRevenue = oneTimeGifts.reduce((sum, t) => sum + t.amount, 0);
      const recurringRevenue = recurringGifts.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      const avgOneTimeGift =
        oneTimeGifts.length > 0 ? oneTimeRevenue / oneTimeGifts.length : 0;
      const avgRecurringGift =
        recurringGifts.length > 0
          ? recurringRevenue / recurringGifts.length
          : 0;

      // Get active recurring donations
      const activeDonations = await Donation.find({
        type: "recurring",
        status: "active",
      }).lean();

      // Get scheduled (one-time future) donations
      const scheduledDonations = await Donation.find({
        type: "one-time",
        status: "scheduled",
      }).lean();

      // Get on-hold donations
      const onHoldDonations = await Donation.find({
        type: "recurring",
        status: "on_hold",
      }).lean();

      // Calculate unique donors
      const uniqueDonors = new Set(
        completedTransactions.map((t) => t.userId.toString())
      ).size;

      // Calculate frequency distribution for recurring donations
      const frequencyBreakdown = await Donation.aggregate([
        {
          $match: {
            type: "recurring",
            status: { $in: ["active", "on_hold"] },
          },
        },
        {
          $group: {
            _id: "$frequency",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const frequencyStats = frequencyBreakdown.map((item) => ({
        frequency: item._id || "Unknown",
        count: item.count,
        monthlyValue: item.totalAmount, // Amount per occurrence
      }));

      // Calculate active recurring monthly revenue
      // Convert all recurring donations to monthly equivalent
      const frequencyMultipliers: Record<string, number> = {
        weekly: 52 / 12, // ~4.33 weeks per month
        biweekly: 26 / 12, // ~2.17 bi-weeks per month
        monthly: 1,
        quarterly: 1 / 3, // ~0.33 months per quarter
        annually: 1 / 12, // ~0.08 months per year
      };

      const activeRecurringRevenue = activeDonations.reduce((sum, donation) => {
        const frequency = donation.frequency || "monthly";
        const multiplier = frequencyMultipliers[frequency] || 1;
        return sum + donation.amount * multiplier;
      }, 0);

      // Calculate average gifts per donor
      const avgGiftsPerDonor =
        uniqueDonors > 0 ? completedTransactions.length / uniqueDonors : 0;

      // Calculate donor retention (donors with more than 1 gift)
      const donorGiftCounts = new Map<string, number>();
      completedTransactions.forEach((t) => {
        const donorId = t.userId.toString();
        donorGiftCounts.set(donorId, (donorGiftCounts.get(donorId) || 0) + 1);
      });
      const repeatDonors = Array.from(donorGiftCounts.values()).filter(
        (count) => count > 1
      ).length;
      const retentionRate =
        uniqueDonors > 0 ? (repeatDonors / uniqueDonors) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          totalRevenue: oneTimeRevenue + recurringRevenue, // in cents
          totalGifts: completedTransactions.length,
          uniqueDonors,
          avgGiftsPerDonor,
          retentionRate, // percentage
          oneTime: {
            gifts: oneTimeGifts.length,
            revenue: oneTimeRevenue, // in cents
            avgGiftSize: avgOneTimeGift, // in cents
          },
          recurring: {
            gifts: recurringGifts.length,
            revenue: recurringRevenue, // in cents
            avgGiftSize: avgRecurringGift, // in cents
            activeDonations: activeDonations.length,
            activeRecurringRevenue, // in cents - monthly equivalent
            onHoldDonations: onHoldDonations.length,
            scheduledDonations: scheduledDonations.length,
            frequencyBreakdown: frequencyStats,
          },
        },
      });
    } catch (error) {
      console.error("Error in getDonationAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch donation analytics",
      });
    }
  }
}
