# Payment Transaction Safety - Lock-Based Solution

**Date:** 2025-10-15  
**Status:** 🟢 **RECOMMENDED APPROACH**  
**Environment:** Render Starter + MongoDB Atlas Free Tier

---

## Executive Summary

Instead of MongoDB transactions (which require replica sets not available in Atlas Free Tier), we can **leverage our existing `LockService`** to provide transaction-like safety for payment operations.

**Key Insights:**

1. ✅ We already have a production-ready `InMemoryLockService`
2. ✅ Render Starter runs on a **single instance** (perfect for in-memory locks)
3. ✅ MongoDB Atlas Free Tier **doesn't support replica sets** (transactions unavailable)
4. ✅ Lock-based approach provides similar safety guarantees without database transactions

---

## Current Lock System Analysis

### Existing Implementation

**Location:** `backend/src/services/LockService.ts`

**Features:**

- ✅ In-memory exclusive locking
- ✅ Automatic timeout protection (5000ms default)
- ✅ Queued operations for same key
- ✅ Automatic cleanup on completion/error
- ✅ Statistics tracking
- ✅ Production-ready with 27 unit tests

**Current Usage:**

- Event role signup (prevents double-booking)
- Registration operations (prevents race conditions)

**Lock Key Examples:**

```typescript
`signup:${eventId}:${roleId}` // Event signup lock
`event:${eventId}:capacity`; // Capacity check lock
```

---

## MongoDB Atlas Free Tier Limitations

### What We DON'T Have:

❌ **Replica Sets** - Free tier = standalone instance  
❌ **Multi-document transactions** - Requires replica set  
❌ **Distributed transactions** - Not supported  
❌ **Change streams** - Requires replica set

### What We DO Have:

✅ **Atomic single-document updates** - `findOneAndUpdate`, `$inc`, etc.  
✅ **Optimistic concurrency** - Version fields  
✅ **Indexes** - For query performance  
✅ **512 MB storage** - Sufficient for startup  
✅ **100 connection limit** - Adequate for single instance

---

## Lock-Based Transaction Pattern

### Core Concept

Use locks to **serialize critical operations** so only one process can execute at a time, preventing race conditions without needing database transactions.

**Flow:**

```
1. Acquire lock with unique key
2. Execute operation (read → validate → write)
3. Release lock (automatic)
```

**Benefits:**

- ✅ Prevents concurrent modifications
- ✅ No MongoDB transaction requirements
- ✅ Works on single instance (Render Starter)
- ✅ Already tested and production-ready
- ✅ Simple to understand and debug

**Limitations:**

- ⚠️ Only works for single-server deployment
- ⚠️ Doesn't provide rollback (must handle manually)
- ⚠️ Lock timeout = operation failure (must retry)

---

## Solution 1: Purchase Creation with Lock

### Problem

```typescript
// CURRENT: Race condition possible
const session = await createCheckoutSession({...});
await Purchase.create({...});  // Could fail, orphaning Stripe session
```

**Risk:** Stripe session created but database fails → no purchase record

### Solution: Lock-Based Creation

