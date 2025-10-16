# Payment Transaction Safety Audit

**Date:** 2025-10-15  
**Status:** ⚠️ **CRITICAL ISSUES IDENTIFIED**

## Executive Summary

Current payment processing flow **LACKS database transaction guarantees**, creating potential for:

- ❌ Partial state updates (inconsistent data)
- ❌ Lost payments (money taken but no purchase record)
- ❌ Duplicate charges (race conditions)
- ❌ Orphaned records (failed rollback)

**Risk Level:** 🔴 **HIGH** - Production payment system without ACID guarantees

---

## Current Implementation Analysis

### 1. Purchase Creation Flow (`PurchaseController.createCheckoutSession`)

**Location:** `backend/src/controllers/purchaseController.ts` (lines 119-146)

```typescript
// Create Stripe session
const session = await createCheckoutSession({...});

// Create pending purchase record
const orderNumber = await Purchase.generateOrderNumber();
await Purchase.create({
  userId: req.user._id,
  programId: program._id,
  orderNumber,
  // ... other fields
  status: "pending",
  stripeSessionId: session.id,
});
```

**Problems:**

1. ❌ **No transaction wrapper** - If `Purchase.create()` fails after Stripe session created, user gets Stripe checkout URL but no database record
2. ❌ **No rollback mechanism** - Failed database writes leave orphaned Stripe sessions
3. ❌ **Race condition risk** - Multiple requests could create duplicate pending purchases

**Failure Scenarios:**

- Database connection drops after Stripe session created → User pays but no purchase record
- MongoDB validation fails → Stripe session orphaned
- Server crashes between operations → Inconsistent state

---

### 2. Webhook Payment Completion (`WebhookController.handleCheckoutSessionCompleted`)

**Location:** `backend/src/controllers/webhookController.ts` (lines 87-195)

```typescript
// 1. Find purchase
const purchase = await Purchase.findOne({ stripeSessionId: session.id });

// 2. Fetch payment details from Stripe (multiple API calls)
const paymentIntent = await getPaymentIntent(paymentIntentId);
const charge = await stripe.charges.retrieve(chargeId);

// 3. Update purchase fields
purchase.stripePaymentIntentId = paymentIntentId;
purchase.billingInfo = {...};
purchase.paymentMethod = paymentMethod;
purchase.status = "completed";
purchase.purchaseDate = new Date();

// 4. Save to database
await purchase.save();

// 5. Send confirmation email
await EmailService.sendPurchaseConfirmationEmail({...});
```

**Problems:**

1. ❌ **Multi-step process without atomicity** - If `purchase.save()` fails, we've already fetched payment details but can't rollback
2. ❌ **No idempotency check** - Webhook could be retried, causing duplicate processing
3. ❌ **Email failure doesn't rollback** - Purchase marked complete even if email fails (this is actually okay, but not documented)
4. ❌ **No database transaction** - Multiple fields updated; partial update possible if crash occurs

**Failure Scenarios:**

- Network timeout during `purchase.save()` → Payment succeeded in Stripe but purchase stays "pending"
- Duplicate webhook delivery → Could process same payment twice (though currently has basic check)
- Database write fails → Money taken, no completion record
- Server crashes after updating some fields but before save → Corrupted purchase state

---

### 3. Class Rep Limit Enforcement

**Location:** `backend/src/controllers/purchaseController.ts` (lines 66-79)

```typescript
if (isClassRep && program.classRepLimit && program.classRepLimit > 0) {
  const classRepCount = await Purchase.countDocuments({
    programId: program._id,
    isClassRep: true,
    status: "completed",
  });

  if (classRepCount >= program.classRepLimit) {
    res.status(400).json({
      success: false,
      message: "Class Representative limit has been reached for this program.",
    });
    return;
  }
}
```

**Problems:**

1. ❌ **Race condition** - Two users could check limit simultaneously, both pass, exceed limit
2. ❌ **No atomic increment** - Count → Check → Create is not atomic
3. ❌ **Time-of-check-time-of-use (TOCTOU) vulnerability**

