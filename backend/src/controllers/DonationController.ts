import { Request, Response } from "express";
import mongoose from "mongoose";
import DonationService from "../services/DonationService";
import Donation, { DonationFrequency, DonationType } from "../models/Donation";
import {
  createDonationCheckoutSession,
  createDonationSubscription,
  updateDonationSubscription,
  pauseDonationSubscription,
  resumeDonationSubscription,
  cancelDonationSubscription,
} from "../services/stripeService";
import { ValidationError, NotFoundError } from "../utils/errors";

class DonationController {
  /**
   * Create a new donation
   * POST /api/donations/create
   */
  async createDonation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const {
        amount,
        type,
        frequency,
        giftDate,
        startDate,
        endDate,
        endAfterOccurrences,
      } = req.body;

      // Validation
      if (!amount || !type) {
        res.status(400).json({
          success: false,
          message: "Amount and type are required.",
        });
        return;
      }

      // Create donation record
      const donation = await DonationService.createDonation({
        userId: (req.user._id as mongoose.Types.ObjectId).toString(),
        amount: Math.round(amount), // Already in cents from frontend
        type: type as DonationType,
        frequency: frequency as DonationFrequency,
        giftDate: giftDate ? new Date(giftDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        endAfterOccurrences,
      });

      // Create Stripe checkout session
      let checkoutUrl = "";

      if (type === "one-time") {
        // One-time donation
        const session = await createDonationCheckoutSession({
          donationId: (donation._id as mongoose.Types.ObjectId).toString(),
          userId: (req.user._id as mongoose.Types.ObjectId).toString(),
          userEmail: req.user.email,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          amount: Math.round(amount), // Already in cents from frontend
          giftDate: giftDate ? new Date(giftDate) : new Date(),
        });

        checkoutUrl = session.url || "";

        // Store Stripe session ID
        donation.stripeCustomerId = session.customer as string;
        await donation.save();
      } else {
        // Recurring donation
        const result = await createDonationSubscription({
          donationId: (donation._id as mongoose.Types.ObjectId).toString(),
          userId: (req.user._id as mongoose.Types.ObjectId).toString(),
          userEmail: req.user.email,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          amount: Math.round(amount), // Already in cents from frontend
          frequency: frequency as DonationFrequency,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : undefined,
        });

        checkoutUrl = result.checkoutUrl;
      }

      res.status(201).json({
        success: true,
        message: "Donation created successfully.",
        data: {
          donationId: donation._id,
          checkoutUrl,
        },
      });
    } catch (error) {
      console.error("Error creating donation:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create donation.",
      });
    }
  }

  /**
   * Retry checkout for a pending donation
   * POST /api/donations/:donationId/retry-checkout
   */
  async retryDonationCheckout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { donationId } = req.params;

      // Find the pending donation
      const donation = await Donation.findOne({
        _id: donationId,
        userId: req.user._id,
        status: "pending",
        type: "one-time",
      });

      if (!donation) {
        res.status(404).json({
          success: false,
          message: "Pending donation not found.",
        });
        return;
      }

      // Create new checkout session
      const session = await createDonationCheckoutSession({
        donationId: (donation._id as mongoose.Types.ObjectId).toString(),
        userId: (req.user._id as mongoose.Types.ObjectId).toString(),
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        amount: donation.amount,
        giftDate: donation.giftDate || new Date(),
      });

      res.status(200).json({
        success: true,
        data: {
          checkoutUrl: session.url || "",
        },
      });
    } catch (error) {
      console.error("Error retrying donation checkout:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to retry donation checkout.",
      });
    }
  }

  /**
   * Get user's donation history
   * GET /api/donations/my-donations
   */
  async getMyDonations(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = (req.query.sortBy as string) || "giftDate";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      const result = await DonationService.getUserDonationHistory(
        (req.user._id as mongoose.Types.ObjectId).toString(),
        page,
        limit,
        sortBy,
        sortOrder
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching donation history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch donation history.",
      });
    }
  }

  /**
   * Get user's scheduled donations
   * GET /api/donations/my-scheduled
   */
  async getMyScheduledDonations(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const donations = await DonationService.getUserScheduledDonations(
        (req.user._id as mongoose.Types.ObjectId).toString()
      );

      res.status(200).json({
        success: true,
        data: {
          scheduled: donations,
        },
      });
    } catch (error) {
      console.error("Error fetching scheduled donations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch scheduled donations.",
      });
    }
  }

  /**
   * Get user's donation stats
   * GET /api/donations/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const stats = await DonationService.getUserDonationStats(
        (req.user._id as mongoose.Types.ObjectId).toString()
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching donation stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch donation stats.",
      });
    }
  }

  /**
   * Update/edit a scheduled donation
   * PUT /api/donations/:id/edit
   */
  async editDonation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { id } = req.params;
      const {
        amount,
        frequency,
        startDate,
        giftDate,
        endDate,
        endAfterOccurrences,
      } = req.body;

      const updates: Record<string, unknown> = {};

      if (amount !== undefined) {
        updates.amount = Math.round(amount * 100); // Convert to cents
      }
      if (frequency) updates.frequency = frequency;
      if (startDate) updates.startDate = new Date(startDate);
      if (giftDate) updates.giftDate = new Date(giftDate);
      if (endDate !== undefined) {
        updates.endDate = endDate ? new Date(endDate) : null;
      }
      if (endAfterOccurrences !== undefined) {
        updates.endAfterOccurrences = endAfterOccurrences;
      }

      const donation = await DonationService.updateDonation(
        id,
        (req.user._id as mongoose.Types.ObjectId).toString(),
        updates
      );

      // Update Stripe subscription if it's a recurring donation
      if (donation.type === "recurring" && donation.stripeSubscriptionId) {
        const stripeUpdates: {
          subscriptionId: string;
          amount?: number;
          frequency?: DonationFrequency;
          endDate?: Date | null;
        } = {
          subscriptionId: donation.stripeSubscriptionId,
          amount: updates.amount as number | undefined,
          frequency: updates.frequency as DonationFrequency | undefined,
        };

        // Handle end date updates (schedule cancellation)
        if (endDate !== undefined) {
          stripeUpdates.endDate = endDate ? new Date(endDate) : null;
        }

        await updateDonationSubscription(stripeUpdates);
      }

      res.status(200).json({
        success: true,
        message: "Donation updated successfully.",
        data: {
          donation,
        },
      });
    } catch (error) {
      console.error("Error updating donation:", error);

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update donation.",
      });
    }
  }

  /**
   * Place donation on hold
   * PUT /api/donations/:id/hold
   */
  async holdDonation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { id } = req.params;

      const donation = await DonationService.holdDonation(
        id,
        (req.user._id as mongoose.Types.ObjectId).toString()
      );

      // Pause Stripe subscription
      if (donation.stripeSubscriptionId) {
        await pauseDonationSubscription(donation.stripeSubscriptionId);
      }

      res.status(200).json({
        success: true,
        message: "Donation placed on hold.",
        data: {
          donation,
        },
      });
    } catch (error) {
      console.error("Error holding donation:", error);

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to hold donation.",
      });
    }
  }

  /**
   * Resume donation from hold
   * PUT /api/donations/:id/resume
   */
  async resumeDonation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { id } = req.params;

      const donation = await DonationService.resumeDonation(
        id,
        (req.user._id as mongoose.Types.ObjectId).toString()
      );

      // Resume Stripe subscription
      if (donation.stripeSubscriptionId) {
        await resumeDonationSubscription(donation.stripeSubscriptionId);
      }

      res.status(200).json({
        success: true,
        message: "Donation resumed.",
        data: {
          donation,
        },
      });
    } catch (error) {
      console.error("Error resuming donation:", error);

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to resume donation.",
      });
    }
  }

  /**
   * Cancel donation
   * DELETE /api/donations/:id/cancel
   */
  async cancelDonation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { id } = req.params;

      const donation = await DonationService.cancelDonation(
        id,
        (req.user._id as mongoose.Types.ObjectId).toString()
      );

      // Cancel Stripe subscription
      if (donation.type === "recurring" && donation.stripeSubscriptionId) {
        await cancelDonationSubscription(donation.stripeSubscriptionId);
      }

      res.status(200).json({
        success: true,
        message: "Donation cancelled.",
        data: {
          donation,
        },
      });
    } catch (error) {
      console.error("Error cancelling donation:", error);

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to cancel donation.",
      });
    }
  }

  /**
   * Get all donations (Admin only)
   * GET /api/donations/admin/all
   */
  async getAllDonations(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || "";
      const statusFilter = (req.query.status as string) || "all";

      const result = await DonationService.getAllDonations(
        page,
        limit,
        search,
        statusFilter
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching all donations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch donations.",
      });
    }
  }

  /**
   * Get donation statistics (Admin only)
   * GET /api/donations/admin/stats
   */
  async getAdminStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const stats = await DonationService.getAdminDonationStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching admin donation stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch donation statistics.",
      });
    }
  }
}

export default new DonationController();
