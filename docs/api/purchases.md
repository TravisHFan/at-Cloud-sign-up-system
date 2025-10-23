# Purchase API Documentation

This document describes all endpoints related to program purchases and enrollments in the @Cloud Ministry Sign-up System.

## Base URL

All endpoints are relative to the API base URL: `/api/purchases`

## Authentication

All purchase endpoints (except webhooks) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Create Checkout Session

Create a Stripe checkout session for program enrollment.

**Endpoint:** `POST /api/purchases/checkout-session/:programId`

**Authentication:** Required (any authenticated user)

**URL Parameters:**

- `programId` (string, required): MongoDB ObjectId of the program to enroll in

**Request Body:**

```typescript
{
  isClassRep: boolean; // Whether enrolling as a class representative
}
```

**Success Response (200 OK):**

```typescript
{
  url: string; // Stripe checkout session URL to redirect user to
}
```

**Error Responses:**

- `400 Bad Request`: Program is free (no payment required)
  ```json
  { "message": "This program is free. No payment required." }
  ```
- `400 Bad Request`: Already enrolled
  ```json
  { "message": "You are already enrolled in this program" }
  ```
- `404 Not Found`: Program doesn't exist
  ```json
  { "message": "Program not found" }
  ```
- `500 Internal Server Error`: Checkout session creation failed
  ```json
  { "message": "Failed to create checkout session" }
  ```

**Example Request:**

```bash
curl -X POST https://api.atcloud.com/api/purchases/checkout-session/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"isClassRep": true}'
```

**Example Response:**

```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_a1..."
}
```

---

### 2. Get User's Purchases

Retrieve all purchases for the authenticated user.

**Endpoint:** `GET /api/purchases/me`

**Authentication:** Required (any authenticated user)

**Success Response (200 OK):**

```typescript
{
  purchases: Purchase[]
}

interface Purchase {
  _id: string;
  orderNumber: string;
  userId: string;
  programId: string;
  programTitle: string;
  programType: string;
  fullPrice: number;           // In cents
  finalPrice: number;          // In cents
  isClassRep: boolean;
  classRepDiscount?: number;   // In cents
  isEarlyBird: boolean;
  earlyBirdDiscount?: number;  // In cents
  status: "pending" | "completed" | "failed" | "refunded";
  purchaseDate: string;        // ISO 8601 date
  paymentMethod?: {
    type: "card" | "other";
    cardBrand?: string;
    last4?: string;
    cardholderName?: string;
  };
  billingInfo: {
    fullName: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  createdAt: string;           // ISO 8601 date
  updatedAt: string;           // ISO 8601 date
}
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid token
  ```json
  { "message": "Unauthorized" }
  ```
- `500 Internal Server Error`: Database error
  ```json
  { "message": "Failed to fetch purchases" }
  ```

**Example Request:**

```bash
curl https://api.atcloud.com/api/purchases/me \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 3. Get Purchase by ID

Retrieve a specific purchase by its ID.

**Endpoint:** `GET /api/purchases/:id`

**Authentication:** Required (purchase owner, Program Mentor, Admin, or Super Admin)

**URL Parameters:**

- `id` (string, required): MongoDB ObjectId of the purchase

**Success Response (200 OK):**

```typescript
Purchase; // Same structure as Get User's Purchases
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User doesn't have permission to view this purchase
  ```json
  { "message": "Forbidden: You don't have permission to view this purchase" }
  ```
- `404 Not Found`: Purchase doesn't exist
  ```json
  { "message": "Purchase not found" }
  ```
- `500 Internal Server Error`: Database error

**Example Request:**

```bash
curl https://api.atcloud.com/api/purchases/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 4. Get Purchase Receipt

Retrieve formatted receipt data for a specific purchase.

**Endpoint:** `GET /api/purchases/:id/receipt`

**Authentication:** Required (purchase owner, Program Mentor, Admin, or Super Admin)

**URL Parameters:**

- `id` (string, required): MongoDB ObjectId of the purchase

**Success Response (200 OK):**

```typescript
{
  orderNumber: string;
  purchaseDate: string;           // ISO 8601 date
  program: {
    title: string;
    programType: string;
  };
  pricing: {
    fullPrice: number;            // In cents
    classRepDiscount: number;     // In cents
    earlyBirdDiscount: number;    // In cents
    finalPrice: number;           // In cents
    isClassRep: boolean;
    isEarlyBird: boolean;
  };
  paymentMethod: {
    type: "card" | "other";
    cardBrand?: string;
    last4?: string;
    cardholderName?: string;
  };
  billingInfo: {
    fullName: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  status: "pending" | "completed" | "failed" | "refunded";
}
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User doesn't have permission to view this receipt
  ```json
  { "message": "Forbidden: You don't have permission to view this receipt" }
  ```
- `404 Not Found`: Purchase doesn't exist
  ```json
  { "message": "Purchase not found" }
  ```
- `500 Internal Server Error`: Database error
  ```json
  { "message": "Failed to fetch receipt" }
  ```

**Example Request:**

```bash
curl https://api.atcloud.com/api/purchases/507f1f77bcf86cd799439011/receipt \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 5. Check Program Access

Check if the authenticated user has access to a specific program (via purchase or admin privileges).

**Endpoint:** `GET /api/purchases/check-access/:programId`

**Authentication:** Required (any authenticated user)

**URL Parameters:**

- `programId` (string, required): MongoDB ObjectId of the program

**Success Response (200 OK):**