**Failure Scenario:**

- User A checks: 9/10 Class Reps ✓
- User B checks: 9/10 Class Reps ✓
- User A creates purchase → 10/10
- User B creates purchase → 11/10 ❌ **Limit exceeded!**

---

## Risk Assessment

### Data Integrity Risks

| Risk                         | Probability | Impact   | Severity    |
| ---------------------------- | ----------- | -------- | ----------- |
| Partial purchase updates     | Medium      | High     | 🔴 Critical |
| Lost payment confirmation    | Low         | Critical | 🔴 Critical |
| Duplicate payment processing | Low         | High     | 🟡 High     |
| Class Rep limit bypass       | Medium      | Low      | 🟡 Medium   |
| Orphaned Stripe sessions     | Medium      | Low      | 🟢 Low      |

### Financial Impact

**Worst-case scenarios:**

1. **Lost Revenue Tracking:** User pays $500 → webhook fails → database shows no purchase → User can't access program → Support nightmare
2. **Double Charging:** Webhook retries → purchase completed twice → customer charged twice → Refund + reputation damage
3. **Over-selling Class Rep Spots:** Program allows 10 Class Reps → race condition → 12 sold → Manual intervention required

---

## MongoDB Transaction Requirements

### Prerequisites for Using Transactions

✅ **MongoDB 4.0+** - Multi-document transactions supported  
✅ **Replica Set** - Required for transactions (even with single node)  
❓ **Current Setup** - Need to verify if replica set is configured

**Check Current MongoDB Configuration:**

```bash
# Connect to MongoDB
mongo mongodb://localhost:27017/atcloud-signup

# Check if replica set is configured
rs.status()
```

**If not configured as replica set:**

```bash
# Convert standalone to replica set (local development)
# 1. Stop MongoDB
# 2. Edit mongod.conf: add replication.replSetName
# 3. Restart MongoDB
# 4. Initiate replica set: rs.initiate()
```

---

## Recommended Solutions

### Solution 1: Implement MongoDB Transactions (RECOMMENDED)

**Priority:** 🔴 **CRITICAL**

#### A. Wrap Purchase Creation in Transaction

```typescript
// backend/src/controllers/purchaseController.ts

static async createCheckoutSession(req: Request, res: Response): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Create Stripe session FIRST (can rollback database, not Stripe)
    const stripeSession = await createCheckoutSession({...});

    // 2. Create purchase record (with transaction)
    const orderNumber = await Purchase.generateOrderNumber();
    const [purchase] = await Purchase.create([{
      userId: req.user._id,
      programId: program._id,
      orderNumber,
      stripeSessionId: stripeSession.id,
      status: "pending",
      // ... other fields
    }], { session });

    // 3. Commit transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: {
        sessionId: stripeSession.id,
        sessionUrl: stripeSession.url,
      },
    });
  } catch (error) {
    // Rollback database changes
    await session.abortTransaction();

    // Note: Can't rollback Stripe session creation
    // Stripe sessions expire automatically after 24h

    console.error("Transaction failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create checkout session.",
    });
  } finally {
    session.endSession();
  }
}
```

#### B. Wrap Webhook Handler in Transaction

