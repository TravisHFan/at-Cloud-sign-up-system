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
  purchaseId?: string; // NEW: For unified lock mechanism
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
    purchaseId, // NEW: For unified lock mechanism
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

  // Add purchaseId for unified lock mechanism (NEW)
  if (purchaseId) {
    metadata.purchaseId = purchaseId;
  }

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

/**
 * Process a refund for a purchase
 * @param paymentIntentId - The Stripe Payment Intent ID to refund
 * @param amount - The amount to refund in cents (should be full amount for now)
 * @param reason - Optional reason for the refund
 * @returns The Stripe Refund object
 */
export async function processRefund(params: {
  paymentIntentId: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Refund> {
  const { paymentIntentId, amount, reason, metadata } = params;

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount), // Ensure integer cents
      reason: reason as Stripe.RefundCreateParams.Reason | undefined,
      metadata: metadata || {},
    });

    return refund;
  } catch (error) {
    console.error("Stripe refund error:", error);
    throw error;
  }
}

/**
 * Retrieve a Stripe Refund
 */
export async function getRefund(refundId: string): Promise<Stripe.Refund> {
  return await stripe.refunds.retrieve(refundId);
}

// ============================================================================
// DONATION FUNCTIONS
// ============================================================================

/**
 * Get or create a Stripe customer for donations
 */
export async function getOrCreateDonationCustomer(params: {
  userId: string;
  email: string;
  name: string;
}): Promise<string> {
  const { userId, email, name } = params;

  // Search for existing customer by email
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
      source: "donation",
    },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for one-time donation
 */
export async function createDonationCheckoutSession(params: {
  donationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number; // in cents
  giftDate: Date;
}): Promise<Stripe.Checkout.Session> {
  const { donationId, userId, userEmail, userName, amount, giftDate } = params;

  // Stripe minimum is $1.00 (100 cents)
  if (amount < 100) {
    throw new Error("Donation amount must be at least $1.00");
  }

  // Get or create customer
  const customerId = await getOrCreateDonationCustomer({
    userId,
    email: userEmail,
    name: userName,
  });

  // Check if this is a future-dated donation
  const isFuture = new Date(giftDate) > new Date();
  const giftDateStr = new Date(giftDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const description = isFuture
    ? `One-time donation scheduled for ${giftDateStr}`
    : "One-time donation to our ministry";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Ministry Donation",
            description,
          },
          unit_amount: Math.round(amount),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/dashboard/donate?success=true&donation_id=${donationId}`,
    cancel_url: `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/dashboard/donate?cancelled=true`,
    metadata: {
      donationId,
      userId,
      type: "donation",
      donationType: "one-time",
      giftDate: giftDate.toISOString(),
    },
    billing_address_collection: "required",
  });

  return session;
}

/**
 * Create a Stripe Subscription for recurring donation
 */
export async function createDonationSubscription(params: {
  donationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number; // in cents
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
  startDate: Date;
  endDate?: Date;
}): Promise<{ subscription: Stripe.Subscription; checkoutUrl: string }> {
  const {
    donationId,
    userId,
    userEmail,
    userName,
    amount,
    frequency,
    startDate,
    endDate,
  } = params;

  // Stripe minimum is $1.00 (100 cents)
  if (amount < 100) {
    throw new Error("Donation amount must be at least $1.00");
  }

  // Get or create customer
  const customerId = await getOrCreateDonationCustomer({
    userId,
    email: userEmail,
    name: userName,
  });

  // Map frequency to Stripe interval
  const intervalMapping: Record<
    string,
    { interval: Stripe.Price.Recurring.Interval; interval_count: number }
  > = {
    weekly: { interval: "week", interval_count: 1 },
    biweekly: { interval: "week", interval_count: 2 },
    monthly: { interval: "month", interval_count: 1 },
    quarterly: { interval: "month", interval_count: 3 },
    annually: { interval: "year", interval_count: 1 },
  };

  const { interval, interval_count } = intervalMapping[frequency];

  // Create a price for this donation
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: Math.round(amount),
    recurring: {
      interval,
      interval_count,
    },
    product_data: {
      name: "Recurring Ministry Donation",
    },
    metadata: {
      donationId,
      userId,
      frequency,
    },
  });

  // Create checkout session for subscription
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  // Check if start date is today or in the past
  // If so, don't use billing_cycle_anchor (let it start immediately after payment)
  // Stripe requires billing_cycle_anchor to be in the future
  const useAnchor = startTimestamp > now + 3600; // At least 1 hour in the future

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/dashboard/donate?success=true&donation_id=${donationId}`,
    cancel_url: `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/dashboard/donate?cancelled=true`,
    metadata: {
      donationId,
      userId,
      type: "donation",
      donationType: "recurring",
    },
    subscription_data: {
      ...(useAnchor ? { billing_cycle_anchor: startTimestamp } : {}),
      metadata: {
        donationId,
        userId,
        type: "donation",
        donationType: "recurring",
        frequency,
        startDate: startDate.toISOString(),
        ...(endDate ? { endDate: endDate.toISOString() } : {}),
      },
    },
    billing_address_collection: "required",
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Note: subscription is created when checkout completes, not now
  // We'll get the subscription ID from the webhook
  return {
    subscription: {} as Stripe.Subscription, // Placeholder
    checkoutUrl: session.url || "",
  };
}

