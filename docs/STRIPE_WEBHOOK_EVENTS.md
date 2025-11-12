# Stripe Webhook Events Configuration

## Required Webhook Events

Configure these webhook events in your Stripe Dashboard to ensure the application works correctly.

### Event Purchases (One-time Payments)

| Event                           | Purpose                                      | Handler                                            |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `checkout.session.completed`    | Completes purchase after successful checkout | `WebhookController.handleCheckoutSessionCompleted` |
| `payment_intent.succeeded`      | Confirms payment success                     | `WebhookController.handlePaymentIntentSucceeded`   |
| `payment_intent.payment_failed` | Handles failed payments                      | `WebhookController.handlePaymentIntentFailed`      |
| `charge.refund.updated`         | Processes refunds                            | `WebhookController.handleRefundUpdated`            |

### Donations - One-time

| Event                        | Purpose                                  | Handler                                            |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `checkout.session.completed` | Records one-time donation after checkout | `DonationWebhookController.handleDonationCheckout` |

### Donations - Recurring Subscriptions

| Event                           | Purpose                                        | Handler                                                   |
| ------------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `checkout.session.completed`    | Creates subscription and records first payment | `DonationWebhookController.handleDonationCheckout`        |
| `invoice.payment_succeeded`     | Records each recurring payment automatically   | `DonationWebhookController.handleInvoicePaymentSucceeded` |
| `invoice.payment_failed`        | Marks donation as failed when payment fails    | `DonationWebhookController.handleInvoicePaymentFailed`    |
| `customer.subscription.updated` | Handles subscription changes (pause/resume)    | `DonationWebhookController.handleSubscriptionUpdated`     |
| `customer.subscription.deleted` | Handles subscription cancellation              | `DonationWebhookController.handleSubscriptionDeleted`     |

## Stripe Dashboard Configuration

### Production Webhook Endpoint

```
https://your-domain.com/api/webhooks/stripe
```

### Development Webhook (Stripe CLI)

```bash
stripe listen --forward-to localhost:5001/api/webhooks/stripe
```

### Events to Enable in Stripe Dashboard

**All Events Required:**

1. ✅ `checkout.session.completed`
2. ✅ `payment_intent.succeeded`
3. ✅ `payment_intent.payment_failed`
4. ✅ `charge.refund.updated`
5. ✅ `invoice.payment_succeeded`
6. ✅ `invoice.payment_failed`
7. ✅ `customer.subscription.updated`
8. ✅ `customer.subscription.deleted`

## How to Configure

### 1. Go to Stripe Dashboard

Navigate to: **Developers → Webhooks**

### 2. Add Endpoint

- Click "Add endpoint"
- Enter your endpoint URL
- Select events to listen to

### 3. Select Events

Choose these 8 events:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refund.updated`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 4. Copy Webhook Secret

- After creating the endpoint, copy the webhook signing secret
- Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

## Testing Webhooks Locally

Use Stripe CLI to forward webhooks to your local development server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5001/api/webhooks/stripe

# Test specific event
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
```

## Webhook Security

The application verifies webhook signatures using the `STRIPE_WEBHOOK_SECRET`:

```typescript
// In stripeService.ts
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
```

**Important:**

- Never share your webhook secret
- Rotate webhook secret if compromised
- Verify all webhook signatures before processing

## Troubleshooting

### Webhooks Not Received

1. Check endpoint URL is correct
2. Verify webhook secret in `.env`
3. Check server logs for signature verification errors
4. Test with Stripe CLI: `stripe listen --forward-to localhost:5001/api/webhooks/stripe`

### Duplicate Transactions

- Webhooks have built-in idempotency checks
- Uses `stripePaymentIntentId` to prevent duplicates
- Safe to receive same webhook multiple times

### Failed Webhook Deliveries

- Stripe retries failed webhooks automatically
- Check "Recent deliveries" in Stripe Dashboard
- Review response codes and error messages

## Monitoring

Check webhook delivery status in Stripe Dashboard:

- **Developers → Webhooks → [Your Endpoint]**
- View recent deliveries
- Check success/failure rates
- Review error logs
