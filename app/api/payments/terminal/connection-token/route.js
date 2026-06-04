import Stripe from 'stripe';

// Use environment variable for the secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10', // using a safe recent version
});

export async function POST(req) {
  try {
    const connectionToken = await stripe.terminal.connectionTokens.create();
    
    return Response.json({ secret: connectionToken.secret });
  } catch (error) {
    console.error('Error creating connection token:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