/**
 * Update a Stripe Subscription (for editing recurring donations)
 */
export async function updateDonationSubscription(params: {
  subscriptionId: string;
  amount?: number;
  frequency?: "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
  endDate?: Date | null;
}): Promise<Stripe.Subscription> {
  const { subscriptionId, amount, frequency, endDate } = params;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const updateParams: Stripe.SubscriptionUpdateParams = {
    proration_behavior: "none", // Don't prorate changes
  };

  // If amount or frequency changed, create new price
  if (amount || frequency) {
    const currentPrice = subscription.items.data[0].price;
    const newAmount = amount || currentPrice.unit_amount || 0;
    const currentFrequency = frequency || "monthly";

    const intervalMapping: Record<
      string,
      { interval: Stripe.Price.Recurring.Interval; interval_count: number }
    > = {
      weekly: { interval: "week", interval_count: 1 },
      biweekly: { interval: "week", interval_count: 2 },
      monthly: { interval: "month", interval_count: 1 },
      quarterly: { interval: "month", interval_count: 3 },
      annually: { interval: "year", interval_count: 1 },
    };

    const { interval, interval_count } = intervalMapping[currentFrequency];

    const newPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: Math.round(newAmount),
      recurring: {
        interval,
        interval_count,
      },
      product_data: {
        name: "Recurring Ministry Donation",
      },
      metadata: {
        frequency: currentFrequency,
      },
    });

    updateParams.items = [
      {
        id: subscription.items.data[0].id,
        price: newPrice.id,
      },
    ];
  }

  // Handle end date - schedule cancellation or remove scheduled cancellation
  if (endDate !== undefined) {
    if (endDate === null) {
      // Remove scheduled cancellation
      updateParams.cancel_at = null;
    } else {
      // Schedule cancellation at end date (convert to Unix timestamp)
      updateParams.cancel_at = Math.floor(endDate.getTime() / 1000);
    }
  }

  return await stripe.subscriptions.update(subscriptionId, updateParams);
}

/**
 * Pause (hold) a Stripe Subscription
 */
export async function pauseDonationSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "void", // Don't collect payment while paused
    },
  });
}

/**
 * Resume a paused Stripe Subscription
 */
export async function resumeDonationSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: null, // Remove pause
  });
}

/**
 * Cancel a Stripe Subscription
 */
export async function cancelDonationSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Retrieve a Stripe Subscription
 */
export async function getDonationSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export default stripe;
