# Donation Feature Implementation Roadmap

**Project**: at-Cloud Sign-up System  
**Feature**: Donation System with Stripe Integration  
**Date**: November 10, 2025  
**Status**: Phase 2 Complete - Backend & Stripe Integration Finished ✅

---

## Implementation Progress

### ✅ Phase 1: Backend Foundation (COMPLETED)

- ✅ Database models (Donation, DonationTransaction)
- ✅ Service layer with business logic
- ✅ Controller with 8 endpoints
- ✅ Routes registered in app

### ✅ Phase 2: Stripe Integration (COMPLETED)

- ✅ Stripe service functions (9 methods)
- ✅ Controller integration with Stripe API
- ✅ Webhook handlers for donation events
- ✅ TypeScript compilation passing

### ⏳ Phase 3: Frontend Implementation (NEXT)

- Add "Donate" to sidebar navigation
- Create DonationPage with tabs
- Create GiveModal form component
- Build transaction history UI
- Build scheduled donations UI

---

## Overview

Building a comprehensive donation system integrated with Stripe, supporting both one-time and recurring donations with future scheduling capabilities.

---

## 1. UI Structure

### 1.1 Sidebar Navigation

- Add "Donate" menu item between "Feedback" and "Log Out"
- Available to all authenticated users (all roles)

### 1.2 Donation Page Layout

**Route**: `/dashboard/donate`
**Title**: "Donation to Our Ministry"

**Components**:

- Header with "+ Give" button (opens modal)
- Two tabs: "Giving" (history) and "Scheduled" (upcoming recurring)

---

## 2. "+ Give" Modal - Donation Form

### 2.1 Common Fields

- **Amount**: Text input, validation: $1.00 - $999,999.00
- **Donation Type**: Two radio options:
  - "Give once"
  - "Give Multiple times"

### 2.2 Give Once Flow

**Fields**:

- Gift Date: Date picker (today → future dates only)

**Summary Section**:

```
$100.00
total
```

**Action**: "Continue" button → Redirect to Stripe Checkout

**Backend Logic**:

- Create Stripe scheduled payment for the selected future date
- Store donation record with status: "scheduled"
- On the scheduled date, Stripe processes payment automatically
- Webhook updates status to "completed"

### 2.3 Give Multiple Times Flow

**Fields**:

- **Frequency** (required): Radio buttons
  - Every Week
  - Every 2 Weeks
  - Every Month
  - Every 3 Months
  - Annually
- **Start Date** (required): Date picker (today → future)

- **+ END** (optional button): Reveals:
  - **Stop Giving After**: Dropdown
    - Option 1: "Date" → Shows "End Date" picker
    - Option 2: "#of times" → Shows "Number of Times" input (integer)

**Summary Section Examples**:

_Without End Date_:

```
$50.00
every week
```

_With End Date (Date option)_:

```
$50.00
every week
24 gifts scheduled
Total: $1,200.00
```

