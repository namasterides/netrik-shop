const { Client } = require('pg');
const PASS = process.env.SUPABASE_DB_PASSWORD || '';
const REF = process.env.SUPABASE_PROJECT_REF || '';
const regions = ['ap-south-1','ap-southeast-1','us-east-1','us-east-2','us-west-1','eu-west-1','eu-central-1','ap-northeast-1','ap-southeast-2'];
const prefixes = ['aws-0','aws-1'];
(async () => {
  if (!PASS || !REF) {
    console.error('Set SUPABASE_DB_PASSWORD and SUPABASE_PROJECT_REF before running this script.');
    process.exit(1);
  }
  for (const p of prefixes) {
    for (const r of regions) {
      const host = `${p}-${r}.pooler.supabase.com`;
      const url = `postgresql://postgres.${REF}:${encodeURIComponent(PASS)}@${host}:6543/postgres`;
      const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 5000, query_timeout: 5000, connectionTimeoutMillis: 5000 });
      try {
        await c.connect();
        console.log('SUCCESS', host);
        await c.end();
        return;
      } catch (e) {
        console.log('fail', host, e.code || '', (e.message || '').slice(0, 80));
        try { await c.end(); } catch {}
      }
    }
  }
})();
