import { createClient } from '@supabase/supabase-js';

const url = 'https://plbeqmlfhoflsmwtlszd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmVxbWxmaG9mbHNtd3Rsc3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIwNTc5MSwiZXhwIjoyMDkyNzgxNzkxfQ.Jph1c2ZxRVFeibfc1b20h4gfmPwGasGvsiIfujZbw_Y';

const supabase = createClient(url, key);

async function enableRealtime() {
  console.log('Checking realtime publications...');
  
  const tables = ['support_messages', 'orders', 'restaurants', 'rest_tables', 'menu'];
  
  for (const table of tables) {
    console.log(`Enabling realtime for ${table}...`);
    const { error } = await supabase.rpc('execute_sql', {
      sql: `ALTER PUBLICATION supabase_realtime ADD TABLE ${table};`
    });
    if (error) {
      if (error.message.includes('already in publication')) {
        console.log(`${table} is already in realtime publication.`);
      } else {
        console.error(`Error for ${table}:`, error.message);
      }
    } else {
      console.log(`${table} successfully added to realtime publication.`);
    }
  }

  // Set replica identity to full so update/delete events contain old data and can be filtered
  for (const table of tables) {
      console.log(`Setting replica identity for ${table}...`);
      const { error } = await supabase.rpc('execute_sql', {
          sql: `ALTER TABLE ${table} REPLICA IDENTITY FULL;`
      });
      if (error) {
          console.error(`Error setting replica identity for ${table}:`, error.message);
      } else {
          console.log(`Replica identity set for ${table}.`);
      }
  }
}

enableRealtime();
