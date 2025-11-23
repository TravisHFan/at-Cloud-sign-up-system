import mongoose from "mongoose";
import Event from "../../models/Event.js";
import Purchase, { IPurchase } from "../../models/Purchase.js";
import { Logger } from "../LoggerService.js";

const log = Logger.getInstance().child("EventPurchaseService");

/**
 * EventPurchaseService
 *
 * Handles event ticket purchase operations:
 * - Creating event purchases
 * - Checking purchase status
 * - Retrieving user's event purchases
 */
class EventPurchaseService {
  /**
   * Create an event ticket purchase
   *
   * @param userId - User purchasing the ticket
   * @param eventId - Event being purchased
   * @param priceInCents - Final price in cents after any discounts
   * @param billingInfo - Billing information
   * @param paymentMethod - Payment method details
   * @param stripeSessionId - Stripe Checkout Session ID
   * @param promoCodeId - Optional promo code ID if used
   * @param promoCodeData - Optional promo code discount details
   * @returns Created purchase record
   */
  async createEventPurchase(params: {
    userId: string | mongoose.Types.ObjectId;
    eventId: string | mongoose.Types.ObjectId;
    priceInCents: number;
    billingInfo: {
      fullName: string;
      email: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    paymentMethod: {
      type: "card" | "other";
      cardBrand?: string;
      last4?: string;
      cardholderName?: string;
    };
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    promoCode?: string;
    promoDiscountAmount?: number;
    promoDiscountPercent?: number;
  }): Promise<IPurchase> {
    try {
      const userIdObj =
        typeof params.userId === "string"
          ? new mongoose.Types.ObjectId(params.userId)
          : params.userId;
      const eventIdObj =
        typeof params.eventId === "string"
          ? new mongoose.Types.ObjectId(params.eventId)
          : params.eventId;

      // Verify event exists and is paid
      const event = await Event.findById(eventIdObj);
      if (!event) {
        throw new Error("Event not found");
      }

      if (event.pricing?.isFree !== false) {
        throw new Error("Cannot purchase tickets for free events");
      }

      // Generate unique order number
      const orderNumber = await (
        Purchase as unknown as {
          generateOrderNumber: () => Promise<string>;
        }
      ).generateOrderNumber();

      // Create purchase record
      const purchase = new Purchase({
        userId: userIdObj,
        purchaseType: "event",
        eventId: eventIdObj,
        orderNumber,
        fullPrice: params.priceInCents,
        classRepDiscount: 0, // Not applicable for events
        earlyBirdDiscount: 0, // Not applicable for events
        finalPrice: params.priceInCents,
        isClassRep: false,
        isEarlyBird: false,
        promoCode: params.promoCode,
        promoDiscountAmount: params.promoDiscountAmount,
        promoDiscountPercent: params.promoDiscountPercent,
        billingInfo: params.billingInfo,
        paymentMethod: params.paymentMethod,
        stripeSessionId: params.stripeSessionId,
        stripePaymentIntentId: params.stripePaymentIntentId,
        status: "pending",
        purchaseDate: new Date(),
      });

      await purchase.save();

      log.info(
        `Event ticket purchase created: ${orderNumber} for user ${userIdObj} and event ${eventIdObj}`
      );

      return purchase;
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.createEventPurchase:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Check if a user has purchased a specific event
   */
  async hasUserPurchasedEvent(
    userId: string | mongoose.Types.ObjectId,
    eventId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const userIdObj =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;
      const eventIdObj =
        typeof eventId === "string"
          ? new mongoose.Types.ObjectId(eventId)
          : eventId;

      const purchase = await Purchase.findOne({
        userId: userIdObj,
        purchaseType: "event",
        eventId: eventIdObj,
        status: "completed",
      });

      return !!purchase;
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.hasUserPurchasedEvent:",
        error instanceof Error ? error : undefined
      );
      return false;
    }
  }

  /**
   * Get all event purchases for a user
   */
  async getUserEventPurchases(
    userId: string | mongoose.Types.ObjectId,
    options?: {
      status?: "pending" | "completed" | "failed" | "refunded";
      limit?: number;
      sortBy?: "purchaseDate" | "createdAt";
      sortOrder?: "asc" | "desc";
    }
  ): Promise<IPurchase[]> {
    try {
      const userIdObj =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;

      // Build query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {
        userId: userIdObj,
        purchaseType: "event",
      };

      if (options?.status) {
        query.status = options.status;
      }

      // Build sort
      const sortField = options?.sortBy || "purchaseDate";
      const sortOrder = options?.sortOrder === "asc" ? 1 : -1;

      // Execute query
      let purchasesQuery = Purchase.find(query)
        .populate("eventId", "title date location")
        .sort({ [sortField]: sortOrder });

      if (options?.limit) {
        purchasesQuery = purchasesQuery.limit(options.limit);
      }

      const purchases = await purchasesQuery;

      return purchases;
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.getUserEventPurchases:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Get a specific purchase by ID
   */
  async getPurchaseById(
    purchaseId: string | mongoose.Types.ObjectId
  ): Promise<IPurchase | null> {
    try {
      const purchaseIdObj =
        typeof purchaseId === "string"
          ? new mongoose.Types.ObjectId(purchaseId)
          : purchaseId;

      const purchase = await Purchase.findById(purchaseIdObj)
        .populate("eventId", "title date location")
        .populate("userId", "name email");

      return purchase;
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.getPurchaseById:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Update purchase status (typically called by Stripe webhook)
   */
  async updatePurchaseStatus(
    purchaseId: string | mongoose.Types.ObjectId,
    status: "pending" | "completed" | "failed" | "refunded",
    stripePaymentIntentId?: string
  ): Promise<IPurchase | null> {
    try {
      const purchaseIdObj =
        typeof purchaseId === "string"
          ? new mongoose.Types.ObjectId(purchaseId)
          : purchaseId;

      const updateData: {
        status: string;
        stripePaymentIntentId?: string;
      } = { status };

      if (stripePaymentIntentId) {
        updateData.stripePaymentIntentId = stripePaymentIntentId;
      }

      const purchase = await Purchase.findByIdAndUpdate(
        purchaseIdObj,
        updateData,
        { new: true }
      );

      if (purchase) {
        log.info(`Event purchase ${purchaseIdObj} status updated to ${status}`);
      }

      return purchase;
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.updatePurchaseStatus:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Get total event ticket sales for an event (for organizers/admins)
   */
  async getEventTicketSales(
    eventId: string | mongoose.Types.ObjectId
  ): Promise<{
    totalSales: number;
    completedPurchases: number;
    totalRevenue: number;
  }> {
    try {
      const eventIdObj =
        typeof eventId === "string"
          ? new mongoose.Types.ObjectId(eventId)
          : eventId;

      const purchases = await Purchase.find({
        purchaseType: "event",
        eventId: eventIdObj,
      });

      const completedPurchases = purchases.filter(
        (p) => p.status === "completed"
      );

      const totalRevenue = completedPurchases.reduce(
        (sum, p) => sum + p.finalPrice,
        0
      );

      return {
        totalSales: purchases.length,
        completedPurchases: completedPurchases.length,
        totalRevenue, // In cents
      };
    } catch (error) {
      log.error(
        "Error in EventPurchaseService.getEventTicketSales:",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}

export default new EventPurchaseService();
