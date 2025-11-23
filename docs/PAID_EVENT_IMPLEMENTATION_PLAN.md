# Paid Event Feature Implementation Plan

## Overview

Add comprehensive paid event functionality with ticket purchasing, access control, and payment flow integration.

---

## 1. Database Schema Changes

### Event Model (`backend/src/models/Event.ts`)

Add new fields:

```typescript
pricing: {
  isFree: { type: Boolean, required: true, default: true },
  price: { type: Number, min: 1 } // Required if isFree = false, USD
}
```

### Purchase Model (`backend/src/models/Purchase.ts`)

Add new field to support event purchases:

```typescript
purchaseType: {
  type: String,
  enum: ['program', 'event'],
  required: true,
  default: 'program'
}
eventId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Event'
  // Required if purchaseType = 'event'
}
```

**Migration Note**: Existing purchases automatically get `purchaseType: 'program'` via default value.

---

## 2. Backend Validation & Services

### A. Event Validation (`backend/src/utils/validation/eventValidation.ts`)

Add pricing validation rules:

- If `pricing.isFree = false`, then `pricing.price` is required and must be >= 1
- If `pricing.isFree = true`, then `pricing.price` must be undefined/null

### B. Event Access Control Service (NEW)

**File**: `backend/src/services/event/EventAccessControlService.ts`

**Purpose**: Determine if a user has access to view a paid event's full details

**Logic** (in priority order):

1. **System Authorization**: Super Admin or Administrator → Free access
2. **Event Organizers**: Organizer or Co-organizer of this event → Free access
3. **Free Event**: If `pricing.isFree = true` → Everyone has access
4. **Program Purchase**: User purchased ANY program in `event.programLabels` → Free access
5. **Event Purchase**: User has completed purchase for this specific event → Access granted
6. **Default**: No access (must purchase)

**Returns**:

```typescript
{
  hasAccess: boolean,
  accessReason?: 'system_admin' | 'organizer' | 'free_event' | 'program_purchase' | 'event_purchase',
  requiresPurchase: boolean
}
```

### C. Event Purchase Service (NEW)

**File**: `backend/src/services/event/EventPurchaseService.ts`

**Purpose**: Handle event ticket purchases

**Methods**:

- `createEventPurchase(userId, eventId, price, promoCodeId?)` - Create Purchase record with `purchaseType: 'event'`
- `hasUserPurchasedEvent(userId, eventId)` - Check if user has completed purchase for event
- `getUserEventPurchases(userId)` - Get all event purchases for purchase history

### D. Update Promo Code Service

**File**: `backend/src/services/PromoCodeService.ts`

Add support for event purchases:

- Update `applicableToType` to include `'event'`
- Add `applicableToEvents: [ObjectId]` field (similar to `applicableToPrograms`)
- Update validation to check event eligibility

---

## 3. API Routes & Controllers

### A. New Event Purchase Routes

**File**: `backend/src/routes/eventRoutes.ts`

```
POST /api/events/:eventId/purchase
  - Create event ticket purchase
  - Accept: { promoCode?: string }
  - Return: Purchase record + redirect URL

GET /api/events/:eventId/access
  - Check if current user has access to event
  - Return: { hasAccess, requiresPurchase, accessReason }

GET /api/events/:eventId/purchase-info
  - Get pricing info with promo code discount applied
  - Accept: ?promoCode=CODE
  - Return: { originalPrice, discount, finalPrice, promoCodeValid }
```

### B. Update Event Controllers

**File**: `backend/src/controllers/event/CreationController.ts` & `UpdateController.ts`

Add validation for pricing fields:

- Step 2.5 (after basic validation): Validate pricing structure
- Ensure price >= 1 if paid event
- Ensure price is undefined if free event

### C. Update Purchase Controller

**File**: `backend/src/controllers/PurchaseController.ts`

Update `getPurchaseHistory()`:

- Include event purchases (`purchaseType: 'event'`)
- Populate `eventId` field for event purchases
- Return purchase type in response

Update `getIncomeHistory()`:

- Include event purchases in Purchase tab
- Show purchase type column

---

## 4. Frontend - Create Event Page

### File: `frontend/src/pages/CreateEvent.tsx`

**Changes**:

1. Add new "Event Pricing" section after Co-organizers, before Purpose
2. Add Yup validation for pricing
3. Add form fields:

   ```tsx
   <section>
     <h3>Event Pricing</h3>
     <RadioGroup name="pricing.isFree">
       <Radio value={true}>Free Event</Radio>
       <Radio value={false}>Paid Event</Radio>
     </RadioGroup>

     {!isFree && (
       <Input
         name="pricing.price"
         label="Ticket Price (USD)"
         type="number"
         min={1}
         required
         placeholder="Enter price (minimum $1)"
       />
     )}
   </section>
   ```

**Validation Schema**:

```typescript
pricing: Yup.object({
  isFree: Yup.boolean().required(),
  price: Yup.number().when("isFree", {
    is: false,
    then: (schema) => schema.required().min(1, "Minimum price is $1"),
    otherwise: (schema) => schema.notRequired().nullable(),
  }),
});
```

---

## 5. Frontend - Edit Event Page

### File: `frontend/src/components/EditEvent/EditEventForm.tsx`

**Changes**: Same as Create Event page

- Add "Event Pricing" section after Co-organizers
- Add pricing form fields with same validation
- Load existing pricing data into form

---

## 6. Frontend - Event Detail Page

### File: `frontend/src/pages/EventDetail.tsx`

**Major Changes**:

### A. Conditional Content Visibility

For paid events where user doesn't have access, **HIDE**:

1. Event format/location details section
2. Entire "Event Roles & Sign-up" section

Show message instead:

```tsx
{
  requiresPurchase && (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
      <p className="text-lg mb-4">
        Purchase a ticket to view event details and register for roles
      </p>
      <Button onClick={handlePurchase}>
        Get Ticket Now - ${event.pricing.price}
      </Button>
    </div>
  );
}
```

### B. Pricing Display Section

Add new section showing:

- Event type: "Free Event" or "Paid Event"
- If paid: "Ticket Price: $XX.XX"
- If user has access to paid event (authorized), show congratulations message:

  ```tsx
  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
    <h3>Congratulations!</h3>
    <p>As a {accessReason}, you have full access to this event.</p>
  </div>
  ```

  Where `accessReason` displays: "Super Admin", "Administrator", "Creator", "Co-organizer", or "Program Enrollee"

- If user purchased event ticket, show enrolled message:
  ```tsx
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3>Enrolled</h3>
    <p className="font-semibold">You're enrolled!</p>
    <p>
      Thank you for enrolling. You now have access to all roles in this event.
    </p>
  </div>
  ```

### C. Sign Up Dropdown Restrictions

For paid events (`pricing.isFree = false`):

- **REMOVE** "Assign User" button
- **REMOVE** "Invite Guest" button
- Only show role registration options for users who have purchased

**Logic**:

```typescript
const canAssignUsers = event.pricing.isFree || isOrganizerOrCoOrg;
const canInviteGuests = event.pricing.isFree || isOrganizerOrCoOrg;
```

### D. Access Check on Load

```typescript
useEffect(() => {
  const checkAccess = async () => {
    if (!event.pricing.isFree) {
      const { hasAccess, requiresPurchase, accessReason } = await api.get(
        `/events/${eventId}/access`
      );
      setAccessState({ hasAccess, requiresPurchase, accessReason });
    }
  };
  checkAccess();
}, [event]);
```

---

## 7. Frontend - Event Purchase Flow (NEW PAGES)

### A. Event Purchase Summary Page

**File**: `frontend/src/pages/EventPurchase.tsx`

**Similar to Program Enrollment page**, show:

- Event title, date, location
- Ticket price
- Promo code input field (optional)
- Discount calculation (if promo code valid)
- **Promo Code 100% Discount Cap**: If discount amount > ticket price, final price = $0 (100% discount)
- Final price (minimum $0)
- "Complete Purchase" button → Stripe checkout (or skip if 100% discount)

**Flow**:

1. User clicks "Get Ticket Now" on Event Detail page
2. Redirect to `/events/:eventId/purchase`
3. Show summary with promo code option
4. Click "Complete Purchase" → Create Stripe checkout session
5. Redirect to Stripe
6. After payment → Stripe webhook creates Purchase record
7. Redirect to success page

### B. Event Purchase Success Page

**File**: `frontend/src/pages/EventPurchaseSuccess.tsx`

**Show**:

- Success message: "Ticket purchased successfully!"
- Event details
- **Important message**: "You now have access to this event. Please select and register for roles."
- Button: "View Event & Register Roles" → Redirect to Event Detail page