```typescript
{
  hasAccess: boolean;
  reason: "purchased" |
    "admin" |
    "super-admin" |
    "mentor" |
    "free" |
    "no-access";
}
```

**Possible Reasons:**

- `purchased`: User has purchased the program
- `admin`: User is an Administrator (has access to all programs)
- `super-admin`: User is a Super Admin (has access to all programs)
- `mentor`: User is a mentor for this specific program
- `free`: Program is free (no purchase required)
- `no-access`: User doesn't have access to this program

**Error Responses:**

- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Program doesn't exist
  ```json
  { "message": "Program not found" }
  ```
- `500 Internal Server Error`: Database error
  ```json
  { "message": "Failed to check access" }
  ```

**Example Request:**

```bash
curl https://api.atcloud.com/api/purchases/check-access/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGc..."
```

**Example Response:**

```json
{
  "hasAccess": true,
  "reason": "purchased"
}
```

---

## Webhook Endpoint

### Stripe Webhook Handler

Handle Stripe webhook events for payment processing.

**Endpoint:** `POST /api/webhooks/stripe`

**Authentication:** None (validated via Stripe signature)

**Headers Required:**

- `stripe-signature` (string): Stripe webhook signature for verification

**Request Body:** Raw Stripe event payload (must be raw body, not parsed JSON)

**Handled Events:**

- `checkout.session.completed`: Marks purchase as completed, sends confirmation email
- `payment_intent.succeeded`: Updates purchase status to completed
- `payment_intent.failed`: Marks purchase as failed

**Success Response (200 OK):**

```json
{
  "received": true
}
```

**Error Responses:**

- `400 Bad Request`: Invalid signature or payload
  ```json
  { "message": "Webhook signature verification failed" }
  ```
- `500 Internal Server Error`: Event processing failed
  ```json
  { "message": "Error processing webhook" }
  ```

**Event Processing Details:**

#### checkout.session.completed

- Retrieves purchase by `stripeSessionId`
- Updates billing info from session customer details
- Extracts payment method details (card brand, last 4 digits, cardholder name)
- Marks purchase as `completed`
- Sends purchase confirmation email to user

#### payment_intent.succeeded

- Retrieves purchase by `stripePaymentIntentId`
- Updates purchase status to `completed` if not already

#### payment_intent.failed

- Retrieves purchase by `stripePaymentIntentId`
- Marks purchase as `failed`

**Example Webhook Event (checkout.session.completed):**

```bash
# Stripe sends this automatically
curl -X POST https://api.atcloud.com/api/webhooks/stripe \
  -H "stripe-signature: t=1234567890,v1=..." \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_...",
    "object": "event",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_...",
        "amount_total": 9900,
        "customer_details": {...},
        "payment_intent": "pi_..."
      }
    }
  }'
```

---

## Data Models

### Purchase Status Values

- `pending`: Payment initiated but not completed
- `completed`: Payment successful, user enrolled
- `failed`: Payment failed
- `refunded`: Payment refunded

### Currency

All monetary values are stored and returned in **cents** (e.g., $99.00 = 9900 cents).

### Discounts

- **Class Representative Discount**: Applied when `isClassRep = true`
- **Early Bird Discount**: Applied automatically based on program's early bird deadline
- Both discounts can be combined for maximum savings

---

## Error Handling

All endpoints follow consistent error response format:

```typescript
{
  message: string;       // Human-readable error message
  error?: string;        // Technical error details (in development only)
  stack?: string;        // Stack trace (in development only)
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters or business logic error
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User doesn't have permission for this resource
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Server-side error

---

## Email Notifications

After successful purchase (on `checkout.session.completed` event), users receive:

- **Purchase confirmation email** with:
  - Order number and purchase date
  - Program details
  - Payment summary with discounts breakdown
  - Receipt link
  - Next steps information
  - Support contact: atcloudministry@gmail.com

---

## Testing

### Stripe Test Mode

Use Stripe test cards for testing checkout flow:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires authentication:** `4000 0025 0000 3155`

### Webhook Testing

Use Stripe CLI to test webhook events locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

---

## Security Considerations

1. **Authentication**: All endpoints (except webhooks) require valid JWT token
2. **Authorization**: Purchase access verified (owner, mentor, or admin)
3. **Webhook Signature**: Stripe signature validated for all webhook events
4. **Raw Body**: Webhook endpoint requires raw request body for signature verification
5. **Email Deduplication**: EmailService prevents duplicate confirmation emails

---

## Integration Example

### Complete Enrollment Flow

```typescript
// 1. User clicks "Enroll Now" button
const response = await fetch(`/api/purchases/checkout-session/${programId}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ isClassRep: true }),
});

const { url } = await response.json();

// 2. Redirect to Stripe checkout
window.location.href = url;

// 3. User completes payment on Stripe
// 4. Stripe redirects to success page
// 5. Webhook updates purchase status in background
// 6. Confirmation email sent automatically

// 7. Fetch user's purchases
const purchasesResponse = await fetch("/api/purchases/me", {
  headers: { Authorization: `Bearer ${token}` },
});

const { purchases } = await purchasesResponse.json();

// 8. Check access before viewing event
const accessResponse = await fetch(`/api/purchases/check-access/${programId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

const { hasAccess, reason } = await accessResponse.json();

if (hasAccess) {
  // Allow access to program events
} else {
  // Show enrollment modal
}
```

---

## Support

For questions or issues with the Purchase API:

- Email: atcloudministry@gmail.com
- Documentation: https://github.com/atcloud/signup-system/docs
