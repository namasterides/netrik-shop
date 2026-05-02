// Apply the schema.sql to Supabase via direct Postgres.
// Note: from this container the direct host (db.<ref>.supabase.co:5432) may not be IPv4-reachable.
// If this fails, the user can paste schema.sql into Supabase SQL Editor.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_DB_URL missing'); process.exit(1); }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();
    console.log('Connected. Applying schema...');
    await client.query(sql);
    console.log('Schema applied successfully.');
  } catch (e) {
    console.error('FAILED:', e.code || '', e.message);
    process.exit(2);
  } finally {
    await client.end().catch(() => {});
  }
})();
