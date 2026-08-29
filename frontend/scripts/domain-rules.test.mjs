import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(repoRoot, 'node_modules', '.tmp', 'domain-rules-cjs');
const filesToCompile = [
  'src/types/bombeiro.ts',
  'src/types/escala.ts',
  'src/types/ferias.ts',
  'src/types/tpepr.ts',
  'src/types/substituicaoTemporaria.ts',
  'src/utils/datas.ts',
  'src/utils/tempo.ts',
  'src/utils/equipes.ts',
  'src/utils/efetivoOperacional.ts',
  'src/utils/regrasOperacionais.ts',
  'src/utils/validacaoCursos.ts',
];

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(path.join(outRoot, 'package.json'), '{"type":"commonjs"}\n');

for (const rel of filesToCompile) {
  const sourcePath = path.join(repoRoot, rel);
  const outPath = path.join(outRoot, rel).replace(/\.ts$/, '.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  }).outputText;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
}

const requireFromTest = createRequire(import.meta.url);
const regras = requireFromTest(path.join(outRoot, 'src/utils/regrasOperacionais.js'));
const cursos = requireFromTest(path.join(outRoot, 'src/utils/validacaoCursos.js'));
const equipesUtils = requireFromTest(path.join(outRoot, 'src/utils/equipes.js'));
const efetivoOperacional = requireFromTest(path.join(outRoot, 'src/utils/efetivoOperacional.js'));
const tpepr = requireFromTest(path.join(outRoot, 'src/types/tpepr.js'));

const {
  validarFeriasGozo,
  validarEscalaDiaria,
  validarSubstituicaoTemporaria,
  diasInclusivos,
} = regras;
const {
  horarioPlantaoPorEquipe,
  dataSaidaPlantao,
  equipesNoDia,
} = equipesUtils;
const {
  calcularQuartaTomada,
  normalizarParticipantesTPEPR,
} = tpepr;
const {
  montarEfetivoOperacional,
  montarTrocasServicoDoDia,
} = efetivoOperacional;

const base = {
  matricula: '',
  nome: '',
  email: '',
  dataNascimento: '',
  idade: 30,
  dataAdmissao: '2020-01-01',
  turno: 'Diurno',
  tipoSanguineo: '',
  cpf: '',
  rg: '',
  cnhNumero: '',
  cnhCategoria: 'D',
  cnhValidade: '2030-01-01',
  credencialValidade: '',
  foto: '',
  dataDesligamento: '',
  endereco: '',
  numeroEndereco: '',
  complemento: '',
  bairro: '',
  cep: '',
  uf: '',
  municipio: '',
  celular: '',
  sexo: 'M',
  cursoChefeEquipe: true,
  cursoMotoristaCCI: true,
  cursoCVE: true,
  cveValidade: '2030-01-01',
  createdAt: '',
  updatedAt: '',
};

function bombeiro(id, cargo, equipe, nome = id) {
  return {
    ...base,
    id,
    cargo,
    equipe,
    nome,
    nomeCompleto: nome,
    nomeGuerra: nome,
  };
}

const ce = bombeiro('ce', 'BA-CE', 'Alfa', 'Chefe');
const lr = bombeiro('lr', 'BA-LR', 'Alfa', 'Lider');
const ba2 = bombeiro('ba2', 'BA-2', 'Alfa', 'BA2');
const mc = bombeiro('mc', 'BA-MC', 'Alfa', 'MC');
const ferista = bombeiro('fer', 'BA-MC', 'Ferista', 'Ferista');
const apoio = bombeiro('apoio', 'BA-2', 'Bravo', 'Apoio');
const bombeiros = [ce, lr, ba2, mc, ferista, apoio];

function gozo(funcionario, overrides = {}) {
  return {
    funcionarioId: funcionario.id,
    funcionarioNome: funcionario.nomeCompleto,
    equipe: funcionario.equipe,
    periodoNumero: 1,
    dataInicio: '2026-08-01',
    dataFim: '2026-08-30',
    dias: 30,
    status: 'Programadas',
    substitutoId: '',
    substitutoNome: '',
    funcaoSubstituicao: '',
    observacoes: '',
    modificadoPor: 'test',
    bloqueado: false,
    ...overrides,
  };
}

assert.equal(diasInclusivos('2026-08-01', '2026-08-30'), 30);
assert.deepEqual(equipesNoDia(new Date('2026-07-21T12:00:00')), ['Alfa', 'Bravo']);
assert.deepEqual(equipesNoDia(new Date('2026-07-22T12:00:00')), ['Charlie', 'Delta']);
assert.deepEqual(horarioPlantaoPorEquipe('Alfa'), {
  horarioInicio: '07:00',
  horarioTermino: '19:00',
  turno: 'Diurno',
  tipo: 'diurno (12h)',
});
assert.deepEqual(horarioPlantaoPorEquipe('Charlie'), {
  horarioInicio: '07:00',
  horarioTermino: '19:00',
  turno: 'Diurno',
  tipo: 'diurno (12h)',
});
assert.deepEqual(horarioPlantaoPorEquipe('Bravo'), {
  horarioInicio: '19:00',
  horarioTermino: '07:00',
  turno: 'Noturno',
  tipo: 'noturno (12h)',
});
assert.deepEqual(horarioPlantaoPorEquipe('Delta'), {
  horarioInicio: '19:00',
  horarioTermino: '07:00',
  turno: 'Noturno',
  tipo: 'noturno (12h)',
});
assert.equal(dataSaidaPlantao('Alfa', '2026-07-21'), '2026-07-21');
assert.equal(dataSaidaPlantao('Bravo', '2026-07-21'), '2026-07-22');
assert.equal(calcularQuartaTomada('02:00', '03:42'), '01:00');
assert.equal(calcularQuartaTomada('02:00', '03:00'), '00:35');
assert.equal(
  normalizarParticipantesTPEPR([{
    pessoaId: 'p1',
    nomeCompleto: 'Participante',
    nomeGuerra: 'P1',
    funcao: 'BA-CE',
    primeiraTomada: '01:00',
    segundaTomada: '02:00',
    terceiraTomada: '03:42',
    quartaTomada: '09:59',
  }])[0].quartaTomada,
  '01:00',
);

assert.match(
  validarFeriasGozo({ gozo: gozo(ce), funcionario: ce, bombeiros }).join('\n'),
  /precisa de substituto/,
);

assert.deepEqual(
  validarFeriasGozo({ gozo: gozo(ferista), funcionario: ferista, bombeiros }),
  [],
);

assert.match(
  validarFeriasGozo({
    gozo: gozo(ba2, { substitutoId: mc.id, substitutoNome: mc.nomeCompleto, funcaoSubstituicao: 'BA-2' }),
    funcionario: ba2,
    substituto: mc,
    bombeiros,
  }).join('\n'),
  /nao pode substituir BA-2/,
);

assert.deepEqual(
  validarFeriasGozo({
    gozo: gozo(ba2, { substitutoId: ferista.id, substitutoNome: ferista.nomeCompleto, funcaoSubstituicao: 'BA-2' }),
    funcionario: ba2,
    substituto: ferista,
    bombeiros,
  }),
  [],
);

assert.match(
  validarFeriasGozo({
    gozo: gozo(ce, { substitutoId: ba2.id, substitutoNome: ba2.nomeCompleto, funcaoSubstituicao: 'BA-CE' }),
    funcionario: ce,
    substituto: ba2,
    bombeiros,
  }).join('\n'),
  /ate uma pessoa da equipe Ferista/,
);

assert.deepEqual(
  validarFeriasGozo({
    gozo: gozo(ce, { substitutoId: ba2.id, substitutoNome: ba2.nomeCompleto, funcaoSubstituicao: 'BA-CE' }),
    funcionario: ce,
    substituto: ba2,
    bombeiros,
    cadeia: [{
      pessoaId: ferista.id,
      pessoaNome: ferista.nomeCompleto,
      pessoaCargo: ferista.cargo,
      pessoaEquipe: ferista.equipe,
      cargoVacante: 'BA-2',
      substituindoNome: ba2.nomeCompleto,
    }],
  }),
  [],
);

const escalaBase = {
  createdBy: 'test',
  equipe: 'Charlie',
  chefeEquipe: 'Chefe',
  dataPlantao: '2026-07-22',
  horarioInicio: '07:00',
  horarioTermino: '19:00',
  turno: 'Diurno',
  guarnicoes: {
    cci02: { baMc: 'MC1', baCe: 'CE1', ba2: 'BA21' },
    cci03: { baMc: 'MC2', ba2_1: 'BA22', ba2_2: 'BA23' },
    crs: { baMc: 'MC3', baLr: 'LR1', baRe1: 'RE1', baRe2: 'RE2' },
  },
  bds: { funcao: 'BA-2', nomeGuerra: 'BDS1' },
  ptr1: { funcao: 'BA-2', nomeGuerra: 'PTR1' },
  ptr2: { funcao: 'BA-2', nomeGuerra: 'PTR2' },
  ptr3: { funcao: 'BA-2', nomeGuerra: 'PTR3' },
  atestados: [],
  trocas: [],
  radio: [],
};

assert.deepEqual(validarEscalaDiaria({ escala: escalaBase }), []);
assert.match(
  validarEscalaDiaria({ escala: { ...escalaBase, equipe: 'Alfa' } }).join('\n'),
  /nao esta prevista/,
);
assert.match(
  validarEscalaDiaria({
    escala: escalaBase,
    escalasExistentes: [{ ...escalaBase, id: 'existente', createdAt: '', updatedAt: '' }],
  }).join('\n'),
  /Ja existe escala diaria/,
);
assert.match(
  validarEscalaDiaria({
    escala: {
      ...escalaBase,
      guarnicoes: {
        ...escalaBase.guarnicoes,
        cci02: { ...escalaBase.guarnicoes.cci02, ba2: 'MC1' },
      },
    },
  }).join('\n'),
  /mesma pessoa/,
);

const trocaAssinada = {
  id: 'troca-1',
  status: 'signed',
  filled_data: {
    nome_solicitante: ce.nomeCompleto,
    funcao_solicitante: ce.cargo,
    nome_solicitado: mc.nomeCompleto,
    funcao_solicitado: mc.cargo,
    data_solicitada: '2026-07-21',
    data_folga_solicitado: '2026-07-23',
  },
};

assert.deepEqual(
  montarTrocasServicoDoDia({
    bombeiros,
    trocaFills: [trocaAssinada],
    equipe: 'Alfa',
    dataPlantao: '2026-07-21',
  }),
  [{
    funcaoSaindo: 'BA-CE',
    nomeSaindo: 'Chefe',
    funcaoEntrando: 'BA-MC',
    nomeEntrando: 'MC',
  }],
);

assert.deepEqual(
  montarTrocasServicoDoDia({
    bombeiros,
    trocaFills: [trocaAssinada],
    equipe: 'Charlie',
    dataPlantao: '2026-07-21',
  }),
  [],
);

const efetivoComAtestado = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [],
  trocaFills: [],
  substituicoesTemporarias: [{
    id: 'afastamento-1',
    funcionarioId: lr.id,
    funcionarioNome: lr.nomeCompleto,
    funcionarioCargo: lr.cargo,
    substitutoId: apoio.id,
    substitutoNome: apoio.nomeCompleto,
    substitutoCargo: apoio.cargo,
    tipo: 'Afastamento',
    motivo: 'Atestado Medico',
    motivoOutro: 'Atestado',
    plantaoExtra: 'Sim',
    dataInicio: '2026-07-21',
    dataFim: '2026-07-21',
    dias: 1,
    status: 'Aprovada',
    observacoesRejeicao: '',
    criadoPor: 'test',
    criadoPorNome: 'Test',
    aprovadoPor: 'admin',
    aprovadoPorNome: 'Admin',
    aprovadoEm: '2026-07-21T10:00:00.000Z',
    cadeiaSubstituicao: [{
      tipo: 'extra',
      pessoaId: apoio.id,
      pessoaNome: apoio.nomeCompleto,
      pessoaCargo: apoio.cargo,
      pessoaEquipe: apoio.equipe,
      cargoOriginal: apoio.cargo,
      cargoVacante: lr.cargo,
      substituindoNome: lr.nomeCompleto,
      dataPlantao: '2026-07-21',
      funcionarioId: lr.id,
      funcionarioNome: lr.nomeCompleto,
      funcionarioCargo: lr.cargo,
      funcionarioEquipe: lr.equipe,
      equipePlantao: lr.equipe,
      substitutoId: apoio.id,
      substitutoNome: apoio.nomeCompleto,
      substitutoCargo: apoio.cargo,
      cargoExercido: lr.cargo,
      plantaoExtra: true,
    }],
    createdAt: '',
    updatedAt: '',
  }],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.equal(efetivoComAtestado.some(entry => entry.bombeiro.id === lr.id), false);
assert.deepEqual(
  efetivoComAtestado.find(entry => entry.bombeiro.id === apoio.id),
  {
    bombeiro: apoio,
    cargoExercido: 'BA-LR',
    substituindo: {
      id: lr.id,
      nome: lr.nomeCompleto,
      cargo: lr.cargo,
    },
  },
);

const vigenciaLiderCobrindoChefe = {
  id: 'vig-lider',
  substitutoId: lr.id,
  substitutoNome: lr.nomeCompleto,
  cargoOriginalSubstituto: lr.cargo,
  cargoExercido: ce.cargo,
  funcionarioOriginalId: ce.id,
  funcionarioOriginalNome: ce.nomeCompleto,
  cargoOriginalFuncionario: ce.cargo,
  equipe: ce.equipe,
  dataInicio: '2026-07-21',
  dataFim: '2026-07-21',
  nivelCascata: 1,
  motivo: 'ferias',
  feriasId: 'ferias-ce-lider',
  ativa: true,
  createdAt: '',
};
const efetivoComAtestadoDeSubstitutoDaEquipe = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [vigenciaLiderCobrindoChefe],
  trocaFills: [],
  substituicoesTemporarias: [{
    id: 'afastamento-lider-em-funcao',
    funcionarioId: lr.id,
    funcionarioNome: lr.nomeCompleto,
    funcionarioCargo: lr.cargo,
    substitutoId: apoio.id,
    substitutoNome: apoio.nomeCompleto,
    substitutoCargo: apoio.cargo,
    tipo: 'Afastamento',
    motivo: 'Atestado Medico',
    motivoOutro: 'Atestado',
    plantaoExtra: 'Sim',
    dataInicio: '2026-07-21',
    dataFim: '2026-07-21',
    dias: 1,
    status: 'Aprovada',
    observacoesRejeicao: '',
    criadoPor: 'test',
    criadoPorNome: 'Test',
    aprovadoPor: 'admin',
    aprovadoPorNome: 'Admin',
    aprovadoEm: '2026-07-21T10:00:00.000Z',
    cadeiaSubstituicao: [{
      tipo: 'extra',
      pessoaId: apoio.id,
      pessoaNome: apoio.nomeCompleto,
      pessoaCargo: apoio.cargo,
      pessoaEquipe: apoio.equipe,
      cargoOriginal: apoio.cargo,
      cargoVacante: '',
      substituindoNome: lr.nomeCompleto,
      dataPlantao: '2026-07-21',
      funcionarioId: lr.id,
      funcionarioNome: lr.nomeCompleto,
      funcionarioCargo: '',
      funcionarioEquipe: '',
      equipePlantao: '',
      substitutoId: apoio.id,
      substitutoNome: apoio.nomeCompleto,
      substitutoCargo: apoio.cargo,
      cargoExercido: '',
      plantaoExtra: true,
    }],
    createdAt: '',
    updatedAt: '',
  }],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.equal(efetivoComAtestadoDeSubstitutoDaEquipe.some(entry => entry.bombeiro.id === lr.id), false);
assert.deepEqual(
  efetivoComAtestadoDeSubstitutoDaEquipe.find(entry => entry.bombeiro.id === apoio.id),
  {
    bombeiro: apoio,
    cargoExercido: 'BA-CE',
    substituindo: {
      id: lr.id,
      nome: lr.nomeCompleto,
      cargo: 'BA-CE',
    },
  },
);

const vigenciaFeristaCobrindoChefe = {
  id: 'vig-ferista',
  substitutoId: ferista.id,
  substitutoNome: ferista.nomeCompleto,
  cargoOriginalSubstituto: ferista.cargo,
  cargoExercido: ce.cargo,
  funcionarioOriginalId: ce.id,
  funcionarioOriginalNome: ce.nomeCompleto,
  cargoOriginalFuncionario: ce.cargo,
  equipe: ce.equipe,
  dataInicio: '2026-07-21',
  dataFim: '2026-07-21',
  nivelCascata: 1,
  motivo: 'ferias',
  feriasId: 'ferias-ce',
  ativa: true,
  createdAt: '',
};
const efetivoComAtestadoDeFeristaEmFuncao = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [vigenciaFeristaCobrindoChefe],
  trocaFills: [],
  substituicoesTemporarias: [{
    id: 'afastamento-ferista',
    funcionarioId: ferista.id,
    funcionarioNome: ferista.nomeCompleto,
    funcionarioCargo: ferista.cargo,
    substitutoId: apoio.id,
    substitutoNome: apoio.nomeCompleto,
    substitutoCargo: apoio.cargo,
    tipo: 'Afastamento',
    motivo: 'Atestado Medico',
    motivoOutro: 'Atestado',
    plantaoExtra: 'Sim',
    dataInicio: '2026-07-21',
    dataFim: '2026-07-21',
    dias: 1,
    status: 'Aprovada',
    observacoesRejeicao: '',
    criadoPor: 'test',
    criadoPorNome: 'Test',
    aprovadoPor: 'admin',
    aprovadoPorNome: 'Admin',
    aprovadoEm: '2026-07-21T10:00:00.000Z',
    cadeiaSubstituicao: [{
      tipo: 'extra',
      pessoaId: apoio.id,
      pessoaNome: apoio.nomeCompleto,
      pessoaCargo: apoio.cargo,
      pessoaEquipe: apoio.equipe,
      cargoOriginal: apoio.cargo,
      cargoVacante: '',
      substituindoNome: ferista.nomeCompleto,
      dataPlantao: '2026-07-21',
      funcionarioId: ferista.id,
      funcionarioNome: ferista.nomeCompleto,
      funcionarioCargo: '',
      funcionarioEquipe: '',
      equipePlantao: '',
      substitutoId: apoio.id,
      substitutoNome: apoio.nomeCompleto,
      substitutoCargo: apoio.cargo,
      cargoExercido: '',
      plantaoExtra: true,
    }],
    createdAt: '',
    updatedAt: '',
  }],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.deepEqual(
  efetivoComAtestadoDeFeristaEmFuncao.find(entry => entry.bombeiro.id === apoio.id),
  {
    bombeiro: apoio,
    cargoExercido: 'BA-CE',
    substituindo: {
      id: ferista.id,
      nome: ferista.nomeCompleto,
      cargo: 'BA-CE',
    },
  },
);

const inssIndeterminadoSemExtras = {
  id: 'inss-sem-extra',
  funcionarioId: lr.id,
  funcionarioNome: lr.nomeCompleto,
  funcionarioCargo: lr.cargo,
  substitutoId: apoio.id,
  substitutoNome: apoio.nomeCompleto,
  substitutoCargo: apoio.cargo,
  tipo: 'Afastamento',
  motivo: 'INSS Indeterminado',
  motivoOutro: 'INSS sem prazo definido',
  plantaoExtra: 'Nao',
  dataInicio: '2026-07-21',
  dataFim: '9999-12-31',
  dias: 0,
  status: 'Pendente',
  observacoesRejeicao: '',
  criadoPor: 'test',
  criadoPorNome: 'Test',
  aprovadoPor: '',
  aprovadoPorNome: '',
  aprovadoEm: '',
  cadeiaSubstituicao: [],
  createdAt: '',
  updatedAt: '',
};
assert.deepEqual(
  validarSubstituicaoTemporaria({
    substituicao: inssIndeterminadoSemExtras,
    funcionario: lr,
    substituto: apoio,
    bombeiros,
  }),
  [],
);

const inssIndeterminadoComExtraInicial = {
  ...inssIndeterminadoSemExtras,
  id: 'inss-com-extra',
  substitutoId: ferista.id,
  substitutoNome: ferista.nomeCompleto,
  substitutoCargo: ferista.cargo,
  plantaoExtra: 'Sim',
  dias: 2,
  status: 'Aprovada',
  cadeiaSubstituicao: [{
    tipo: 'extra',
    pessoaId: apoio.id,
    pessoaNome: apoio.nomeCompleto,
    pessoaCargo: apoio.cargo,
    pessoaEquipe: apoio.equipe,
    cargoOriginal: apoio.cargo,
    cargoVacante: lr.cargo,
    substituindoNome: lr.nomeCompleto,
    dataPlantao: '2026-07-21',
    funcionarioId: lr.id,
    funcionarioNome: lr.nomeCompleto,
    funcionarioCargo: lr.cargo,
    funcionarioEquipe: lr.equipe,
    equipePlantao: lr.equipe,
    substitutoId: apoio.id,
    substitutoNome: apoio.nomeCompleto,
    substitutoCargo: apoio.cargo,
    cargoExercido: lr.cargo,
    plantaoExtra: true,
  }],
};
assert.deepEqual(
  validarSubstituicaoTemporaria({
    substituicao: inssIndeterminadoComExtraInicial,
    funcionario: lr,
    substituto: ferista,
    bombeiros,
  }),
  [],
);

const vigenciaInssFixaDepoisDosExtras = {
  id: 'vig-inss-fixa',
  substitutoId: ferista.id,
  substitutoNome: ferista.nomeCompleto,
  cargoOriginalSubstituto: ferista.cargo,
  cargoExercido: lr.cargo,
  funcionarioOriginalId: lr.id,
  funcionarioOriginalNome: lr.nomeCompleto,
  cargoOriginalFuncionario: lr.cargo,
  equipe: lr.equipe,
  dataInicio: '2026-07-23',
  dataFim: '9999-12-31',
  nivelCascata: 1,
  motivo: 'afastamento',
  feriasId: inssIndeterminadoComExtraInicial.id,
  ativa: true,
  createdAt: '',
};
const efetivoDuranteExtraInicial = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [vigenciaInssFixaDepoisDosExtras],
  trocaFills: [],
  substituicoesTemporarias: [inssIndeterminadoComExtraInicial],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.deepEqual(
  efetivoDuranteExtraInicial.find(entry => entry.bombeiro.id === apoio.id),
  {
    bombeiro: apoio,
    cargoExercido: 'BA-LR',
    substituindo: {
      id: lr.id,
      nome: lr.nomeCompleto,
      cargo: lr.cargo,
    },
  },
);
const efetivoDepoisDosExtras = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [vigenciaInssFixaDepoisDosExtras],
  trocaFills: [],
  substituicoesTemporarias: [inssIndeterminadoComExtraInicial],
  equipe: 'Alfa',
  dataPlantao: '2026-07-23',
});
assert.equal(efetivoDepoisDosExtras.some(entry => entry.bombeiro.id === lr.id), false);
assert.deepEqual(
  efetivoDepoisDosExtras.find(entry => entry.bombeiro.id === ferista.id),
  {
    bombeiro: ferista,
    cargoExercido: 'BA-LR',
    substituindo: {
      id: lr.id,
      nome: lr.nomeCompleto,
      cargo: lr.cargo,
    },
  },
);