```typescript
// backend/src/controllers/purchaseController.ts

import { lockService } from "../services/LockService";

static async createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const { programId, isClassRep } = req.body;

    // Validate program exists
    const program = await Program.findById(programId);
    if (!program) {
      res.status(404).json({ success: false, message: "Program not found." });
      return;
    }

    if (program.isFree) {
      res.status(400).json({ success: false, message: "This program is free." });
      return;
    }

    // Check existing completed purchase (outside lock - read-only)
    const existingPurchase = await Purchase.findOne({
      userId: req.user._id,
      programId: program._id,
      status: "completed",
    });

    if (existingPurchase) {
      res.status(400).json({
        success: false,
        message: "You have already purchased this program."
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
          userId: req.user._id,
          programId: program._id,
          status: "pending",
        });

        // If pending exists, return existing session (idempotent)
        if (pendingPurchase && pendingPurchase.stripeSessionId) {
          try {
            const { stripe } = await import("../services/stripeService");
            const existingSession = await stripe.checkout.sessions.retrieve(
              pendingPurchase.stripeSessionId
            );

            // If session still valid, return it
            if (existingSession.status !== "expired") {
              return {
                sessionId: existingSession.id,
                sessionUrl: existingSession.url,
                existing: true
              };
            }
          } catch (error) {
            // Session expired or invalid, continue to create new one
            console.log("Existing session invalid, creating new one");
          }
        }

        // 2. Check Class Rep limit (atomic check + reserve within lock)
        if (isClassRep && program.classRepLimit && program.classRepLimit > 0) {
          const classRepCount = await Purchase.countDocuments({
            programId: program._id,
            isClassRep: true,
            status: { $in: ["pending", "completed"] }, // Count both to reserve spot
          });

          if (classRepCount >= program.classRepLimit) {
            throw new Error("Class Representative limit has been reached for this program.");
          }
        }

        // 3. Calculate pricing
        const fullPrice = program.fullPriceTicket;
        let classRepDiscount = 0;
        let earlyBirdDiscount = 0;
        let isEarlyBird = false;

        if (isClassRep && program.classRepDiscount > 0) {
          classRepDiscount = program.classRepDiscount;
        }

        if (program.earlyBirdDeadline && new Date() < program.earlyBirdDeadline) {
          isEarlyBird = true;
          earlyBirdDiscount = program.earlyBirdDiscount || 0;
        }

        const finalPrice = Math.max(0, fullPrice - classRepDiscount - earlyBirdDiscount);

        // 4. Create Stripe session FIRST (can't rollback, but expires in 24h)
        const { createCheckoutSession } = await import("../services/stripeService");
        const stripeSession = await createCheckoutSession({
          userId: String(req.user._id),
          userEmail: req.user.email,
          programId: String(program._id),
          programTitle: program.title,
          fullPrice,
          classRepDiscount,
          earlyBirdDiscount,
          finalPrice,
          isClassRep: !!isClassRep,
          isEarlyBird,
        });

        // 5. Create purchase record SECOND (atomic within lock)
        const orderNumber = await (Purchase as any).generateOrderNumber();

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
          stripeSessionId: stripeSession.id,
          status: "pending",
          billingInfo: {
            fullName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.username,
            email: req.user.email,
          },
          paymentMethod: { type: "card" },
          purchaseDate: new Date(),
        });

        return {
          sessionId: stripeSession.id,
          sessionUrl: stripeSession.url,
          existing: false
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

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create checkout session.",
    });
  }
}
```

**Key Improvements:**

1. ✅ **Idempotent** - Returns existing session if still valid
2. ✅ **Atomic Class Rep check** - Lock prevents race condition
3. ✅ **Single user lock** - Only blocks same user creating duplicate purchase
4. ✅ **Timeout protection** - 10s timeout for Stripe API
5. ✅ **Error handling** - Clear messages for different failure types

---

## Solution 2: Webhook Handler with Lock

### Problem

```typescript
// CURRENT: No idempotency, could process same webhook twice
const purchase = await Purchase.findOne({ stripeSessionId: session.id });
purchase.status = "completed";
await purchase.save(); // Partial update possible if crash
```

**Risk:** Webhook retry → duplicate processing, inconsistent state

### Solution: Lock + Idempotency