---

## 8. Frontend - Public Event Page

### File: `frontend/src/pages/PublicEvent.tsx`

**Changes**:

1. **Show Pricing Section** for paid events:

   ```tsx
   {
     !event.pricing.isFree && (
       <div className="mb-6">
         <h3>Ticket Price</h3>
         <p className="text-2xl font-bold">${event.pricing.price}</p>
       </div>
     );
   }
   ```

2. **Add "Get Ticket Now" Button** for paid events:

   ```tsx
   {
     !event.pricing.isFree && (
       <Button onClick={handleGetTicket}>
         Get Ticket Now - ${event.pricing.price}
       </Button>
     );
   }
   ```

3. **Login Redirect Logic**:
   ```typescript
   const handleGetTicket = () => {
     if (!isAuthenticated) {
       // Redirect to login with automatic redirect to payment page after login
       navigate(`/login?redirect=/events/${eventId}/purchase`);
     } else {
       navigate(`/events/${eventId}/purchase`);
     }
   };
   ```

---

## 9. Frontend - Purchase History Page

### File: `frontend/src/pages/PurchaseHistory.tsx`

**Changes**:

1. **Add "Type" Column** to table:
2. **Change "Program" column header to "Program/Event"**:
   ```tsx
   <Table>
     <TableHeader>
       <TableColumn>Date</TableColumn>
       <TableColumn>Type</TableColumn> {/* NEW */}
       <TableColumn>Program/Event</TableColumn> {/* UPDATED */}
       <TableColumn>Amount</TableColumn>
       <TableColumn>Status</TableColumn>
     </TableHeader>
     <TableBody>
       {purchases.map((p) => (
         <TableRow key={p._id}>
           <TableCell>{formatDate(p.createdAt)}</TableCell>
           <TableCell>
             {p.purchaseType === "event"
               ? "Event Ticket"
               : "Program Enrollment"}
           </TableCell>
           <TableCell>
             {p.purchaseType === "event" ? p.event?.title : p.program?.title}
           </TableCell>
           <TableCell>${p.amount}</TableCell>
           <TableCell>{p.status}</TableCell>
         </TableRow>
       ))}
     </TableBody>
   </Table>
   ```

---

## 10. Frontend - Income History Page

### File: `frontend/src/pages/IncomeHistory.tsx`

**Changes**:

1. **Change tab name from "Program Purchases" to "Purchases"**
2. **Update Purchase Tab Table** - Add "Type" column:
3. **Change "Program" column header to "Program/Event"**:
   ```tsx
   <Table>
     <TableHeader>
       <TableColumn>Date</TableColumn>
       <TableColumn>Type</TableColumn> {/* NEW */}
       <TableColumn>User</TableColumn>
       <TableColumn>Program/Event</TableColumn> {/* UPDATED */}
       <TableColumn>Amount</TableColumn>
     </TableHeader>
     <TableBody>
       {purchases.map((p) => (
         <TableRow key={p._id}>
           <TableCell>{formatDate(p.createdAt)}</TableCell>
           <TableCell>
             {p.purchaseType === "event"
               ? "Event Ticket"
               : "Program Enrollment"}
           </TableCell>
           <TableCell>{p.user?.name}</TableCell>
           <TableCell>
             {p.purchaseType === "event" ? p.event?.title : p.program?.title}
           </TableCell>
           <TableCell>${p.amount}</TableCell>
         </TableRow>
       ))}
     </TableBody>
   </Table>
   ```

---

## 11. Types & Interfaces

### Frontend Types (`frontend/src/types/`)

**Update Event Interface**:

```typescript
interface Event {
  // ... existing fields
  pricing: {
    isFree: boolean;
    price?: number; // USD, required if isFree = false
  };
}
```

**Update Purchase Interface**:

```typescript
interface Purchase {
  // ... existing fields
  purchaseType: "program" | "event";
  eventId?: string; // Populated if purchaseType = 'event'
  event?: {
    _id: string;
    title: string;
    startDate: string;
  };
}
```

---

## 12. Promo Code Integration

### Admin Promo Code Management

**File**: `frontend/src/pages/admin/PromoCodeManagement.tsx`

**Changes**:

1. Add "Applicable To" field with options:
   - Programs (existing)
   - Events (new)
