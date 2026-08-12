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

const { error } = await supabase
  .from('usuarios')
  .update({ role: 'desenvolvedor', updated_at: new Date().toISOString() })
  .eq('username', 'serra');

if (error) {
  console.error('❌ Erro ao atualizar serra:', error.message);
  process.exit(1);
}

console.log('✅ Usuário "serra" atualizado para desenvolvedor!');

const { data } = await supabase.from('usuarios').select('username, name, role');
console.log('\n📋 Usuários atuais:');
for (const u of data) {
  console.log(`   ${u.username.padEnd(12)} ${u.role.padEnd(15)} ${u.name}`);
}
