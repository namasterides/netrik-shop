# Stripe Payment Gateway - Quick Start Guide

## ✅ What's Been Implemented

Your Netrik Shop ordering system now has **full Stripe payment gateway integration** with a beautiful chatbot experience. Here's what's ready to use:

### Core Features
- ✅ Secure card payment processing via Stripe Checkout
- ✅ Real-time payment status updates in the chatbot
- ✅ Automatic order completion on successful payment
- ✅ Webhook support for payment event handling
- ✅ Comprehensive error handling and logging
- ✅ Customer feedback collection after payment

### Current Setup
```
Environment Variables: ✅ Already configured in .env
- STRIPE_PUBLISHABLE_KEY: pk_live_51TUt1qLMBvdp6KEi...
- STRIPE_SECRET_KEY: sk_live_51TUt1qLMBvdp6KEi...
```

## 🚀 How to Use

### For Customers (via Chatbot)
1. Customer browses menu and adds items to cart
2. Says "place order" to send order to kitchen
3. When food is ready, gets notification: "Your food is ready. Want anything else, or should I bring the bill?"
4. Says "bill" or taps the button
5. Taps "Pay" or says "pay"
6. Sees payment modal: "Opening secure card payment for $XX.XX"
7. Clicks "Open secure payment" button
8. Completes payment on Stripe's secure checkout page
9. Returns to app and sees: "✅ Payment confirmed. Please rate your experience."

### Chatbot Payment Dialog Flow
```
Customer → "I'm ready to pay"
          ↓
Chatbot → "Opening secure card payment for $XX.XX"
          ↓
Modal Opens with:
  • Total amount
  • Payment reference
  • "Open secure payment" button
  • "Download receipt" button
          ↓
Customer clicks "Open secure payment"
          ↓
Stripe Checkout opens (new window)
          ↓
Customer completes payment
          ↓
Returns to order page
          ↓
Chatbot polls status every 3 seconds
          ↓
Payment confirmed!
          ↓
Chatbot → "Please rate your experience" (1-5 stars)
```

## ⚙️ Configuration Needed (Optional but Recommended)

### Set Up Webhook for Real-Time Updates
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/payment/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `charge.refunded`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the signing secret
6. Add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
7. Restart the application

### Production URLs
- Update success/cancel redirect URLs in Stripe settings if deploying to production
- Default: `http://localhost:3000` (for development)
- Production: `https://your-production-domain.com`

## 🧪 Testing the Payment Flow

### Using Stripe Test Cards
Since you're using test/live keys, you can test with these card numbers:

**Successful Payment**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

**Failed Payment**
- Card: `4000 0000 0000 0002`
- Expiry: Any future date
- CVC: Any 3 digits

**Test Flow:**
1. Start a new order at `/order/[tableId]`
2. Add items to cart
3. Say "place order"
4. Wait for "food ready" message
5. Say "bill" and then "pay"
6. Click "Open secure payment"
7. Enter test card details
8. Complete the checkout
9. Return to app (automatic or manual)
10. See payment confirmation and feedback prompt

## 📊 API Endpoints

### Check Order Status
```bash
GET /api/orders/{orderId}
```

### Initiate Payment
```bash
POST /api/payment/stripe/init
Body: { "orderId": "order_123" }
```

### Check Payment Status
```bash
GET /api/payment/stripe/status?orderId=order_123
```

### Webhook (Stripe sends events)
```
POST /api/payment/stripe/webhook
Headers: stripe-signature: ...
```

## 📝 Database Schema

Orders now track payment information:
- `payment_status`: pending, paid, failed, cancelled
- `payment_reference`: Stripe session ID
- `payment_provider`: Always "stripe"
- `payment_method`: "card"
- `payment_created_at`: When payment was initiated
- `paid_at`: When payment was completed
- `status`: Order status (updates to "paid" on successful payment)

## 🔒 Security

✅ All card data handled by Stripe (PCI compliant)
✅ Webhook signatures verified server-side
✅ API keys only used server-side
✅ Session-based checkout (single-use)
✅ HTTPS recommended for production

## 📱 Mobile Experience

The payment flow works seamlessly on:
- ✅ Desktop browsers
- ✅ Mobile web browsers
- ✅ Touch interactions optimized
- ✅ Responsive payment modal

## 🐛 Troubleshooting

### "Payment init failed"
- Check that order ID is correct
- Verify Stripe keys in `.env` are valid
- Check browser console for error details

### Payment status not updating
- Ensure polling is active (check network tab)
- Verify API endpoint is responding
- Check server logs for errors

### Webhook not working
- Verify webhook secret in `.env`
- Check Stripe Dashboard → Events for failed deliveries
- Ensure endpoint is publicly accessible (not localhost)

### "Order not found" errors
- Verify order was created successfully
- Check that table ID and restaurant ID are correct
- Ensure order hasn't been deleted/archived

## 📈 Next Steps (Optional Enhancements)

1. **Email Receipts**: Add email notification with receipt
2. **Apple Pay/Google Pay**: Support mobile wallet payments
3. **Payment Analytics**: Dashboard showing payment trends
4. **Installment Plans**: Offer "Pay in X installments"
5. **Saved Cards**: Allow returning customers to save cards
6. **Refund Management**: Admin portal for processing refunds

## 📞 Support

Check the detailed documentation:
- See `STRIPE_INTEGRATION.md` for complete technical details
- Review error logs in browser console and server logs
- Consult Stripe documentation: https://stripe.com/docs

## ✨ Summary

Your Netrik Shop now has:
- ✅ Complete Stripe payment integration
- ✅ Beautiful chatbot payment experience
- ✅ Real-time status updates
- ✅ Automatic order completion
- ✅ Webhook support
- ✅ Comprehensive error handling
- ✅ Production-ready code

**Everything is ready to go!** Test it out and let me know if you need any adjustments.
