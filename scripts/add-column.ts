import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use the PostgREST pg/query endpoint to run DDL
// Actually, Supabase provides a /rest/v1/rpc endpoint. Let's try the pg_net approach or just use the REST API to call a DB function.

// Alternative: Use the Supabase Management API or just raw SQL via pg wire protocol.
// Simplest approach: use the Supabase REST API to call a function that runs the ALTER TABLE.

// Actually, the easiest way without psql is to use the Supabase HTTP API for SQL queries
// which is available at: POST /pg/query (requires service role key)

async function addColumn() {
  const sql = "ALTER TABLE notices ADD COLUMN IF NOT EXISTS pdf_urls jsonb DEFAULT '[]'::jsonb;";
  
  // Try the Supabase SQL endpoint (available in newer versions)
  const pgUrl = `${supabaseUrl}/rest/v1/rpc/`;
  
  // Method 1: Try the /pg endpoint (Supabase v2)
  console.log('Trying /pg/query endpoint...');
  try {
    const res = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
    if (res.ok) {
      console.log('Column added via /pg/query ✅');
      process.exit(0);
    }
  } catch (e) {
    console.log('Error:', (e as Error).message);
  }

  // Method 2: Try raw SQL through the query endpoint  
  console.log('\nTrying direct SQL via /sql endpoint...');
  try {
    const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    });
    console.log('Status:', res2.status);
    const text2 = await res2.text();
    console.log('Response:', text2.substring(0, 500));
  } catch (e) {
    console.log('Error:', (e as Error).message);
  }

  console.log('\n⚠️  If neither method worked, please run this SQL in the Supabase Dashboard SQL Editor:');
  console.log(sql);
  process.exit(1);
}

addColumn();
