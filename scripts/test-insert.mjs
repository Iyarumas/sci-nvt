import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envRaw = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envRaw.split('\n').filter(Boolean).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testando insert na tabela bombeiros...');

const { error: errInsert } = await supabase.from('bombeiros').insert({
  matricula: 'TESTE',
  nome_completo: 'Teste Insert',
  nome_guerra: 'Teste',
  cpf: '00000000000',
  rg: '000000000',
  sexo: 'M',
  data_nascimento: '1990-01-01',
  tipo_sanguineo: 'A+',
  email: 'teste@teste.com',
  celular: '00000000000',
  endereco: 'Rua Teste',
  numero_endereco: '123',
  complemento: '',
  cep: '00000000',
  uf: 'SP',
  municipio: 'Sao Paulo',
  data_admissao: '2024-01-01',
  cargo: 'BA-2',
  equipe: 'Alfa',
  turno: 'Diurno',
  cnh_numero: '00000000000',
  cnh_categoria: 'B',
  cnh_validade: '2030-01-01',
  idade: 34,
  curso_chefe_equipe: false,
  curso_motorista_cci: false,
});

if (errInsert) {
  console.error('❌ Erro ao inserir registro de teste:', errInsert.message);
} else {
  console.log('✅ Insert de teste funcionou!');
  await supabase.from('bombeiros').delete().eq('matricula', 'TESTE');
  console.log('✅ Registro de teste removido.');
}
