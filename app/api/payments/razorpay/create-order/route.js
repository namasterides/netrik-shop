import Razorpay from 'razorpay';

export async function POST(req) {
  try {
    const { amount, currency, receipt } = await req.json();

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
    });

    const options = {
      amount: amount, // amount in the smallest currency unit (e.g., paise)
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return Response.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
