/**
 * Verificar se as migrations foram aplicadas corretamente
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ler chave do .env.local
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
    .split('\n').filter(Boolean).map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log('A verificar migrations...\n');

  const checks = [
    { name: 'vigencia_substituicoes', query: 'SELECT COUNT(*) as count FROM vigencia_substituicoes' },
    { name: 'vagas_pendentes', query: 'SELECT COUNT(*) as count FROM vagas_pendentes' },
    { name: 'ferias_escala_item.enviado', query: 'SELECT enviado FROM ferias_escala_item LIMIT 1' },
    { name: 'substituicoes_temporarias.tipo', query: 'SELECT tipo FROM substituicoes_temporarias LIMIT 1' },
  ];

  let allOk = true;
  for (const c of checks) {
    try {
      const { data, error } = await supabase.from(c.name.split('.')[0]).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`  ✗ ${c.name}: ${error.message}`);
        allOk = false;
      } else {
        console.log(`  ✓ ${c.name}: OK (${data?.length || 0} registos)`);
      }
    } catch (e) {
      console.log(`  ✗ ${c.name}: ${e.message}`);
      allOk = false;
    }
  }

  console.log(allOk ? '\n✓ Todas as migrations aplicadas!' : '\n✗ Algumas migrations faltam aplicar.');
}

check().catch(console.error);