```typescript
// backend/src/controllers/webhookController.ts

import { lockService } from "../services/LockService";

private static async handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log("Checkout session completed:", session.id);

  // Lock ensures only one webhook processes this session
  const lockKey = `webhook:session:${session.id}`;

  await lockService.withLock(
    lockKey,
    async () => {
      // 1. Find purchase
      const purchase = await Purchase.findOne({
        stripeSessionId: session.id
      });

      if (!purchase) {
        console.error("Purchase not found for session:", session.id);
        throw new Error(`Purchase not found for session: ${session.id}`);
      }

      // 2. IDEMPOTENCY CHECK: Skip if already completed
      if (purchase.status === "completed") {
        console.log("Purchase already completed (idempotent), skipping:", purchase.orderNumber);
        return; // Exit early, don't re-process
      }

      // 3. Fetch payment details from Stripe
      const paymentIntentId = session.payment_intent as string;
      let paymentMethod: {
        type: "card" | "other";
        cardBrand?: string;
        last4?: string;
        cardholderName?: string;
      } = { type: "card" };

      if (paymentIntentId) {
        try {
          const paymentIntent = await getPaymentIntent(paymentIntentId);

          if (paymentIntent.latest_charge) {
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge.id;

            const { stripe } = await import("../services/stripeService");
            const charge = await stripe.charges.retrieve(chargeId);
            const paymentMethodDetails = charge.payment_method_details;

            if (paymentMethodDetails?.card) {
              paymentMethod = {
                type: "card",
                cardBrand: paymentMethodDetails.card.brand || undefined,
                last4: paymentMethodDetails.card.last4 || undefined,
                cardholderName: charge.billing_details?.name || undefined,
              };
            }
          }

          purchase.stripePaymentIntentId = paymentIntentId;
        } catch (error) {
          console.error("Error fetching payment intent:", error);
          // Continue anyway - payment succeeded even if details fetch failed
        }
      }

      // 4. Update billing info from session
      if (session.customer_details) {
        purchase.billingInfo = {
          fullName: session.customer_details.name || purchase.billingInfo.fullName,
          email: session.customer_details.email || purchase.billingInfo.email,
          address: session.customer_details.address?.line1 || undefined,
          city: session.customer_details.address?.city || undefined,
          state: session.customer_details.address?.state || undefined,
          zipCode: session.customer_details.address?.postal_code || undefined,
          country: session.customer_details.address?.country || undefined,
        };
      }

      // 5. Update payment method
      purchase.paymentMethod = paymentMethod;

      // 6. Mark purchase as completed (ATOMIC UPDATE)
      purchase.status = "completed";
      purchase.purchaseDate = new Date();

      // 7. Save all changes atomically
      await purchase.save();

      console.log("Purchase completed successfully:", purchase.orderNumber);

      // 8. Send confirmation email AFTER save (best effort)
      // Email failure doesn't affect purchase completion
      try {
        await purchase.populate([{ path: "userId" }, { path: "programId" }]);

        const user = purchase.userId as unknown as IUser;
        const program = purchase.programId as unknown as IProgram;

        if (user && program) {
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
          const receiptUrl = `${frontendUrl}/dashboard/purchase-receipt/${purchase._id}`;

          await EmailService.sendPurchaseConfirmationEmail({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            orderNumber: purchase.orderNumber,
            programTitle: program.title,
            programType: program.programType || "Program",
            purchaseDate: purchase.purchaseDate,
            fullPrice: purchase.fullPrice,
            finalPrice: purchase.finalPrice,
            classRepDiscount: purchase.classRepDiscount || 0,
            earlyBirdDiscount: purchase.earlyBirdDiscount || 0,
            isClassRep: purchase.isClassRep,
            isEarlyBird: purchase.isEarlyBird,
            receiptUrl,
          });

          console.log(`Purchase confirmation email sent to ${user.email}`);
        } else {
          console.warn("Could not send confirmation email: user or program not found");
        }
      } catch (emailError) {
        console.error("Error sending purchase confirmation email:", emailError);
        // Don't throw - purchase is already completed successfully
      }
    },
    15000 // 15s timeout for Stripe API + email
  );
}
```

**Key Improvements:**

1. ✅ **Idempotent** - Checks if already completed before processing
2. ✅ **Atomic** - Lock ensures only one webhook processes
3. ✅ **Stripe retry safe** - Returns success even if already processed
4. ✅ **Email failure handling** - Purchase completes even if email fails
5. ✅ **Timeout protection** - 15s covers Stripe API + email sending

---

## Solution 3: Class Rep Limit with Atomic Counter

### Problem

```typescript
// CURRENT: Race condition
const count = await Purchase.countDocuments({...});
if (count >= limit) { /* reject */ }
// Two users could pass check simultaneously!
```

**Risk:** Limit = 10, but 11 users get in due to race condition

### Solution: Atomic Field Increment

#### Step 1: Add Counter to Program Model

