/**
 * Purchase Type Definitions
 *
 * Supports both program enrollments and event ticket purchases
 * Phase 4 - Paid Events Feature
 */

export type PurchaseType = "program" | "event";

export type PurchaseStatus = "pending" | "completed" | "failed" | "refunded";

export interface PromoCodeUsed {
  code: string;
  discountAmount?: number; // in cents
  discountPercent?: number; // percentage (0-100)
}

export interface BillingInfo {
  name: string;
  email: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface PaymentInfo {
  method: "stripe" | "other";
  last4?: string;
  brand?: string;
  stripePaymentIntentId?: string;
}

/**
 * Base Purchase interface
 * Used for both program enrollments and event ticket purchases
 */
export interface Purchase {
  id: string;
  orderNumber: string;
  userId:
    | string
    | {
        id: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      };

  // Purchase Type Discriminator (Paid Events Feature - Phase 1)
  purchaseType: PurchaseType; // 'program' or 'event'

  // Program Purchase Fields (legacy, purchaseType = 'program')
  programId?:
    | {
        id: string;
        title: string;
        programType?: string;
      }
    | string;
  fullPrice?: number; // in cents
  classRepDiscount?: number; // in cents
  earlyBirdDiscount?: number; // in cents
  isClassRep?: boolean;
  isEarlyBird?: boolean;

  // Event Purchase Fields (new, purchaseType = 'event')
  eventId?:
    | {
        id: string;
        title: string;
        date?: string;
        time?: string;
      }
    | string;

  // Common Fields
  amount: number; // Final price paid in cents (alias for finalPrice)
  finalPrice?: number; // in cents (legacy field for programs)
  status: PurchaseStatus;
  purchaseDate: string;
  stripeSessionId?: string;

  // Promo Code Support
  promoCodeUsed?: PromoCodeUsed;

  // Billing & Payment
  billingInfo?: BillingInfo;
  paymentInfo?: PaymentInfo;

  // Bundle Promo Code (for program purchases only)
  bundlePromoCode?: string;
  bundleDiscountAmount?: number; // in cents
  bundleExpiresAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Program Purchase - specific type for program enrollments
 */
export interface ProgramPurchase extends Purchase {
  purchaseType: "program";
  programId:
    | {
        id: string;
        title: string;
        programType?: string;
      }
    | string;
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
}

/**
 * Event Purchase - specific type for event ticket purchases
 */
export interface EventPurchase extends Purchase {
  purchaseType: "event";
  eventId:
    | {
        id: string;
        title: string;
        date?: string;
        time?: string;
      }
    | string;
}

/**
 * Type guard to check if purchase is a program purchase
 */
export function isProgramPurchase(
  purchase: Purchase
): purchase is ProgramPurchase {
  return purchase.purchaseType === "program";
}

/**
 * Type guard to check if purchase is an event purchase
 */
export function isEventPurchase(purchase: Purchase): purchase is EventPurchase {
  return purchase.purchaseType === "event";
}

/**
 * Purchase History Response
 */
export interface PurchaseHistoryResponse {
  success: boolean;
  data: {
    purchases: Purchase[];
    totalPurchases: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message?: string;
}

/**
 * Purchase creation/checkout request
 */
export interface CreatePurchaseRequest {
  // For program purchases
  programId?: string;
  isClassRep?: boolean;

  // For event purchases
  eventId?: string;

  // Common
  promoCode?: string;
}

/**
 * Purchase verification response (from Stripe session)
 */
export interface PurchaseVerificationResponse {
  success: boolean;
  data?: Purchase;
  message?: string;
}
