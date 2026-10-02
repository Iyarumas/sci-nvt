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
  'src/utils/afastamentos.ts',
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
const { agruparAfastamentosIndeterminados, calcularTempoAfastamento } = requireFromTest(path.join(outRoot, 'src/utils/afastamentos.js'));
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
  filtrarAfastamentosQuadroEfetivosPorMes,
  filtrarQuadroEfetivosPorMes,
  resolverPosicoesQuadroEfetivos,
  montarMembrosEscalaMensalPlantao,
  resolverPessoaNoPlantaoOperacional,
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

const feristaMotorista = { ...ferista, cargo: 'BA-MC' };
assert.deepEqual(validarFeriasGozo({
  gozo: gozo(feristaMotorista), funcionario: feristaMotorista, bombeiros,
}), [], 'Equipe Ferista dispensa substituto mesmo para cargo de motorista');
assert.match(validarFeriasGozo({
  gozo: gozo(mc), funcionario: mc, bombeiros,
}).join('\n'), /precisa de substituto/, 'Motorista da equipe operacional continua exigindo cobertura nas férias');

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

const efetivoComTrocaDoDia = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [],
  trocaFills: [trocaAssinada],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.equal(efetivoComTrocaDoDia.some(item => item.bombeiro.id === ce.id), false);
assert.equal(efetivoComTrocaDoDia.some(item => item.bombeiro.id === mc.id), true);

const efetivoSemAplicarTroca = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [],
  trocaFills: [trocaAssinada],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
  aplicarTrocas: false,
});
assert.equal(efetivoSemAplicarTroca.some(item => item.bombeiro.id === ce.id), true);
assert.equal(efetivoSemAplicarTroca.some(item => item.bombeiro.id === mc.id), true);

const laurianoEscalado = bombeiro('lauriano-escala', 'BA-2', 'Ferista', 'Thiago Lauriano Ricardo');
const laurianoCadastroDuplicado = bombeiro('lauriano-cadastro', 'BA-2', 'Ferista', 'Thiago Lauriano Ricardo');
const amilcarFerista = bombeiro('amilcar', 'BA-2', 'Ferista', 'Amilcar Alexandre de Souza Lemos');
const escalaDeltaFeristas = {
  config: {
    id: 'escala-delta-setembro',
    equipe: 'Delta',
    mes: 9,
    ano: 2026,
    paridade: 'par',
    pessoas: [{
      id: laurianoEscalado.id,
      nome: laurianoEscalado.nomeCompleto,
      nomeGuerra: laurianoEscalado.nomeGuerra,
      funcao: 'ba-2',
      veiculo: 'cciF2',
      funcaoNoVeiculo: 'Ba2',
      isRadioFixo: false,
    }],
    createdAt: '',
    updatedAt: '',
  },
  paradas: [{
    dia: 10,
    data: '2026-09-10',
    veiculos: {
      cciF2: { baMc: '-', baCe: '-', ba2: laurianoEscalado.nomeCompleto },
      cciF3: { baMc: '-', ba2_1: '-', ba2_2: '-' },
      crs: { baMc: '-', baLr: '-', ba2_1: '-', ba2_2: '-' },
    },
    radio: [],
  }],
  faxinaMensal: [],
  responsabilidades: [],
};
const trocaFeristasDelta = {
  id: 'troca-feristas-delta',
  status: 'signed',
  filled_data: {
    nome_solicitante: laurianoEscalado.nomeCompleto,
    funcao_solicitante: 'BA-2',
    nome_solicitado: amilcarFerista.nomeCompleto,
    funcao_solicitado: 'BA-2',
    data_solicitada: '2026-09-10',
    data_folga_solicitado: '2026-09-12',
  },
};
const efetivoTrocaEntreFeristas = montarEfetivoOperacional({
  bombeiros: [laurianoEscalado, amilcarFerista, laurianoCadastroDuplicado],
  feriasGozo: [],
  vigencias: [],
  trocaFills: [trocaFeristasDelta],
  escalasCompletas: [escalaDeltaFeristas],
  equipe: 'Delta',
  dataPlantao: '2026-09-10',
});
assert.deepEqual(
  efetivoTrocaEntreFeristas.map(item => item.bombeiro.nomeCompleto),
  ['Amilcar Alexandre de Souza Lemos'],
);