```typescript
// backend/src/models/Program.ts

const programSchema = new Schema({
  // ... existing fields ...

  // Class Rep tracking
  classRepLimit: {
    type: Number,
    default: 0,
    min: 0,
  },
  classRepCount: {
    // NEW FIELD
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function (this: any, value: number) {
        // Ensure count never exceeds limit
        if (this.classRepLimit > 0 && value > this.classRepLimit) {
          return false;
        }
        return true;
      },
      message: "Class Rep count cannot exceed limit",
    },
  },

  // ... rest of fields ...
});
```

#### Step 2: Atomic Increment in Purchase Creation

```typescript
// Inside lockService.withLock() in createCheckoutSession

// 2. Check and RESERVE Class Rep spot atomically
if (isClassRep && program.classRepLimit && program.classRepLimit > 0) {
  // Atomic increment: only succeeds if under limit
  const updatedProgram = await Program.findOneAndUpdate(
    {
      _id: program._id,
      classRepCount: { $lt: program.classRepLimit }, // Only if count < limit
    },
    {
      $inc: { classRepCount: 1 }, // Atomically increment
    },
    {
      new: true, // Return updated document
      runValidators: true, // Run validation
    }
  );

  if (!updatedProgram) {
    // Failed to increment = limit reached
    throw new Error(
      "Class Representative limit has been reached for this program."
    );
  }

  // Spot reserved! Continue with purchase creation
  console.log(
    `Class Rep spot reserved: ${updatedProgram.classRepCount}/${program.classRepLimit}`
  );
}
```

#### Step 3: Decrement on Purchase Failure/Cancellation

```typescript
// backend/src/controllers/purchaseController.ts

// When purchase fails or is canceled:
static async cancelPurchase(purchaseId: string): Promise<void> {
  const purchase = await Purchase.findById(purchaseId);

  if (purchase && purchase.isClassRep && purchase.status !== "completed") {
    // Decrement Class Rep count (return the reserved spot)
    await Program.findByIdAndUpdate(
      purchase.programId,
      { $inc: { classRepCount: -1 } },
      { runValidators: false } // Allow going below limit on decrement
    );
  }

  purchase.status = "failed";
  await purchase.save();
}
```

**Key Improvements:**

1. ✅ **Atomic** - `findOneAndUpdate` with condition is single operation
2. ✅ **Race-condition free** - MongoDB guarantees atomicity
3. ✅ **No lock needed** - Database handles concurrency
4. ✅ **Accurate count** - Always matches reality
5. ✅ **Reservation system** - Spot reserved when payment starts

---

## Solution 4: Webhook Event Deduplication (Simple)

### Problem

Stripe may retry webhooks, causing duplicate processing.

### Solution: Simple Status Check (No Extra Model)

```typescript
// Already implemented in Solution 2!

if (purchase.status === "completed") {
  console.log("Purchase already completed (idempotent), skipping");
  return; // Early exit
}
```

**Why This Works:**

- ✅ Lock ensures only one webhook processes at a time
- ✅ Status check provides idempotency
- ✅ No extra database model needed
- ✅ Simple and maintainable

**Alternative: Add `processedWebhookIds` Array**

If you need more robust tracking:

```typescript
// backend/src/models/Purchase.ts

const purchaseSchema = new Schema({
  // ... existing fields ...

  processedWebhookIds: {
    type: [String],
    default: [],
    maxlength: 10, // Keep only recent 10 webhook IDs
  },
});

// In webhook handler:
if (purchase.processedWebhookIds.includes(event.id)) {
  console.log("Webhook already processed:", event.id);
  return;
}

purchase.processedWebhookIds.push(event.id);
if (purchase.processedWebhookIds.length > 10) {
  purchase.processedWebhookIds.shift(); // Keep array small
}
```

---

## Comparison: Locks vs Transactions

