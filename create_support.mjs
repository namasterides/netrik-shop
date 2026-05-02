import { createClient } from '@supabase/supabase-js';

const url = 'https://plbeqmlfhoflsmwtlszd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIwNTc5MSwiZXhwIjoyMDkyNzgxNzkxfQ.Jph1c2ZxRVFeibfc1b20h4gfmPwGasGvsiIfujZbw_Y';

const supabase = createClient(url, key);

async function check() {
  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS support_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
    `
  });
  
  if (error) {
    console.error('RPC failed, attempting direct insert to create table via REST? Not possible. Please create manually or ensure this succeeds:', error.message);
  } else {
    console.log('support_messages table verified/created.');
  }
}

check();
