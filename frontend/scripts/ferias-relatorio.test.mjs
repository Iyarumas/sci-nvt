import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const src = path.resolve(import.meta.dirname, '../src');
const context = vm.createContext({ console, Date, Map, Set });
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename);
  const module = { exports: {} };
  modules.set(filename, module.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(`(function(exports, require, module) { ${output} })`, context)(module.exports, spec => load(path.resolve(path.dirname(filename), `${spec}.ts`)), module);
  return module.exports;
}
const { montarRelatorioFerias } = load(path.join(src, 'utils/relatorioFerias.ts'));
const plain = value => JSON.parse(JSON.stringify(value));
const pessoa = (id, equipe = 'Alfa', cargo = 'BA-2', extra = {}) => ({ id, nomeCompleto: `Pessoa ${id}`, nomeGuerra: id, equipe, cargo, dataAdmissao: '2020-03-10', dataDesligamento: '', ...extra });
const gozo = (id, funcionarioId, inicio = '2026-10-05', fim = '2026-11-03', extra = {}) => ({ id, funcionarioId, funcionarioNome: `Pessoa ${funcionarioId}`, equipe: 'Alfa', periodoNumero: 5, dataInicio: inicio, dataFim: fim, dias: 30, status: 'Programadas', substitutoId: '', substitutoNome: '', ...extra });
const vigencia = (id, funcionarioOriginalId, substitutoId, cargoExercido, extra = {}) => ({ id, funcionarioOriginalId, substitutoId, cargoExercido, cargoOriginalSubstituto: 'BA-2', funcionarioOriginalNome: `Pessoa ${funcionarioOriginalId}`, substitutoNome: `Pessoa ${substitutoId}`, equipe: 'Alfa', dataInicio: '2026-10-05', dataFim: '2026-11-03', ativa: true, motivo: 'ferias', nivelCascata: 1, feriasId: 'f1', ...extra });
const afastamento = (id, funcionarioId, dataInicio, dataFim, extra = {}) => ({ id, funcionarioId, funcionarioNome: `Pessoa ${funcionarioId}`, tipo: 'Afastamento', status: 'Aprovada', motivo: 'INSS Indeterminado', dataInicio, dataFim, ...extra });
const base = extra => ({ bombeiros: [pessoa('chefe', 'Alfa', 'BA-CE'), pessoa('lider', 'Alfa', 'BA-LR'), pessoa('ferista', 'Ferista')], feriasGozo: [gozo('f1', 'chefe')], itensEscala: [], vigencias: [], substituicoes: [], ...extra });
const filtros = { mes: 10, ano: 2026, incluirAfastados: false };

test('mesmo recorte do quadro: mês de início, todos os status, datas de gozo completas e aquisitivo correto', () => {
  const dados = base({ feriasGozo: [gozo('f1', 'chefe', undefined, undefined, { status: 'Gozadas' }), gozo('anterior', 'lider', '2026-09-20', '2026-10-19'), gozo('futuro', 'ferista', '2026-11-01', '2026-11-30')] });
  const relatorio = montarRelatorioFerias(dados, filtros);
  assert.equal(relatorio.equipes.length, 1);
  const linha = relatorio.equipes[0].pessoas[0];
  assert.equal(linha.id, 'f1');
  assert.equal(linha.dataFim, '2026-11-03');
  assert.equal(linha.aquisitivoInicio, '2024-03-10');
  assert.equal(linha.aquisitivoFim, '2025-03-09');
  assert.equal(relatorio.afastados.length, 0);
});

test('cadeia completa preserva função exercida, equipe da vaga e ordem; exclui autorreferência e inativas', () => {
  const relatorio = montarRelatorioFerias(base({ vigencias: [
    vigencia('v2', 'lider', 'ferista', 'BA-LR', { motivo: 'cascata', nivelCascata: 2 }),
    vigencia('v1', 'chefe', 'lider', 'BA-CE', { cargoOriginalSubstituto: 'BA-LR' }),
    vigencia('self', 'ferista', 'ferista', 'BA-2'),
    vigencia('antiga', 'chefe', 'ferista', 'BA-CE', { ativa: false }),
  ] }), filtros);
  const coberturas = relatorio.equipes[0].pessoas[0].coberturas;
  assert.deepEqual(plain(coberturas.map(c => [c.nome, c.cargoExercido, c.equipe, c.dataFim])), [
    ['Pessoa lider', 'BA-CE', 'Alfa', '2026-10-31'],
    ['Pessoa ferista', 'BA-LR', 'Alfa', '2026-10-31'],
  ]);
});

