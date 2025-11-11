import Donation, {
  IDonation,
  DonationType,
  DonationFrequency,
} from "../models/Donation";
import DonationTransaction, {
  IDonationTransaction,
} from "../models/DonationTransaction";
import User from "../models/User";
import { addWeeks, addMonths, addYears } from "date-fns";
import mongoose from "mongoose";

interface CreateDonationParams {
  userId: string;
  amount: number; // in cents
  type: DonationType;
  frequency?: DonationFrequency;
  giftDate?: Date; // for one-time
  startDate?: Date; // for recurring
  endDate?: Date;
  endAfterOccurrences?: number;
}

interface DonationStats {
  totalAmount: number;
  totalGifts: number;
}

class DonationService {
  /**
   * Create a new donation record
   */
  async createDonation(params: CreateDonationParams): Promise<IDonation> {
    const {
      userId,
      amount,
      type,
      frequency,
      giftDate,
      startDate,
      endDate,
      endAfterOccurrences,
    } = params;

    // Validation
    if (amount < 100 || amount > 99999900) {
      throw new Error("Amount must be between $1.00 and $999,999.00");
    }

    if (type === "one-time" && !giftDate) {
      throw new Error("Gift date is required for one-time donations");
    }

    if (type === "recurring") {
      if (!frequency) {
        throw new Error("Frequency is required for recurring donations");
      }
      if (!startDate) {
        throw new Error("Start date is required for recurring donations");
      }
    }

    // Get or create Stripe customer
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // For now, we'll set a placeholder - this will be updated when Stripe checkout completes
    const stripeCustomerId = user.stripeCustomerId || "pending";

    const donationData: Partial<IDonation> = {
      userId: user._id,
      amount,
      type,
      frequency,
      status: "pending", // All donations start as pending until payment is confirmed
      giftDate,
      startDate,
      endDate,
      endAfterOccurrences,
      currentOccurrence: 0,
      stripeCustomerId,
    };

    // Calculate remaining occurrences if specified
    if (type === "recurring" && endAfterOccurrences) {
      donationData.remainingOccurrences = endAfterOccurrences;
    }

    // Set next payment date
    if (type === "recurring" && startDate) {
      donationData.nextPaymentDate = startDate;
    }

    const donation = await Donation.create(donationData);
    return donation;
  }

