/**
 * EventPurchaseController.ts
 * Handles Stripe checkout session creation for event ticket purchases
 */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Event, PromoCode, User } from "../../models";
import type { IEvent } from "../../models/Event";
import type { IPromoCode } from "../../models/PromoCode";
import { lockService } from "../../services/LockService";
import EventAccessControlService from "../../services/event/EventAccessControlService";

/**
 * Controller for handling event ticket purchase operations
 */
class EventPurchaseController {
  /**
   * Create a Stripe Checkout Session for event ticket purchase
   * POST /api/events/:id/purchase
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

      const { id: eventId } = req.params;
      const { promoCode } = req.body;

      // Extract user info early (needed for promo validation)
      const userId = req.user._id as mongoose.Types.ObjectId;
      const userEmail = req.user.email;
      const userName =
        `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
        req.user.username;

      // Validate event ID
      if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }

      // Fetch event details
      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      // Check if event is paid
      if (event.pricing?.isFree !== false) {
        res.status(400).json({
          success: false,
          message: "This event is free and does not require purchase.",
        });
        return;
      }

      // Check if user already has access (organizer, co-organizer, program purchaser)
      const accessCheck = await EventAccessControlService.checkUserAccess(
        userId.toString(),
        eventId
      );

      if (accessCheck.hasAccess && !accessCheck.requiresPurchase) {
        res.status(400).json({
          success: false,
          message: `You already have access to this event: ${accessCheck.accessReason}`,
        });
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

        // Validate promo code can be used for this event
        const validation = validatedPromoCode.canBeUsedForEvent(event._id);
        if (!validation.valid) {
          res.status(400).json({
            success: false,
            message:
              validation.reason || "Promo code is not valid for this event.",
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

        // Additional check for staff codes: verify allowedEventIds if specified
        if (
          validatedPromoCode.type === "staff_access" &&
          validatedPromoCode.allowedEventIds &&
          validatedPromoCode.allowedEventIds.length > 0
        ) {
          const eventIdStr = event._id.toString();
          const allowedIds = validatedPromoCode.allowedEventIds.map((id) =>
            id.toString()
          );
          if (!allowedIds.includes(eventIdStr)) {
            res.status(400).json({
              success: false,
              message: "This staff code is not valid for this event.",
            });
            return;
          }
        }
      }

      // Check if user already purchased this event (outside lock - read-only)
      const existingCompletedPurchase = await Purchase.findOne({
        userId: req.user._id,
        eventId: event._id,
        purchaseType: "event",
        status: "completed",
      });

      if (existingCompletedPurchase) {
        res.status(400).json({
          success: false,
          message: "You have already purchased a ticket for this event.",
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
            eventId: event._id,
            purchaseType: "event",
            status: "pending",
          });

          // If pending exists, DELETE it and create a new one with fresh pricing
          // This allows users to change their promo code
          if (pendingPurchase) {
            console.log(
              `Found existing pending event purchase ${pendingPurchase.orderNumber} - deleting to create fresh session with updated pricing`
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
              `Deleted old pending event purchase ${pendingPurchase.orderNumber}`
            );
          }

          // 2. Calculate pricing
          const fullPrice = event.pricing?.price || 0;
          let promoDiscountAmount = 0;
          let promoDiscountPercent = 0;

          if (validatedPromoCode) {
            if (validatedPromoCode.discountAmount) {
              // Fixed dollar discount
              promoDiscountAmount = validatedPromoCode.discountAmount;
            } else if (validatedPromoCode.discountPercent) {
              // Percentage discount
              promoDiscountPercent = validatedPromoCode.discountPercent;
            }
          }

          // Calculate final price
          // First apply fixed discount
          let finalPrice = Math.max(0, fullPrice - promoDiscountAmount);

          // Then apply percentage discount
          if (promoDiscountPercent > 0) {
            finalPrice = Math.max(
              0,
              finalPrice - (finalPrice * promoDiscountPercent) / 100
            );
          }

          // Round to 2 decimal places
          finalPrice = Math.round(finalPrice * 100) / 100;

          // 3. Generate order number and create purchase record
          const orderNumber = await (
            Purchase as unknown as {
              generateOrderNumber: () => Promise<string>;
            }
          ).generateOrderNumber();

          const newPurchase = await Purchase.create({
            _id: purchaseId,
            userId: userId,
            eventId: event._id,
            purchaseType: "event",
            orderNumber,
            fullPrice: fullPrice,
            finalPrice: finalPrice,
            classRepDiscount: 0,
            earlyBirdDiscount: 0,
            isClassRep: false,
            isEarlyBird: false,
            status: "pending",
            billingInfo: {
              fullName: userName,
              email: userEmail,
            },
            paymentMethod: {
              type: "card",
            },
            promoCode: validatedPromoCode?.code,
            promoCodeId: validatedPromoCode?._id,
            promoDiscountAmount:
              promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
            promoDiscountPercent:
              promoDiscountPercent > 0 ? promoDiscountPercent : undefined,
          });

          console.log(
            `Created event purchase record: ${orderNumber} for ${userName} (${userEmail})`
          );

          // 4. Create Stripe checkout session (directly using stripe API for events)
          const { stripe } = await import("../../services/stripeService");
          const successUrl = `${process.env.FRONTEND_URL}/dashboard/events/${eventId}/purchase/success?session_id={CHECKOUT_SESSION_ID}`;
          const cancelUrl = `${process.env.FRONTEND_URL}/dashboard/purchase/cancel?event_id=${eventId}`;

          // Build description with discount details
          let description = "Event ticket purchase";
          const discountDetails: string[] = [];

          if (fullPrice !== finalPrice) {
            discountDetails.push(
              `Original price: $${(fullPrice / 100).toFixed(2)}`
            );

            if (validatedPromoCode && promoDiscountAmount > 0) {
              discountDetails.push(
                `Promo Code (${validatedPromoCode.code}): -$${(
                  promoDiscountAmount / 100
                ).toFixed(2)}`
              );
            }

            if (validatedPromoCode && promoDiscountPercent > 0) {
              discountDetails.push(
                `Promo Code (${validatedPromoCode.code}): -${promoDiscountPercent}%`
              );
            }

            if (discountDetails.length > 0) {
              description = `${description}\n${discountDetails.join("\n")}`;
            }
          }

          // Stripe requires minimum $0.50 USD (50 cents)
          if (finalPrice < 50) {
            throw new Error(
              `Cannot create payment for $${(finalPrice / 100).toFixed(
                2
              )}. Stripe requires a minimum of $0.50 for checkout sessions.`
            );
          }

          const metadata: Record<string, string> = {
            userId: userId.toString(),
            eventId: event._id.toString(),
            eventTitle: event.title,
            fullPrice: fullPrice.toString(),
            finalPrice: finalPrice.toString(),
            purchaseType: "event",
            purchaseId: purchaseId.toString(),
          };

          if (validatedPromoCode) {
            metadata.promoCode = validatedPromoCode.code;
            if (promoDiscountAmount > 0) {
              metadata.promoDiscountAmount = promoDiscountAmount.toString();
            }
            if (promoDiscountPercent > 0) {
              metadata.promoDiscountPercent = promoDiscountPercent.toString();
            }
          }

          const stripeSession = await stripe.checkout.sessions.create({
            customer_email: userEmail,
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: event.title,
                    description,
                  },
                  unit_amount: Math.round(finalPrice),
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata,
            billing_address_collection: "required",
          });

          // 5. Store Stripe session ID
          newPurchase.stripeSessionId = stripeSession.id;
          await newPurchase.save();

          console.log(
            `Created Stripe checkout session ${stripeSession.id} for event purchase ${orderNumber}`
          );

          return {
            sessionId: stripeSession.id,
            sessionUrl: stripeSession.url,
            purchaseId: purchaseId.toString(),
            orderNumber,
          };
        },
        30000 // 30 second lock timeout
      );

      res.status(200).json({
        success: true,
        message: "Event ticket checkout session created successfully.",
        data: result,
      });
    } catch (error) {
      console.error("Error creating event ticket checkout session:", error);

      // Check if error is from lock timeout
      if (error instanceof Error && error.message.includes("acquire lock")) {
        res.status(409).json({
          success: false,
          message:
            "Another purchase is in progress. Please try again in a moment.",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session.",
      });
    }
  }
}

export default EventPurchaseController;
