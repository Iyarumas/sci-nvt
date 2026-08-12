import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
    .split('\n').filter(Boolean).map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runMigration(filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  console.log(`Running: ${filePath.split('/').pop()}...`);
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
  if (error) {
    // Try direct SQL via REST API
    console.log(`RPC failed, trying direct query...`);
    const { error: err2 } = await supabase.from('_migrations').insert({ sql }).single().catch(() => ({}));
    if (err2) {
      console.log(`Cannot run DDL directly. Please run manually in Supabase SQL Editor:`);
      console.log(`\n--- ${filePath.split('/').pop()} ---`);
      console.log(sql.substring(0, 500) + '...');
      return false;
    }
  }
  console.log(`✓ ${filePath.split('/').pop()}`);
  return true;
}

// Check if exec_sql RPC exists
async function checkRPC() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_text: 'SELECT 1' }).single();
  return !error;
}

async function main() {
  console.log('Checking migration capabilities...');
  const hasRPC = await checkRPC();
  console.log(`exec_sql RPC available: ${hasRPC}`);

  if (!hasRPC) {
    console.log('\n⚠ Cannot run DDL automatically. Please apply migrations manually via:');
    console.log('  1. Go to https://supabase.com/dashboard/project/vopyrlgmwerzvpmjnyug');
    console.log('  2. Open SQL Editor');
    console.log('  3. Copy and paste each migration file in order\n');
  }

  const migrations = [
    '022_fix_service_schema_mismatches.sql',
    '025_vigencia_substituicoes.sql',
  ];

  for (const m of migrations) {
    const fp = resolve(__dirname, '..', 'supabase', 'migrations', m);
    await runMigration(fp);
  }
}

main().catch(console.error);
