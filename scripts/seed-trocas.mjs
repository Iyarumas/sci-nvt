import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://vopyrlgmwerzvpmjnyug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHlybGdtd2VyenZwbWpueXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MjIyNjEsImV4cCI6MjA5OTI5ODI2MX0.OsAf71jd80sTn9xfzH1K2a2GlC5rBz-R5KwuNm_fwDw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Sample Bombeiros ───────────────────────────────────────────────────────
function makeBombeiro(nomeGuerra, nomeCompleto, cargo, equipe, turno, idx) {
  return { nomeCompleto, nomeGuerra, matricula: `2024${String(idx).padStart(3, '0')}`, cpf: `${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}`.slice(0, 11), cargo, equipe, turno, email: `${nomeGuerra.toLowerCase()}@sescinc.com` };
}

const SAMPLE_BOMBEIROS = [];
let idx = 1;
const equipes = [
  { nome: 'Alfa', turno: 'Diurno', membros: [
    ['Carlos', 'Carlos Alberto Silva', 'BA-2'],
    ['PedroH', 'Pedro Henrique Lima', 'BA-2'],
    ['Amanda', 'Amanda Cristina Vieira', 'BA-2'],
    ['Diego', 'Diego Santos Oliveira', 'BA-2'],
    ['Vinicius', 'Vinicius Barbosa Silva', 'BA-2'],
    ['Fernando', 'Fernando Costa Lima', 'BA-MC'],
    ['Lucas', 'Lucas Almeida Costa', 'BA-MC'],
    ['RafaelA', 'Rafael Almeida Souza', 'BA-MC'],
    ['Julio', 'Julio Cesar Pereira', 'BA-LR'],
    ['Roberto', 'Roberto Oliveira Santos', 'BA-CE'],
  ]},
  { nome: 'Bravo', turno: 'Noturno', membros: [
    ['Marcos', 'Marcos Paulo Souza', 'BA-2'],
    ['Gustavo', 'Gustavo Henrique Dias', 'BA-2'],
    ['BrunoH', 'Bruno Henrique Santos', 'BA-2'],
    ['Kevin', 'Kevin Almeida Costa', 'BA-2'],
    ['ThiagoO', 'Thiago Oliveira Rocha', 'BA-2'],
    ['Paulo', 'Paulo Henrique Almeida', 'BA-MC'],
    ['RafaelL', 'Rafael Souza Lima', 'BA-MC'],
    ['Igor', 'Igor Pereira Lima', 'BA-MC'],
    ['Leonardo', 'Leonardo Costa Pereira', 'BA-LR'],
    ['Ricardo', 'Ricardo Augusto Barbosa', 'BA-CE'],
  ]},
  { nome: 'Charlie', turno: 'Diurno', membros: [
    ['Luciana', 'Luciana Ferreira Dias', 'BA-2'],
    ['Aline', 'Aline Cristina Barros', 'BA-2'],
    ['Juliana', 'Juliana Almeida Rocha', 'BA-2'],
    ['Priscila', 'Priscila Lima Dias', 'BA-2'],
    ['Fernanda', 'Fernanda Oliveira Santos', 'BA-2'],
    ['Patricia', 'Patricia Oliveira Rocha', 'BA-MC'],
    ['Carla', 'Carla Regina Souza', 'BA-MC'],
    ['CamilaC', 'Camila Cristina Oliveira', 'BA-MC'],
    ['Daniela', 'Daniela Pereira Costa', 'BA-LR'],
    ['Bruno', 'Bruno Cesar Teixeira', 'BA-CE'],
  ]},
  { nome: 'Delta', turno: 'Noturno', membros: [
    ['Thiago', 'Thiago Rafael Mendes', 'BA-2'],
    ['Matheus', 'Matheus Silva Almeida', 'BA-2'],
    ['Renato', 'Renato Costa Souza', 'BA-2'],
    ['Danilo', 'Danilo Pereira Santos', 'BA-2'],
    ['Fabio', 'Fabio Henrique Barbosa', 'BA-2'],
    ['Eduardo', 'Eduardo Henrique Cardoso', 'BA-MC'],
    ['Caio', 'Caio Oliveira Rocha', 'BA-MC'],
    ['RafaelM', 'Rafael Martins Pereira', 'BA-MC'],
    ['Rafaela', 'Rafaela Cristina Barros', 'BA-LR'],
    ['Humberto', 'Humberto Almeida Costa', 'BA-CE'],
  ]},
  { nome: 'Feirista', turno: 'Feirista', membros: [
    ['Joao', 'Joao Batista Santos', 'BA-2'],
    ['Jose', 'Jose Roberto Silva', 'BA-2'],
    ['PedroF', 'Pedro Augusto Rocha', 'BA-2'],
    ['Maria', 'Maria Aparecida Lima', 'BA-2'],
    ['Ana', 'Ana Carolina Souza', 'BA-2'],
    ['Camila', 'Camila Regina Oliveira', 'BA-2'],
  ]},
];

