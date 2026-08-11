import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf-8')
    .split('\n').filter(Boolean).map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { error, count } = await supabase
  .from('ptrb_registros')
  .delete({ count: 'exact' })
  .neq('id', '00000000-0000-0000-0000-000000000000');

if (error) {
  console.error('❌ Erro ao deletar PTR-BA:', error.message);
  process.exit(1);
}

console.log(`✅ ${count} PTR-BA deletados.`);

const { count: restante } = await supabase
  .from('ptrb_registros')
  .select('*', { count: 'exact', head: true });

console.log(`📊 Restam ${restante ?? 0} registros na tabela.`);