_With End Date (#of times option)_:

```
$100.00
every month
12 gifts scheduled
Total: $1,200.00
```

**Action**: "Continue" button → Redirect to Stripe Checkout

**Backend Logic**:

- Create Stripe Subscription with:
  - `billing_cycle_anchor`: Start Date timestamp
  - `cancel_at`: Calculated end date (if specified)
  - Or track iteration count in our database
- Store subscription record with status: "active"
- Webhook handles each recurring payment event
- Auto-change status to "completed" after final payment

---

## 3. "Giving" Tab - Donation History

### 3.1 Stats Cards (Top Row)

- **Total Amount**: Sum of all completed donations
- **Total Gifts**: Count of all completed donation transactions

### 3.2 History Table

**Columns**:
| Gift Date | Type | Payment Method | Amount |
|-----------|------|----------------|--------|
| Nov 10, 2025 | One-time | Visa \*\*\*0920 | $100.00 |
| Nov 3, 2025 | Recurring | Mastercard \*\*\*4532 | $50.00 |

**Data Display**:

- **Gift Date**: Date when payment was processed (completed)
- **Type**: "One-time" or "Recurring"
- **Payment Method**: `{cardBrand} ***{last4}`
- **Amount**: `${amount}`

**Notes**:

- Each recurring payment shows as a separate row
- Sorted by Gift Date descending (most recent first)
- Only shows completed/successful donations

---

## 4. "Scheduled" Tab - Upcoming Recurring Donations

### 4.1 Display Format

Each scheduled recurring donation shows as a card:

```
### $100.00 gift scheduled for Nov 17, 2025

Weekly on Mondays

Last gift on Apr 20, 2026

23 gifts remaining ending on Apr 21, 2026

Visa ***0920

[Edit] [Place On Hold] [Cancel]
```

**Data Shown**:

- Next payment amount and date
- Frequency description ("Weekly on Mondays", "Every 2 weeks", etc.)
- Last scheduled gift date
- Remaining gifts count and end date
- Payment method

### 4.2 Action Buttons

#### **Edit Button**

- Opens same "+ Give" modal
- Pre-filled with current donation data
- User can modify:
  - Amount
  - Frequency
  - Start date
  - End conditions
  - Payment method (through Stripe)
- On Continue: Update Stripe subscription
- Backend tries to update existing subscription parameters

#### **Place On Hold Button**

- Shows confirmation modal:
  ```
  Are you sure you want to place this scheduled gift on hold?
  [Cancel] [Confirm]
  ```
- On Confirm:
  - Pause Stripe subscription (keep payment method)
  - Update status: "on_hold"
  - Show "Resume" button in place of "Place On Hold"

#### **Resume Button** (when on hold)

- Resumes Stripe subscription
- Update status: "active"
- Replace with "Place On Hold" button

#### **Cancel Button**

- Shows confirmation modal:
  ```
  Are you sure you want to cancel this scheduled gift?
  [Cancel] [Confirm]
  ```
- On Confirm:
  - Cancel Stripe subscription
  - Update status: "cancelled"
  - Move to history with cancelled status

---

## 5. Database Schema

### 5.1 New Model: `Donation`

```typescript
{
  userId: ObjectId,
  amount: Number, // in cents
  type: 'one-time' | 'recurring',
  frequency: String?, // 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'
  status: 'scheduled' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'failed',

  // Dates
  giftDate: Date?, // for one-time donations
  startDate: Date?, // for recurring
  nextPaymentDate: Date?,
  endDate: Date?,
  lastGiftDate: Date?,

  // End conditions
  endAfterOccurrences: Number?,
  currentOccurrence: Number?, // track payment count
  remainingOccurrences: Number?,

  // Stripe references
  stripePaymentIntentId: String?, // one-time
  stripeSubscriptionId: String?, // recurring
  stripeCustomerId: String,

  // Payment method
  paymentMethod: {
    type: String,
    cardBrand: String,
    last4: String
  },

  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

### 5.2 New Model: `DonationTransaction`

```typescript
{
  donationId: ObjectId,
  userId: ObjectId,
  amount: Number,
  type: 'one-time' | 'recurring',
  status: 'completed' | 'failed' | 'refunded',
  giftDate: Date, // when payment processed
  stripePaymentIntentId: String,
  paymentMethod: {
    cardBrand: String,
    last4: String
  },
  createdAt: Date
}
```

---

## 6. Backend Implementation

### 6.1 New Routes

```
POST   /api/donations/create          - Create donation (one-time or recurring)
GET    /api/donations/my-donations    - Get user's donation history (Giving tab)
GET    /api/donations/my-scheduled    - Get user's scheduled donations
PUT    /api/donations/:id/edit        - Update scheduled donation
PUT    /api/donations/:id/hold        - Place on hold
PUT    /api/donations/:id/resume      - Resume from hold
DELETE /api/donations/:id/cancel      - Cancel scheduled donation
GET    /api/donations/stats           - Get user's donation stats
```

### 6.2 Stripe Integration

#### One-Time Future Donation

- Use `stripe.paymentIntents.create()` with future `payment_schedule`
- Or `stripe.checkout.sessions.create()` with scheduled payment

#### Recurring Donation

- Use `stripe.subscriptions.create()` with:
  - `billing_cycle_anchor`: startDate timestamp
  - `cancel_at`: calculated endDate timestamp (if specified)
  - Custom interval for "Every 2 Weeks" etc.

### 6.3 Webhook Events to Handle

```
// One-time donations
payment_intent.succeeded
payment_intent.payment_failed

// Recurring donations
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded  // Each recurring payment
invoice.payment_failed
```

### 6.4 Webhook Logic

- `invoice.payment_succeeded`:
  - Create `DonationTransaction` record
  - Update `currentOccurrence` count
  - Check if reached `endAfterOccurrences`
  - If final payment: update status to "completed", cancel subscription

---

## 7. Frontend Components Structure

```
/dashboard/donate
├── DonationPage.tsx (main container)
│   ├── GiveButton (opens modal)
│   ├── Tabs (Giving / Scheduled)
│   │   ├── GivingTab.tsx
│   │   │   ├── StatsCards (Total Amount, Total Gifts)
│   │   │   └── DonationHistoryTable
│   │   └── ScheduledTab.tsx
│   │       └── ScheduledDonationCard[] (with Edit/Hold/Cancel)
│   └── GiveModal.tsx
│       ├── AmountInput
│       ├── TypeSelector (Once / Multiple)
│       ├── OneTimeFields (GiftDate)
│       ├── RecurringFields
│       │   ├── FrequencySelector
│       │   ├── StartDatePicker
│       │   └── EndConditions (optional)
│       └── Summary + Continue
```

---

## 8. User Flow Examples

### Example 1: One-Time $100 Donation on Christmas

1. Click "+ Give"
2. Enter Amount: $100
3. Select "Give once"
4. Select Gift Date: Dec 25, 2025
5. See Summary: "$100.00 / total"
6. Click Continue → Stripe Checkout
7. Complete payment
8. Scheduled donation created, status: "scheduled"
9. On Dec 25, Stripe processes payment
10. Webhook updates status: "completed"
11. Shows in Giving tab history

### Example 2: Monthly $50 for 12 Months

1. Click "+ Give"
2. Enter Amount: $50
3. Select "Give Multiple times"
4. Select Frequency: "Every Month"
5. Select Start Date: Nov 15, 2025
6. Click "+ END"
7. Select "#of times", enter 12
8. See Summary: "$50.00 / every month / 12 gifts scheduled / Total: $600.00"
9. Click Continue → Stripe Checkout
10. Subscription created, first payment Nov 15
11. Shows in Scheduled tab with 12 remaining
12. Each month: webhook creates transaction, decrements count
13. After 12th payment: status changes to "completed"

---

## 9. Technical Considerations

### 9.1 Best Practices

- **Webhook Handler**: Create separate `/api/webhooks/stripe-donations` endpoint for donation events (separate from purchase webhooks for cleaner separation)
- **Idempotency**: Use Stripe idempotency keys for retry safety
- **Error Handling**: Failed payments send user notifications
- **Currency**: All amounts stored in cents (integer)

### 9.2 Edge Cases

- User edits donation before first payment: Cancel old subscription, create new
- End date calculation with "#of times": Store both count and calculated end date
- Timezone handling: Use user's timezone for date selections, convert to UTC for storage
- Stripe minimum: $1.00 (100 cents)

---

## 10. Implementation Phases

### Phase 1: Database Models + Backend Routes ✅ COMPLETED

- [x] Create `Donation` model
- [x] Create `DonationTransaction` model
- [x] Create donation routes
- [x] Create donation controller
- [x] Create donation service

### Phase 2: Stripe Integration + Webhook Handlers (IN PROGRESS)

- [ ] Implement one-time donation with Stripe
- [ ] Implement recurring donation with Stripe
- [ ] Create webhook handler for donations
- [ ] Handle all webhook events
- [ ] Test webhook flows

### Phase 3: Frontend Components + Modal UI

- [ ] Add "Donate" to sidebar
- [ ] Create DonationPage component
- [ ] Create GiveModal component
- [ ] Create GivingTab component
- [ ] Create ScheduledTab component
- [ ] Create donation API service

### Phase 4: Integration + Testing

- [ ] End-to-end testing
- [ ] Error handling
- [ ] Loading states
- [ ] Success/failure notifications

### Phase 5: Edge Cases + Polish

- [ ] Edit functionality
- [ ] Hold/Resume functionality
- [ ] Cancel functionality
- [ ] Stats calculation
- [ ] Payment method display

---

## 11. API Response Formats

### Create Donation Response

```json
{
  "success": true,
  "data": {
    "donationId": "...",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

### Get Donation History Response

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "...",
        "giftDate": "2025-11-10T10:00:00Z",
        "type": "one-time",
        "amount": 10000,
        "paymentMethod": {
          "cardBrand": "visa",
          "last4": "0920"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Get Stats Response

```json
{
  "success": true,
  "data": {
    "totalAmount": 125000,
    "totalGifts": 45
  }
}
```

### Get Scheduled Donations Response

```json
{
  "success": true,
  "data": {
    "scheduled": [
      {
        "id": "...",
        "amount": 10000,
        "nextPaymentDate": "2025-11-17T10:00:00Z",
        "frequency": "weekly",
        "lastGiftDate": "2026-04-20T10:00:00Z",
        "remainingOccurrences": 23,
        "endDate": "2026-04-21T10:00:00Z",
        "status": "active",
        "paymentMethod": {
          "cardBrand": "visa",
          "last4": "0920"
        }
      }
    ]
  }
}
```

---

## 12. Validation Rules

### Amount

- Minimum: $1.00 (100 cents)
- Maximum: $999,999.00 (99999900 cents)
- Must be positive integer (in cents)

### Dates

- Gift Date: Must be today or future date
- Start Date: Must be today or future date
- End Date: Must be after Start Date

### Frequency

- Allowed values: "weekly", "biweekly", "monthly", "quarterly", "annually"

### End Conditions

- If "Date": endDate required
- If "#of times": endAfterOccurrences required (positive integer)

---

## 13. Error Messages

### Client-Side

- "Amount must be between $1.00 and $999,999.00"
- "Gift date must be today or a future date"
- "Start date must be today or a future date"
- "End date must be after start date"
- "Number of times must be a positive number"

### Server-Side

- "Invalid donation amount"
- "Failed to create donation"
- "Donation not found"
- "Cannot edit completed donation"
- "Cannot hold/resume one-time donation"
- "Stripe payment failed"

---

## 14. Testing Strategy

### Unit Tests

- DonationService methods
- Date calculation helpers
- Amount validation logic

### Integration Tests

- API endpoint testing
- Stripe webhook simulation
- Database operations

### E2E Tests

- Complete donation flows
- Payment processing
- Webhook event handling

---

## 15. Phase 2 Implementation Details

### Webhook Handler Implementation

**File**: `backend/src/controllers/webhookController.ts`

#### Webhook Events Handled:

1. **`checkout.session.completed`**

   - Detects donation checkouts via metadata
   - Updates donation with Stripe customer ID
   - For subscriptions: stores subscription ID
   - For one-time: records transaction immediately
   - Extracts payment method details (card brand, last4)

2. **`invoice.payment_succeeded`**

   - Finds donation by subscription ID
   - Records transaction in DonationTransaction
   - Updates payment method on donation record
   - Updates last gift date
   - Increments occurrence counters
   - Calculates next payment date
   - Marks as completed if end condition met

3. **`invoice.payment_failed`**

   - Finds donation by subscription ID
   - Marks donation status as "failed"
   - Logs failure for admin review
   - TODO: Send notification to user

4. **`customer.subscription.updated`**

   - Finds donation by subscription ID
   - Updates status based on pause_collection state:
     - Paused → "on_hold"
     - Active → "active"
   - Updates next payment date from current_period_end

5. **`customer.subscription.deleted`**
   - Finds donation by subscription ID
   - Marks donation status as "cancelled"
   - Logs cancellation event

#### Technical Notes:

- Uses existing webhook infrastructure at `/api/webhooks/stripe`
- Shares signature verification with purchase webhooks
- Singleton pattern for DonationService (not constructable)
- Type assertions for Stripe properties not in strict TypeScript definitions
- Mongoose ObjectId casting for proper type safety
- Idempotent webhook processing (safe to retry)

#### Stripe Metadata Usage:

**Checkout Session Metadata**:

```typescript
{
  type: "donation",
  donationId: string,
  userId: string,
  // For recurring:
  frequency: string,
  startDate: ISO string
}
```

**Subscription Metadata**:

```typescript
{
  donationId: string,
  userId: string,
  type: "recurring",
  frequency: string,
  startDate: ISO string
}
```

**Price Metadata**:

```typescript
{
  donationId: string,
  userId: string,
  frequency: string
}
```

#### Payment Method Extraction:

Webhook handler extracts payment details from Stripe Charge:

- Card brand (Visa, MasterCard, etc.)
- Last 4 digits
- Cardholder name (when available)

Stored in donation record for display in UI without additional Stripe calls.

---

## Next Steps (Phase 3: Frontend)

### Immediate Tasks:

1. **Add Donate to Sidebar**

   - Edit `frontend/src/components/layout/Sidebar.tsx`
   - Add navigation item between Feedback and Log Out
   - Icon: HeartIcon from Heroicons
   - Route: `/dashboard/donate`

2. **Create DonationPage Component**

   - File: `frontend/src/pages/DonationPage.tsx`
   - Two tabs: "Giving" and "Scheduled"
   - "+ Give" button opens modal
   - Fetch donation history and scheduled donations

3. **Create GiveModal Component**

   - File: `frontend/src/components/donations/GiveModal.tsx`
   - Form with amount, type, date/schedule inputs
   - Real-time summary calculation
   - Stripe checkout redirect

4. **Create History Components**

   - File: `frontend/src/components/donations/GivingTab.tsx`
   - Stats cards (total given, # of gifts)
   - Transaction history table
   - Payment method display

5. **Create Scheduled Components**
   - File: `frontend/src/components/donations/ScheduledTab.tsx`
   - Donation cards with details
   - Edit/Hold/Resume/Cancel actions
   - Next payment date display

---

## Completion Checklist

### Backend (Phase 1-2) ✅

- [x] Donation model with schema
- [x] DonationTransaction model
- [x] DonationService with business logic
- [x] DonationController with 8 endpoints
- [x] Stripe integration functions
- [x] Webhook handlers for all events
- [x] TypeScript compilation passing
- [x] Routes registered

### Frontend (Phase 3) ⏳

- [ ] Sidebar navigation updated
- [ ] DonationPage created
- [ ] GiveModal implemented
- [ ] GivingTab with history
- [ ] ScheduledTab with cards
- [ ] Payment method display
- [ ] Action buttons (edit/hold/resume/cancel)
- [ ] Real-time summary calculations
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling

### Testing (Phase 4) ⏳

- [ ] Unit tests for DonationService
- [ ] Controller endpoint tests
- [ ] Webhook handler tests
- [ ] Frontend component tests
- [ ] E2E donation flows
- [ ] Stripe CLI webhook testing

### Documentation ⏳

- [ ] API documentation
- [ ] User guide
- [ ] Admin guide
- [ ] Deployment notes
- [ ] Environment variables

---

**Phase 2 Completed**: 2025-11-10
**Next Phase**: Frontend Implementation (Phase 3)

---

## Notes

- All monetary amounts stored in cents (integer)
- All dates stored in UTC, displayed in user's timezone
- Stripe customer ID reused if exists
- Payment methods cached after first successful payment
- Webhook idempotency handled by Stripe event ID
