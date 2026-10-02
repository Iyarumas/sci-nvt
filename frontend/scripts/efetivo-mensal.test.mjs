import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(repoRoot, 'node_modules', '.tmp', 'efetivo-mensal-cjs');
const filesToCompile = [
  'src/types/escalaMensal.ts',
  'src/utils/datas.ts',
  'src/utils/equipes.ts',
  'src/utils/efetivoMensal.ts',
  'src/utils/validacaoCursos.ts',
  'src/services/escalaMensalGenerator.ts',
];

assert.ok(outRoot.startsWith(`${repoRoot}${path.sep}`), 'O diretório temporário precisa permanecer dentro do frontend.');
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(path.join(outRoot, 'package.json'), '{"type":"commonjs"}\n');

for (const rel of filesToCompile) {
  const sourcePath = path.join(repoRoot, rel);
  const outPath = path.join(outRoot, rel).replace(/\.ts$/, '.js');
  const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
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

// Exercita as funções reais de seleção sem carregar React ou inicializar services HTTP.
const pagePath = path.join(repoRoot, 'src/pages/Escalas/EscalaMensal.tsx');
const pageSource = fs.readFileSync(pagePath, 'utf8');
const pageAst = ts.createSourceFile(pagePath, pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selectionFunctions = [
  'cargoParaSlot', 'pessoaEscala', 'montarPessoasPorSlots',
  'resolverPessoaSelecionada', 'resolverPessoasSelecionadas',
];
const selectionNodes = pageAst.statements.filter(statement => (
  ts.isFunctionDeclaration(statement) && selectionFunctions.includes(statement.name?.text)
) || (
  ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(pageAst) === 'SLOTS')
));
assert.equal(selectionNodes.length, selectionFunctions.length + 1, 'Todas as funções de seleção precisam ser encontradas na página.');
const selectionSource = [
  "import { validarCursoParaFuncao } from '../../utils/validacaoCursos';",
  ...selectionNodes.map(statement => statement.getText(pageAst)),
  `export { SLOTS, ${selectionFunctions.join(', ')} };`,
].join('\n');
const selectionOutPath = path.join(outRoot, 'src/pages/Escalas/EscalaMensalSlots.js');
fs.mkdirSync(path.dirname(selectionOutPath), { recursive: true });
fs.writeFileSync(selectionOutPath, ts.transpileModule(selectionSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  fileName: 'EscalaMensalSlots.ts',
}).outputText);

const requireFromTest = createRequire(import.meta.url);
const { montarEfetivoMensal, dataReferenciaEfetivoMensal } = requireFromTest(path.join(outRoot, 'src/utils/efetivoMensal.js'));
const { gerarEscalaMensal } = requireFromTest(path.join(outRoot, 'src/services/escalaMensalGenerator.js'));
const { SLOTS, montarPessoasPorSlots, resolverPessoaSelecionada, resolverPessoasSelecionadas } = requireFromTest(selectionOutPath);

function bombeiro(id, cargo, equipe = 'Delta', nome = id) {
  return {
    id, nome, nomeCompleto: nome, nomeGuerra: nome, cargo, equipe, dataDesligamento: '',
    cursoChefeEquipe: true, cursoCVE: true, cursoMotoristaCCI: true,
    cnhCategoria: 'D', cnhValidade: '9999-12-31', cveValidade: '9999-12-31',
  };
}

function gozo(original, substituto, overrides = {}) {
  return {
    id: `ferias-${original.id}`,
    funcionarioId: original.id,
    funcionarioNome: original.nomeCompleto,
    equipe: original.equipe,
    dataInicio: '2026-09-02',
    dataFim: '2026-10-01',
    status: 'Gozadas',
    substitutoId: substituto?.id || '',
    substitutoNome: substituto?.nomeCompleto || '',
    funcaoSubstituicao: original.cargo,
    ...overrides,
  };
}

function vigencia(original, substituto, overrides = {}) {
  return {
    id: `vigencia-${original.id}-${substituto.id}`,
    substitutoId: substituto.id,
    substitutoNome: substituto.nomeCompleto,
    cargoOriginalSubstituto: substituto.cargo,
    cargoExercido: original.cargo,
    funcionarioOriginalId: original.id,
    funcionarioOriginalNome: original.nomeCompleto,
    cargoOriginalFuncionario: original.cargo,
    equipe: original.equipe,
    dataInicio: '2026-09-02',
    dataFim: '2026-10-01',
    nivelCascata: 1,
    motivo: 'ferias',
    feriasId: `ferias-${original.id}`,
    ativa: true,
    createdAt: '',
    ...overrides,
  };
}

