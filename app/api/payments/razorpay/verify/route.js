import crypto from 'crypto';

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      return Response.json({ success: true, message: "Payment verified successfully" });
    } else {
      return Response.json({ success: false, message: "Invalid signature" }, { status: 400 });
    }
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
