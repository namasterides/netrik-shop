import Stripe from 'stripe';

const DEFAULT_CURRENCY = String(process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

function getStripeClient() {
  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Neither STRIPE_RESTRICTED_KEY nor STRIPE_SECRET_KEY is configured');
  return new Stripe(secretKey);
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function parseAmountInMinorUnits(amount) {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid payment amount');
  return Math.round(parsed * 100);
}

export async function createCheckoutSession({ orderId, amount, restaurantName, tableId, customerEmail, baseUrl, currency = DEFAULT_CURRENCY, metadata = {} }) {
  try {
    const stripe = getStripeClient();
    const appBaseUrl = normalizeBaseUrl(baseUrl);
    const normalizedCurrency = String(currency || DEFAULT_CURRENCY).toLowerCase();
    const unitAmount = parseAmountInMinorUnits(amount);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: normalizedCurrency,
            product_data: {
              name: `Order from ${restaurantName}`,
              description: `Order ID: ${orderId}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/order/${tableId}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/order/${tableId}?payment_status=cancelled`,
      metadata: {
        orderId,
        tableId,
        restaurantName,
        ...metadata,
      },
    });

    return {
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      clientSecret: session.client_secret,
    };
  } catch (error) {
    console.error('[Stripe] Checkout session creation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function createPaymentIntent({ orderId, amount, restaurantName, tableId, customerEmail, currency = DEFAULT_CURRENCY, metadata = {} }) {
  try {
    const stripe = getStripeClient();
    const normalizedCurrency = String(currency || DEFAULT_CURRENCY).toLowerCase();
    const unitAmount = parseAmountInMinorUnits(amount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: normalizedCurrency,
      description: `Order from ${restaurantName} (ID: ${orderId})`,
      receipt_email: customerEmail || undefined,
      metadata: {
        orderId,
        tableId,
        restaurantName,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error('[Stripe] Payment intent creation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getSessionStatus(sessionId) {
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      success: true,
      status: session.payment_status, // 'paid', 'unpaid', 'no_payment_required'
      session,
    };
  } catch (error) {
    console.error('[Stripe] Session retrieval failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getPaymentIntentStatus(paymentIntentId) {
  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      success: true,
      status: paymentIntent.status,
      paymentIntent,
    };
  } catch (error) {
    console.error('[Stripe] Payment intent retrieval failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export function verifyWebhookSignature(body, signature, secret) {
  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, secret);
    return { success: true, event };
  } catch (error) {
    console.error('[Stripe] Webhook signature verification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function refundPayment(chargeId, amount) {
  try {
    const stripe = getStripeClient();
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });
    return { success: true, refund };
  } catch (error) {
    console.error('[Stripe] Refund failed:', error);
    return { success: false, error: error.message };
  }
}

export async function handleWebhookEvent(event, supabase) {
  switch (event.type) {
    case 'checkout.session.completed':
      return await handleCheckoutComplete(event.data.object, supabase);
    case 'charge.refunded':
      return await handleChargeRefunded(event.data.object, supabase);
    case 'payment_intent.succeeded':
      return await handlePaymentIntentSucceeded(event.data.object, supabase);
    case 'payment_intent.payment_failed':
      return await handlePaymentIntentFailed(event.data.object, supabase);
    default:
      return { handled: false };
  }
}

async function handleCheckoutComplete(session, supabase) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return { handled: false };

  try {
    const { data, error } = await supabase.from('orders').update({
      payment_status: 'paid',
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId).select('table_id').single();

    if (!error && data?.table_id) {
      await supabase.from('rest_tables').update({ status: 'available' }).eq('id', data.table_id);
    }

    return { handled: true, orderId };
  } catch (err) {
    console.error('[Stripe Webhook] Error handling checkout complete:', err);
    return { handled: false, error: err.message };
  }
}

async function handleChargeRefunded(charge, supabase) {
  // Log refund event - can be used for analytics and audit trails
  console.log('[Stripe Webhook] Charge refunded:', charge.id);
  return { handled: true };
}

async function handlePaymentIntentSucceeded(paymentIntent, supabase) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return { handled: false };

  try {
    const { data, error } = await supabase.from('orders').update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId).select('table_id').single();

    if (!error && data?.table_id) {
      await supabase.from('rest_tables').update({ status: 'available' }).eq('id', data.table_id);
    }

    return { handled: true, orderId };
  } catch (err) {
    console.error('[Stripe Webhook] Error handling payment intent succeeded:', err);
    return { handled: false, error: err.message };
  }
}

async function handlePaymentIntentFailed(paymentIntent, supabase) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return { handled: false };

  try {
    await supabase.from('orders').update({
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    return { handled: true, orderId };
  } catch (err) {
    console.error('[Stripe Webhook] Error handling payment intent failed:', err);
    return { handled: false, error: err.message };
  }
}