for (const eq of equipes) {
  for (const [guerra, nome, cargo] of eq.membros) {
    SAMPLE_BOMBEIROS.push(makeBombeiro(guerra, nome, cargo, eq.nome, eq.turno, idx++));
  }
}
// Total: 10+10+10+10+6 = 46 bombeiros

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtDate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getCargoLabel(cargo) {
  const labels = {
    'BA-2': 'BA-2 - Bombeiro de Aeródromo',
    'BA-MC': 'BA-MC - Motorista/Operador de CCI',
    'BA-CE': 'BA-CE - Chefe de Equipe',
    'BA-LR': 'BA-LR - Líder de Resgate',
    'BA-RE': 'BA-RE - Resgatista',
    'GS': 'GS - Gerente de Seção Contra Incêndio',
    'OC': 'OC - Operador de Comunicações',
  };
  return labels[cargo] || cargo;
}

// ─── Step 1: Load or save bombeiros ─────────────────────────────────────────
const bombeirosPath = join(process.env.LOCALAPPDATA || '', 'sescinc-bombeiros.json');

let bombeiros;
if (existsSync(bombeirosPath)) {
  const raw = readFileSync(bombeirosPath, 'utf-8');
  bombeiros = JSON.parse(raw);
  console.log(`Loaded ${bombeiros.length} bombeiros from localStorage`);
  // Insert into Supabase so services that read from DB can find them
  const bombeiroRows = bombeiros.map(b => ({
    id: b.id, matricula: b.matricula, nome_completo: b.nomeCompleto, nome_guerra: b.nomeGuerra,
    email: b.email, data_nascimento: b.dataNascimento, idade: b.idade, data_admissao: b.dataAdmissao,
    cargo: b.cargo, equipe: b.equipe, turno: b.turno, tipo_sanguineo: b.tipoSanguineo,
    cpf: b.cpf, rg: b.rg, cnh_numero: b.cnhNumero, cnh_categoria: b.cnhCategoria,
    cnh_validade: b.cnhValidade,
    foto: b.foto, data_desligamento: b.dataDesligamento,
    endereco: b.endereco, numero_endereco: b.numeroEndereco, complemento: b.complemento,
    cep: b.cep, uf: b.uf, municipio: b.municipio, celular: b.celular, sexo: b.sexo,
    curso_chefe_equipe: b.cursoChefeEquipe, curso_motorista_cci: b.cursoMotoristaCCI,
    created_at: b.createdAt, updated_at: b.updatedAt,
  }));
  const { error: bombeiroInsertErr } = await supabase.from('bombeiros').upsert(bombeiroRows, { onConflict: 'id', ignore: true });
  if (bombeiroInsertErr) console.error('Warning: could not upsert bombeiros:', bombeiroInsertErr.message);
  else console.log('Upserted bombeiros into Supabase');
} else {
  bombeiros = SAMPLE_BOMBEIROS.map(b => ({
    id: randomUUID(),
    ...b,
    dataNascimento: '1990-01-15',
    idade: 36,
    dataAdmissao: '2020-03-01',
    tipoSanguineo: 'O+',
    rg: 'MG-12.345.678',
    cnhNumero: '12345678901',
    cnhCategoria: 'B',
    cnhValidade: '2028-12-31',
    credencialValidade: '2028-12-31',
    foto: '',
    dataDesligamento: '',
    endereco: 'Rua Exemplo, 100',
    numeroEndereco: '100',
    complemento: '',
    cep: '01001000',
    uf: 'SP',
    municipio: 'São Paulo',
    celular: '(11) 99999-0001',
    sexo: b.nomeCompleto.includes('Luciana') || b.nomeCompleto.includes('Patricia') || b.nomeCompleto.includes('Rafaela') || b.nomeCompleto.includes('Amanda') ? 'F' : 'M',
    cursoChefeEquipe: b.cargo === 'BA-CE',
    cursoMotoristaCCI: b.cargo === 'BA-MC',
    cursoCVE: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  writeFileSync(bombeirosPath, JSON.stringify(bombeiros, null, 2));
  // Also insert into Supabase so services that read from DB can find them
  const { error: bombeiroInsertErr } = await supabase.from('bombeiros').upsert(
    bombeiros.map(b => ({
      id: b.id, matricula: b.matricula, nome_completo: b.nomeCompleto, nome_guerra: b.nomeGuerra,
      email: b.email, data_nascimento: b.dataNascimento, idade: b.idade, data_admissao: b.dataAdmissao,
      cargo: b.cargo, equipe: b.equipe, turno: b.turno, tipo_sanguineo: b.tipoSanguineo,
      cpf: b.cpf, rg: b.rg, cnh_numero: b.cnhNumero, cnh_categoria: b.cnhCategoria,
      cnh_validade: b.cnhValidade,
      foto: b.foto, data_desligamento: b.dataDesligamento,
      endereco: b.endereco, numero_endereco: b.numeroEndereco, complemento: b.complemento,
      cep: b.cep, uf: b.uf, municipio: b.municipio, celular: b.celular, sexo: b.sexo,
      curso_chefe_equipe: b.cursoChefeEquipe, curso_motorista_cci: b.cursoMotoristaCCI,
      created_at: b.createdAt, updated_at: b.updatedAt,
    })),
    { onConflict: 'id', ignore: true },
  );
  if (bombeiroInsertErr) console.error('Warning: could not insert bombeiros to Supabase:', bombeiroInsertErr.message);
  else console.log(`Inserted/upserted ${bombeiros.length} bombeiros into Supabase`);
}

// ─── Step 2: Find or create the document template ───────────────────────────
const DOC_NAME = 'FORMULARIO DE TROCA DE SERVICOS (PERMUTA)';

let doc;
const { data: docs } = await supabase.from('documents').select('*').eq('active', true);
const existing = docs?.find(d => d.name === DOC_NAME);

if (existing) {
  doc = existing;
  console.log(`Found existing document: "${doc.name}" (${doc.id})`);
} else {
  const { data: created, error: createErr } = await supabase.from('documents').insert({
    name: DOC_NAME,
    description: 'Formulario de Troca de Servicos - Permuta',
    category: 'administrativo',
    template_pdf_url: null,
    active: true,
    template_pdf_pages: 0,
    template_pdf_width: 0,
    template_pdf_height: 0,
    source_module: 'trocas',
    created_by: null,
  }).select().single();
  if (createErr) { console.error('Failed to create document:', createErr); process.exit(1); }
  doc = created;
  console.log(`Created document: "${doc.name}" (${doc.id})`);

  // Create fields from template
  const TEMPLATE_FIELDS = [
    { field_name: 'nome_solicitante', field_label: 'Nome do Solicitante', field_type: 'text', required: true, placeholder: 'Digite o nome...', options: null, data_source: 'solicitante.nome', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 180, height: 20 },
    { field_name: 'cpf_solicitante', field_label: 'CPF do Solicitante', field_type: 'text', required: true, placeholder: null, options: null, data_source: 'solicitante.cpf', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 120, height: 20 },
    { field_name: 'data_solicitada', field_label: 'Data Solicitada', field_type: 'date', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 100, height: 20 },
    { field_name: 'funcao_solicitante', field_label: 'Funcao do Solicitante', field_type: 'text', required: true, placeholder: null, options: null, data_source: 'solicitante.funcao', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 250, height: 20 },
    { field_name: 'motivo_troca', field_label: 'Motivo da Troca', field_type: 'textarea', required: true, placeholder: 'Descreva o motivo da troca...', options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 200, height: 40 },
    { field_name: 'nome_solicitado', field_label: 'Nome do Solicitado', field_type: 'text', required: true, placeholder: 'Digite o nome...', options: null, data_source: 'solicitado.nome', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 180, height: 20 },
    { field_name: 'cpf_solicitado', field_label: 'CPF do Solicitado', field_type: 'text', required: true, placeholder: null, options: null, data_source: 'solicitado.cpf', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 120, height: 20 },
    { field_name: 'data_folga_solicitado', field_label: 'Data da Folga do Solicitado', field_type: 'date', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 100, height: 20 },
    { field_name: 'troca_emergencial', field_label: 'Troca Emergencial', field_type: 'checkbox', required: true, placeholder: null, options: ['SIM', 'NAO'], data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 40, height: 20 },
    { field_name: 'justificativa_emergencial', field_label: 'Justificativa Emergencial', field_type: 'textarea', required: true, placeholder: 'Informe a justificativa...', options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: 'troca_emergencial=SIM', font_size: 12, width: 200, height: 40 },
    { field_name: 'deferido_indeferido', field_label: 'Parecer do Embaixador', field_type: 'checkbox', required: true, placeholder: null, options: ['DEFERIDO', 'INDEFERIDO'], data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 12, width: 40, height: 20 },
    { field_name: 'check_troca_sim', field_label: '✓ Sim', field_type: 'text', required: false, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 18, width: 70, height: 26 },
    { field_name: 'check_troca_nao', field_label: '✓ Não', field_type: 'text', required: false, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 18, width: 70, height: 26 },
    { field_name: 'check_deferido', field_label: '✓ Deferido', field_type: 'text', required: false, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 18, width: 130, height: 26 },
    { field_name: 'check_indeferido', field_label: '✓ Indeferido', field_type: 'text', required: false, placeholder: null, options: null, data_source: 'manual', is_signature: false, signer_role: null, read_only: false, conditional_on: null, font_size: 18, width: 150, height: 26 },
    { field_name: 'assinatura_solicitante', field_label: 'Assinatura do Solicitante', field_type: 'signature', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: true, signer_role: 'Solicitante', read_only: false, conditional_on: null, font_size: 12, width: 150, height: 30 },
    { field_name: 'assinatura_solicitado', field_label: 'Assinatura do Solicitado', field_type: 'signature', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: true, signer_role: 'Solicitado', read_only: false, conditional_on: null, font_size: 12, width: 150, height: 30 },
    { field_name: 'assinatura_chefe_solicitante', field_label: 'Assinatura Chefe de Equipe (Solicitante)', field_type: 'signature', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: true, signer_role: 'Chefe de Equipe (Solicitante)', read_only: false, conditional_on: null, font_size: 12, width: 150, height: 30 },
    { field_name: 'assinatura_chefe_solicitado', field_label: 'Assinatura Chefe de Equipe (Solicitado)', field_type: 'signature', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: true, signer_role: 'Chefe de Equipe (Solicitado)', read_only: false, conditional_on: null, font_size: 12, width: 150, height: 30 },
    { field_name: 'assinatura_gerente', field_label: 'Assinatura do Gerente', field_type: 'signature', required: true, placeholder: null, options: null, data_source: 'manual', is_signature: true, signer_role: 'Gerente', read_only: false, conditional_on: null, font_size: 12, width: 150, height: 30 },
    { field_name: 'data_autentique_1', field_label: 'Data Assinatura Solicitante', field_type: 'date', required: false, placeholder: null, options: null, data_source: 'autentique_assinatura', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 100, height: 18 },
    { field_name: 'data_autentique_2', field_label: 'Data Assinatura Solicitado', field_type: 'date', required: false, placeholder: null, options: null, data_source: 'autentique_assinatura', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 100, height: 18 },
    { field_name: 'data_autentique_3', field_label: 'Data Assinatura Gestor', field_type: 'date', required: false, placeholder: null, options: null, data_source: 'autentique_assinatura', is_signature: false, signer_role: null, read_only: true, conditional_on: null, font_size: 12, width: 100, height: 18 },
  ];

  const fieldRows = TEMPLATE_FIELDS.map((f, i) => ({
    document_id: doc.id,
    field_name: f.field_name,
    field_label: f.field_label,
    field_type: f.field_type,
    required: f.required,
    placeholder: f.placeholder,
    options: f.options,
    order_index: i,
    page: 1,
    x: 0, y: 0,
    width: f.width,
    height: f.height,
    font_size: f.font_size,
    data_source: f.data_source,
    is_signature: f.is_signature,
    signer_role: f.signer_role,
    read_only: f.read_only,
    conditional_on: f.conditional_on,
  }));

  const { error: fieldsErr } = await supabase.from('document_fields').insert(fieldRows);
  if (fieldsErr) { console.error('Failed to create fields:', fieldsErr); process.exit(1); }

  // Create signers
  const SIGNERS = [
    { signer_name: 'Solicitante', signer_role: 'Solicitante', order_index: 1 },
    { signer_name: 'Solicitado', signer_role: 'Solicitado', order_index: 2 },
    { signer_name: 'Chefe de Equipe (Solicitante)', signer_role: 'Chefe de Equipe', order_index: 3 },
    { signer_name: 'Chefe de Equipe (Solicitado)', signer_role: 'Chefe de Equipe', order_index: 4 },
    { signer_name: 'Gerente', signer_role: 'Gerente', order_index: 5 },
  ];

  const { error: signersErr } = await supabase.from('document_signers').insert(
    SIGNERS.map(s => ({ document_id: doc.id, ...s, required: true }))
  );
  if (signersErr) { console.error('Failed to create signers:', signersErr); process.exit(1); }

  console.log('  -> Created fields and signers');
}

// ─── Step 3: Build 15 troca fills ───────────────────────────────────────────

const MOTIVOS = [
  'Problema de saúde na família, necessitando acompanhamento médico',
  'Compromisso particular inadiável',
  'Concurso público agendado',
  'Consulta médica especializada',
  'Problemas pessoais a serem resolvidos',
  'Casamento de familiar',
  'Viagem de emergência',
  'Acompanhamento de dependente em tratamento',
  'Prova de faculdade',
  'Questões bancárias urgentes',
];

const STATUS_POOL = ['draft', 'pending', 'signed'];

// People we'll use repeatedly to test the >3 trocas limit
// Carlos (index 0), Amanda (index 15) will be heavy users
const sol = b => b.nomeCompleto;
const cargo = b => b.cargo;
const cpf = b => b.cpf;

const heavyUser = getB('Carlos'); // Carlos Alberto Silva (Alfa, BA-2)
const heavyUser2 = getB('Roberto'); // Amanda Cristina Vieira (Alfa, BA-2)
function getB(nomeGuerra) { return bombeiros.find(b => b.nomeGuerra === nomeGuerra); }

function buildFill({ solicitante, solicitado, dataSolicitada, dataFolga, emergencial = false, deferido = false, status, createdDay, funcaoSolicitanteOverride, funcaoSolicitadoOverride }) {
  const isEmergencial = emergencial;
  const isDeferido = deferido;
  const data = new Date(2026, 6, createdDay);

  const filled_data = {
    nome_solicitante: sol(solicitante),
    cpf_solicitante: cpf(solicitante),
    nome_solicitado: sol(solicitado),
    cpf_solicitado: cpf(solicitado),
    funcao_solicitante: funcaoSolicitanteOverride || cargo(solicitante),
    funcao_solicitado: funcaoSolicitadoOverride || cargo(solicitado),
    data_solicitada: fmtDate(dataSolicitada),
    data_folga_solicitado: fmtDate(dataFolga),
    motivo_troca: pick(MOTIVOS),
    troca_emergencial: isEmergencial ? 'SIM' : '',
    justificativa_emergencial: isEmergencial ? 'Emergência médica comprovada por atestado apresentado ao chefe de equipe.' : '',
    deferido_indeferido: isDeferido ? 'DEFERIDO' : '',
    check_troca_sim: isEmergencial ? 'V' : '',
    check_troca_nao: isEmergencial ? '' : 'V',
    check_deferido: isDeferido ? 'V' : '',
    check_indeferido: isDeferido ? '' : 'V',
    criado_por: `Administrador`,
    autorizado_por: isDeferido ? 'GS Carlos Alberto' : '',
    data_autorizacao: isDeferido ? fmtDate(new Date(2026, 6, createdDay + 1)) : '',
    assinatura_solicitante: '',
    assinatura_solicitado: '',
    assinatura_chefe_solicitante: '',
    assinatura_chefe_solicitado: '',
    assinatura_gerente: '',
    data_autentique_1: '',
    data_autentique_2: '',
    data_autentique_3: '',
  };

  return {
    document_id: doc.id,
    filled_by: 'admin@sescinc.com',
    filled_data,
    status,
    autentique_document_id: null,
    autentique_link: null,
    created_at: data.toISOString(),
    updated_at: data.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILL SCENARIOS (15 total)
// ═══════════════════════════════════════════════════════════════════════════════

const fills = [];

// ── Carlos (heavy user - 4 trocas in same month to test the >3 limit) ──────
// 1. Carlos (BA-2, Alfa) ─ swap with Andre (BA-RE, Bravo), same function, normal
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Marcos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 1,
}));

// 2. Carlos (BA-2, Alfa) ─ swap with Luciana (BA-2, Charlie), different turn (Diurno x Diurno), same function
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Luciana'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'pending', createdDay: 3,
}));

