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
  'src/types/substituicaoTemporaria.ts',
  'src/utils/equipes.ts',
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
const ba2 = bombeiro('ba2', 'BA-2', 'Alfa', 'BA2');
const mc = bombeiro('mc', 'BA-MC', 'Alfa', 'MC');
const ferista = bombeiro('fer', 'BA-MC', 'Ferista', 'Ferista');
const bombeiros = [ce, ba2, mc, ferista];

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