```typescript
// backend/src/controllers/webhookController.ts

private static async handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    // 1. Find purchase (with session lock)
    const purchase = await Purchase.findOne({
      stripeSessionId: session.id
    }).session(mongoSession);

    if (!purchase) {
      throw new Error(`Purchase not found for session: ${session.id}`);
    }

    // 2. Idempotency check (prevent duplicate processing)
    if (purchase.status === "completed") {
      console.log("Purchase already completed, skipping:", purchase.orderNumber);
      await mongoSession.commitTransaction();
      return;
    }

    // 3. Fetch payment details from Stripe
    const paymentIntentId = session.payment_intent as string;
    let paymentMethod = { type: "card" as const };

    if (paymentIntentId) {
      const paymentIntent = await getPaymentIntent(paymentIntentId);
      // ... extract payment details
      purchase.stripePaymentIntentId = paymentIntentId;
    }

    // 4. Update purchase (all fields atomically)
    purchase.billingInfo = {...};
    purchase.paymentMethod = paymentMethod;
    purchase.status = "completed";
    purchase.purchaseDate = new Date();

    await purchase.save({ session: mongoSession });

    // 5. Commit transaction BEFORE email
    await mongoSession.commitTransaction();

    // 6. Send email AFTER transaction committed
    // (Email failure won't rollback completed purchase)
    try {
      await purchase.populate([{ path: "userId" }, { path: "programId" }]);
      const user = purchase.userId as unknown as IUser;
      const program = purchase.programId as unknown as IProgram;

      if (user && program) {
        await EmailService.sendPurchaseConfirmationEmail({...});
      }
    } catch (emailError) {
      console.error("Email failed (purchase still completed):", emailError);
      // Don't throw - purchase is already completed successfully
    }

  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("Webhook transaction failed:", error);
    throw error; // Let webhook handler return 500 so Stripe retries
  } finally {
    mongoSession.endSession();
  }
}
```

#### C. Fix Class Rep Limit Race Condition

```typescript
// backend/src/controllers/purchaseController.ts

// Option 1: Use atomic findOneAndUpdate with increment
if (isClassRep && program.classRepLimit && program.classRepLimit > 0) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Atomically increment and check in one operation
    const updatedProgram = await Program.findOneAndUpdate(
      {
        _id: program._id,
        classRepCount: { $lt: program.classRepLimit }, // Only if under limit
      },
      {
        $inc: { classRepCount: 1 }, // Increment counter
      },
      {
        new: true,
        session,
      }
    );

    if (!updatedProgram) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Class Representative limit has been reached.",
      });
      return;
    }

    // Continue with purchase creation...
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Option 2: Add classRepCount field to Program model
// This allows atomic increment without counting documents every time
```

---

### Solution 2: Idempotency Keys

**Priority:** 🟡 **HIGH**

Add idempotency to webhook handlers to safely handle retries:

```typescript
// backend/src/models/WebhookEvent.ts (NEW MODEL)

const webhookEventSchema = new Schema({
  stripeEventId: {
    type: String,
    required: true,
    unique: true, // Prevent duplicate processing
    index: true,
  },
  eventType: { type: String, required: true },
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  attempts: { type: Number, default: 0 },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 86400 * 7 }, // Auto-delete after 7 days
});

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
```

```typescript
// backend/src/controllers/webhookController.ts

static async handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    res.status(400).json({ message: "Invalid signature" });
    return;
  }

  // Check if already processed (idempotency)
  const existingEvent = await WebhookEvent.findOne({
    stripeEventId: event.id
  });

  if (existingEvent?.processed) {
    console.log("Event already processed:", event.id);
    res.status(200).json({ received: true, cached: true });
    return;
  }

  // Create or update event record
  const webhookEvent = await WebhookEvent.findOneAndUpdate(
    { stripeEventId: event.id },
    {
      $set: { eventType: event.type },
      $inc: { attempts: 1 }
    },
    { upsert: true, new: true }
  );

  try {
    // Process event
    switch (event.type) {
      case "checkout.session.completed":
        await WebhookController.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      // ... other cases
    }

    // Mark as successfully processed
    webhookEvent.processed = true;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();

    res.status(200).json({ received: true });
  } catch (error) {
    // Store error for debugging
    webhookEvent.lastError = (error as Error).message;
    await webhookEvent.save();

    res.status(500).json({ message: "Processing failed" });
  }
}
```

---

### Solution 3: Stripe Webhook Retry Strategy

**Priority:** 🟢 **MEDIUM**

**Current Behavior:**

- Stripe automatically retries failed webhooks for up to 3 days
- Exponential backoff: 1h, 2h, 4h, 8h, 16h, 24h

