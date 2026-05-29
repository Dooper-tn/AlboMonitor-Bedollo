import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrate() {
  // Step 1: Check if pdf_urls column already exists
  console.log('1. Checking pdf_urls column...');
  const { data: testData, error: testErr } = await sb
    .from('notices')
    .select('id, pdf_urls')
    .limit(1);

  if (testErr && testErr.message.includes('pdf_urls')) {
    console.log('   Column pdf_urls does NOT exist. Need to add it via Supabase Dashboard SQL Editor:');
    console.log("   ALTER TABLE notices ADD COLUMN pdf_urls jsonb DEFAULT '[]'::jsonb;");
    process.exit(1);
  } else {
    console.log('   Column pdf_urls exists ✅');
  }

  // Step 2: Migrate existing pdf_url data to pdf_urls
  console.log('2. Migrating existing pdf_url data...');
  const { data: notices } = await sb
    .from('notices')
    .select('id, pdf_url, pdf_urls')
    .not('pdf_url', 'is', null);

  if (notices && notices.length > 0) {
    let migrated = 0;
    for (const n of notices) {
      const existing = (n as any).pdf_urls as any[] | null;
      if (!existing || existing.length === 0) {
        const pdfUrls = [{ url: (n as any).pdf_url, label: 'Documento PDF' }];
        const { error } = await sb.from('notices').update({ pdf_urls: pdfUrls }).eq('id', n.id);
        if (error) {
          console.log(`   Error migrating ${n.id}: ${error.message}`);
        } else {
          migrated++;
        }
      }
    }
    console.log(`   Migrated ${migrated} notices ✅`);
  } else {
    console.log('   No notices with pdf_url to migrate');
  }

  // Step 3: Fix the broken notice
  console.log('3. Fixing notice 1a9511be...');
  const pdfUrl = 'https://albobedollo.gisco-tn.it/allegato/168433_143908/AP20260094G.PDF';
  const { error: e3 } = await sb.from('notices').update({
    pdf_url: pdfUrl,
    pdf_urls: [{ url: pdfUrl, label: 'Scarica ATTO PDF' }]
  }).eq('id', '1a9511be-a644-4901-8c0c-fac63c43665c');
  console.log('   Fix notice:', e3 ? `ERROR: ${e3.message}` : 'OK ✅');

  // Step 4: Verify
  console.log('4. Verifying...');
  const { data: check } = await sb.from('notices').select('id, pdf_url, pdf_urls').eq('id', '1a9511be-a644-4901-8c0c-fac63c43665c').single();
  console.log(JSON.stringify(check, null, 2));

  const { data: all } = await sb.from('notices').select('id, pdf_url, pdf_urls').order('created_at', { ascending: false }).limit(5);
  console.log('\nRecent 5 notices pdf status:');
  for (const n of all || []) {
    const urls = ((n as any).pdf_urls as any[]) || [];
    console.log(`  ${n.id.substring(0, 8)}... pdf_url=${(n as any).pdf_url ? 'YES' : 'null'} pdf_urls=${urls.length} items`);
  }

  process.exit(0);
}

migrate();
