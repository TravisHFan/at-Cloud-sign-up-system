# Promo Code System - UI/UX Specifications

**Version**: 1.0  
**Date**: 2025-10-17  
**Status**: Design Approved ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Navigation Structure](#navigation-structure)
3. [Component Specifications](#component-specifications)
4. [Page Specifications](#page-specifications)
5. [User Flows](#user-flows)
6. [Data Models](#data-models)
7. [Color & Typography](#color--typography)
8. [Responsive Design](#responsive-design)

---

## 🎯 Overview

### Feature Goals

- **Bundle Discount**: Auto-generate fixed dollar amount off promo code after program purchase (e.g., $50 off, 30-day expiry)
- **Staff Access**: Admin-created 100% off codes for volunteers/staff
- **User-Friendly**: Easy code discovery, application, and management
- **Transparent**: Clear pricing breakdown with discounts

### MVP Scope

- ✅ User can view their promo codes
- ✅ User can apply promo codes at checkout
- ✅ User receives bundle code after purchase
- ✅ Admin can create staff access codes
- ✅ Admin can view all promo codes
- ✅ Admin can configure bundle discount amount

### Out of Scope (Future)

- ❌ Public/shareable codes
- ❌ Multiple-use codes
- ❌ Referral system
- ❌ Dynamic discount amounts per code

---

## 🗺️ Navigation Structure

### User Navigation

```
Dashboard Header → Avatar Dropdown
├── Profile
├── My Promo Codes  ← NEW (Route: /dashboard/promo-codes)
├── Purchase History
├── Change Password
└── Log Out
```

**Location**: `frontend/src/layouts/dashboard/UserDropdown.tsx`

**Icon**: None (consistent with other dropdown items)

**Access**: All authenticated users

---

### Admin Navigation

**Sidebar Location**:

```
Admin Sidebar
├── Welcome
├── Programs
├── Upcoming Events
├── Past Events
├── My Events
├── Published Events
├── Create Event
├── Role Templates
├── Promo Codes  ← NEW
├── Management
├── System Messages
├── Analytics
├── System Monitor
├── Audit Logs
├── Feedback
└── Log Out
```

**Icon**: 🎫 Ticket icon

**Access**: Super Admin & Administrator only

**Tab Structure** (appears on right side when "Promo Codes" is selected):

```
┌─────────────────────────────────────────────────────────┐
│  Promo Codes                                            │
│                                                          │
│  [View All Codes]  [Create Staff Code]  [Bundle Config] │ ← Horizontal tabs
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  (Content area changes based on selected tab)           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Tab Routes**:

1. **View All Codes** (default): `/dashboard/admin/promo-codes`
2. **Create Staff Code**: `/dashboard/admin/promo-codes/create-staff`
3. **Bundle Config**: `/dashboard/admin/promo-codes/bundle-config`

---

## 🧩 Component Specifications

### 1. PromoCodeCard

**File**: `frontend/src/components/promo/PromoCodeCard.tsx`

**Purpose**: Display individual promo code with details

**Props**:

```typescript
interface PromoCodeCardProps {
  code: string; // e.g., "X8K9P2L4"
  type: "bundle_discount" | "staff_access";
  discountAmount?: number; // For bundle: dollar amount (e.g., 50 for $50 off)
  discountPercent?: number; // For staff: 100 (100% off)
  expiresAt?: string; // ISO date string
  isUsed: boolean;
  onCopy?: () => void;
  onUse?: () => void;
}
```

**Layout**:

```
┌─────────────────────────────────────────┐
│ X8K9P2L4                    [Active]    │
│                                          │
│ $50 OFF                                  │
│ 🎁 Bundle Discount                       │
│                                          │
│ ⏰ Expires: Nov 16, 2025 (28 days)      │
│ 📌 Valid for any program                 │
│                                          │
│ [Copy Code]  [Use Now →]                │
└─────────────────────────────────────────┘
```

**States**:

- **Active**: Green border, full color
- **Used**: Gray background, opacity 60%, "USED" badge
- **Expired**: Red border, crossed-out code, "EXPIRED" badge

**Styling**:

```css
/* Bundle Discount */
background: linear-gradient(135deg, #ebf4ff 0%, #f3e8ff 100%);
border: 2px solid #3b82f6;

/* Staff Access */
background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
border: 2px solid #10b981;

/* Code Display */
font-family: "Courier New", monospace;
font-size: 24px;
font-weight: bold;
letter-spacing: 2px;
```

---

### 2. BundlePromoCodeCard

**File**: `frontend/src/components/promo/BundlePromoCodeCard.tsx`

**Purpose**: Celebration card shown on purchase success page

**Props**:

```typescript
interface BundlePromoCodeCardProps {
  code: string;
  discountAmount: number; // Dollar amount (e.g., 50 for $50 off)
  expiresAt: string;
  onCopy?: () => void;
}
```

**Layout**:

```
┌─────────────────────────────────────────────────┐
│         🎉 BONUS: Bundle Discount! 🎉           │
│                                                  │
│     Get $50 off your next program purchase      │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │                                         │    │
│  │         X 8 K 9 P 2 L 4                │    │
│  │                                         │    │
│  └────────────────────────────────────────┘    │
│                                                  │
│  ⏰ Valid until: Nov 16, 2025 (30 days)        │
│  📌 Can be used on any other program            │
│                                                  │
│            [Copy Code & Browse Programs]        │
└─────────────────────────────────────────────────┘
```

**Animation**: Confetti particles falling (optional for MVP)

**Styling**:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: white;
padding: 32px;
border-radius: 16px;
box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
```

---

### 3. PromoCodeInput

**File**: `frontend/src/components/promo/PromoCodeInput.tsx`

**Purpose**: Allow user to select or enter promo code at checkout

**Props**:

```typescript
interface PromoCodeInputProps {
  programId: string;
  availableCodes: PromoCode[];
  onApply: (code: string, discount: number) => void;
  onRemove: () => void;
  appliedCode?: string;
  appliedDiscount?: number;
}
```

**Layout**:

```
┌─────────────────────────────────────────────────┐
│ 💎 Have a promo code?                           │
│                                                  │
│ Your Available Codes (2 available)              │
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │ ○ X8K9P2L4  ($50 off)                   │    │
│ │   Bundle Discount • Expires in 28 days  │    │
│ └─────────────────────────────────────────┘    │
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │ ○ A3B7C9D2  (100% off)                  │    │
│ │   Staff Access • No expiration          │    │
│ └─────────────────────────────────────────┘    │
│                                                  │
│ ────────── OR ──────────                        │
│                                                  │
│ Enter code manually:                            │
│ ┌──────────────────────┐                        │
│ │ X8K9P2L4             │  [Apply]               │
│ └──────────────────────┘                        │
│                                                  │
│ ✓ $50 discount applied                          │
│ [Remove Code]                                   │
└─────────────────────────────────────────────────┘
```

**Behavior**:

- Radio buttons to select from available codes
- Manual input field always visible
- "Apply" button validates and applies code
- Success banner appears after applying
- "Remove" button clears applied code

---

### 4. PriceSummary

**File**: `frontend/src/components/promo/PriceSummary.tsx`

**Purpose**: Show price breakdown with discount

**Props**:

```typescript
interface PriceSummaryProps {
  originalPrice: number;
  appliedCode?: string;
  discountAmount?: number; // Dollar amount for bundle, or calculated amount for staff
  finalPrice: number;
}
```

**Layout**:

```
┌──────────────────────────────┐
│ Price Summary                │
│                               │
│ Original Price:      $500    │  ← Strikethrough if discount
│ Discount ($50):      -$50    │  ← Green text
│   Code: X8K9P2L4              │
│ ──────────────────────        │
│ Total:               $450    │  ← Large, bold
│                               │
│ or                            │
│                               │
│ Total:               FREE 🎉  │  ← For 100% discount
└──────────────────────────────┘
```

**Styling**:

```css
/* Original price with discount */
text-decoration: line-through;
color: #6b7280; /* gray-500 */

/* Discount amount */
color: #10b981; /* green-600 */
font-weight: 600;

/* Final price */
font-size: 32px;
font-weight: bold;
color: #10b981; /* green if discounted */
```

---

## 📄 Page Specifications

### 1. My Promo Codes Page

**File**: `frontend/src/pages/MyPromoCodes.tsx`

**Route**: `/dashboard/promo-codes`

**Purpose**: User views all their promo codes

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard > My Promo Codes                               │
│                                                          │
│ My Promo Codes (3)                                      │
│                                                          │
│ [All (3)]  [Active (2)]  [Used (1)]  [Expired (0)]     │ ← Filter tabs
│                                                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ X8K9P2L4                           [Active]     │    │
│ │ $50 OFF • Bundle Discount                       │    │
│ │ Expires: Nov 16, 2025 (28 days)                │    │
│ │ Valid for any program                           │    │
│ │ [Copy Code]  [Use Now →]                        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ A3B7C9D2                           [Active]     │    │
│ │ 100% OFF • Staff Access                         │    │
│ │ Valid for all paid programs                     │    │
│ │ [Copy Code]  [Use Now →]                        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ K2M5N8P1                           [Used]       │    │
│ │ $50 OFF • Bundle Discount                       │    │
│ │ Used on: ECW Spring 2025 (Oct 10, 2025)        │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Empty State**:

```
┌─────────────────────────────────────────────────────────┐
│                     🎫                                   │
│                                                          │
│         No promo codes yet                              │
│                                                          │
│    Purchase a program to receive a bundle discount     │
│    code for your next purchase!                         │
│                                                          │
│         [Browse Programs →]                             │
└─────────────────────────────────────────────────────────┘
```

**Features**:

- Filter by status (all/active/used/expired)
- Sort by: expiration date, discount amount
- Search by code
- Quick copy functionality
- "Use Now" redirects to programs list

---

### 2. Purchase Success Page (Enhanced with Bundle Code)

**File**: `frontend/src/pages/PurchaseSuccess.tsx` (**UPDATE EXISTING**)

**Route**: `/dashboard/purchase/success` (existing route)

**Purpose**: Show purchase confirmation + **NEW bundle promo code**

**Layout** (Enhanced from existing):

```
┌─────────────────────────────────────────────────────────┐
│                   🎉  (existing)                         │
│                                                          │
│         Payment Successful!  (existing)                 │
│                                                          │
│  You now have access to EMBA Mentor Circles 2025       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │ ← EXISTING
│  │ Order Number: #ORD-2025-001                    │    │   purchase
│  │ Program: EMBA Mentor Circles 2025              │    │   details
│  │ Amount Paid: $300                              │    │
│  │ Purchase Date: Oct 17, 2025                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │ ← NEW
│  │  🎁 BONUS: Bundle Discount!                     │    │   bundle
│  │                                                 │    │   code
│  │  Get $50 off your next program purchase        │    │   card
│  │                                                 │    │
│  │  Your Code:  X8K9P2L4         [Copy]          │    │
│  │                                                 │    │
│  │  ⏰ Valid until: Nov 16, 2025 (30 days)       │    │
│  │  📌 Can be used on any other program           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [View Program]  [Browse More Programs]  (existing)     │
└─────────────────────────────────────────────────────────┘
```

**Logic** (Enhanced from existing):

- Existing logic fetches purchase by `session_id` query param
- **NEW**: Check if purchase has `bundlePromoCode` field
- **NEW**: If `bundlePromoCode` exists, show `BundlePromoCodeCard` component
- Only show bundle code if purchase was paid (not free)
- Handle case where bundle feature is disabled globally

---

### 3. Enroll Program Page (Enhanced with Promo Codes)

**File**: `frontend/src/pages/EnrollProgram.tsx` (**UPDATE EXISTING**)

**Route**: `/dashboard/programs/:id/enroll` (existing route)

**Purpose**: User enrolls in program with existing class rep/early bird discounts **+ NEW promo code support**

**Layout** (Enhanced from existing):

```
┌─────────────────────────────────────────────────────────┐
│ Enroll in EMBA Mentor Circles 2025                      │
│                                                          │
│ ┌────────────────────────────────────────────────┐     │
│ │ Program Details                                │     │
│ │ (existing program info)                        │     │
│ └────────────────────────────────────────────────┘     │
│                                                          │
│ ┌────────────────────────────────────────────────┐     │
│ │ Pricing Options (EXISTING)                     │     │
│ │ ☐ Class Representative (-$100)                 │     │
│ │ Early Bird: Active (auto -$50)                 │     │
│ └────────────────────────────────────────────────┘     │
│                                                          │
│ ┌────────────────────────────────────────────────┐     │ ← NEW
│ │ 💎 Have a promo code?                          │     │
│ │ [PromoCodeInput Component]                     │     │
│ └────────────────────────────────────────────────┘     │
│                                                          │
│ ┌────────────────────────────────────────────────┐     │ ← ENHANCED
│ │ Price Summary                                  │     │
│ │ Full Price:          $500                      │     │
│ │ Class Rep Discount: -$100                      │     │
│ │ Early Bird Discount: -$50                      │     │
│ │ Promo Code (X8K9P2L4): -$50  ← NEW             │     │
│ │ ────────────────────                           │     │
│ │ Total:               $300                      │     │
│ └────────────────────────────────────────────────┘     │
│                                                          │
│ [Proceed to Payment - $300]  (existing button)          │
└─────────────────────────────────────────────────────────┘
```

**Integration Notes**:

- Add `PromoCodeInput` component AFTER existing pricing options
- Enhance price calculation to include promo code discount
- Update `calculatePrice()` function to deduct promo dollar amount
- Pass promo code to `purchaseService.createCheckoutSession()`
- Maintain existing class rep + early bird logic

**Flow** (Enhanced from existing):

1. Load program details (existing)
2. Load class rep availability (existing)
3. **NEW**: Fetch user's available promo codes
4. User selects class rep option (existing)
5. System auto-applies early bird if applicable (existing)
6. **NEW**: User selects/enters promo code → Validate → Update price
7. User clicks "Proceed to Payment" (existing button)
8. **ENHANCED**: Pass promo code to `createCheckoutSession` API
9. Redirect to Stripe Checkout (existing)
10. After payment → Redirect to success page (existing)

**API Changes Required**:

Backend `POST /api/purchases/create-checkout-session` needs to accept:

```typescript
{
  programId: string;
  isClassRep: boolean;
  promoCode?: string;  // ← NEW field
}
```

**Validation Rules** (run before creating checkout session):

- Code must exist and be active
- Code must not be used
- Code must not be expired
- Code must belong to user
- If code is 100% off → Skip Stripe, directly create completed purchase
- For bundle codes: Backend automatically excludes the program it was generated from

---

### 4. Admin: Create Staff Access Code

**File**: `frontend/src/pages/admin/CreateStaffAccessCode.tsx`

**Route**: `/dashboard/admin/promo-codes/create-staff`

**Access**: Super Admin & Administrator

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Create Staff Access Code                                 │
│                                                          │
│ 1. Select User *                                        │
│ ┌────────────────────────────────────────────────┐     │
│ │ 🔍 Search users...                              │     │
│ └────────────────────────────────────────────────┘     │
│ ▼ Results:                                              │
│ ✓ Jane Smith (volunteer@example.com)                   │
│   Sarah Lee (staff@example.com)                        │
│                                                          │
│ 2. Programs (Optional)                                  │
│ ☑ All paid programs (recommended)                       │
│ ☐ Specific programs only:                              │
│    ☐ EMBA Mentor Circles 2025                          │
│    ☐ ECW Spring 2025                                   │
│                                                          │
│ 3. Expiration (Optional)                                │
│ ○ Never expires                                         │
│ ○ Custom date: [Date Picker]                          │
│                                                          │
│ ☑ Send email notification to user                      │
│                                                          │
│ [Cancel]  [Generate Code]                              │
└─────────────────────────────────────────────────────────┘
```

**Success Modal**:

```
┌──────────────────────────────────┐
│ ✅ Staff Access Code Created!   │
│                                  │
│ For: Jane Smith                  │
│      volunteer@example.com       │
│                                  │
│ Code:  A3B7C9D2    [Copy]       │
│                                  │
│ 📧 Email sent to user            │
│                                  │
│ [Create Another]  [View All]    │
└──────────────────────────────────┘
```

---

### 5. Admin: Promo Codes List

**File**: `frontend/src/pages/admin/PromoCodeList.tsx`

**Route**: `/dashboard/admin/promo-codes`

**Access**: Super Admin & Administrator

**Layout**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Promo Codes                             [+ Create Staff Access Code]     │
│                                                                           │
│ [All]  [Bundle]  [Staff]    [Active]  [Used]  [Expired]  🔍 [Search]   │
│                                                                           │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ Code      Type    Owner         Discount  Status   Expires  Action│  │
│ ├────────────────────────────────────────────────────────────────────┤  │
│ │ X8K9P2L4  Bundle  John Doe       $50       Used     -        Copy  │  │
│ │ A3B7C9D2  Staff   Jane Smith    100%      Active   Never    Copy  │  │
│ │ K2M5N8P1  Bundle  Bob Wilson     $50       Expired  Oct 15   Copy  │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ Showing 1-20 of 156       [<]  1 2 3 4 ... 8  [>]                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Features**:

- Filter by type, status
- Search by code or owner name
- Pagination (20 per page)
- Quick copy code
- Export to CSV (future)

---

### 6. Admin: Bundle Discount Config

**File**: `frontend/src/pages/admin/BundleDiscountConfig.tsx`

**Route**: `/dashboard/admin/promo-codes/bundle-config`

**Access**: Super Admin & Administrator

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Bundle Discount Configuration                            │
│                                                          │
│ ☑ Enable Bundle Discount                                │
│ Automatically generate promo codes after purchases      │
│                                                          │
│ Discount Amount (USD)                                   │
│ ┌──────────────────────────────────────────────┐       │
│ │ $ 50.00                                       │       │
│ └──────────────────────────────────────────────┘       │
│ [────●──────────────────────────────────────────] $200  │  ← Slider
│ $0                                                       │
│                                                          │
│ Recommended: $30-$75                                    │
│                                                          │
│ Preview:                                                │
│ ┌──────────────────────────────────────────────┐       │
│ │ User purchases program for $500               │       │
│ │ Receives code for: $50 off next purchase     │       │
│ └──────────────────────────────────────────────┘       │
│                                                          │
│ [Cancel]  [Save Configuration]                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Color & Typography

### Color Palette

**Bundle Discount Theme**:

```css
Primary:     #3B82F6  /* blue-600 */
Light:       #EBF4FF  /* blue-50 */
Gradient:    linear-gradient(135deg, #EBF4FF 0%, #F3E8FF 100%)
```

**Staff Access Theme**:

```css
Primary:     #10B981  /* green-600 */
Light:       #F0FDF4  /* green-50 */
Gradient:    linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)
```

**Status Colors**:

```css
Active:      #10B981  /* green-600 */
Used:        #6B7280  /* gray-500 */
Expired:     #EF4444  /* red-600 */
Warning:     #F59E0B  /* amber-500 */
```

### Typography

**Code Display**:

```css
font-family: "Courier New", "Monaco", monospace;
font-size: 24px;
font-weight: 700;
letter-spacing: 2px;
text-transform: uppercase;
```

**Discount Amount**:

```css
font-size: 48px;
font-weight: 800;
line-height: 1;
```

**Body Text**:

```css
font-family: "Inter", "system-ui", sans-serif;
font-size: 14px;
line-height: 1.5;
```

---

## 📱 Responsive Design

### Breakpoints

```css
Mobile:   < 640px
Tablet:   640px - 1024px
Desktop:  > 1024px
```

### Mobile Adaptations

**PromoCodeCard**:

- Stack buttons vertically
- Reduce code font size: 24px → 20px
- Single column layout

**PromoCodeInput**:

- Available codes: 2 columns → 1 column
- Input field: Full width

**PriceSummary**:

- Font sizes: 32px → 24px for total

**My Promo Codes Page**:

- Grid: 2 columns → 1 column
- Tabs: Horizontal scroll on mobile

---

## 🔄 User Flows

### Flow 1: Receiving Bundle Discount

```
Purchase Program ($500)
        ↓
Stripe Payment Success
        ↓
Backend generates code: X8K9P2L4 ($50 off, expires +30 days)
        ↓
Success Page displays BundlePromoCodeCard
        ↓
User copies code / clicks "Browse Programs"
        ↓
Code appears in "My Promo Codes" page
```

### Flow 2: Using Bundle Discount

```
User visits "My Promo Codes"
        ↓
Sees active code: X8K9P2L4 ($50 off)
        ↓
Clicks "Use Now" → Redirects to Programs list
        ↓
Selects "ECW Spring 2025" → "Purchase"
        ↓
ProgramPurchase page loads
        ↓
PromoCodeInput shows X8K9P2L4 as available
        ↓
User clicks on code card → Auto-applies
        ↓
Price updates: $300 → $250 ($50 off)
        ↓
User completes payment with Stripe
        ↓
Code marked as "used" in My Promo Codes
```

### Flow 3: Using Staff Access Code

```
Admin creates staff code for volunteer Jane
        ↓
System generates: A3B7C9D2 (100% off)
        ↓
Email sent to Jane with code
        ↓
Jane receives email, copies code
        ↓
Jane browses programs, selects "EMBA Mentor Circles"
        ↓
On ProgramPurchase page, enters: A3B7C9D2
        ↓
Clicks "Apply" → Validates → Price: $500 → $0 (FREE)
        ↓
Payment section changes to: [Claim Free Access]
        ↓
Jane clicks → Backend creates purchase record (no Stripe)
        ↓
Code marked as "used"
        ↓
Jane gets immediate access to program
```

---

## 📊 Data Models (Frontend Types)

### PromoCode Type

```typescript
interface PromoCode {
  _id: string;
  code: string; // "X8K9P2L4"
  type: "bundle_discount" | "staff_access";
  discountAmount?: number; // For bundle: dollar amount (e.g., 50 for $50 off)
  discountPercent?: number; // For staff: 100 (100% off)

  // Ownership & Restrictions
  ownerId: string; // User ID
  allowedProgramIds?: string[]; // For staff codes: specific programs, empty = all programs

  // Status
  isActive: boolean;
  isUsed: boolean;
  expiresAt?: string; // ISO date string

  // Usage
  usedAt?: string; // ISO date string
  usedForProgramId?: string;
  usedForProgramTitle?: string;

  // Metadata
  createdAt: string; // ISO date string
  createdBy: string; // User ID
}
```

### Purchase Type (Enhanced from Existing)

**Current Structure** (from `frontend/src/pages/PurchaseSuccess.tsx`):

```typescript
interface Purchase {
  id: string;
  orderNumber: string;
  programId: {
    _id: string;
    title: string;
    programType?: string;
  };
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  purchaseDate: string;
  status: string;
}
```

**NEW FIELDS TO ADD**:

```typescript
interface Purchase {
  // ... existing fields above ...

  // Promo Code Fields (NEW)
  promoCode?: string; // Code used (e.g., "X8K9P2L4")
  promoDiscountAmount?: number; // Dollar amount discount from promo
  promoDiscountPercent?: number; // Percentage discount from promo (for 100% codes)

  // Bundle Code Generation (NEW)
  bundlePromoCode?: string; // Auto-generated code after purchase
  bundleDiscountAmount?: number; // Dollar amount for bundle code
  bundleExpiresAt?: string; // ISO date string
}
```

---

## 🔧 Backend Integration Points

### Existing Purchase Flow to Enhance

**Current Flow** (from `backend/src/controllers/purchaseController.ts`):

1. User clicks "Proceed to Payment" on EnrollProgram page
2. Frontend calls `POST /api/purchases/create-checkout-session`
3. Backend validates program, checks existing purchase
4. Calculates price: `fullPrice - classRepDiscount - earlyBirdDiscount`
5. Creates Stripe Checkout Session
6. Creates pending Purchase record with `stripeSessionId`
7. Returns `sessionUrl` to frontend
8. User completes payment in Stripe
9. Stripe webhook calls `/api/webhooks/stripe`
10. Backend marks purchase as "completed"
11. User redirected to `/dashboard/purchase/success`

**NEW: Promo Code Enhancements**:

#### 1. Update `createCheckoutSession` API

**Request Body Changes**:

```typescript
{
  programId: string;
  isClassRep: boolean;
  promoCode?: string;  // ← NEW optional field
}
```

**Additional Validation**:

- If `promoCode` provided:
  - Validate code exists in PromoCode collection
  - Check `isActive: true`, `isUsed: false`
  - Check not expired (`expiresAt > now`)
  - Check `ownerId` matches current user
  - For bundle codes: backend prevents using on same program (check `excludedProgramId`)
  - For staff codes: check `allowedProgramIds` if specified

**Price Calculation** (Enhanced):

```typescript
let finalPrice = fullPrice - classRepDiscount - earlyBirdDiscount;

if (promoCode) {
  if (promoCode.type === "bundle_discount") {
    finalPrice -= promoCode.discountAmount; // Dollar amount
  } else if (promoCode.type === "staff_access") {
    finalPrice = 0; // 100% off
  }
}

finalPrice = Math.max(0, finalPrice);
```

**Special Case - 100% Off**:

- If `finalPrice === 0` after promo, skip Stripe entirely
- Create purchase with `status: "completed"` immediately
- Set `paymentMethod: "promo_code"`
- Mark promo code as used
- Return success response (no Stripe redirect)

**Purchase Record** (Enhanced):

```typescript
{
  // Existing fields...
  fullPrice,
  classRepDiscount,
  earlyBirdDiscount,
  finalPrice,

  // NEW promo fields
  promoCode: promoCode?.code,
  promoDiscountAmount: promoCode?.discountAmount,
  promoDiscountPercent: promoCode?.discountPercent, // Only for 100% staff codes

  // Bundle code generation (happens after payment in webhook)
  bundlePromoCode: null, // Set later in webhook
  bundleDiscountAmount: null,
  bundleExpiresAt: null,
}
```

#### 2. Update Stripe Webhook Handler

**After marking purchase as "completed"**:

- Check if bundle discount feature is enabled globally
- If enabled and `finalPrice > 0` (paid purchase):
  - Generate random 8-character code (uppercase)
  - Get bundle config (discount amount, e.g., $50)
  - Calculate expiry date (30 days from now)
  - Create new PromoCode document:
    ```typescript
    {
      code: generateCode(),
      type: 'bundle_discount',
      discountAmount: bundleConfig.amount, // e.g., 50 ($50 off)
      ownerId: purchase.userId,
      excludedProgramId: purchase.programId, // Can't use on same program
      isActive: true,
      isUsed: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      createdBy: 'system',
    }
    ```
  - Update purchase with bundle code info:
    ```typescript
    purchase.bundlePromoCode = promoCode.code;
    purchase.bundleDiscountAmount = promoCode.discountAmount;
    purchase.bundleExpiresAt = promoCode.expiresAt;
    await purchase.save();
    ```

#### 3. New API Endpoints

**User Endpoints**:

- `GET /api/promo-codes/my-codes` - Fetch user's promo codes
- `POST /api/promo-codes/validate` - Validate code for specific program
  ```typescript
  Request: { code: string, programId: string }
  Response: { valid: boolean, discount: number, message?: string }
  ```

**Admin Endpoints**:

- `GET /api/promo-codes` - List all codes (with filters)
- `POST /api/promo-codes/staff` - Create staff access code
- `GET /api/promo-codes/config` - Get bundle discount config
- `PUT /api/promo-codes/config` - Update bundle discount config

---

## ✅ Design Checklist

- [x] Navigation structure defined
- [x] Component specifications documented
- [x] Page layouts designed
- [x] User flows mapped
- [x] Data models defined
- [x] Color palette selected
- [x] Typography specified
- [x] Responsive breakpoints defined
- [x] Empty states designed
- [x] Success/error states defined

---

## 🚀 Next Steps

1. ✅ **This document approved** → Proceed to implementation
2. ⏭️ **Todo #2**: Create mock data fixtures
3. ⏭️ **Todo #3**: Build PromoCodeCard component
4. ⏭️ **Todo #4**: Build My Promo Codes page

---

**Document Status**: ✅ **APPROVED - Ready for Implementation**
