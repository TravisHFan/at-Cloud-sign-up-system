import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Program } from "../models";
import type { IProgram } from "../models/Program";
import { createCheckoutSession as stripeCreateCheckoutSession } from "../services/stripeService";

export class PurchaseController {
  /**
   * Create a Stripe Checkout Session for program purchase
   * POST /api/purchases/create-checkout-session
   */
  static async createCheckoutSession(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { programId, isClassRep } = req.body;

      // Validate program ID
      if (!programId || !mongoose.Types.ObjectId.isValid(programId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      // Fetch program details
      const program = await Program.findById(programId);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Check if program is free
      if (program.isFree) {
        res.status(400).json({
          success: false,
          message: "This program is free and does not require purchase.",
        });
        return;
      }

      // Check if user already purchased this program
      const existingPurchase = await Purchase.findOne({
        userId: req.user._id,
        programId: program._id,
        status: "completed",
      });

      if (existingPurchase) {
        res.status(400).json({
          success: false,
          message: "You have already purchased this program.",
        });
        return;
      }

      // Check Class Rep limit if user selected Class Rep option
      if (isClassRep && program.classRepLimit && program.classRepLimit > 0) {
        const classRepCount = await Purchase.countDocuments({
          programId: program._id,
          isClassRep: true,
          status: "completed",
        });

        if (classRepCount >= program.classRepLimit) {
          res.status(400).json({
            success: false,
            message:
              "Class Rep slots are full. Please proceed with standard pricing.",
          });
          return;
        }
      }

      // Calculate pricing
      const fullPrice = program.fullPriceTicket;
      let classRepDiscount = 0;
      let earlyBirdDiscount = 0;
      let isEarlyBird = false;

      // Apply Class Rep discount if selected
      if (isClassRep && program.classRepDiscount) {
        classRepDiscount = program.classRepDiscount;
      }

      // Apply Early Bird discount if applicable
      if (program.earlyBirdDeadline && program.earlyBirdDiscount) {
        const now = new Date();
        const deadline = new Date(program.earlyBirdDeadline);
        if (now <= deadline) {
          earlyBirdDiscount = program.earlyBirdDiscount;
          isEarlyBird = true;
        }
      }

      // Calculate final price
      const finalPrice = Math.max(
        0,
        fullPrice - classRepDiscount - earlyBirdDiscount
      );

      // Create Stripe Checkout Session
      const session = await stripeCreateCheckoutSession({
        userId: (req.user._id as mongoose.Types.ObjectId).toString(),
        userEmail: req.user.email,
        programId: program._id.toString(),
        programTitle: program.title,
        fullPrice,
        classRepDiscount,
        earlyBirdDiscount,
        finalPrice,
        isClassRep: !!isClassRep,
        isEarlyBird,
      });

      // Create pending purchase record
      const orderNumber = await (
        Purchase as unknown as {
          generateOrderNumber: () => Promise<string>;
        }
      ).generateOrderNumber();
      await Purchase.create({
        userId: req.user._id,
        programId: program._id,
        orderNumber,
        fullPrice,
        classRepDiscount,
        earlyBirdDiscount,
        finalPrice,
        isClassRep: !!isClassRep,
        isEarlyBird,
        stripeSessionId: session.id,
        status: "pending",
        billingInfo: {
          fullName:
            `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
            req.user.username,
          email: req.user.email,
        },
        paymentMethod: {
          type: "card",
        },
        purchaseDate: new Date(),
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
        },
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create checkout session.",
        error: (error as Error).message,
      });
    }
  }

  /**
   * Verify Stripe session and get purchase details
   * GET /api/purchases/verify-session/:sessionId
   */
  static async verifySession(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { sessionId } = req.params;

      if (!sessionId) {
        res
          .status(400)
          .json({ success: false, message: "Session ID is required." });
        return;
      }

      // Find purchase by session ID and user ID
      // Note: We don't filter by status here because purchase might still be "pending"
      // when user lands on success page (webhook might not have processed yet)
      const purchase = await Purchase.findOne({
        stripeSessionId: sessionId,
        userId: req.user._id,
      }).populate("programId", "title programType");

      if (!purchase) {
        res.status(404).json({
          success: false,
          message: "Purchase not found. Please wait a moment and try again.",
        });
        return;
      }

      console.log("✅ Purchase found:", {
        id: purchase._id,
        orderNumber: purchase.orderNumber,
        programId: purchase.programId,
        status: purchase.status,
      });

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error verifying session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify session.",
      });
    }
  }

  /**
   * Get user's purchase history
   * GET /api/purchases/my-purchases
   */
  static async getMyPurchases(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const purchases = await Purchase.find({
        userId: req.user._id,
        status: "completed",
      })
        .populate("programId", "title programType")
        .sort({ purchaseDate: -1 });

      res.status(200).json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchase history.",
      });
    }
  }

  /**
   * Get a specific purchase by ID
   * GET /api/purchases/:id
   */
  static async getPurchaseById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(id).populate(
        "programId",
        "title programType hostedBy mentors"
      );

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Admins can view any purchase
      const isAdmin =
        req.user.role === "Super Admin" || req.user.role === "Administrator";

      // Check if user is a mentor of this program
      const program = purchase.programId as unknown as IProgram;
      const isMentor = program.mentors?.some(
        (mentor: { userId: mongoose.Types.ObjectId }) =>
          mentor.userId.toString() ===
          (req.user!._id as mongoose.Types.ObjectId).toString()
      );

      // Check if user is the purchase owner
      const isOwner =
        purchase.userId.toString() ===
        (req.user._id as mongoose.Types.ObjectId).toString();

      // Allow access if user is owner, admin, or mentor
      if (!isOwner && !isAdmin && !isMentor) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error fetching purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchase.",
      });
    }
  }

  /**
   * Get purchase receipt data
   * GET /api/purchases/:id/receipt
   */
  static async getPurchaseReceipt(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(id)
        .populate("programId", "title programType hostedBy")
        .populate("userId", "firstName lastName email");

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Admins can view any receipt
      const isAdmin =
        req.user.role === "Super Admin" || req.user.role === "Administrator";

      // Check if user owns this purchase
      const purchaseUserId =
        typeof purchase.userId === "object" && "_id" in purchase.userId
          ? (purchase.userId._id as mongoose.Types.ObjectId).toString()
          : (purchase.userId as mongoose.Types.ObjectId).toString();

      const isOwner =
        purchaseUserId === (req.user._id as mongoose.Types.ObjectId).toString();

      // Allow access if user is owner or admin
      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      // Only show receipt for completed purchases
      if (purchase.status !== "completed") {
        res.status(400).json({
          success: false,
          message: "Receipt is only available for completed purchases.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch receipt.",
      });
    }
  }

  /**
   * Check if user has access to a program
   * GET /api/purchases/check-access/:programId
   */
  static async checkProgramAccess(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { programId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(programId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      const program = await Program.findById(programId);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Super Admin and Administrator have access to all programs
      if (
        req.user.role === "Super Admin" ||
        req.user.role === "Administrator"
      ) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "admin" },
        });
        return;
      }

      // Check if user is a mentor of this program
      const isMentor = program.mentors?.some(
        (mentor: { userId: mongoose.Types.ObjectId }) =>
          mentor.userId.toString() ===
          (req.user!._id as mongoose.Types.ObjectId).toString()
      );
      if (isMentor) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "mentor" },
        });
        return;
      }

      // Check if program is free
      if (program.isFree) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "free" },
        });
        return;
      }

      // Check if user has purchased the program
      const purchase = await Purchase.findOne({
        userId: req.user._id,
        programId: program._id,
        status: "completed",
      });

      if (purchase) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "purchased" },
        });
        return;
      }

      // No access
      res.status(200).json({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    } catch (error) {
      console.error("Error checking program access:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check program access.",
      });
    }
  }

  /**
   * TEMPORARY: Manually complete a pending purchase (for testing)
   * POST /api/purchases/:id/complete
   * Only for development/testing - remove in production
   */
  static async manuallyCompletePurchase(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(id);

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Check if user owns this purchase
      if (
        purchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You can only complete your own purchases.",
        });
        return;
      }

      if (purchase.status === "completed") {
        res.status(400).json({
          success: false,
          message: "Purchase is already completed.",
        });
        return;
      }

      // Manually mark as completed
      purchase.status = "completed";
      purchase.purchaseDate = new Date();
      await purchase.save();

      console.log("✅ Manually completed purchase:", purchase.orderNumber);

      res.status(200).json({
        success: true,
        message: "Purchase marked as completed.",
        data: purchase,
      });
    } catch (error) {
      console.error("Error completing purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to complete purchase.",
      });
    }
  }
}
