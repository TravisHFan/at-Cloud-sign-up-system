import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Program, PromoCode, User } from "../models";
import type { IProgram } from "../models/Program";
import type { IPromoCode } from "../models/PromoCode";
import { createCheckoutSession as stripeCreateCheckoutSession } from "../services/stripeService";
import { lockService } from "../services/LockService";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";

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

      const { programId, isClassRep, promoCode } = req.body;

      // Extract user info early (needed for promo validation)
      const userId = req.user._id;
      const userEmail = req.user.email;
      const userName =
        `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
        req.user.username;

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

      // Validate and fetch promo code if provided
      let validatedPromoCode: IPromoCode | null = null;
      if (promoCode) {
        validatedPromoCode = await PromoCode.findOne({ code: promoCode });

        if (!validatedPromoCode) {
          res.status(400).json({
            success: false,
            message: "Invalid promo code.",
          });
          return;
        }

        // Validate promo code can be used for this program
        const validation = validatedPromoCode.canBeUsedForProgram(program._id);
        if (!validation.valid) {
          res.status(400).json({
            success: false,
            message:
              validation.reason || "Promo code is not valid for this program.",
          });
          return;
        }

        // Verify code belongs to user (skip for general codes that have no owner)
        if (!validatedPromoCode.isGeneral) {
          if (
            !validatedPromoCode.ownerId ||
            validatedPromoCode.ownerId.toString() !==
              (userId as mongoose.Types.ObjectId).toString()
          ) {
            res.status(400).json({
              success: false,
              message: "This promo code does not belong to you.",
            });
            return;
          }
        }

        // Additional check for staff codes: verify allowedProgramIds if specified
        if (
          validatedPromoCode.type === "staff_access" &&
          validatedPromoCode.allowedProgramIds &&
          validatedPromoCode.allowedProgramIds.length > 0
        ) {
          const programIdStr = program._id.toString();
          const allowedIds = validatedPromoCode.allowedProgramIds.map((id) =>
            id.toString()
          );
          if (!allowedIds.includes(programIdStr)) {
            res.status(400).json({
              success: false,
              message: "This staff code is not valid for this program.",
            });
            return;
          }
        }
      }

      // Check if program is free
      if (program.isFree) {
        res.status(400).json({
          success: false,
          message: "This program is free and does not require purchase.",
        });
        return;
      }

      // Check if user already purchased this program (outside lock - read-only)
      const existingCompletedPurchase = await Purchase.findOne({
        userId: req.user._id,
        programId: program._id,
        status: "completed",
      });

      if (existingCompletedPurchase) {
        res.status(400).json({
          success: false,
          message: "You have already purchased this program.",
        });
        return;
      }

      // === CRITICAL SECTION: Lock prevents race conditions ===
      const lockKey = `purchase:create:${req.user._id}:${programId}`;

      const result = await lockService.withLock(
        lockKey,
        async () => {
          // 1. Check pending purchase within lock (prevents duplicates)
          const pendingPurchase = await Purchase.findOne({
            userId: userId,
            programId: program._id,
            status: "pending",
          });

          // If pending exists, DELETE it and create a new one with fresh pricing
          // This allows users to change their enrollment options (Class Rep, promo code, etc.)
          if (pendingPurchase) {
            console.log(
              `Found existing pending purchase ${pendingPurchase.orderNumber} - deleting to create fresh session with updated pricing`
            );

            // Cancel old Stripe session if it exists
            if (pendingPurchase.stripeSessionId) {
              try {
                const { stripe } = await import("../services/stripeService");
                const existingSession = await stripe.checkout.sessions.retrieve(
                  pendingPurchase.stripeSessionId
                );

                // Only try to expire if session is still open
                if (existingSession.status === "open") {
                  await stripe.checkout.sessions.expire(
                    pendingPurchase.stripeSessionId
                  );
                  console.log(
                    `Expired old Stripe session ${pendingPurchase.stripeSessionId}`
                  );
                }
              } catch (error) {
                console.error(
                  "Error expiring old Stripe session:",
                  error instanceof Error ? error.message : error
                );
                // Continue anyway - old session will expire in 24h
              }
            }

            // Delete the old pending purchase
            await Purchase.deleteOne({ _id: pendingPurchase._id });
            console.log(
              `Deleted old pending purchase ${pendingPurchase.orderNumber}`
            );
          }

          // 2. Check and RESERVE Class Rep spot atomically (using atomic counter)
          if (
            isClassRep &&
            program.classRepLimit &&
            program.classRepLimit > 0
          ) {
            // Atomic increment: only succeeds if under limit
            // Note: Use $or to handle both existing count < limit AND missing count (null/undefined)
            const updatedProgram = await Program.findOneAndUpdate(
              {
                _id: program._id,
                $or: [
                  { classRepCount: { $lt: program.classRepLimit } }, // Existing count < limit
                  { classRepCount: { $exists: false } }, // Field doesn't exist yet (legacy programs)
                  { classRepCount: null }, // Field is null
                ],
              },
              {
                $inc: { classRepCount: 1 }, // Atomically increment (0 if field missing)
              },
              {
                new: true, // Return updated document
                runValidators: true, // Run validation
              }
            );

            if (!updatedProgram) {
              // Failed to increment = limit reached
              throw new Error(
                "Class Rep slots are full. Please proceed with standard pricing."
              );
            }

            console.log(
              `Class Rep spot reserved: ${updatedProgram.classRepCount}/${program.classRepLimit}`
            );
          }

          // 3. Calculate pricing
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

          // Calculate promo discount
          let promoDiscountAmount = 0;
          let promoDiscountPercent = 0;

          if (validatedPromoCode) {
            if (validatedPromoCode.type === "bundle_discount") {
              // Bundle codes provide fixed dollar discount
              promoDiscountAmount = validatedPromoCode.discountAmount || 0;
            } else if (validatedPromoCode.type === "staff_access") {
              // Staff codes provide percentage discount
              promoDiscountPercent = validatedPromoCode.discountPercent || 0;
            }
          }

          // Calculate final price
          // First apply fixed discounts (Class Rep + Early Bird + Promo Amount)
          let finalPrice = Math.max(
            0,
            fullPrice -
              classRepDiscount -
              earlyBirdDiscount -
              promoDiscountAmount
          );

          // Then apply percentage discounts (Promo Percent for staff codes)
          if (promoDiscountPercent > 0) {
            finalPrice = Math.max(
              0,
              Math.round(finalPrice * (1 - promoDiscountPercent / 100))
            );
          }

          // Special case: 100% off (free purchase) - skip Stripe entirely
          if (finalPrice === 0) {
            // Generate order number
            const orderNumber = await (
              Purchase as unknown as {
                generateOrderNumber: () => Promise<string>;
              }
            ).generateOrderNumber();

            // Create completed purchase immediately (no Stripe needed)
            const purchase = await Purchase.create({
              userId: userId,
              programId: program._id,
              orderNumber,
              fullPrice,
              classRepDiscount,
              earlyBirdDiscount,
              finalPrice: 0,
              isClassRep: !!isClassRep,
              isEarlyBird,
              // Promo code fields
              promoCode: validatedPromoCode?.code,
              promoDiscountAmount:
                promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
              promoDiscountPercent:
                promoDiscountPercent > 0 ? promoDiscountPercent : undefined,
              // No Stripe session needed
              stripeSessionId: undefined,
              stripePaymentIntentId: undefined,
              status: "completed", // Mark as completed immediately
              billingInfo: {
                fullName: userName,
                email: userEmail,
              },
              paymentMethod: {
                type: "other", // Not a card payment
              },
              purchaseDate: new Date(),
            });

            // Mark promo code as used
            if (validatedPromoCode) {
              console.log(
                `🔍 DEBUG: Promo code "${validatedPromoCode.code}" being marked as used`
              );
              console.log(
                `🔍 DEBUG: isGeneral = ${validatedPromoCode.isGeneral}`
              );
              console.log(
                `🔍 DEBUG: Full promo code object:`,
                JSON.stringify(validatedPromoCode, null, 2)
              );

              await validatedPromoCode.markAsUsed(
                program._id,
                userId as mongoose.Types.ObjectId,
                userName,
                userEmail,
                program.title
              );

              // Send notification to admins if it's a general staff code
              if (validatedPromoCode.isGeneral) {
                console.log(
                  `✅ DEBUG: This IS a general code, sending admin notifications...`
                );
                try {
                  // Find all administrators
                  const admins = await User.find({
                    role: { $in: ["Super Admin", "Administrator"] },
                  }).select("_id");

                  console.log(`🔍 DEBUG: Found ${admins.length} admin users`);
                  const adminIds = admins.map((admin) => admin._id.toString());

                  if (adminIds.length > 0) {
                    console.log(
                      `📤 DEBUG: Sending notification to ${adminIds.length} admins...`
                    );
                    await TrioNotificationService.createTrio({
                      systemMessage: {
                        title: "General Staff Code Used",
                        content: `${userName} (${userEmail}) used general staff code "${validatedPromoCode.code}" for program "${program.title}".`,
                        type: "announcement",
                        priority: "medium",
                        hideCreator: true, // System-generated notification, no sender
                        metadata: {
                          promoCodeId: (
                            validatedPromoCode._id as mongoose.Types.ObjectId
                          ).toString(),
                          userId: (
                            userId as mongoose.Types.ObjectId
                          ).toString(),
                          programId: program._id.toString(),
                        },
                      },
                      recipients: adminIds,
                    });
                    console.log(
                      `✅ DEBUG: Admin notification sent successfully!`
                    );
                  } else {
                    console.log(`⚠️ DEBUG: No admin users found to notify`);
                  }
                } catch (notifyError) {
                  console.error(
                    "Failed to notify admins of general code usage:",
                    notifyError
                  );
                  // Don't fail the purchase if notification fails
                }
              } else {
                console.log(
                  `❌ DEBUG: This is NOT a general code (isGeneral = ${validatedPromoCode.isGeneral}), skipping admin notification`
                );
              }
            }

            console.log(
              `Free purchase completed (100% off) for user ${userId}, program ${programId}, order ${orderNumber}`
            );

            // Return success without Stripe redirect
            return {
              sessionId: null,
              sessionUrl: null,
              orderId: purchase.orderNumber,
              isFree: true,
            };
          }

          // Validate final price meets Stripe's minimum of $0.50 (50 cents)
          if (finalPrice < 50) {
            throw new Error(
              `The total price after discounts is $${(finalPrice / 100).toFixed(
                2
              )}. Stripe requires a minimum charge of $0.50. Please contact an administrator for enrollment assistance.`
            );
          }

          // 4. Create Stripe session FIRST (can't rollback, but expires in 24h)
          const stripeSession = await stripeCreateCheckoutSession({
            userId: (userId as mongoose.Types.ObjectId).toString(),
            userEmail: userEmail,
            programId: program._id.toString(),
            programTitle: program.title,
            fullPrice,
            classRepDiscount,
            earlyBirdDiscount,
            promoCode: validatedPromoCode?.code,
            promoDiscountAmount:
              promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
            promoDiscountPercent:
              promoDiscountPercent > 0 ? promoDiscountPercent : undefined,
            finalPrice,
            isClassRep: !!isClassRep,
            isEarlyBird,
          });

          // 5. Create purchase record SECOND (atomic within lock)
          const orderNumber = await (
            Purchase as unknown as {
              generateOrderNumber: () => Promise<string>;
            }
          ).generateOrderNumber();

          await Purchase.create({
            userId: userId,
            programId: program._id,
            orderNumber,
            fullPrice,
            classRepDiscount,
            earlyBirdDiscount,
            finalPrice,
            isClassRep: !!isClassRep,
            isEarlyBird,
            // Promo code fields
            promoCode: validatedPromoCode?.code,
            promoDiscountAmount:
              promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
            promoDiscountPercent:
              promoDiscountPercent > 0 ? promoDiscountPercent : undefined,
            stripeSessionId: stripeSession.id,
            status: "pending",
            billingInfo: {
              fullName: userName,
              email: userEmail,
            },
            paymentMethod: {
              type: "card",
            },
            purchaseDate: new Date(),
          });

          console.log(
            `Purchase created successfully for user ${userId}, program ${programId}`
          );

          return {
            sessionId: stripeSession.id,
            sessionUrl: stripeSession.url,
            existing: false,
          };
        },
        10000 // 10s timeout for Stripe API calls
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);

      // Check if it's a lock timeout
      if (error instanceof Error && error.message.includes("Lock timeout")) {
        res.status(503).json({
          success: false,
          message: "Purchase operation in progress, please wait and try again.",
        });
        return;
      }

      // Check if it's a Class Rep limit error
      if (
        error instanceof Error &&
        error.message.includes("Class Rep slots are full")
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

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
   * Get user's pending purchases with auto-cleanup of expired sessions
   * GET /api/purchases/my-pending-purchases
   */
  static async getMyPendingPurchases(
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

      // Auto-cleanup 1: Delete pending purchases older than 24 hours (Stripe session expiration)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredCleanupResult = await Purchase.deleteMany({
        userId: req.user._id,
        status: "pending",
        createdAt: { $lt: twentyFourHoursAgo },
      });

      if (expiredCleanupResult.deletedCount > 0) {
        console.log(
          `Auto-cleaned ${expiredCleanupResult.deletedCount} expired pending purchases for user ${req.user._id}`
        );
      }

      // Fetch remaining pending purchases
      const pendingPurchases = await Purchase.find({
        userId: req.user._id,
        status: "pending",
      })
        .populate("programId", "title programType")
        .sort({ createdAt: -1 });

      // Auto-cleanup 2: Remove pending purchases for programs that are already completed
      const redundantPurchaseIds: string[] = [];
      for (const pending of pendingPurchases) {
        const programId = (pending.programId as { _id: unknown })._id;
        const existingCompletedPurchase = await Purchase.findOne({
          userId: req.user._id,
          programId: programId,
          status: "completed",
        });

        if (existingCompletedPurchase) {
          redundantPurchaseIds.push(pending._id.toString());
        }
      }

      if (redundantPurchaseIds.length > 0) {
        const redundantCleanupResult = await Purchase.deleteMany({
          _id: { $in: redundantPurchaseIds },
        });
        console.log(
          `Auto-cleaned ${redundantCleanupResult.deletedCount} redundant pending purchases (already purchased programs) for user ${req.user._id}`
        );

        // Re-fetch pending purchases after redundant cleanup
        const updatedPendingPurchases = await Purchase.find({
          userId: req.user._id,
          status: "pending",
        })
          .populate("programId", "title programType")
          .sort({ createdAt: -1 });

        res.status(200).json({
          success: true,
          data: updatedPendingPurchases,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: pendingPurchases,
      });
    } catch (error) {
      console.error("Error fetching pending purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch pending purchases.",
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
   * Retry a pending purchase - creates a new checkout session
   * POST /api/purchases/retry/:id
   * Validates that user hasn't already purchased the program
   */
  static async retryPendingPurchase(
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

      // Find the pending purchase
      const pendingPurchase = await Purchase.findById(id).populate("programId");

      if (!pendingPurchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Verify ownership
      if (
        pendingPurchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You can only retry your own purchases.",
        });
        return;
      }

      // Verify it's still pending
      if (pendingPurchase.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Cannot retry a ${pendingPurchase.status} purchase.`,
        });
        return;
      }

      // CRITICAL: Check if user already has a completed purchase for this program
      const existingCompletedPurchase = await Purchase.findOne({
        userId: req.user._id,
        programId: pendingPurchase.programId,
        status: "completed",
      });

      if (existingCompletedPurchase) {
        res.status(400).json({
          success: false,
          message:
            "You have already purchased this program. Check your purchase history.",
        });
        return;
      }

      // Get program details
      const program = pendingPurchase.programId as unknown as IProgram;

      // Create new Stripe checkout session (reusing the same pricing logic)
      const session = await stripeCreateCheckoutSession({
        userId: (req.user._id as mongoose.Types.ObjectId).toString(),
        userEmail: req.user.email,
        programId: (program._id as mongoose.Types.ObjectId).toString(),
        programTitle: program.title,
        fullPrice: pendingPurchase.fullPrice,
        classRepDiscount: pendingPurchase.classRepDiscount,
        earlyBirdDiscount: pendingPurchase.earlyBirdDiscount,
        finalPrice: pendingPurchase.finalPrice,
        isClassRep: pendingPurchase.isClassRep,
        isEarlyBird: pendingPurchase.isEarlyBird,
      });

      // Update the pending purchase with new session ID
      pendingPurchase.stripeSessionId = session.id;
      await pendingPurchase.save();

      console.log(
        `Created new checkout session for pending purchase ${pendingPurchase.orderNumber}`
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
        },
      });
    } catch (error) {
      console.error("Error retrying purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retry purchase.",
        error: (error as Error).message,
      });
    }
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

      // Verify ownership
      if (
        purchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You can only cancel your own purchases.",
        });
        return;
      }

      // Only allow deleting pending purchases
      if (purchase.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Cannot cancel a ${purchase.status} purchase. Only pending purchases can be cancelled.`,
        });
        return;
      }

      // If this was a Class Rep purchase, decrement the counter
      if (purchase.isClassRep) {
        await Program.findByIdAndUpdate(
          purchase.programId,
          { $inc: { classRepCount: -1 } },
          { runValidators: false } // Allow going below limit on decrement
        );
        console.log(
          `Decremented classRepCount for program ${purchase.programId}`
        );
      }

      await Purchase.findByIdAndDelete(id);

      console.log(`Cancelled pending purchase ${purchase.orderNumber}`);

      res.status(200).json({
        success: true,
        message: "Pending purchase cancelled successfully.",
      });
    } catch (error) {
      console.error("Error cancelling purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel purchase.",
      });
    }
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

      const {
        page = 1,
        limit = 20,
        search = "",
        status,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        status?: string;
      };

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      );
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: Record<string, unknown> = {};

      // Status filter
      if (status && status !== "all") {
        query.status = status;
      }

      // Fetch ALL purchases matching status filter (we'll filter by search client-side)
      // This is necessary because search includes populated fields (user name, program title)
      const allPurchases = await Purchase.find(query)
        .populate({
          path: "userId",
          select: "firstName lastName email username",
        })
        .populate({
          path: "programId",
          select: "title startDate endDate",
        })
        .sort({ createdAt: -1 });

      // Apply search filter after population (if search is provided)
      let filteredPurchases = allPurchases;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPurchases = allPurchases.filter((purchase) => {
          const user = purchase.userId as {
            firstName?: string;
            lastName?: string;
            email?: string;
            username?: string;
          };
          const program = purchase.programId as { title?: string };

          const userFirstName = user?.firstName?.toLowerCase() || "";
          const userLastName = user?.lastName?.toLowerCase() || "";
          const userEmail = user?.email?.toLowerCase() || "";
          const userName = user?.username?.toLowerCase() || "";
          const programTitle = program?.title?.toLowerCase() || "";
          const orderNumber = purchase.orderNumber?.toLowerCase() || "";

          return (
            userFirstName.includes(searchLower) ||
            userLastName.includes(searchLower) ||
            userEmail.includes(searchLower) ||
            userName.includes(searchLower) ||
            programTitle.includes(searchLower) ||
            orderNumber.includes(searchLower)
          );
        });
      }

      // Apply pagination to filtered results
      const total = filteredPurchases.length;
      const paginatedPurchases = filteredPurchases.slice(skip, skip + limitNum);

      // Format response
      const formattedPurchases = paginatedPurchases.map((purchase) => {
        const user = purchase.userId as {
          _id?: unknown;
          firstName?: string;
          lastName?: string;
          email?: string;
          username?: string;
        };
        const program = purchase.programId as {
          _id?: unknown;
          title?: string;
        };

        return {
          id: purchase._id,
          orderNumber: purchase.orderNumber,
          user: {
            id: user?._id,
            name:
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              user?.username ||
              "Unknown User",
            email: user?.email || "",
          },
          program: {
            id: program?._id,
            name: program?.title || "Unknown Program",
          },
          fullPrice: purchase.fullPrice,
          classRepDiscount: purchase.classRepDiscount,
          earlyBirdDiscount: purchase.earlyBirdDiscount,
          promoDiscountAmount: purchase.promoDiscountAmount || 0,
          promoDiscountPercent: purchase.promoDiscountPercent || 0,
          finalPrice: purchase.finalPrice,
          isClassRep: purchase.isClassRep,
          isEarlyBird: purchase.isEarlyBird,
          promoCode: purchase.promoCode,
          status: purchase.status,
          purchaseDate: purchase.purchaseDate,
          createdAt: purchase.createdAt,
          paymentMethod: purchase.paymentMethod,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          purchases: formattedPurchases,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching admin purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchases.",
      });
    }
  }

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

      // Get all completed purchases
      const completedPurchases = await Purchase.find({ status: "completed" });

      // Calculate total revenue (in cents)
      const totalRevenue = completedPurchases.reduce(
        (sum, purchase) => sum + purchase.finalPrice,
        0
      );

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

      // Get recent purchases (last 30 days)
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
            totalRevenue, // in cents
            totalPurchases: statusMap.completed || 0,
            pendingPurchases: statusMap.pending || 0,
            failedPurchases: statusMap.failed || 0,
            refundedPurchases: statusMap.refunded || 0,
            uniqueBuyers: uniqueBuyers.length,
            classRepPurchases: classRepCount,
            promoCodeUsage,
            last30Days: {
              purchases: recentPurchases,
              revenue: recentRevenue[0]?.total || 0,
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

export default PurchaseController;
