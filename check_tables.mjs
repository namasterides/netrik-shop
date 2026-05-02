import { createClient } from '@supabase/supabase-js';

const url = 'https://plbeqmlfhoflsmwtlszd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIwNTc5MSwiZXhwIjoyMDkyNzgxNzkxfQ.Jph1c2ZxRVFeibfc1b20h4gfmPwGasGvsiIfujZbw_Y';

const supabase = createClient(url, key);

async function check() {
  const tables = ['restaurants', 'menu', 'rest_tables', 'orders', 'chat_sessions', 'feedback'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`Table ${t} missing or error:`, error.message);
    } else {
      console.log(`Table ${t} exists.`);
    }
  }
}

check();