| Feature                  | MongoDB Transactions      | Lock-Based Solution         |
| ------------------------ | ------------------------- | --------------------------- |
| **Atomicity**            | ✅ Full ACID              | ⚠️ Application-level        |
| **Rollback**             | ✅ Automatic              | ❌ Manual compensation      |
| **Multi-document**       | ✅ Yes                    | ⚠️ Sequential operations    |
| **Replica Set Required** | ❌ Yes (not in free tier) | ✅ No                       |
| **Single Instance**      | ⚠️ Works but wasteful     | ✅ Perfect fit              |
| **Performance**          | ⚠️ Higher overhead        | ✅ Minimal overhead         |
| **Complexity**           | ⚠️ Database-specific      | ✅ Simple application logic |
| **Debugging**            | ⚠️ Harder                 | ✅ Easy to trace            |
| **Cost**                 | 💰 Requires paid tier     | ✅ Free tier compatible     |

**Verdict:** Lock-based solution is **better** for our use case.

---

## Implementation Priority

### Phase 1: Core Safety (Week 1) 🔴 CRITICAL

1. ✅ Add lock to `createCheckoutSession()`

   - Prevent duplicate pending purchases
   - Atomic Class Rep limit check
   - File: `backend/src/controllers/purchaseController.ts`

2. ✅ Add lock + idempotency to `handleCheckoutSessionCompleted()`

   - Prevent duplicate webhook processing
   - Atomic purchase completion
   - File: `backend/src/controllers/webhookController.ts`

3. ✅ Add `classRepCount` field to Program model
   - Enable atomic counter operations
   - File: `backend/src/models/Program.ts`

### Phase 2: Robustness (Week 2) 🟡 HIGH

1. ✅ Add atomic Class Rep increment/decrement

   - Replace count query with atomic operation
   - Handle purchase cancellations

2. ✅ Add comprehensive error handling

   - Lock timeout errors
   - Stripe API failures
   - Email sending failures

3. ✅ Add monitoring and alerts
   - Lock statistics tracking
   - Failed webhook logging
   - Purchase anomaly detection

### Phase 3: Testing (Week 2-3) 🟢 MEDIUM

1. ✅ Unit tests for locked operations
2. ✅ Integration tests for race conditions
3. ✅ Load testing with concurrent purchases
4. ✅ Webhook retry simulation

---

## Migration Strategy

### Step 1: Add New Code (No Breaking Changes)

```typescript
// Add lock-based version alongside existing code
static async createCheckoutSessionV2(req: Request, res: Response) {
  // New locked implementation
}

// Keep old version temporarily
static async createCheckoutSession(req: Request, res: Response) {
  // Existing code (unchanged)
}
```

### Step 2: Test in Staging

- Deploy both versions
- Route 10% traffic to V2
- Monitor for errors
- Increase to 50%, then 100%

### Step 3: Replace Old Version

```typescript
// Remove V2 suffix, delete old version
static async createCheckoutSession(req: Request, res: Response) {
  // New locked implementation becomes default
}
```

### Step 4: Add Monitoring

```typescript
// Log lock statistics
setInterval(() => {
  const stats = lockService.getLockStats();
  console.log("Lock stats:", stats);
}, 60000); // Every minute
```

---

## Testing Strategy

### Unit Tests

```typescript
describe("Purchase Creation with Lock", () => {
  it("should prevent duplicate pending purchases", async () => {
    // Simulate two concurrent requests from same user
    const promises = [
      createCheckoutSession(user1, programA),
      createCheckoutSession(user1, programA),
    ];

    const results = await Promise.allSettled(promises);

    // One should succeed with new session
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    // One should return existing session (idempotent)
    expect(results.filter((r) => r.value?.existing === true)).toHaveLength(1);
  });

  it("should enforce Class Rep limit atomically", async () => {
    // Set limit to 10
    program.classRepLimit = 10;
    await program.save();

    // Try to create 15 concurrent purchases
    const promises = Array.from({ length: 15 }, (_, i) =>
      createCheckoutSession(users[i], program, { isClassRep: true })
    );

    const results = await Promise.allSettled(promises);

    // Only 10 should succeed
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);

    // Verify counter
    const updated = await Program.findById(program._id);
    expect(updated.classRepCount).toBe(10);
  });
});

describe("Webhook Handler with Lock", () => {
  it("should process webhook only once (idempotent)", async () => {
    // Send same webhook twice
    await handleCheckoutSessionCompleted(sessionData);
    await handleCheckoutSessionCompleted(sessionData);

    // Purchase should be completed only once
    const purchase = await Purchase.findOne({
      stripeSessionId: sessionData.id,
    });
    expect(purchase.status).toBe("completed");

    // Email sent only once
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});
```

