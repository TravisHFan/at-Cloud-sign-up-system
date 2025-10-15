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
export interface CheckoutSessionMetadata extends Record<string, string> {
  userId: string;
  programId: string;
  programTitle: string;
  fullPrice: string;
  classRepDiscount: string;
  earlyBirdDiscount: string;
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
    discountDetails.push(`Original price: $${fullPrice.toFixed(2)}`);

    if (isClassRep && classRepDiscount > 0) {
      discountDetails.push(
        `Class Rep Discount: -$${classRepDiscount.toFixed(2)}`
      );
    }

    if (isEarlyBird && earlyBirdDiscount > 0) {
      discountDetails.push(
        `Early Bird Discount: -$${earlyBirdDiscount.toFixed(2)}`
      );
    }

    if (discountDetails.length > 0) {
      description = `${description}\n${discountDetails.join("\n")}`;
    }
  }

  // Single line item with final price
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: {
        name: programTitle,
        description,
      },
      unit_amount: Math.round(finalPrice * 100), // Stripe expects cents, round to avoid floating point issues
    },
    quantity: 1,
  });

  // Create metadata to track purchase details
  const metadata: CheckoutSessionMetadata = {
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