const titularDeltaEmFerias = bombeiro('titular-delta', 'BA-2', 'Delta', 'Titular Delta');
const vigenciaLaurianoNaDelta = {
  id: 'vigencia-lauriano-delta',
  substitutoId: laurianoEscalado.id,
  substitutoNome: laurianoEscalado.nomeCompleto,
  cargoOriginalSubstituto: laurianoEscalado.cargo,
  cargoExercido: 'BA-2',
  funcionarioOriginalId: titularDeltaEmFerias.id,
  funcionarioOriginalNome: titularDeltaEmFerias.nomeCompleto,
  cargoOriginalFuncionario: titularDeltaEmFerias.cargo,
  equipe: 'Delta',
  dataInicio: '2026-09-01',
  dataFim: '2026-09-30',
  nivelCascata: 1,
  motivo: 'ferias',
  feriasId: 'ferias-titular-delta',
  ativa: true,
  createdAt: '',
};
const efetivoTrocaDeFeristaEmVigencia = montarEfetivoOperacional({
  bombeiros: [titularDeltaEmFerias, laurianoEscalado, amilcarFerista],
  feriasGozo: [],
  vigencias: [vigenciaLaurianoNaDelta],
  trocaFills: [trocaFeristasDelta],
  equipe: 'Delta',
  dataPlantao: '2026-09-10',
});
assert.deepEqual(
  efetivoTrocaDeFeristaEmVigencia.map(item => item.bombeiro.nomeCompleto),
  ['Amilcar Alexandre de Souza Lemos'],
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

const afastamentoSemCobertura = {
  ...inssIndeterminadoSemExtras,
  substitutoId: '',
  substitutoNome: '',
  substitutoCargo: '',
};
assert.deepEqual(validarSubstituicaoTemporaria({
  substituicao: afastamentoSemCobertura,
  funcionario: lr,
  bombeiros,
}), [], 'INSS sem cobertura deve preservar o afastamento');
assert.deepEqual(validarSubstituicaoTemporaria({
  substituicao: {
    ...afastamentoSemCobertura,
    motivo: 'Atestado Medico',
    dataFim: '2026-07-22',
    dias: 2,
  },
  funcionario: lr,
  bombeiros,
}), [], 'Atestado pode ser registrado sem substituto ou extras');
assert.match(validarSubstituicaoTemporaria({
  substituicao: { ...afastamentoSemCobertura, tipo: 'Substituição' },
  funcionario: lr,
  bombeiros,
}).join('\n'), /Informe o substituto/, 'Substituição comum continua exigindo uma pessoa');
assert.match(validarSubstituicaoTemporaria({
  substituicao: { ...afastamentoSemCobertura, substitutoId: 'inexistente' },
  funcionario: lr,
  bombeiros,
}).join('\n'), /Substituto do afastamento nao encontrado/, 'ID inválido não representa ausência de cobertura');
assert.match(validarSubstituicaoTemporaria({
  substituicao: afastamentoSemCobertura,
  funcionario: lr,
  bombeiros,
  substituicoesExistentes: [{ ...afastamentoSemCobertura, id: 'outro-afastamento', status: 'Aprovada' }],
}).join('\n'), /conflitante/, 'Sem substituto ainda bloqueia outro afastamento simultâneo da mesma pessoa');

const efetivoSemCobertura = montarEfetivoOperacional({
  bombeiros,
  feriasGozo: [],
  vigencias: [],
  trocaFills: [],
  substituicoesTemporarias: [{ ...afastamentoSemCobertura, status: 'Aprovada' }],
  equipe: 'Alfa',
  dataPlantao: '2026-07-21',
});
assert.equal(efetivoSemCobertura.some(entry => entry.bombeiro.id === lr.id), false,
  'Pessoa afastada sem cobertura não pode retornar ao efetivo');
assert.equal(efetivoSemCobertura.some(entry => entry.substituindo?.id === lr.id), false,
  'Afastamento sem cobertura não pode inventar um substituto');

const inssAprovadoSemCobertura = { ...afastamentoSemCobertura, status: 'Aprovada', dataInicio: '2026-09-01' };
const atestadoAprovadoSemCobertura = {
  ...afastamentoSemCobertura, id: 'atestado-sem-cobertura', motivo: 'Atestado Medico',
  status: 'Aprovada', dataInicio: '2026-10-05', dataFim: '2026-10-09', dias: 5,
};
assert.deepEqual(filtrarAfastamentosQuadroEfetivosPorMes([
  inssAprovadoSemCobertura,
  atestadoAprovadoSemCobertura,
  { ...inssAprovadoSemCobertura, id: 'inss-encerrado', dataFim: '2026-09-30' },
  { ...inssAprovadoSemCobertura, id: 'inss-pendente', status: 'Pendente' },
  { ...inssAprovadoSemCobertura, id: 'inss-rejeitado', status: 'Rejeitada' },
  { ...inssAprovadoSemCobertura, id: 'substituicao-comum', tipo: 'Substituição' },
], 10, 2026).map(sub => sub.id), [inssAprovadoSemCobertura.id, atestadoAprovadoSemCobertura.id],
'Quadro mensal considera apenas afastamentos aprovados no período, mesmo sem vigência');
assert.deepEqual(filtrarAfastamentosQuadroEfetivosPorMes([inssAprovadoSemCobertura], 11, 2026),
  [inssAprovadoSemCobertura], 'INSS indeterminado iniciado antes do mês continua afastando');
assert.deepEqual(filtrarAfastamentosQuadroEfetivosPorMes([inssAprovadoSemCobertura], 8, 2026), [],
  'Afastamento futuro não altera meses anteriores');

const inicioInssContinuo = {
  ...inssIndeterminadoSemExtras,
  id: 'inss-original',
  status: 'Aprovada',
  dataFim: '2026-09-29',
};
assert.deepEqual(calcularTempoAfastamento('2026-09-15', '9999-12-31', '2026-10-15'), {
  dataRetorno: '', diasDecorridos: 31, diasPrevistos: null, iniciado: true, encerrado: false,
}, 'INSS aberto conta dias desde o início original e não inventa data de retorno');
assert.deepEqual(calcularTempoAfastamento('2026-10-01', '2026-10-05', '2026-10-15'), {
  dataRetorno: '2026-10-06', diasDecorridos: 5, diasPrevistos: 5, iniciado: true, encerrado: true,
}, 'Período encerrado para a contagem no último dia; retorno é no dia seguinte');
assert.deepEqual(calcularTempoAfastamento('2026-10-20', '2026-10-24', '2026-10-15'), {
  dataRetorno: '2026-10-25', diasDecorridos: 0, diasPrevistos: 5, iniciado: false, encerrado: false,
}, 'Período futuro tem duração prevista, sem dias decorridos negativos');
assert.deepEqual(calcularTempoAfastamento('2026-10-10', '2026-10-20', '2026-10-15'), {
  dataRetorno: '2026-10-21', diasDecorridos: 6, diasPrevistos: 11, iniciado: true, encerrado: false,
}, 'Afastamento em andamento distingue dias transcorridos de duração prevista');
assert.equal(calcularTempoAfastamento('2026-10-15', '9999-12-31', '2026-10-15').diasDecorridos, 1,
  'Primeiro dia de afastamento conta como um dia');
assert.equal(calcularTempoAfastamento('2026-12-30', '2026-12-31', '2027-01-01').dataRetorno, '2027-01-01',
  'Retorno atravessa corretamente a virada do ano');
assert.equal(calcularTempoAfastamento('2028-02-28', '2028-03-01', '2028-03-02').diasDecorridos, 3,
  'Tempo afastado inclui 29 de fevereiro em ano bissexto');
const coberturaInssAtual = {
  ...inssIndeterminadoSemExtras,
  id: 'inss-cobertura-atual',
  status: 'Aprovada',
  dataInicio: '2026-09-30',
  substitutoId: ferista.id,
  substitutoNome: ferista.nomeCompleto,
  substitutoCargo: ferista.cargo,
};
const retiradaCoberturaPendente = {
  ...afastamentoSemCobertura,
  id: 'inss-retirada-pendente',
  dataInicio: '2026-10-01',
};
const [inssAgrupado] = agruparAfastamentosIndeterminados([
  retiradaCoberturaPendente, coberturaInssAtual, inicioInssContinuo,
]);
assert.equal(inssAgrupado.id, inicioInssContinuo.id);
assert.equal(inssAgrupado.dataInicio, inicioInssContinuo.dataInicio, 'Troca conserva início original do afastamento');
assert.equal(inssAgrupado.atual.id, coberturaInssAtual.id, 'Pendente não substitui cobertura aprovada');
assert.deepEqual(inssAgrupado.periodos.map(sub => sub.id), [
  inicioInssContinuo.id, coberturaInssAtual.id, retiradaCoberturaPendente.id,
]);
assert.equal(agruparAfastamentosIndeterminados([
  retiradaCoberturaPendente, coberturaInssAtual, inicioInssContinuo,
]).length, 1, 'Troca e retirada de cobertura pertencem ao mesmo card');
const gruposComRetorno = agruparAfastamentosIndeterminados([
  { ...inicioInssContinuo, dataFim: '2026-08-31' },
  coberturaInssAtual,
]);
assert.equal(gruposComRetorno.length, 2, 'Retorno entre períodos separa episódios INSS');
assert.equal(agruparAfastamentosIndeterminados([
  inicioInssContinuo, { ...coberturaInssAtual, funcionarioId: ce.id },
]).length, 2, 'Funcionários diferentes nunca compartilham o mesmo afastamento');
assert.equal(agruparAfastamentosIndeterminados([
  { ...inicioInssContinuo, motivo: 'Atestado Medico' },
  { ...coberturaInssAtual, motivo: 'Atestado Medico' },
]).length, 2, 'Atestados distintos não são unidos por continuidade de datas');
const coberturaEncerrada = { ...coberturaInssAtual, dataFim: '2026-10-04' };
const trocaRejeitada = { ...retiradaCoberturaPendente, status: 'Rejeitada', dataInicio: '2026-10-02' };
const coberturaPosterior = {
  ...afastamentoSemCobertura,
  id: 'inss-sem-cobertura-aprovado',
  status: 'Aprovada',
  dataInicio: '2026-10-05',
};
const gruposComRejeicao = agruparAfastamentosIndeterminados([
  coberturaPosterior, trocaRejeitada, coberturaEncerrada, inicioInssContinuo,
]);
assert.equal(gruposComRejeicao.length, 1, 'Rejeição permanece no histórico mesmo após outra troca aprovada');
assert.equal(gruposComRejeicao[0].atual.id, coberturaPosterior.id);
assert.equal(gruposComRejeicao[0].atual.substitutoId, '', 'Período aprovado sem cobertura mantém o mesmo afastamento');
assert.equal(agruparAfastamentosIndeterminados([
  { ...inicioInssContinuo, dataFim: '2026-09-01' },
  { ...trocaRejeitada, dataInicio: '2026-09-02' },
  coberturaInssAtual,
]).length, 3, 'Solicitação rejeitada não une episódios separados');

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

// Uma mensal antiga não prolonga os cargos da corrente depois do retorno das férias.
const gozoCorrenteMensal = gozo(ce, {
  id: 'gozo-corrente-mensal',
  dataInicio: '2026-09-02',
  dataFim: '2026-10-01',
  status: 'Gozadas',
  substitutoId: lr.id,
  substitutoNome: lr.nomeCompleto,
  funcaoSubstituicao: 'BA-CE',
});
const vigenciasCorrenteMensal = [
  [ce, lr, 'BA-CE'],
  [lr, mc, 'BA-LR'],
  [mc, ferista, 'BA-MC'],
].map(([original, substituto, cargoExercido], index) => ({
  id: `vigencia-corrente-mensal-${index}`,
  substitutoId: substituto.id,
  substitutoNome: substituto.nomeCompleto,
  cargoOriginalSubstituto: substituto.cargo,
  cargoExercido,
  funcionarioOriginalId: original.id,
  funcionarioOriginalNome: original.nomeCompleto,
  cargoOriginalFuncionario: original.cargo,
  equipe: 'Alfa',
  dataInicio: gozoCorrenteMensal.dataInicio,
  dataFim: gozoCorrenteMensal.dataFim,
  nivelCascata: index + 1,
  motivo: index === 0 ? 'ferias' : 'cascata',
  feriasId: gozoCorrenteMensal.id,
  ativa: true,
  createdAt: '',
}));
const veiculosCorrenteMensal = {
  cciF2: { baCe: lr.nomeGuerra, baMc: ferista.nomeGuerra, ba2: ba2.nomeGuerra },
  cciF3: { baMc: '-', ba2_1: '-', ba2_2: '-' },
  crs: { baMc: '-', baLr: mc.nomeGuerra, ba2_1: '-', ba2_2: '-' },
};
const mensalComCorrenteLegada = {
  config: {
    id: 'mensal-corrente-legada', equipe: 'Alfa', mes: 10, ano: 2026,
    paridade: 'par', createdAt: '', updatedAt: '',
    pessoas: [
      { id: lr.id, nome: lr.nomeCompleto, nomeGuerra: lr.nomeGuerra, funcao: 'chefe', veiculo: 'cciF2', funcaoNoVeiculo: 'BaCe', isRadioFixo: false },
      { id: mc.id, nome: mc.nomeCompleto, nomeGuerra: mc.nomeGuerra, funcao: 'lider', veiculo: 'crs', funcaoNoVeiculo: 'BaLr', isRadioFixo: false },
      { id: ferista.id, nome: ferista.nomeCompleto, nomeGuerra: ferista.nomeGuerra, funcao: 'ba-mc', veiculo: 'cciF2', funcaoNoVeiculo: 'BaMc', isRadioFixo: false },
    ],
  },
  paradas: [1, 2, 3].map(dia => ({
    dia, data: `2026-10-0${dia}`, veiculos: veiculosCorrenteMensal, radio: [],
  })),
  faxinaMensal: [], responsabilidades: [],
};
const contextoCorrenteMensal = {
  bombeiros,
  feriasGozo: [gozoCorrenteMensal],
  vigencias: vigenciasCorrenteMensal,
  trocaFills: [],
  escalasCompletas: [mensalComCorrenteLegada],
  equipe: 'Alfa',
};
const cargosDoEfetivo = efetivo => Object.fromEntries(efetivo.map(entry => [entry.bombeiro.id, entry.cargoExercido]));
const contextoCorrenteAindaNaoIniciada = {
  ...contextoCorrenteMensal,
  feriasGozo: [{ ...gozoCorrenteMensal, dataInicio: '2026-10-02', dataFim: '2026-10-03' }],
  vigencias: vigenciasCorrenteMensal.map(v => ({ ...v, dataInicio: '2026-10-02', dataFim: '2026-10-03' })),
};
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteAindaNaoIniciada, dataPlantao: '2026-10-01',
})), {
  [ce.id]: 'BA-CE', [lr.id]: 'BA-LR', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'O cargo temporário não começa antes do início da vigência');
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteAindaNaoIniciada, dataPlantao: '2026-10-02',
})), {
  [lr.id]: 'BA-CE', [mc.id]: 'BA-LR', [ferista.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'O primeiro dia das férias já aplica todos os cargos da corrente');
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteMensal, dataPlantao: '2026-10-01',
})), {
  [lr.id]: 'BA-CE', [mc.id]: 'BA-LR', [ferista.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'O último dia das férias preserva a corrente, mesmo com status atual Gozadas');
const efetivoDepoisDaCorrente = montarEfetivoOperacional({
  ...contextoCorrenteMensal, dataPlantao: '2026-10-02',
});
assert.deepEqual(cargosDoEfetivo(efetivoDepoisDaCorrente), {
  [ce.id]: 'BA-CE', [lr.id]: 'BA-LR', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'Após o retorno, titulares e substitutos da equipe recuperam seus cargos e o Ferista sai');
assert.equal(efetivoDepoisDaCorrente.filter(entry => entry.cargoExercido === 'BA-CE').length, 1);
assert.equal(efetivoDepoisDaCorrente.filter(entry => entry.cargoExercido === 'BA-LR').length, 1);
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteMensal,
  feriasGozo: [{ ...gozoCorrenteMensal, dataFim: '2026-09-30' }],
  vigencias: vigenciasCorrenteMensal.map(v => ({ ...v, dataFim: '2026-09-30' })),
  dataPlantao: '2026-10-01',
})), {
  [ce.id]: 'BA-CE', [lr.id]: 'BA-LR', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'A mensal clonada no mês seguinte não prolonga uma corrente encerrada em setembro');
