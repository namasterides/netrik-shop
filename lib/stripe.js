import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function createCheckoutSession({ orderId, amount, restaurantName, tableId, customerEmail }) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Order from ${restaurantName}`,
              description: `Order ID: ${orderId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/order/${tableId}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/order/${tableId}?payment_status=cancelled`,
      metadata: {
        orderId,
        tableId,
        restaurantName,
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

export async function getSessionStatus(sessionId) {
  try {
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
    const event = stripe.webhooks.constructEvent(body, signature, secret);
    return { success: true, event };
  } catch (error) {
    console.error('[Stripe] Webhook signature verification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function refundPayment(chargeId, amount) {
  try {
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