2. Add conditional selectors:

   - If "Programs" selected: Show program multi-select
   - If "Events" selected: Show event multi-select (fetch from `/api/events`)

3. Update form validation to require either programs or events selection

### Backend Promo Code Model

**File**: `backend/src/models/PromoCode.ts`

Add fields:

```typescript
applicableToType: {
  type: String,
  enum: ['program', 'event'],
  required: true
}
applicableToEvents: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Event'
}]
```

---

## 13. Testing Strategy

### Unit Tests (Backend)

1. **EventAccessControlService.test.ts**

   - Test system admin access
   - Test organizer/co-organizer access
   - Test free event access
   - Test program purchase access
   - Test event purchase access
   - Test no access (should purchase)

2. **EventPurchaseService.test.ts**

   - Test create event purchase
   - Test check user purchased event
   - Test get user event purchases

3. **Event validation tests**
   - Test pricing validation (free event)
   - Test pricing validation (paid event with price)
   - Test pricing validation (paid event without price - should fail)
   - Test price minimum validation

### Integration Tests (Backend)

1. **events-purchase.integration.test.ts**

   - POST /api/events/:id/purchase - successful purchase
   - POST /api/events/:id/purchase - with promo code
   - GET /api/events/:id/access - various access scenarios
   - GET /api/events/:id/purchase-info - price calculation with promo

2. **events-pricing.integration.test.ts**
   - POST /api/events - create free event
   - POST /api/events - create paid event
   - PUT /api/events/:id - update pricing
   - Validation tests for pricing rules

### Frontend Tests

1. **CreateEvent.test.tsx**

   - Test pricing section renders
   - Test free/paid radio toggle
   - Test price input shows/hides correctly
   - Test price validation (minimum $1)

2. **EventDetail.test.tsx**

   - Test content visibility for paid events without access
   - Test pricing display section
   - Test "Assign User"/"Invite Guest" buttons hidden for paid events

3. **EventPurchase.test.tsx**
   - Test promo code application
   - Test price calculation display
   - Test purchase button functionality

---

## 14. Implementation Order

### Phase 1: Database & Models

1. Update Event model with pricing fields
2. Update Purchase model with purchaseType and eventId
3. Update PromoCode model for event applicability

### Phase 2: Backend Services

4. Create EventAccessControlService
5. Create EventPurchaseService
6. Update PromoCodeService for events
7. Update event validation

### Phase 3: Backend API

8. Add event purchase routes
9. Update CreationController & UpdateController with pricing validation
10. Update PurchaseController for event purchases

### Phase 4: Frontend Forms

11. Update CreateEvent page with pricing section
12. Update EditEvent page with pricing section
13. Update types/interfaces

### Phase 5: Frontend Event Detail & Purchase

14. Update EventDetail page with access control
15. Create EventPurchase page
16. Create EventPurchaseSuccess page
17. Update PublicEvent page

### Phase 6: Frontend History & Admin

18. Update PurchaseHistory page with Type column
19. Update IncomeHistory page with Type column
20. Update PromoCodeManagement for events

### Phase 7: Testing

21. Write unit tests
22. Write integration tests
23. Manual testing & QA

---

## 15. Edge Cases & Considerations

1. **Event becomes paid after free registrations exist**: Existing registrations remain valid
2. **User refunds event purchase**: Implement refund logic, revoke access
3. **Program purchase after event purchase**: User already has access, no impact
4. **Co-organizer purchases ticket**: Unnecessary (they have free access), but allow if they want
5. **Price changes after purchase**: Existing purchases locked at original price
6. **Event deletion with purchases**: Soft delete event, maintain purchase records

---

## 16. Success Criteria

- ✅ Users can create/edit events with free or paid pricing
- ✅ Paid event content hidden from non-purchasers
- ✅ Purchase flow works with promo codes
- ✅ Program purchasers get free event access
- ✅ System admins and organizers have free access
- ✅ Purchase history shows event tickets separately
- ✅ Income history includes event purchases
- ✅ "Assign User"/"Invite Guest" hidden for paid events
- ✅ All tests passing with high coverage
- ✅ No regressions in existing functionality

---

**Estimated Implementation Time**: 2-3 days
**Files to Create**: ~8 new files
**Files to Modify**: ~25 existing files
**Tests to Add**: ~30 unit tests, ~15 integration tests