assert.deepEqual(resolverPessoaNoPlantaoOperacional({
  ...contextoCorrenteMensal, pessoa: lr, dataPlantao: '2026-10-02',
}), { pertence: true, cargoExercido: 'BA-LR' });
assert.deepEqual(resolverPessoaNoPlantaoOperacional({
  ...contextoCorrenteMensal, pessoa: ferista, dataPlantao: '2026-10-02',
}), { pertence: false });
assert.deepEqual(resolverPessoaNoPlantaoOperacional({
  ...contextoCorrenteMensal, pessoa: ferista, dataPlantao: '2026-10-01',
}), { pertence: true, cargoExercido: 'BA-MC' });
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteMensal,
  vigencias: [],
  dataPlantao: '2026-10-02',
  escalasCompletas: [{
    ...mensalComCorrenteLegada,
    config: { ...mensalComCorrenteLegada.config, pessoas: [mensalComCorrenteLegada.config.pessoas[0]] },
    paradas: [],
  }],
})), {
  [ce.id]: 'BA-CE', [lr.id]: 'BA-LR', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'Sem vigências, o histórico de férias também impede prolongar o cargo temporário');
assert.deepEqual(cargosDoEfetivo(montarEfetivoOperacional({
  ...contextoCorrenteMensal,
  vigencias: [],
  escalasCompletas: [],
  dataPlantao: '2026-10-01',
})), {
  [lr.id]: 'BA-CE', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2',
}, 'Férias Gozadas continuam retirando o titular no seu último plantão histórico');