function congelarProfundo(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) congelarProfundo(child);
  return Object.freeze(value);
}

const alexandre = bombeiro('alexandre', 'BA-CE', 'Delta', 'Alexandre');
const catia = bombeiro('catia', 'BA-LR', 'Delta', 'Cátia');
const substitutoChefe = bombeiro('adalto', 'BA-MC', 'Delta', 'Adalto');
const substitutoLider = bombeiro('serra', 'BA-MC', 'Delta', 'Serra');
const outroMotorista = bombeiro('motorista', 'BA-MC');
const guarnicao = Array.from({ length: 5 }, (_, i) => bombeiro(`ba2-${i}`, 'BA-2'));
const feristaChefe = bombeiro('ferista-chefe', 'BA-2', 'Ferista');
const feristaLider = bombeiro('ferista-lider', 'BA-2', 'Ferista');
const bombeiros = [alexandre, catia, substitutoChefe, substitutoLider, outroMotorista, ...guarnicao, feristaChefe, feristaLider];
const feriasGozo = [gozo(alexandre, substitutoChefe), gozo(catia, substitutoLider)];
const vigencias = [
  vigencia(alexandre, substitutoChefe),
  vigencia(catia, substitutoLider),
  vigencia(substitutoChefe, feristaChefe, { nivelCascata: 2, motivo: 'cascata', feriasId: feriasGozo[0].id }),
  vigencia(substitutoLider, feristaLider, { nivelCascata: 2, motivo: 'cascata', feriasId: feriasGozo[1].id }),
];
const dados = congelarProfundo({ bombeiros, feriasGozo, vigencias, equipe: 'Delta' });
const dadosAntes = structuredClone(dados);

function efetivoNoDia(dataReferencia, overrides = {}) {
  const [ano, mes] = dataReferencia.slice(0, 10).split('-').map(Number);
  return montarEfetivoMensal({ ...dados, mes, ano, ...overrides, dataReferencia });
}

function cargos(efetivo) {
  return Object.fromEntries(efetivo.map(entry => [entry.bombeiro.id, entry.cargoExercido]));
}

assert.equal(dataReferenciaEfetivoMensal(10, 2026, '2026-10-02'), '2026-10-02');
assert.equal(dataReferenciaEfetivoMensal(9, 2026, '2026-10-02'), '2026-09-01');
assert.equal(dataReferenciaEfetivoMensal(11, 2026, '2026-10-02'), '2026-11-01');
assert.equal(dataReferenciaEfetivoMensal(10, 2025, '2026-10-02'), '2025-10-01');
assert.equal(dataReferenciaEfetivoMensal(10, 2026, '2026-10-02T03:00:00.000Z'), '2026-10-02');

// Uma cobertura que toca o mês acaba na data real, sem retirar os titulares pelo mês inteiro.
const antes = cargos(efetivoNoDia('2026-09-01'));
assert.equal(antes.alexandre, 'BA-CE');
assert.equal(antes.catia, 'BA-LR');
assert.equal(antes.adalto, 'BA-MC');
assert.equal(antes.serra, 'BA-MC');

for (const dia of ['2026-09-02', '2026-09-30', '2026-10-01']) {
  const efetivo = efetivoNoDia(dia);
  const exercidos = cargos(efetivo);
  assert.equal(exercidos.alexandre, undefined, `Alexandre está de férias em ${dia}.`);
  assert.equal(exercidos.catia, undefined, `Catia está de férias em ${dia}.`);
  assert.equal(exercidos.adalto, 'BA-CE');
  assert.equal(exercidos.serra, 'BA-LR');
  assert.equal(exercidos['ferista-chefe'], 'BA-MC');
  assert.equal(exercidos['ferista-lider'], 'BA-MC');
  assert.equal(efetivo.length, 10, 'A corrente preserva dez vagas operacionais.');
  assert.equal(new Set(efetivo.map(entry => entry.bombeiro.id)).size, 10);
}

