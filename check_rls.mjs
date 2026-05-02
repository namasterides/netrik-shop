import { createClient } from '@supabase/supabase-js';

const url = 'https://plbeqmlfhoflsmwtlszd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIwNTc5MSwiZXhwIjoyMDkyNzgxNzkxfQ.Jph1c2ZxRVFeibfc1b20h4gfmPwGasGvsiIfujZbw_Y';

const supabase = createClient(url, key);

async function checkRLS() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('support_messages', 'orders', 'restaurants', 'rest_tables', 'menu');
    `
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('RLS Status:', data);
  }
}

checkRLS();