const mensalComRetornoPorPlantao = {
  ...mensalComCorrenteLegada,
  paradas: [{
    dia: 2, data: '2026-10-02', radio: [],
    veiculos: {
      ...veiculosCorrenteMensal,
      cciF2: { ...veiculosCorrenteMensal.cciF2, baCe: ce.nomeGuerra, baMc: mc.nomeGuerra },
      crs: { ...veiculosCorrenteMensal.crs, baLr: lr.nomeGuerra },
    },
  }],
};
const membrosDaParadaCorrigida = montarMembrosEscalaMensalPlantao({
  bombeiros, escalasCompletas: [mensalComRetornoPorPlantao], equipe: 'Alfa', dataPlantao: '2026-10-02',
});
assert.deepEqual(cargosDoEfetivo(membrosDaParadaCorrigida), {
  [ce.id]: 'BA-CE', [mc.id]: 'BA-MC', [ba2.id]: 'BA-2', [lr.id]: 'BA-LR',
}, 'A guarnição da parada prevalece sobre o config do mês e não reintroduz o Ferista');
assert.deepEqual(montarMembrosEscalaMensalPlantao({
  bombeiros,
  escalasCompletas: [{
    ...mensalComRetornoPorPlantao,
    paradas: [{
      dia: 2, data: '2026-10-02', radio: [],
      veiculos: {
        cciF2: { baCe: '-', baMc: '-', ba2: '-' },
        cciF3: { baMc: '-', ba2_1: '-', ba2_2: '-' },
        crs: { baMc: '-', baLr: '-', ba2_1: '-', ba2_2: '-' },
      },
    }],
  }],
  equipe: 'Alfa', dataPlantao: '2026-10-02',
}), [], 'Uma guarnição vazia explícita não recupera pessoas do config de outro período');
assert.equal(montarMembrosEscalaMensalPlantao({
  bombeiros,
  escalasCompletas: [{ ...mensalComCorrenteLegada, paradas: [] }],
  equipe: 'Alfa', dataPlantao: '2026-10-02',
}).length, 3, 'Uma mensal legada sem parada usa seu config como fallback');
const feristaMensalSemHistorico = montarMembrosEscalaMensalPlantao({
  ...contextoCorrenteMensal,
  vigencias: [], feriasGozo: [],
  dataPlantao: '2026-10-02',
});
assert.equal(feristaMensalSemHistorico.some(entry => entry.bombeiro.id === ferista.id), true,
  'Um Ferista manual sem evidência de cobertura mantém sua designação');