assert.deepEqual(
  montarTrocasServicoDoDia({
    bombeiros,
    trocaFills: [{ ...trocaAssinada, status: 'cancelled' }],
    equipe: 'Alfa',
    dataPlantao: '2026-07-21',
  }),
  [],
);

assert.deepEqual(
  montarTrocasServicoDoDia({
    bombeiros,
    trocaFills: [trocaAssinada],
    equipe: 'Alfa',
    dataPlantao: '2026-07-23',
  }),
  [{
    funcaoSaindo: 'BA-MC',
    nomeSaindo: 'MC',
    funcaoEntrando: 'BA-CE',
    nomeEntrando: 'Chefe',
  }],
);

assert.match(
  validarSubstituicaoTemporaria({
    substituicao: {
      funcionarioId: 'a',
      funcionarioNome: 'A',
      funcionarioCargo: 'BA-2',
      substitutoId: 'a',
      substitutoNome: 'A',
      substitutoCargo: 'BA-2',
      tipo: 'SubstituiÃ§Ã£o',
      motivo: 'Outro',
      motivoOutro: 'Teste',
      plantaoExtra: '',
      dataInicio: '2026-08-01',
      dataFim: '2026-08-02',
      dias: 2,
      status: 'Pendente',
      observacoesRejeicao: '',
      criadoPor: 'test',
      criadoPorNome: 'Test',
      aprovadoPor: '',
      aprovadoPorNome: '',
      aprovadoEm: '',
    },
  }).join('\n'),
  /proprio funcionario/,
);

for (const categoria of ['D', 'E', 'AD', 'AE']) {
  assert.equal(cursos.temCategoriaD(categoria), true, `${categoria} deve ser aceita como D/E`);
}
for (const categoria of ['A', 'B', 'C', 'AB', 'AC']) {
  assert.equal(cursos.temCategoriaD(categoria), false, `${categoria} nao deve ser aceita como D/E`);
}

console.log('domain rules ok');