**Recommended Configuration:**

1. **Enable webhook versioning in Stripe Dashboard**
2. **Set webhook endpoint to return:**

   - `200` - Successfully processed (don't retry)
   - `500` - Failed, please retry
   - `400` - Invalid data (don't retry)

3. **Monitor webhook failures:**

```typescript
// Log failed webhooks for manual review
if (error) {
  await ErrorLog.create({
    type: "webhook_failure",
    stripeEventId: event.id,
    eventType: event.type,
    error: error.message,
    payload: event,
    timestamp: new Date(),
  });
}
```

---

## Implementation Priority

### Phase 1: Critical Safety (Week 1)

1. ✅ Add MongoDB transaction to webhook handler
2. ✅ Add idempotency check using `WebhookEvent` model
3. ✅ Add transaction to purchase creation
4. ✅ Test failure scenarios thoroughly

### Phase 2: Race Condition Fixes (Week 2)

1. ✅ Add `classRepCount` field to Program model
2. ✅ Implement atomic Class Rep limit checking
3. ✅ Add database indexes for performance
4. ✅ Load test concurrent purchases

### Phase 3: Monitoring & Observability (Week 3)

1. ✅ Add webhook processing metrics
2. ✅ Set up alerts for failed transactions
3. ✅ Create admin dashboard for orphaned purchases
4. ✅ Document manual reconciliation process

---

## Testing Strategy

### Unit Tests Needed

```typescript
// tests/unit/payment-transactions.test.ts

describe("Payment Transaction Safety", () => {
  it("should rollback purchase if Stripe session fails", async () => {
    // Mock Stripe to fail after purchase created
    // Verify purchase record rolled back
  });

  it("should not create duplicate purchases on webhook retry", async () => {
    // Send same webhook twice
    // Verify only one purchase completed
  });

  it("should prevent Class Rep limit bypass with concurrent requests", async () => {
    // Simulate 5 concurrent purchase requests
    // Verify limit still enforced
  });

  it("should handle partial webhook failure gracefully", async () => {
    // Simulate database failure mid-webhook
    // Verify rollback and retry behavior
  });
});
```

### Integration Tests Needed

```typescript
// tests/integration/payment-flow.test.ts

describe("End-to-End Payment Flow", () => {
  it("should complete full purchase flow atomically", async () => {
    // Create checkout → webhook → verify purchase completed
  });

  it("should recover from webhook processing failure", async () => {
    // Simulate webhook failure → manual retry → verify completion
  });
});
```

---

## Deployment Checklist

### Before Deploying Transaction Changes:

- [ ] Verify MongoDB is configured as replica set
- [ ] Test transactions in staging environment
- [ ] Run all unit and integration tests
- [ ] Load test with concurrent transactions
- [ ] Set up monitoring alerts
- [ ] Document rollback procedure
- [ ] Train support team on manual reconciliation
- [ ] Create runbook for failed webhook scenarios

### Rollback Plan:

If transactions cause issues in production:

1. Revert webhook handler to non-transactional version
2. Process stuck webhooks manually using admin script
3. Monitor for data inconsistencies
4. Fix root cause in staging before re-deploying

---

## Conclusion

**Current Status:** ⚠️ Payment system lacks transaction safety

**Required Actions:**

1. **Immediate:** Add transactions to webhook handler (prevents lost payments)
2. **High Priority:** Add idempotency (prevents duplicate charges)
3. **Medium Priority:** Fix race conditions (prevents limit bypass)

**Timeline:** Estimated 2-3 weeks for full implementation and testing

**Risk if not fixed:** High probability of data inconsistencies in production under concurrent load or failure scenarios.

---

## References

- [MongoDB Transactions Documentation](https://www.mongodb.com/docs/manual/core/transactions/)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Idempotency in Payment Systems](https://stripe.com/docs/api/idempotent_requests)
- [ACID Properties in Databases](https://en.wikipedia.org/wiki/ACID)