const depois = efetivoNoDia('2026-10-02');
assert.equal(cargos(depois).alexandre, 'BA-CE');
assert.equal(cargos(depois).catia, 'BA-LR');
assert.equal(cargos(depois).adalto, 'BA-MC');
assert.equal(cargos(depois).serra, 'BA-MC');
assert.equal(cargos(depois)['ferista-chefe'], undefined);
assert.equal(cargos(depois)['ferista-lider'], undefined);
assert.ok(depois.every(entry => !entry.substituindo), 'Não mantém vínculo de cobertura depois do retorno.');

// Edição de uma mensal antiga reconcilia os cargos vencidos e mantém escolhas que continuam válidas.
const durante = efetivoNoDia('2026-10-01');
const selecionadasDuranteFerias = congelarProfundo(montarPessoasPorSlots(durante));
const selecionadasAntes = structuredClone(selecionadasDuranteFerias);
const selecionadasAposRetorno = resolverPessoasSelecionadas(selecionadasDuranteFerias, depois);
assert.equal(selecionadasAposRetorno[0].id, alexandre.id);
assert.equal(selecionadasAposRetorno[1].id, catia.id);
assert.ok(selecionadasAposRetorno.slice(2, 5).some(p => p.id === substitutoChefe.id));
assert.ok(selecionadasAposRetorno.slice(2, 5).some(p => p.id === substitutoLider.id));
assert.deepEqual(selecionadasAposRetorno.slice(5).map(p => p.id), selecionadasDuranteFerias.slice(5).map(p => p.id));
assert.equal(new Set(selecionadasAposRetorno.map(p => p.id)).size, 10, 'A reconciliação não duplica pessoas.');
assert.deepEqual(selecionadasDuranteFerias, selecionadasAntes, 'A reconciliação não altera as seleções históricas.');
assert.equal(resolverPessoaSelecionada(selecionadasDuranteFerias[0], SLOTS[0], depois), null, 'Uma seleção expirada não continua como chefe.');
const vagasSemTitulares = depois.filter(e => e.bombeiro.id !== alexandre.id && e.bombeiro.id !== catia.id);
assert.equal(resolverPessoasSelecionadas(selecionadasDuranteFerias, vagasSemTitulares)[0], null);
assert.equal(resolverPessoasSelecionadas(selecionadasDuranteFerias, vagasSemTitulares)[1], null);
const selecaoComVagaLimpa = [...selecionadasDuranteFerias];
selecaoComVagaLimpa[0] = null;
assert.equal(resolverPessoasSelecionadas(selecaoComVagaLimpa, depois)[0], null, 'Uma vaga apagada pelo usuário continua vazia.');

// A mesma configuração de referência resolve substituição e retorno nos plantões anteriores/posteriores.
const selecionadasNominais = montarPessoasPorSlots(depois);
const selecionadasNoPeriodo = resolverPessoasSelecionadas(selecionadasNominais, durante, depois);
assert.equal(selecionadasNoPeriodo[0].id, substitutoChefe.id);
assert.equal(selecionadasNoPeriodo[1].id, substitutoLider.id);
const titularesRecuperados = resolverPessoasSelecionadas(selecionadasDuranteFerias, depois, durante);
assert.equal(titularesRecuperados[0].id, alexandre.id);
assert.equal(titularesRecuperados[1].id, catia.id);

// O fallback pelas férias preserva o histórico mesmo com status atual Gozadas e sem vigências.
const historicoSemVigencias = cargos(efetivoNoDia('2026-09-30', { vigencias: [] }));
assert.equal(historicoSemVigencias.alexandre, undefined);
assert.equal(historicoSemVigencias.catia, undefined);
assert.equal(historicoSemVigencias.adalto, 'BA-CE');
assert.equal(historicoSemVigencias.serra, 'BA-LR');
assert.equal(cargos(efetivoNoDia('2026-10-02', { vigencias: [] })).alexandre, 'BA-CE');

// Uma programação futura no mesmo mês não afasta a pessoa antes do início.
const futuras = [gozo(alexandre, substitutoChefe, { dataInicio: '2026-11-10', dataFim: '2026-11-29', status: 'Programadas' })];
const dadosFuturos = { feriasGozo: futuras, vigencias: [] };
for (const dia of ['2026-11-01', '2026-11-09', '2026-11-30']) {
  assert.equal(cargos(efetivoNoDia(dia, dadosFuturos)).alexandre, 'BA-CE');
  assert.equal(cargos(efetivoNoDia(dia, dadosFuturos)).adalto, 'BA-MC');
}
for (const dia of ['2026-11-10', '2026-11-29']) {
  assert.equal(cargos(efetivoNoDia(dia, dadosFuturos)).alexandre, undefined);
  assert.equal(cargos(efetivoNoDia(dia, dadosFuturos)).adalto, 'BA-CE');
}