assert.equal(montarMembrosEscalaMensalPlantao({
  ...contextoCorrenteMensal,
  vigencias: vigenciasCorrenteMensal.map(v => ({ ...v, dataInicio: '2026-08-01', dataFim: '2026-08-30' })),
  feriasGozo: [], dataPlantao: '2026-10-02',
}).some(entry => entry.bombeiro.id === ferista.id), false,
'Uma cobertura encerrada não mantém o substituto externo em uma mensal posterior');

// O quadro mensal pertence ao mes de inicio das ferias, inclusive suas coberturas.
const feriasQuadroSetembro = gozo(mc, {
  id: 'quadro-ferias-setembro',
  dataInicio: '2026-09-02',
  dataFim: '2026-10-01',
  substitutoId: ba2.id,
  substitutoNome: ba2.nomeCompleto,
});
const feriasQuadroOutubro = gozo(ce, {
  id: 'quadro-ferias-outubro',
  dataInicio: '2026-10-03',
  dataFim: '2026-11-01',
  substitutoId: lr.id,
  substitutoNome: lr.nomeCompleto,
});

function itemQuadro(overrides = {}) {
  return {
    id: 'quadro-item-outubro',
    mes: 10,
    dataInicio: feriasQuadroOutubro.dataInicio,
    dataFim: feriasQuadroOutubro.dataFim,
    feriasGozoId: feriasQuadroOutubro.id,
    rejeitado: false,
    ...overrides,
  };
}