  /**
   * Get user's donation history (completed transactions)
   */
  async getUserDonationHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    sortBy: string = "giftDate",
    sortOrder: string = "desc"
  ): Promise<{
    transactions: IDonationTransaction[];
    pending: IDonation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortField = sortBy === "giftDate" ? "giftDate" : "giftDate"; // Default to giftDate

    // Fetch completed transactions
    const [transactions, total] = await Promise.all([
      DonationTransaction.find({
        userId,
        status: "completed",
      })
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      DonationTransaction.countDocuments({
        userId,
        status: "completed",
      }),
    ]);

    // Fetch pending one-time donations (only on first page)
    const pending =
      page === 1
        ? await Donation.find({
            userId,
            type: "one-time",
            status: "pending",
          })
            .sort({ giftDate: -1 })
            .lean()
        : [];

    return {
      transactions: transactions as IDonationTransaction[],
      pending: pending as IDonation[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's scheduled/active donations
   */
  async getUserScheduledDonations(userId: string): Promise<IDonation[]> {
    const donations = await Donation.find({
      userId,
      status: { $in: ["scheduled", "active", "on_hold"] },
    })
      .sort({ nextPaymentDate: 1 })
      .lean();

    return donations as IDonation[];
  }

  /**
   * Get user's donation stats
   */
  async getUserDonationStats(userId: string): Promise<DonationStats> {
    const result = await DonationTransaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalGifts: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        totalAmount: 0,
        totalGifts: 0,
      };
    }

    return {
      totalAmount: result[0].totalAmount,
      totalGifts: result[0].totalGifts,
    };
  }

  /**
   * Update donation (edit scheduled donation)
   */
  async updateDonation(
    donationId: string,
    userId: string,
    updates: Partial<CreateDonationParams>
  ): Promise<IDonation> {
    const donation = await Donation.findOne({
      _id: donationId,
      userId,
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.status === "completed" || donation.status === "cancelled") {
      throw new Error("Cannot edit completed or cancelled donation");
    }

    // Update allowed fields
    if (updates.amount !== undefined) {
      if (updates.amount < 100 || updates.amount > 99999900) {
        throw new Error("Amount must be between $1.00 and $999,999.00");
      }
      donation.amount = updates.amount;
    }

    if (updates.frequency) {
      donation.frequency = updates.frequency;
    }

    if (updates.startDate) {
      donation.startDate = updates.startDate;
      donation.nextPaymentDate = updates.startDate;
    }

    if (updates.giftDate) {
      donation.giftDate = updates.giftDate;
    }

    if (updates.endDate !== undefined) {
      donation.endDate = updates.endDate;
    }

    if (updates.endAfterOccurrences !== undefined) {
      donation.endAfterOccurrences = updates.endAfterOccurrences;
      donation.remainingOccurrences = updates.endAfterOccurrences;
    }

    await donation.save();
    return donation;
  }

  /**
   * Place donation on hold
   */
  async holdDonation(donationId: string, userId: string): Promise<IDonation> {
    const donation = await Donation.findOne({
      _id: donationId,
      userId,
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.type === "one-time") {
      throw new Error("Cannot hold one-time donations");
    }

    if (donation.status !== "active") {
      throw new Error("Can only hold active donations");
    }

    donation.status = "on_hold";
    await donation.save();

    return donation;
  }

  /**
   * Resume donation from hold
   */
  async resumeDonation(donationId: string, userId: string): Promise<IDonation> {
    const donation = await Donation.findOne({
      _id: donationId,
      userId,
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.status !== "on_hold") {
      throw new Error("Can only resume donations that are on hold");
    }

    donation.status = "active";
    await donation.save();

    return donation;
  }

  /**
   * Cancel donation
   */
  async cancelDonation(donationId: string, userId: string): Promise<IDonation> {
    const donation = await Donation.findOne({
      _id: donationId,
      userId,
    });

    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.status === "completed") {
      throw new Error("Cannot cancel completed donation");
    }

    if (donation.status === "cancelled") {
      throw new Error("Donation is already cancelled");
    }

    donation.status = "cancelled";
    await donation.save();

    return donation;
  }

  /**
   * Record a successful donation transaction (called from webhook)
   */
  async recordTransaction(data: {
    donationId: string;
    userId: string;
    amount: number;
    type: DonationType;
    stripePaymentIntentId: string;
    paymentMethod?: {
      cardBrand?: string;
      last4?: string;
    };
  }): Promise<IDonationTransaction> {
    const transaction = await DonationTransaction.create({
      donationId: data.donationId,
      userId: data.userId,
      amount: data.amount,
      type: data.type,
      status: "completed",
      giftDate: new Date(),
      stripePaymentIntentId: data.stripePaymentIntentId,
      paymentMethod: data.paymentMethod,
    });

    // Update donation record
    const donation = await Donation.findById(data.donationId);
    if (donation) {
      // Update payment method if provided
      if (data.paymentMethod) {
        donation.paymentMethod = {
          type: "card",
          ...data.paymentMethod,
        };
      }

      // For recurring donations, update occurrence counts
      if (donation.type === "recurring") {
        donation.currentOccurrence = (donation.currentOccurrence || 0) + 1;

        if (donation.remainingOccurrences !== undefined) {
          donation.remainingOccurrences = Math.max(
            0,
            donation.remainingOccurrences - 1
          );
        }

        // Calculate next payment date
        if (donation.frequency && donation.nextPaymentDate) {
          donation.nextPaymentDate = this.calculateNextPaymentDate(
            donation.nextPaymentDate,
            donation.frequency
          );
        }

        // Check if completed
        if (
          donation.endAfterOccurrences &&
          donation.currentOccurrence >= donation.endAfterOccurrences
        ) {
          donation.status = "completed";
          donation.lastGiftDate = new Date();
        }
      } else if (donation.type === "one-time") {
        // One-time donation completed
        donation.status = "completed";
      }

      await donation.save();
    }

    return transaction;
  }

  /**
   * Calculate next payment date based on frequency
   */
  private calculateNextPaymentDate(
    currentDate: Date,
    frequency: DonationFrequency
  ): Date {
    switch (frequency) {
      case "weekly":
        return addWeeks(currentDate, 1);
      case "biweekly":
        return addWeeks(currentDate, 2);
      case "monthly":
        return addMonths(currentDate, 1);
      case "quarterly":
        return addMonths(currentDate, 3);
      case "annually":
        return addYears(currentDate, 1);
      default:
        return addMonths(currentDate, 1);
    }
  }

  /**
   * Calculate total amount for recurring donation with end condition
   */
  calculateTotalAmount(
    amount: number,
    frequency: DonationFrequency,
    startDate: Date,
    endCondition:
      | { type: "date"; endDate: Date }
      | { type: "occurrences"; count: number }
  ): { totalGifts: number; totalAmount: number; endDate: Date } {
    if (endCondition.type === "occurrences") {
      return {
        totalGifts: endCondition.count,
        totalAmount: amount * endCondition.count,
        endDate: this.calculateEndDateFromOccurrences(
          startDate,
          frequency,
          endCondition.count
        ),
      };
    } else {
      const gifts = this.calculateOccurrencesBetweenDates(
        startDate,
        endCondition.endDate,
        frequency
      );
      return {
        totalGifts: gifts,
        totalAmount: amount * gifts,
        endDate: endCondition.endDate,
      };
    }
  }

  /**
   * Calculate end date from number of occurrences
   */
  private calculateEndDateFromOccurrences(
    startDate: Date,
    frequency: DonationFrequency,
    occurrences: number
  ): Date {
    let endDate = new Date(startDate);

    switch (frequency) {
      case "weekly":
        endDate = addWeeks(startDate, occurrences);
        break;
      case "biweekly":
        endDate = addWeeks(startDate, occurrences * 2);
        break;
      case "monthly":
        endDate = addMonths(startDate, occurrences);
        break;
      case "quarterly":
        endDate = addMonths(startDate, occurrences * 3);
        break;
      case "annually":
        endDate = addYears(startDate, occurrences);
        break;
    }

    return endDate;
  }

  /**
   * Calculate number of occurrences between two dates
   */
  private calculateOccurrencesBetweenDates(
    startDate: Date,
    endDate: Date,
    frequency: DonationFrequency
  ): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diffMs = end - start;

    if (diffMs <= 0) return 0;

    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (frequency) {
      case "weekly":
        return Math.floor(diffDays / 7);
      case "biweekly":
        return Math.floor(diffDays / 14);
      case "monthly":
        return Math.floor(diffDays / 30); // Approximate
      case "quarterly":
        return Math.floor(diffDays / 91); // Approximate
      case "annually":
        return Math.floor(diffDays / 365);
      default:
        return 0;
    }
  }
}

export default new DonationService();