// A sentinela do INSS indeterminado continua válida; não encerra outras coberturas por status de férias.
const afastamentoIndeterminado = [vigencia(alexandre, substitutoChefe, {
  dataInicio: '2026-10-02', dataFim: '9999-12-31', motivo: 'afastamento', feriasId: '',
})];
const indefinido = cargos(efetivoNoDia('2035-01-20', { feriasGozo: [], vigencias: afastamentoIndeterminado }));
assert.equal(indefinido.alexandre, undefined);
assert.equal(indefinido.adalto, 'BA-CE');
assert.equal(cargos(efetivoNoDia('2026-10-02', {
  feriasGozo: [], vigencias: afastamentoIndeterminado.map(v => ({ ...v, ativa: false })),
})).alexandre, 'BA-CE');

// Datas vindas como timestamps são normalizadas pelos mesmos helpers do restante do sistema.
const timestamp = cargos(efetivoNoDia('2026-10-01T12:00:00', {
  feriasGozo: [],
  vigencias: [vigencia(alexandre, substitutoChefe, { dataInicio: '2026-09-02T00:00:00.000Z', dataFim: '2026-10-01T00:00:00.000Z' })],
}));
assert.equal(timestamp.adalto, 'BA-CE');

assert.deepEqual(montarEfetivoMensal({ ...dados, equipe: '', mes: 10, ano: 2026 }), []);
const semDesligado = efetivoNoDia('2026-10-02', {
  bombeiros: bombeiros.map(b => b.id === guarnicao[0].id ? { ...b, dataDesligamento: '2026-01-01' } : b),
});
assert.ok(!semDesligado.some(entry => entry.bombeiro.id === guarnicao[0].id));

const config = congelarProfundo({
  id: 'mensal-retorno', equipe: 'Delta', mes: 10, ano: 2026, paridade: 'par',
  pessoas: selecionadasNominais, createdAt: '', updatedAt: '',
});
const configAntes = structuredClone(config);
const datasResolvidas = [];
// A Delta trabalha em 02/10 e 04/10. Este cenário mantém as férias até o primeiro plantão.
const dadosGeracao = {
  feriasGozo: feriasGozo.map(g => ({ ...g, dataFim: '2026-10-02' })),
  vigencias: vigencias.map(v => ({ ...v, dataFim: '2026-10-02' })),
};
const mensal = gerarEscalaMensal(config, {
  pessoasNoPlantao(data) {
    datasResolvidas.push(data);
    return resolverPessoasSelecionadas(config.pessoas, efetivoNoDia(data, dadosGeracao), depois).filter(Boolean);
  },
});
assert.deepEqual(datasResolvidas, mensal.paradas.map(parada => parada.data), 'Resolve cada plantão na própria data.');
const primeiroPlantao = mensal.paradas.find(p => p.dia === 2);
const aposRetorno = mensal.paradas.find(p => p.dia === 4);
assert.equal(primeiroPlantao.veiculos.cciF2.baCe, substitutoChefe.nomeGuerra);
assert.equal(primeiroPlantao.veiculos.crs.baLr, substitutoLider.nomeGuerra);
assert.equal(aposRetorno.veiculos.cciF2.baCe, alexandre.nomeGuerra);
assert.equal(aposRetorno.veiculos.crs.baLr, catia.nomeGuerra);
for (const parada of mensal.paradas) {
  const lideres = new Set([parada.veiculos.cciF2.baCe, parada.veiculos.crs.baLr]);
  assert.ok(parada.radio.every(slot => !lideres.has(slot.pessoaNomeGuerra)), 'Chefe e líder efetivos não entram no rádio daquele dia.');
}
assert.deepEqual(config, configAntes, 'A geração não modifica a configuração mensal original.');
assert.deepEqual(dados, dadosAntes, 'A resolução não modifica pessoas, férias ou vigências históricas.');

console.log('Regressões da escala mensal: retornos, datas inclusivas, histórico, programação, afastamento e geração por plantão passaram.');