function vigenciaQuadro(overrides = {}) {
  return {
    id: 'quadro-vigencia-outubro',
    substitutoId: lr.id,
    funcionarioOriginalId: ce.id,
    dataInicio: feriasQuadroOutubro.dataInicio,
    dataFim: feriasQuadroOutubro.dataFim,
    motivo: 'ferias',
    feriasId: feriasQuadroOutubro.id,
    ativa: true,
    nivelCascata: 1,
    ...overrides,
  };
}

const vigenciasQuadroFerias = [
  vigenciaQuadro({
    id: 'quadro-vigencia-setembro',
    substitutoId: ba2.id,
    funcionarioOriginalId: mc.id,
    dataInicio: feriasQuadroSetembro.dataInicio,
    dataFim: feriasQuadroSetembro.dataFim,
    feriasId: feriasQuadroSetembro.id,
  }),
  vigenciaQuadro({
    id: 'quadro-cascata-setembro',
    substitutoId: ferista.id,
    funcionarioOriginalId: ba2.id,
    dataInicio: feriasQuadroSetembro.dataInicio,
    dataFim: feriasQuadroSetembro.dataFim,
    motivo: 'cascata',
    feriasId: feriasQuadroSetembro.id,
    nivelCascata: 2,
  }),
  vigenciaQuadro(),
  vigenciaQuadro({
    id: 'quadro-cascata-outubro',
    substitutoId: ferista.id,
    funcionarioOriginalId: lr.id,
    motivo: 'cascata',
    nivelCascata: 2,
  }),
];
const dadosQuadroFerias = {
  feriasGozo: [feriasQuadroSetembro, feriasQuadroOutubro],
  itensEscala: [
    itemQuadro(),
    itemQuadro({ id: 'item-rejeitado', rejeitado: true }),
    itemQuadro({ id: 'item-sem-gozo', feriasGozoId: '' }),
    itemQuadro({ id: 'item-inicio-setembro', dataInicio: '2026-09-02' }),
    itemQuadro({ id: 'item-fonte-setembro', feriasGozoId: feriasQuadroSetembro.id }),
    itemQuadro({ id: 'item-mes-inconsistente', mes: 9 }),
  ],
  vigencias: vigenciasQuadroFerias,
  ano: 2026,
};
const quadroOutubro = filtrarQuadroEfetivosPorMes({ ...dadosQuadroFerias, mes: 10 });
assert.deepEqual(quadroOutubro.feriasGozo.map(g => g.id), [feriasQuadroOutubro.id]);
assert.deepEqual(quadroOutubro.itensEscala.map(i => i.id), ['quadro-item-outubro']);
assert.deepEqual(quadroOutubro.vigencias.map(v => v.id), ['quadro-vigencia-outubro', 'quadro-cascata-outubro']);
assert.deepEqual(
  filtrarQuadroEfetivosPorMes({ ...dadosQuadroFerias, mes: 9 }).vigencias.map(v => v.id),
  ['quadro-vigencia-setembro', 'quadro-cascata-setembro'],
);
const quadroNovembro = filtrarQuadroEfetivosPorMes({ ...dadosQuadroFerias, mes: 11 });
assert.deepEqual(quadroNovembro, { feriasGozo: [], itensEscala: [], vigencias: [] });
assert.equal(
  montarEfetivoOperacional({
    bombeiros,
    feriasGozo: [feriasQuadroSetembro],
    vigencias: [{
      ...vigenciasQuadroFerias[0],
      equipe: 'Alfa',
      cargoExercido: mc.cargo,
      funcionarioOriginalNome: mc.nomeCompleto,
      cargoOriginalFuncionario: mc.cargo,
    }],
    trocaFills: [],
    equipe: 'Alfa',
    dataPlantao: '2026-10-01',
  }).find(entry => entry.bombeiro.id === ba2.id)?.substituindo?.id,
  mc.id,
  'A cobertura de setembro ainda vale na escala diaria em seu ultimo dia, 01/10.',
);

