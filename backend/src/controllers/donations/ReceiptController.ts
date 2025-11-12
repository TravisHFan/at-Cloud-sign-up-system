import { Request, Response } from "express";
import DonationTransaction from "../../models/DonationTransaction";
import User from "../../models/User";
import { createLogger } from "../../services/LoggerService";

const log = createLogger("ReceiptController");

interface YearlyStats {
  year: number;
  totalAmount: number;
  transactionCount: number;
  transactions: Array<{
    id: string;
    date: Date;
    amount: number;
    type: string;
    status: string;
  }>;
}

class ReceiptController {
  /**
   * Get donation receipt data for specified year(s)
   * GET /api/donations/receipt?years=2024,2023
   */
  async getReceipt(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const userId = req.user._id;
      const yearsParam = req.query.years as string;

      // Parse years from query parameter
      let selectedYears: number[] = [];
      if (yearsParam) {
        selectedYears = yearsParam
          .split(",")
          .map((y) => parseInt(y.trim(), 10))
          .filter(
            (y) => !isNaN(y) && y >= 2000 && y <= new Date().getFullYear() + 1
          );
      }

      // If no valid years specified, default to current year
      if (selectedYears.length === 0) {
        selectedYears = [new Date().getFullYear()];
      }

      // Fetch user information
      const user = await User.findById(userId).select(
        "firstName lastName email"
      );
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Fetch all completed transactions for the user
      const transactions = await DonationTransaction.find({
        userId: userId,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .lean();

      // Group transactions by year and calculate stats
      const yearlyData: Map<number, YearlyStats> = new Map();

      transactions.forEach((transaction) => {
        const year = new Date(transaction.createdAt).getFullYear();

        // Only include transactions from selected years
        if (!selectedYears.includes(year)) {
          return;
        }

        if (!yearlyData.has(year)) {
          yearlyData.set(year, {
            year,
            totalAmount: 0,
            transactionCount: 0,
            transactions: [],
          });
        }

        const yearStats = yearlyData.get(year)!;
        yearStats.totalAmount += transaction.amount;
        yearStats.transactionCount += 1;
        yearStats.transactions.push({
          id: transaction._id.toString(),
          date: transaction.createdAt,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
        });
      });

      // Convert map to sorted array (most recent year first)
      const yearlyStats = Array.from(yearlyData.values()).sort(
        (a, b) => b.year - a.year
      );

      // Calculate grand totals across all selected years
      const grandTotal = yearlyStats.reduce(
        (sum, year) => sum + year.totalAmount,
        0
      );
      const totalTransactions = yearlyStats.reduce(
        (sum, year) => sum + year.transactionCount,
        0
      );

      log.info(
        `Generated receipt for user ${userId} - Years: ${selectedYears.join(
          ", "
        )}, Total: $${(grandTotal / 100).toFixed(2)}`
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
          },
          selectedYears,
          summary: {
            grandTotal,
            totalTransactions,
            yearsCount: yearlyStats.length,
          },
          yearlyStats,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      log.error(
        "Error generating receipt:",
        error instanceof Error ? error : new Error("Unknown error")
      );
      res.status(500).json({
        success: false,
        message: "Failed to generate receipt.",
      });
    }
  }

  /**
   * Get available years for receipts
   * GET /api/donations/receipt/years
   */
  async getAvailableYears(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const userId = req.user._id;

      // Get all distinct years from user's completed transactions
      const transactions = await DonationTransaction.find({
        userId: userId,
        status: "completed",
      })
        .select("createdAt")
        .lean();

      const years = new Set<number>();
      transactions.forEach((transaction) => {
        years.add(new Date(transaction.createdAt).getFullYear());
      });

      const availableYears = Array.from(years).sort((a, b) => b - a);

      res.status(200).json({
        success: true,
        data: {
          years: availableYears,
        },
      });
    } catch (error) {
      log.error(
        "Error fetching available years:",
        error instanceof Error ? error : new Error("Unknown error")
      );
      res.status(500).json({
        success: false,
        message: "Failed to fetch available years.",
      });
    }
  }
}

export default new ReceiptController();
