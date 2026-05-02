import { createClient } from '@supabase/supabase-js';

const url = 'https://plbeqmlfhoflsmwtlszd.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDU3OTEsImV4cCI6MjA5Mjc4MTc5MX0.WYpU9pRTYxz9xWC5GtS0vDk-FiBzZwztjXVc6_f66Fk';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIwNTc5MSwiZXhwIjoyMDkyNzgxNzkxfQ.Jph1c2ZxRVFeibfc1b20h4gfmPwGasGvsiIfujZbw_Y';

const anonClient = createClient(url, anonKey);
const serviceClient = createClient(url, serviceKey);

async function testRealtime() {
  console.log('Subscribing with Anon Key...');
  
  const channel = anonClient.channel('test-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
      console.log('SUCCESS! Received real-time payload:', payload);
      process.exit(0);
    })
    .subscribe((status, err) => {
      console.log('Subscription status:', status);
      if (err) console.error('Subscription error:', err);
      
      if (status === 'SUBSCRIBED') {
        console.log('Inserting message with Service Role...');
        serviceClient.from('support_messages').insert({
          restaurant_id: 'rest_test_123',
          sender: 'test',
          message: 'Hello Realtime!'
        }).then(({ error }) => {
          if (error) console.error('Insert error:', error.message);
          else console.log('Message inserted, waiting for real-time event...');
        });
      }
    });

  setTimeout(() => {
    console.log('TIMEOUT: Did not receive real-time event within 5 seconds.');
    console.log('This means RLS is blocking the Anon key from receiving real-time events, or Realtime is still not configured correctly.');
    process.exit(1);
  }, 5000);
}

testRealtime();
