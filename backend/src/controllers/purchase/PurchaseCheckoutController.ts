/**
 * PurchaseCheckoutController.ts
 * Handles Stripe checkout session creation for program purchases
 */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Program, PromoCode, User } from "../../models";
import type { IProgram } from "../../models/Program";
import type { IPromoCode } from "../../models/PromoCode";
import { createCheckoutSession as stripeCreateCheckoutSession } from "../../services/stripeService";
import { lockService } from "../../services/LockService";
import { TrioNotificationService } from "../../services/notifications/TrioNotificationService";

/**
 * Controller for handling purchase checkout operations
 */
class PurchaseCheckoutController {
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
      // Pre-generate purchase ID for unified lock mechanism
      const purchaseId = new mongoose.Types.ObjectId();
      const lockKey = `purchase:complete:${purchaseId.toString()}`;

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
                const { stripe } = await import("../../services/stripeService");
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

          // 4. Generate order number and create purchase record FIRST
          // This ensures the purchase exists BEFORE webhook fires
          const orderNumber = await (
            Purchase as unknown as {
              generateOrderNumber: () => Promise<string>;
            }
          ).generateOrderNumber();

          const purchase = await Purchase.create({
            _id: purchaseId, // Use pre-generated ID for unified lock
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
            stripeSessionId: "", // Placeholder, will be updated after Stripe session creation
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
            `Purchase record created (order: ${orderNumber}), creating Stripe session...`
          );

          // 5. Create Stripe session SECOND (after purchase record exists)
          let stripeSession;
          try {
            stripeSession = await stripeCreateCheckoutSession({
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
              purchaseId: purchaseId.toString(), // Pass for unified lock mechanism
            });

            // 6. Update purchase with Stripe session ID
            purchase.stripeSessionId = stripeSession.id;
            await purchase.save();

            console.log(
              `Stripe session created and linked to purchase ${orderNumber}`
            );
          } catch (stripeError) {
            // If Stripe fails, clean up the purchase record
            console.error("Stripe session creation failed:", stripeError);
            await Purchase.deleteOne({ _id: purchase._id });
            throw stripeError; // Re-throw to return error to user
          }

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
}

export default PurchaseCheckoutController;
