# Stripe Payment Gateway Integration

## Overview
Stripe payment gateway has been successfully integrated into the Netrik Shop ordering system with chatbot support. Customers can now pay for their orders using credit/debit cards through a secure Stripe checkout experience.

## Implementation Details

### Environment Setup
The following environment variables are required and already configured in `.env`:
```
STRIPE_PUBLISHABLE_KEY=pk_live_51TUt1qLMBvdp6KEi...
STRIPE_SECRET_KEY=sk_live_51TUt1qLMBvdp6KEi...
STRIPE_WEBHOOK_SECRET=whsec_... (optional but recommended)
```

### Key Components

#### 1. Backend Implementation (`lib/stripe.js`)
Core Stripe utilities including:
- **createCheckoutSession**: Creates a Stripe checkout session for payment
- **getSessionStatus**: Retrieves checkout session status to verify payment
- **verifyWebhookSignature**: Validates Stripe webhook signatures
- **refundPayment**: Process refunds if needed
- **handleWebhookEvent**: Processes various Stripe webhook events:
  - `checkout.session.completed`: Updates order status to paid
  - `charge.refunded`: Logs refund events
  - `payment_intent.succeeded`: Alternative payment success handling
  - `payment_intent.payment_failed`: Handles failed payments

#### 2. API Endpoints

##### POST `/api/payment/stripe/init`
Initiates a Stripe checkout session for an order.

**Request:**
```json
{
  "orderId": "order_abc123"
}
```

**Response:**
```json
{
  "order": { /* updated order object */ },
  "payment": {
    "status": "pending",
    "reference": "cs_test_...",
    "provider": "stripe",
    "method": "card",
    "createdAt": "2024-01-01T12:00:00Z",
    "checkoutUrl": "https://checkout.stripe.com/..."
  },
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

##### GET `/api/payment/stripe/status`
Checks the status of a payment for an order.

**Query Parameters:**
- `orderId` (required): The order ID
- `sessionId` (optional): The Stripe checkout session ID

**Response:**
```json
{
  "order": { /* updated order object */ },
  "payment": {
    "status": "paid|unpaid|pending",
    "reference": "cs_test_...",
    "provider": "stripe",
    "method": "card"
  }
}
```

##### POST `/api/payment/stripe/webhook`
Webhook endpoint for Stripe events. Should be registered in Stripe dashboard.

**Webhook Events Handled:**
- `checkout.session.completed`
- `charge.refunded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Frontend Integration

#### Chatbot Payment Flow (`app/order/[tableId]/page.js`)

1. **Initiate Payment**
   - User types "pay" or taps payment button
   - `startStripePayment()` function is called
   - Creates Stripe checkout session via `/api/payment/stripe/init`
   - Opens payment modal with checkout URL

2. **Payment Handling**
   - Stripe checkout opens in a new window
   - Customer completes payment on Stripe's secure page
   - Returns to the application

3. **Status Polling**
   - Component polls `/api/payment/stripe/status` every 3 seconds
   - Updates payment status in real-time
   - Shows confirmation when payment is complete
   - Transitions to feedback stage

4. **Payment Modal UI**
   - Displays order total and payment status
   - Shows payment reference number
   - Includes "Open secure payment" button
   - Displays receipt download option
   - Real-time status updates while on page

### Payment Status Flow

```
browsing → serving → paying → feedback → done
                         ↓
                    polling every 3s
                         ↓
                      paid (success)
```

### Database Updates
When payment is successful:
- `orders.payment_status` → 'paid'
- `orders.status` → 'paid'
- `orders.paid_at` → current timestamp
- `rest_tables.status` → 'available' (marks table as free)

## Configuration

### Stripe Dashboard Setup
1. Go to https://dashboard.stripe.com/
2. Navigate to Webhooks section
3. Add endpoint: `https://your-domain.com/api/payment/stripe/webhook`
4. Select events to receive:
   - `checkout.session.completed`
   - `charge.refunded`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the signing secret and add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Success/Cancel URLs
Configured to return to the order page with status parameters:
- Success: `/order/[tableId]?payment_status=success&session_id=[SESSION_ID]`
- Cancel: `/order/[tableId]?payment_status=cancelled`

## Error Handling

The implementation includes comprehensive error handling for:
- Network failures during checkout creation
- Invalid session IDs
- Missing order data
- Webhook signature verification failures
- Database update errors

Errors are logged server-side and user-friendly messages displayed in the chatbot.

## Testing

### Local Testing
1. Use Stripe test keys (already available if not using live mode)
2. Test card numbers:
   - Success: `4242 4242 4242 4242`
   - Failure: `4000 0000 0000 0002`
3. Use any future expiry date and any 3-digit CVC

### Payment Statuses
- `pending`: Checkout session created, awaiting payment
- `paid`: Payment successfully processed
- `failed`: Payment was declined
- `cancelled`: User cancelled the payment

## Chatbot Integration

The chatbot naturally guides users through payment:
1. **Order Complete**: "Your food is ready. Want anything else, or should I bring the bill?"
2. **Bill Requested**: Shows itemized bill
3. **Payment Ready**: "Opening secure card payment for $XX.XX"
4. **Checkout Window**: Opens Stripe checkout in new tab
5. **Confirmation**: "Payment confirmed. Please rate your experience."

## Security Considerations

✅ **PCI Compliance**: Stripe handles all card data - we never store/transmit raw card numbers
✅ **HTTPS Only**: All payment endpoints require HTTPS in production
✅ **Webhook Verification**: All webhook events verified using Stripe signing secret
✅ **Session Management**: Checkout sessions expire and are single-use
✅ **Environment Variables**: Keys stored securely in `.env`

## Monitoring & Logging

- All Stripe API calls logged with `[Stripe]` prefix
- Webhook processing logged with `[Stripe Webhook]` prefix
- Errors include detailed messages for debugging
- Payment status changes tracked in order records

## Future Enhancements

Possible improvements:
- Multiple payment method support (Apple Pay, Google Pay)
- Installment payment plans
- Saved payment methods for returning customers
- Real-time payment analytics dashboard
- Automated refund processing
- Payment receipt email notifications

## Support

For issues:
1. Check Stripe Dashboard event logs for webhook events
2. Review browser console for client-side errors
3. Check server logs for API errors
4. Verify `.env` keys are correct and match Stripe account
5. Ensure HTTPS is properly configured for webhooks