const feriasViradaAno = gozo(mc, {
  id: 'quadro-ferias-dezembro',
  dataInicio: '2026-12-03',
  dataFim: '2027-01-01',
});
const dadosViradaAno = {
  feriasGozo: [feriasViradaAno],
  itensEscala: [],
  vigencias: [vigenciaQuadro({
    id: 'quadro-vigencia-dezembro',
    feriasId: feriasViradaAno.id,
    dataInicio: feriasViradaAno.dataInicio,
    dataFim: feriasViradaAno.dataFim,
  })],
};
assert.equal(filtrarQuadroEfetivosPorMes({ ...dadosViradaAno, mes: 12, ano: 2026 }).vigencias.length, 1);
assert.deepEqual(
  filtrarQuadroEfetivosPorMes({ ...dadosViradaAno, mes: 1, ano: 2027 }),
  { feriasGozo: [], itensEscala: [], vigencias: [] },
);

// Sem registro de gozo legado, a raiz identifica o mes da corrente inteira.
const dadosQuadroLegado = {
  feriasGozo: [],
  itensEscala: [],
  vigencias: [
    vigenciaQuadro({
      id: 'legado-raiz-setembro',
      feriasId: 'ferias-legadas',
      dataInicio: '2026-09-02',
      dataFim: '2026-10-01',
    }),
    vigenciaQuadro({
      id: 'legado-cascata-inicio-outubro',
      feriasId: 'ferias-legadas',
      motivo: 'cascata',
      dataInicio: '2026-10-01',
      dataFim: '2026-10-01',
      nivelCascata: 2,
    }),
    vigenciaQuadro({ id: 'legado-ferias-outubro-sem-vinculo', feriasId: '' }),
  ],
  mes: 10,
  ano: 2026,
};
assert.deepEqual(
  filtrarQuadroEfetivosPorMes(dadosQuadroLegado).vigencias.map(v => v.id),
  ['legado-ferias-outubro-sem-vinculo'],
);

// Afastamentos, substituicoes e cascatas desconhecidas seguem o periodo vigente.
const vigenciaIndeterminada = {
  dataInicio: '2026-09-02',
  dataFim: '9999-12-31',
  feriasId: 'afastamento-inss',
  motivo: 'afastamento',
};
const dadosQuadroAfastamentos = {
  feriasGozo: [],
  itensEscala: [],
  vigencias: [
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'inss-ativo' }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'inss-cascata', motivo: 'cascata', nivelCascata: 2 }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'substituicao-ativa', motivo: 'substituicao', feriasId: 'substituicao-temporaria' }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'cascata-origem-desconhecida', motivo: 'cascata', feriasId: 'movimentacao-legada' }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'inss-inativo', ativa: false }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'inss-autosubstituicao', substitutoId: ce.id }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'inss-sem-substituto', substitutoId: '' }),
    vigenciaQuadro({ ...vigenciaIndeterminada, id: 'afastamento-encerrado', dataFim: '2026-09-30' }),
  ],
  mes: 10,
  ano: 2026,
};
assert.deepEqual(
  filtrarQuadroEfetivosPorMes(dadosQuadroAfastamentos).vigencias.map(v => v.id),
  ['inss-ativo', 'inss-cascata', 'substituicao-ativa', 'cascata-origem-desconhecida'],
);