### Load Testing

```bash
# Simulate 100 concurrent purchase requests
artillery quick \
  --count 100 \
  --num 1 \
  POST https://api.atcloud.com/api/purchases/create-checkout-session

# Monitor lock statistics
curl https://api.atcloud.com/api/system/locks
```

---

## Monitoring & Observability

### Add Lock Metrics Endpoint

```typescript
// backend/src/routes/system.ts

router.get("/locks", authenticate, requireAdmin, (req, res) => {
  const stats = lockService.getLockStats();

  res.json({
    success: true,
    data: {
      activeLocks: stats.activeLocks,
      totalLocksAcquired: stats.totalLocksAcquired,
      averageWaitTime: stats.averageWaitTime,
      health: stats.activeLocks > 10 ? "warning" : "healthy",
    },
  });
});
```

### Add Purchase Anomaly Detection

```typescript
// Scheduled job: Check for stuck purchases
cron.schedule("*/15 * * * *", async () => {
  const stuckPurchases = await Purchase.find({
    status: "pending",
    createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }, // > 1 hour old
  });

  if (stuckPurchases.length > 0) {
    console.warn(`Found ${stuckPurchases.length} stuck pending purchases`);
    // Send alert to admin
  }
});
```

---

## Rollback Plan

If issues occur after deployment:

### Immediate Rollback

```bash
# Revert to previous deployment
git revert HEAD
git push
# Render auto-deploys
```

### Manual Fix for Stuck Purchases

```typescript
// Admin script: Manually complete stuck purchases
async function fixStuckPurchase(orderNumber: string) {
  const purchase = await Purchase.findOne({ orderNumber });

  if (purchase.status === "pending" && purchase.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(
      purchase.stripeSessionId
    );

    if (session.payment_status === "paid") {
      purchase.status = "completed";
      purchase.purchaseDate = new Date();
      await purchase.save();

      console.log(`Fixed purchase ${orderNumber}`);
    }
  }
}
```

---

## Advantages of Lock-Based Approach

### ✅ Render Starter Compatible

- Single instance deployment (perfect for locks)
- No cluster/PM2 configuration needed
- Existing `SINGLE_INSTANCE_ENFORCE` guard already in place

### ✅ MongoDB Atlas Free Tier Compatible

- No replica set requirement
- Uses atomic operations (`findOneAndUpdate`)
- Standard queries and updates only

### ✅ Code Simplicity

- No transaction boilerplate
- Clear error handling
- Easy to debug and test

### ✅ Performance

- In-memory locks = microsecond latency
- No distributed coordination overhead
- Minimal memory footprint

### ✅ Already Battle-Tested

- LockService has 27 unit tests
- Used in production for event signups
- Proven reliable under load

---

## Conclusion

**Recommendation:** Implement lock-based solution using existing `LockService`.

**Timeline:** 1-2 weeks for full implementation and testing

**Benefits:**

- ✅ Works with current infrastructure (no upgrades needed)
- ✅ Simpler than database transactions
- ✅ Better performance for single-instance deployment
- ✅ Already have robust locking system

**Trade-offs:**

- ⚠️ Only works for single instance (acceptable for Render Starter)
- ⚠️ Manual error handling instead of automatic rollback
- ⚠️ Can't scale to multi-instance without Redis/MongoDB locking

**Next Steps:**

1. Implement Phase 1 (core safety features)
2. Test thoroughly in staging
3. Deploy gradually with monitoring
4. Document operational procedures

---

## References

- [LockService Implementation](../backend/src/services/LockService.ts)
- [Lock System Audit](./CACHE_AND_LOCK_AUDIT_2025-10-09.md)
- [Render Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [MongoDB Atlas Free Tier Limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
