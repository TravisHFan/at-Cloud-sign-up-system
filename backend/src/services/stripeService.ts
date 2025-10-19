import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    "⚠️ STRIPE_SECRET_KEY is not set. Using placeholder for testing."
  );
  // Set a placeholder for tests instead of throwing
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_for_testing";
}

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

// Stripe configuration
export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  successUrl:
    process.env.STRIPE_SUCCESS_URL ||
    "http://localhost:5173/purchase/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl:
    process.env.STRIPE_CANCEL_URL || "http://localhost:5173/purchase/cancel",
};

// Type for checkout session metadata
export interface CheckoutSessionMetadata {
  userId: string;
  programId: string;
  programTitle: string;
  fullPrice: string;
  classRepDiscount: string;
  earlyBirdDiscount: string;
  promoCode?: string;
  promoDiscountAmount?: string;
  promoDiscountPercent?: string;
  finalPrice: string;
  isClassRep: string;
  isEarlyBird: string;
}

/**
 * Create a Stripe Checkout Session for program purchase
 */
export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  programId: string;
  programTitle: string;
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  promoCode?: string;
  promoDiscountAmount?: number;
  promoDiscountPercent?: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
}): Promise<Stripe.Checkout.Session> {
  const {
    userId,
    userEmail,
    programId,
    programTitle,
    fullPrice,
    classRepDiscount,
    earlyBirdDiscount,
    promoCode,
    promoDiscountAmount = 0,
    promoDiscountPercent = 0,
    finalPrice,
    isClassRep,
    isEarlyBird,
  } = params;

  // Build line items - Stripe doesn't allow negative amounts in payment mode
  // So we show the final price with description of applied discounts
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  // Build description with discount details
  let description = "Program enrollment";
  const discountDetails: string[] = [];

  if (fullPrice !== finalPrice) {
    discountDetails.push(`Original price: $${(fullPrice / 100).toFixed(2)}`);

    if (isClassRep && classRepDiscount > 0) {
      discountDetails.push(
        `Class Rep Discount: -$${(classRepDiscount / 100).toFixed(2)}`
      );
    }

    if (isEarlyBird && earlyBirdDiscount > 0) {
      discountDetails.push(
        `Early Bird Discount: -$${(earlyBirdDiscount / 100).toFixed(2)}`
      );
    }

    if (promoCode && promoDiscountAmount > 0) {
      discountDetails.push(
        `Promo Code (${promoCode}): -$${(promoDiscountAmount / 100).toFixed(2)}`
      );
    }

    if (promoCode && promoDiscountPercent > 0) {
      discountDetails.push(
        `Promo Code (${promoCode}): -${promoDiscountPercent}%`
      );
    }

    if (discountDetails.length > 0) {
      description = `${description}\n${discountDetails.join("\n")}`;
    }
  }

  // Single line item with final price
  // Note: prices are already in cents from the backend
  // Stripe requires checkout sessions to have a minimum of $0.50 USD (50 cents)
  if (finalPrice < 50) {
    throw new Error(
      `Cannot create payment for $${(finalPrice / 100).toFixed(
        2
      )}. Stripe requires a minimum of $0.50 for checkout sessions. Please contact support or use admin enrollment for programs under $0.50.`
    );
  }

  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: {
        name: programTitle,
        description,
      },
      unit_amount: Math.round(finalPrice),
    },
    quantity: 1,
  });

  // Create metadata to track purchase details
  const metadata: Record<string, string> = {
    userId,
    programId,
    programTitle,
    fullPrice: fullPrice.toString(),
    classRepDiscount: classRepDiscount.toString(),
    earlyBirdDiscount: earlyBirdDiscount.toString(),
    finalPrice: finalPrice.toString(),
    isClassRep: isClassRep.toString(),
    isEarlyBird: isEarlyBird.toString(),
  };

  // Add promo code fields if present
  if (promoCode) {
    metadata.promoCode = promoCode;
    if (promoDiscountAmount > 0) {
      metadata.promoDiscountAmount = promoDiscountAmount.toString();
    }
    if (promoDiscountPercent > 0) {
      metadata.promoDiscountPercent = promoDiscountPercent.toString();
    }
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: STRIPE_CONFIG.successUrl,
    cancel_url: `${STRIPE_CONFIG.cancelUrl}?program_id=${programId}`,
    metadata,
    billing_address_collection: "required",
  });

  return session;
}

/**
 * Retrieve a Stripe Checkout Session
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieve a Stripe Payment Intent
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    STRIPE_CONFIG.webhookSecret
  );
}

export default stripe;