// Barreto aparece na vaga de Aline; sua vaga nominal nao pode exibi-lo de novo.
const alineQuadro = bombeiro('quadro-aline', 'BA-2', 'Charlie', 'Aline');
const barretoQuadro = bombeiro('quadro-barreto', 'BA-2', 'Charlie', 'Barreto');
const adailtonQuadro = bombeiro('quadro-adailton', 'BA-2', 'Charlie', 'Adailton');
const coberturaAline = new Map([[alineQuadro.id, barretoQuadro.id]]);
const quadroSemDuplicata = resolverPosicoesQuadroEfetivos([alineQuadro, barretoQuadro], coberturaAline);
assert.deepEqual(quadroSemDuplicata.posicoes.map(p => p.id), [alineQuadro.id]);
assert.equal(quadroSemDuplicata.totalEfetivos, 1);
assert.deepEqual(
  resolverPosicoesQuadroEfetivos([barretoQuadro, alineQuadro], coberturaAline).posicoes.map(p => p.id),
  [alineQuadro.id],
  'A vaga de cobertura prevalece mesmo quando a vaga nominal vem primeiro.',
);

// A->B->C preserva a vaga de B exibindo C e remove somente a vaga nominal de C.
const quadroCascata = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro, adailtonQuadro],
  new Map([[alineQuadro.id, barretoQuadro.id], [barretoQuadro.id, adailtonQuadro.id]]),
);
assert.deepEqual(quadroCascata.posicoes.map(p => p.id), [alineQuadro.id, barretoQuadro.id]);
assert.equal(quadroCascata.totalEfetivos, 2);
const quadroCascataFerista = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro, adailtonQuadro],
  new Map([
    [alineQuadro.id, barretoQuadro.id],
    [barretoQuadro.id, adailtonQuadro.id],
    [adailtonQuadro.id, ferista.id],
  ]),
);
assert.deepEqual(
  quadroCascataFerista.posicoes.map(p => p.id),
  [alineQuadro.id, barretoQuadro.id, adailtonQuadro.id],
);
assert.equal(quadroCascataFerista.totalEfetivos, 3);

// Pessoas homonimas sao diferentes; IDs, e nao nomes, identificam a cobertura.
const homonimoBarreto = bombeiro('quadro-outro-barreto', 'BA-2', 'Charlie', 'Barreto');
const quadroHomonimos = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro, homonimoBarreto],
  coberturaAline,
);
assert.deepEqual(quadroHomonimos.posicoes.map(p => p.id), [alineQuadro.id, homonimoBarreto.id]);
assert.equal(quadroHomonimos.totalEfetivos, 2);

// Cobertura externa aparece uma vez na vaga de destino, sem apagar outro membro.
const quadroCoberturaExterna = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro],
  new Map([[alineQuadro.id, apoio.id]]),
);
assert.deepEqual(quadroCoberturaExterna.posicoes.map(p => p.id), [alineQuadro.id, barretoQuadro.id]);
assert.equal(quadroCoberturaExterna.totalEfetivos, 2);
const quadroOutraEquipe = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro],
  new Map([[apoio.id, barretoQuadro.id]]),
);
assert.deepEqual(quadroOutraEquipe.posicoes.map(p => p.id), [alineQuadro.id, barretoQuadro.id]);
assert.equal(quadroOutraEquipe.totalEfetivos, 2, 'Cobertura de vaga fora do card nao oculta seu membro nominal.');

// Gozo manual sem cobertura renderizada nao pode eliminar o unico substituto visivel.
const quadroSemCobertura = resolverPosicoesQuadroEfetivos([barretoQuadro], new Map());
assert.deepEqual(quadroSemCobertura.posicoes.map(p => p.id), [barretoQuadro.id]);
assert.equal(quadroSemCobertura.totalEfetivos, 1);
const quadroAutoCobertura = resolverPosicoesQuadroEfetivos(
  [alineQuadro, barretoQuadro],
  new Map([[barretoQuadro.id, barretoQuadro.id]]),
);
assert.deepEqual(quadroAutoCobertura.posicoes.map(p => p.id), [alineQuadro.id, barretoQuadro.id]);
assert.equal(quadroAutoCobertura.totalEfetivos, 2);

// Duas coberturas distintas do mesmo substituto mantem seus alvos, mas contam uma pessoa.
const quadroDoisAlvos = resolverPosicoesQuadroEfetivos(
  [alineQuadro, adailtonQuadro, barretoQuadro],
  new Map([[alineQuadro.id, barretoQuadro.id], [adailtonQuadro.id, barretoQuadro.id]]),
);
assert.deepEqual(quadroDoisAlvos.posicoes.map(p => p.id), [alineQuadro.id, adailtonQuadro.id]);
assert.equal(quadroDoisAlvos.totalEfetivos, 1);
assert.deepEqual(resolverPosicoesQuadroEfetivos([], coberturaAline), { posicoes: [], totalEfetivos: 0 });

const membrosQuadroImutaveis = Object.freeze([barretoQuadro, alineQuadro]);
const membrosQuadroAntes = structuredClone(membrosQuadroImutaveis);
const coberturasQuadroAntes = [...coberturaAline];
resolverPosicoesQuadroEfetivos(membrosQuadroImutaveis, coberturaAline);
assert.deepEqual(membrosQuadroImutaveis, membrosQuadroAntes);
assert.deepEqual([...coberturaAline], coberturasQuadroAntes);

console.log('domain rules ok');