// 3. Carlos (BA-2) ─ swap with Thiago (BA-2, Delta), different turn (Diurno x Noturno)
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Thiago'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'pending', createdDay: 5,
}));

// 4. Carlos (BA-2) ─ swap with Marcos (BA-2, Bravo), 4th troca this month (exceeding limit!)
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Marcos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'draft', createdDay: 7,
}));

// ── Amanda (heavy user 2 - 3 trocas, at the limit) ─────────────────────────
// 5. Amanda (BA-2, Alfa) ─ swap with Patricia (BA-MC, Charlie)
fills.push(buildFill({
  solicitante: getB('Amanda'), solicitado: getB('Patricia'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 2,
}));

// 6. Amanda (BA-2) ─ swap with Gabriel (BA-RE, Charlie), different function
fills.push(buildFill({
  solicitante: getB('Amanda'), solicitado: getB('Thiago'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 4,
  funcaoSolicitanteOverride: 'BA-2', funcaoSolicitadoOverride: 'BA-RE',
}));

// 7. Amanda (BA-2) ─ swap with Eduardo (BA-MC, Delta), 3rd troca (at the limit!)
fills.push(buildFill({
  solicitante: getB('Amanda'), solicitado: getB('Eduardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'pending', createdDay: 6,
  funcaoSolicitanteOverride: 'BA-2', funcaoSolicitadoOverride: 'BA-MC',
}));

// ── Other varied scenarios ──────────────────────────────────────────────────
// 8. Roberto (BA-CE, Alfa) ─ Paulo (BA-MC, Bravo), diff functions, diff turns
fills.push(buildFill({
  solicitante: getB('Roberto'), solicitado: getB('Paulo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 8,
  funcaoSolicitanteOverride: 'BA-CE', funcaoSolicitadoOverride: 'BA-MC',
}));

// 9. Luciana (BA-2, Charlie) ─ Julio (BA-LR, Alfa), diff functions
fills.push(buildFill({
  solicitante: getB('Luciana'), solicitado: getB('Julio'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'draft', createdDay: 9,
  funcaoSolicitanteOverride: 'BA-2', funcaoSolicitadoOverride: 'BA-LR',
}));

// 10. Thiago (BA-2, Delta) ─ Rafaela (BA-LR, Delta), same equipe, diff functions
fills.push(buildFill({
  solicitante: getB('Thiago'), solicitado: getB('Rafaela'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'pending', createdDay: 10,
  funcaoSolicitanteOverride: 'BA-2', funcaoSolicitadoOverride: 'BA-LR',
}));

// 11. Fernando (BA-MC, Alfa) ─ Roberto (BA-CE, Alfa), same equipe
fills.push(buildFill({
  solicitante: getB('Fernando'), solicitado: getB('Roberto'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 11,
  funcaoSolicitanteOverride: 'BA-MC', funcaoSolicitadoOverride: 'BA-CE',
}));

// 12. Emergency swap ─ Gabriel (BA-RE, Charlie) ─ Bruno (BA-CE, Charlie)
fills.push(buildFill({
  solicitante: getB('Thiago'), solicitado: getB('Bruno'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 12,
}));

// 13. Patricia (BA-MC, Charlie) ─ Luciana (BA-2, Charlie), same equipe, diff func
fills.push(buildFill({
  solicitante: getB('Patricia'), solicitado: getB('Luciana'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'draft', createdDay: 13,
  funcaoSolicitanteOverride: 'BA-MC', funcaoSolicitadoOverride: 'BA-2',
}));

// 14. Andre (BA-RE, Bravo) ─ Marcos (BA-2, Bravo), same equipe, diff func
fills.push(buildFill({
  solicitante: getB('Marcos'), solicitado: getB('Marcos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'pending', createdDay: 14,
  funcaoSolicitanteOverride: 'BA-RE', funcaoSolicitadoOverride: 'BA-2',
}));

// 15. Eduardo (BA-MC, Delta) ─ Rafaela (BA-LR, Delta), same equipe
fills.push(buildFill({
  solicitante: getB('Eduardo'), solicitado: getB('Rafaela'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 15,
  funcaoSolicitanteOverride: 'BA-MC', funcaoSolicitadoOverride: 'BA-LR',
}));

// 16. Luciana (BA-2, Charlie-Diurno) ─ Thiago (BA-2, Delta-Noturno) → TURNOS DIFERENTES
fills.push(buildFill({
  solicitante: getB('Luciana'), solicitado: getB('Thiago'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 16,
}));

// 17. Patricia (BA-MC, Charlie-Diurno) ─ Eduardo (BA-MC, Delta-Noturno) → TURNOS DIFERENTES
fills.push(buildFill({
  solicitante: getB('Patricia'), solicitado: getB('Eduardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'pending', createdDay: 17,
}));

// 18. Gabriel (BA-RE, Charlie-Diurno) ─ Marcos (BA-2, Bravo-Noturno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Thiago'), solicitado: getB('Marcos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 18,
  funcaoSolicitanteOverride: 'BA-RE', funcaoSolicitadoOverride: 'BA-2',
}));

// 19. Roberto (BA-CE, Alfa-Diurno) ─ Ricardo (BA-CE, Bravo-Noturno) → TURNOS DIFERENTES (mesma função)
fills.push(buildFill({
  solicitante: getB('Roberto'), solicitado: getB('Ricardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'draft', createdDay: 19,
}));

// 20. Fernando (BA-MC, Alfa-Diurno) ─ Paulo (BA-MC, Bravo-Noturno) → TURNOS DIFERENTES (mesma função)
fills.push(buildFill({
  solicitante: getB('Fernando'), solicitado: getB('Paulo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 20,
}));

// 21. Julio (BA-LR, Alfa-Diurno) ─ Rafaela (BA-LR, Delta-Noturno) → TURNOS DIFERENTES (mesma função)
fills.push(buildFill({
  solicitante: getB('Julio'), solicitado: getB('Rafaela'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'pending', createdDay: 21,
}));

// 22. Carlos (BA-2, Alfa-Diurno) ─ Thiago (BA-2, Delta-Noturno) → TURNOS DIFERENTES + EXCEDEU LIMITE (4ª troca)
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Thiago'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 22,
}));

// 23. Carlos (BA-2, Alfa-Diurno) ─ Marcos (BA-2, Bravo-Noturno) → TURNOS DIFERENTES + EXCEDEU LIMITE (5ª troca)
fills.push(buildFill({
  solicitante: getB('Carlos'), solicitado: getB('Marcos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 23,
}));

// 24. Patricia (BA-MC, Charlie-Diurno) ─ Paulo (BA-MC, Bravo-Noturno) → TURNOS + FUNÇÕES DIFERENTES (BA-MC x BA-MC mas equipes inversas)
fills.push(buildFill({
  solicitante: getB('Patricia'), solicitado: getB('Paulo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'draft', createdDay: 24,
}));

// 25. Amanda (BA-2, Alfa-Diurno) ─ Ricardo (BA-CE, Bravo-Noturno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Amanda'), solicitado: getB('Ricardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 25,
  funcaoSolicitanteOverride: 'BA-2', funcaoSolicitadoOverride: 'BA-CE',
}));

// 26. Roberto (BA-CE, Alfa-Diurno) ─ Carlos (BA-2, Alfa-Diurno) → MESMA EQUIPE, MESMO TURNO (para contraste)
fills.push(buildFill({
  solicitante: getB('Roberto'), solicitado: getB('Carlos'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 26,
  funcaoSolicitanteOverride: 'BA-CE', funcaoSolicitadoOverride: 'BA-2',
}));

// 27. Fernando (BA-MC, Alfa-Diurno) ─ Ricardo (BA-CE, Bravo-Noturno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Fernando'), solicitado: getB('Ricardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'signed', createdDay: 27,
  funcaoSolicitanteOverride: 'BA-MC', funcaoSolicitadoOverride: 'BA-CE',
}));

// 28. Bruno (BA-CE, Charlie-Diurno) ─ Paulo (BA-MC, Bravo-Noturno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Bruno'), solicitado: getB('Paulo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: true, deferido: true, status: 'signed', createdDay: 28,
  funcaoSolicitanteOverride: 'BA-CE', funcaoSolicitadoOverride: 'BA-MC',
}));

// 29. Rafaela (BA-LR, Delta-Noturno) ─ Roberto (BA-CE, Alfa-Diurno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Rafaela'), solicitado: getB('Roberto'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: false, status: 'draft', createdDay: 29,
  funcaoSolicitanteOverride: 'BA-LR', funcaoSolicitadoOverride: 'BA-CE',
}));

// 30. Gabriel (BA-RE, Charlie-Diurno) ─ Eduardo (BA-MC, Delta-Noturno) → TURNOS + FUNÇÕES DIFERENTES
fills.push(buildFill({
  solicitante: getB('Thiago'), solicitado: getB('Eduardo'),
  dataSolicitada: new Date(2026, 6, ), dataFolga: new Date(2026, 6, ),
  emergencial: false, deferido: true, status: 'pending', createdDay: 30,
  funcaoSolicitanteOverride: 'BA-RE', funcaoSolicitadoOverride: 'BA-MC',
}));

// ─── Step 4: Insert fills ──────────────────────────────────────────────────
const { error: deleteErr } = await supabase.from('document_fills').delete().eq('document_id', doc.id);
if (deleteErr) { console.error('Failed to clear existing fills:', deleteErr); }
console.log('Cleared existing fills for this document');

const { data: inserted, error: insertErr } = await supabase.from('document_fills').insert(fills).select();
if (insertErr) { console.error('Failed to insert fills:', insertErr); process.exit(1); }

console.log(`\n✅ Inserted ${inserted.length} troca fills!\n`);

// ─── Summary ────────────────────────────────────────────────────────────────
const statusCounts = {};
const solicitantes = {};
for (const f of inserted) {
  const fd = f.filled_data;
  statusCounts[fd.status || f.status] = (statusCounts[fd.status || f.status] || 0) + 1;
  const nome = fd.nome_solicitante;
  solicitantes[nome] = (solicitantes[nome] || 0) + 1;
}

console.log('📊 Status distribution:');
for (const [st, count] of Object.entries(statusCounts)) {
  console.log(`   ${st}: ${count}`);
}

console.log('\n📊 Trocas per solicitante:');
const sorted = Object.entries(solicitantes).sort((a, b) => b[1] - a[1]);
for (const [nome, count] of sorted) {
  const flag = count > 3 ? ' ⚠️ EXCEDEU LIMITE (mais de 3)' : count === 3 ? ' (no limite)' : '';
  console.log(`   ${nome}: ${count}${flag}`);
}

// ─── Clean up bombeiros with created_at dates ──────────────────────────────
const cleanBombeiros = bombeiros.map(b => ({
  id: b.id,
  matricula: b.matricula,
  nomeCompleto: b.nomeCompleto,
  nomeGuerra: b.nomeGuerra,
  email: b.email,
  dataNascimento: b.dataNascimento,
  idade: b.idade,
  dataAdmissao: b.dataAdmissao,
  cargo: b.cargo,
  equipe: b.equipe,
  turno: b.turno,
  tipoSanguineo: b.tipoSanguineo,
  cpf: b.cpf,
  rg: b.rg,
  cnhNumero: b.cnhNumero,
  cnhCategoria: b.cnhCategoria,
  cnhValidade: b.cnhValidade,
  credencialValidade: b.credencialValidade,
  foto: b.foto,
  dataDesligamento: b.dataDesligamento,
  endereco: b.endereco,
  numeroEndereco: b.numeroEndereco,
  complemento: b.complemento,
  cep: b.cep,
  uf: b.uf,
  municipio: b.municipio,
  celular: b.celular,
  sexo: b.sexo,
  cursoChefeEquipe: b.cursoChefeEquipe,
  cursoMotoristaCCI: b.cursoMotoristaCCI,
  cursoCVE: b.cursoCVE,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
}));

// ─── Seed PTR-BA records ────────────────────────────────────────────
const PTRB_RECORDS = [
  { equipe: 'Alfa', data: '2026-07-18', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '14. PCINC - Procedimentos de Combate a Incêndio', duracao: '01:00' },
  { equipe: 'Alfa', data: '2026-07-18', hora_inicio: '09:00', hora_termino: '10:00', assunto_ministrado: '15. EQUIPAMENTOS DE PROTEÇÃO - Revisão de EPIs', duracao: '01:00' },
  { equipe: 'Alfa', data: '2026-07-25', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '20. OPERAÇÕES AERONÁUTICAS - Procedimentos de resgate', duracao: '01:00' },
  { equipe: 'Bravo', data: '2026-07-18', hora_inicio: '19:30', hora_termino: '20:30', assunto_ministrado: '14. PCINC - Revisão de técnicas', duracao: '01:00' },
  { equipe: 'Charlie', data: '2026-07-18', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '18. MANUSEIO DE MANGUEIRAS - Prática operacional', duracao: '01:00' },
  { equipe: 'Delta', data: '2026-07-18', hora_inicio: '19:30', hora_termino: '20:30', assunto_ministrado: '12. RONDA OPERACIONAL - Verificação de equipamentos', duracao: '01:00' },
  { equipe: 'Alfa', data: '2026-07-02', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '10. INSTRUÇÃO GERAL - Procedimentos de segurança', duracao: '01:00' },
  { equipe: 'Alfa', data: '2026-07-04', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '11. COMBATE A INCÊNDIO - Técnicas avançadas', duracao: '01:00' },
  { equipe: 'Bravo', data: '2026-07-05', hora_inicio: '19:30', hora_termino: '20:30', assunto_ministrado: '09. PRIMEIROS SOCORROS - Atualização', duracao: '01:00' },
  { equipe: 'Charlie', data: '2026-07-08', hora_inicio: '07:30', hora_termino: '08:30', assunto_ministrado: '13. EQUIPAMENTOS DE RESGATE - Verificação', duracao: '01:00' },
  { equipe: 'Delta', data: '2026-07-12', hora_inicio: '19:30', hora_termino: '20:30', assunto_ministrado: '16. SIMULADO DE EMERGÊNCIA - Procedimentos', duracao: '01:00' },
];
const { error: ptrbError } = await supabase.from('ptrb_registros').insert(
  PTRB_RECORDS.map(r => ({
    id: randomUUID(), created_by: 'seed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    data: r.data, hora_inicio: r.hora_inicio, hora_termino: r.hora_termino, duracao: r.duracao,
    equipe: r.equipe, turno: r.equipe === 'Alfa' || r.equipe === 'Charlie' ? 'Diurno' : 'Noturno',
    assunto_ministrado: r.assunto_ministrado, descricao: r.assunto_ministrado, instrutor: 'Instrutor',
    participantes: [], observacoes: '',
  }))
);
if (ptrbError) console.error('Warning: could not insert PTR-BA records:', ptrbError.message);
else console.log(`Inserted ${PTRB_RECORDS.length} PTR-BA records`);

writeFileSync(bombeirosPath, JSON.stringify(cleanBombeiros, null, 2));
console.log(`\n✅ Bombeiros data saved to ${bombeirosPath}`);

console.log('\nDone!');
