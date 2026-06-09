import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Use environment variable for the secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10', 
});

export async function POST(req) {
  try {
    const { amount, currency, tableId, guestId } = await req.json();
    
    // The mobile app sends amount in cents already (e.g. amount * 100).
    const intent = await stripe.paymentIntents.create({
      amount: amount, 
      currency: currency || 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'manual', // Tap to Pay requires manual capture
      metadata: {
        tableId: tableId || '',
        guestId: guestId || '',
      }
    });
    
    return Response.json({ client_secret: intent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