test('cobertura é dividida por afastamento aprovado ou férias do substituto; pendentes não bloqueiam', () => {
  const relatorio = montarRelatorioFerias(base({
    vigencias: [vigencia('v1', 'chefe', 'lider', 'BA-CE')],
    feriasGozo: [gozo('f1', 'chefe'), gozo('outra', 'lider', '2026-10-20', '2026-10-22')],
    substituicoes: [afastamento('a', 'lider', '2026-10-10', '2026-10-15'), afastamento('pendente', 'lider', '2026-10-25', '2026-10-30', { status: 'Pendente' })],
  }), filtros);
  const coberturas = relatorio.equipes[0].pessoas.find(p => p.id === 'f1').coberturas;
  assert.deepEqual(plain(coberturas.map(c => [c.dataInicio, c.dataFim])), [
    ['2026-10-05', '2026-10-09'], ['2026-10-16', '2026-10-19'], ['2026-10-23', '2026-10-31'],
  ]);
});

test('fallback do gozo manual e item aprovado; não mistura rascunho/rejeitado nem pessoa desligada', () => {
  const relatorio = montarRelatorioFerias(base({
    feriasGozo: [gozo('f1', 'chefe', undefined, undefined, { substitutoId: 'lider', substitutoNome: 'Pessoa lider', funcaoSubstituicao: 'BA-CE' }), gozo('f2', 'ferista')],
    itensEscala: [{ feriasGozoId: 'f1', funcionarioId: 'chefe', mes: 10, dataInicio: '2026-10-05', rejeitado: true, substitutoId: 'ferista', funcaoSubstituicao: 'BA-CE' }],
  }), filtros);
  assert.equal(relatorio.equipes[0].pessoas[0].coberturas[0].nome, 'Pessoa lider');
  assert.equal(relatorio.equipes[1].equipe, 'Ferista');
  assert.equal(relatorio.equipes[1].pessoas[0].coberturas.length, 0);
  const semAtivo = montarRelatorioFerias(base({ bombeiros: [pessoa('chefe', 'Alfa', 'BA-CE', { dataDesligamento: '2026-09-01' })] }), filtros);
  assert.equal(semAtivo.equipes.length, 0);
});

test('afastados opcionais ao final: aprovados sobrepostos, episódios INSS contínuos e sem previsão', () => {
  const dados = base({ substituicoes: [
    afastamento('a1', 'lider', '2026-08-01', '2026-09-30'),
    afastamento('a2', 'lider', '2026-10-01', '9999-12-31', { motivoOutro: 'Recuperação após procedimento.\nAcompanhamento periódico.\nCID: Z00.\nPrazo: indeterminado.\nExtras: cobertura registrada.' }),
    afastamento('pendente', 'chefe', '2026-10-01', '2026-10-10', { status: 'Pendente' }),
    afastamento('antes', 'ferista', '2026-08-01', '2026-08-15'),
  ] });
  assert.equal(montarRelatorioFerias(dados, filtros).afastados.length, 0);
  const relatorio = montarRelatorioFerias(dados, { ...filtros, incluirAfastados: true });
  assert.equal(relatorio.afastados.length, 1);
  assert.equal(relatorio.afastados[0].dataInicio, '2026-08-01');
  assert.equal(relatorio.afastados[0].dataFim, '9999-12-31');
  assert.equal(relatorio.afastados[0].retorno, '');
  assert.equal(relatorio.afastados[0].tipoAfastamento, 'INSS/Indeterminado');
  assert.equal(relatorio.afastados[0].motivo, 'Recuperação após procedimento.\nAcompanhamento periódico.');
});

test('validade dos filtros e falta de período aquisitivo não geram dados inventados', () => {
  for (const mes of [0, 13, NaN]) assert.throws(() => montarRelatorioFerias(base(), { ...filtros, mes }), /válidos/);
  const relatorio = montarRelatorioFerias(base({ bombeiros: [pessoa('chefe', 'Alfa', 'BA-CE', { dataAdmissao: '' })] }), filtros);
  assert.equal(relatorio.equipes[0].pessoas[0].aquisitivoInicio, '');
  const futuro = montarRelatorioFerias(base({ feriasGozo: [gozo('futuro', 'chefe', '2028-10-01', '2028-10-30', { periodoNumero: 9 })] }), { ...filtros, ano: 2028 });
  assert.equal(futuro.equipes[0].pessoas[0].aquisitivoInicio, '2028-03-10');
  assert.equal(futuro.equipes[0].pessoas[0].aquisitivoFim, '2029-03-09');
});
