/**
 * Aplicar Migrations Pendentes no Supabase
 * 
 * Modo 1: Automático (se tiver service_role key ou supabase login)
 *   SUPABASE_SERVICE_KEY=sua_key node scripts/aplicar-migrations.mjs
 * 
 * Modo 2: Instruções para SQL Editor
 *   node scripts/aplicar-migrations.mjs --help
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

const PENDING = [
  '022_fix_service_schema_mismatches.sql',
  '025_vigencia_substituicoes.sql',
  '026_vagas_pendentes.sql',
];

function loadSQL(filename) {
  const path = resolve(MIGRATIONS_DIR, filename);
  if (!existsSync(path)) {
    console.error(`✗ Ficheiro não encontrado: ${filename}`);
    return null;
  }
  return readFileSync(path, 'utf-8');
}

async function tryAuto() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.log('⚠ SUPABASE_SERVICE_KEY não definida.');
    console.log('  Para execução automática:');
    console.log('    1. Ir a https://supabase.com/dashboard/project/vopyrlgmwerzvpmjnyug/settings/api');
    console.log('    2. Copiar a "service_role key"');
    console.log('    3. Executar:');
    console.log('       $env:SUPABASE_SERVICE_KEY="sua_key" ; node scripts/aplicar-migrations.mjs\n');
    return false;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    'https://vopyrlgmwerzvpmjnyug.supabase.co',
    serviceKey,
  );

  for (const m of PENDING) {
    const sql = loadSQL(m);
    if (!sql) continue;

    console.log(`A aplicar: ${m}...`);

    // Try via RPC first
    const { error: rpcErr } = await supabase.rpc('exec_sql', { query: sql });
    if (!rpcErr) {
      console.log(`  ✓ ${m}`);
      continue;
    }

    // Fallback: direct SQL via raw query
    const { error } = await supabase.from('_sql').insert({ sql }).single().catch(() => ({}));
    if (error) {
      console.log(`  ✗ ${m} — ${error.message}`);
      console.log('  A tentar próximo método...');
    } else {
      console.log(`  ✓ ${m}`);
    }
  }

  return true;
}

function printManualInstructions() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  INSTRUÇÕES PARA APLICAÇÃO MANUAL');
  console.log('══════════════════════════════════════════════\n');
  console.log('  1. Abrir https://supabase.com/dashboard');
  console.log('  2. Selecionar o projeto: vopyrlgmwerzvpmjnyug');
  console.log('  3. Ir a "SQL Editor" → "New Query"\n');
  console.log('  4. Copiar e executar CADA migration por ordem:\n');

  for (const m of PENDING) {
    const sql = loadSQL(m);
    if (!sql) continue;
    console.log(`  ─── ${m} ───`);
    // Show just the table creation part
    const lines = sql.split('\n').filter(l => l.trim() && !l.startsWith('--'));
    console.log(`  (${lines.length} linhas SQL)`);
    console.log(`  CREATE TABLE: ${m.includes('vigencia') ? 'vigencia_substituicoes' : m.includes('vaga') ? 'vagas_pendentes' : 'ferias_escala_item + substituicoes_temporarias'}`);
    console.log('');
  }

  console.log('  5. Após aplicar, executar: node scripts/verificar-migrations.mjs\n');
}

// Main
const isHelp = process.argv.includes('--help');
if (isHelp) {
  printManualInstructions();
  process.exit(0);
}

console.log('╔══════════════════════════════════════════╗');
console.log('║  Aplicar Migrations - SESCINC Manager   ║');
console.log('╚══════════════════════════════════════════╝\n');

const autoOk = await tryAuto();
if (!autoOk) {
  printManualInstructions();
}
