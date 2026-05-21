'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Initialize Stripe outside of component to avoid recreating it
// Replace this with your actual publishable key, ideally loaded from env
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ clientSecret, onSuccess, onCancel, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // Handle success inline if possible
    });

    if (error) {
      setErrorMessage(error.message);
      setIsProcessing(false);
      toast.error(error.message);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setIsProcessing(false);
      onSuccess(paymentIntent);
    } else {
      setIsProcessing(false);
      setErrorMessage('Unexpected payment status.');
      toast.error('Unexpected payment status.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      
      {errorMessage && (
        <div className="text-rose-600 text-sm font-semibold text-center mt-2">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 rounded-full bg-white border border-neutral-200 text-neutral-700 font-bold hover:bg-neutral-50 transition shadow-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-[2] py-3 px-4 rounded-full bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </button>
      </div>
    </form>
  );
}

export default function InlinePayment({ clientSecret, amount, onSuccess, onCancel }) {
  if (!clientSecret) {
    return (
      <div className="p-8 text-center text-neutral-500 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-700" />
        <p>Loading secure payment...</p>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#047857', // emerald-700
        colorBackground: '#ffffff',
        colorText: '#171717',
        colorDanger: '#e11d48',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '12px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm 
        clientSecret={clientSecret} 
        onSuccess={onSuccess} 
        onCancel={onCancel} 
        amount={amount} 
      />
    </Elements>
  );
}
