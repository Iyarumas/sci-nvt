import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const srcRoot = path.resolve(import.meta.dirname, '..', 'src');
function harness() {
  const tables = { exercicios_posicionamento: [], treinamentos_tempo_resposta: [] };
  const requests = [];
  let fail = false;
  const context = vm.createContext({
    console: { ...console, error() {} }, structuredClone, FormData, Blob,
    fetch: async (url, init) => {
      const [, table, action] = new URL(url).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
      const body = JSON.parse(init.body);
      requests.push({ table, action, body, cache: init.cache });
      if (fail) return new Response(JSON.stringify({ message: 'Consulta indisponível' }), { status: 503, headers: { 'content-type': 'application/json' } });
      let rows = tables[table].filter(row => body.filters.every(f => row[f.column] === f.value));
      if (action === 'query') {
        rows.sort((a, b) => b.numero - a.numero);
        if (body.limit) rows = rows.slice(0, body.limit);
      } else if (action === 'insert') {
        rows = [{ id: `novo-${tables[table].length + 1}`, ...body.payload }];
        tables[table].push(...rows);
      } else if (action === 'update') rows.forEach(row => Object.assign(row, body.payload));
      return new Response(JSON.stringify({ data: rows, error: null }), { headers: { 'content-type': 'application/json' } });
    },
  });
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const source = fs.readFileSync(filename, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: filename }).outputText;
    const module = { exports: {} };
    vm.runInContext(`(function(exports, require, module) {\n${compiled}\n})`, context, { filename })(module.exports,
      spec => load(path.resolve(path.dirname(filename), `${spec}.ts`)), module);
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { tables, requests, load, fail: () => { fail = true; } };
}

for (const [name, table, base, create, update] of [
  ['exercicioPosicionamento', 'exercicios_posicionamento', 42, 'criarExercicio', 'atualizarExercicio'],
  ['tempoResposta', 'treinamentos_tempo_resposta', 24, 'criarTreino', 'atualizarTreino'],
]) {
  test(`${name}: referência 2026, maior número manual e reinício anual, com HTTP sem cache`, async () => {
    const h = harness();
    const service = h.load(path.join(srcRoot, `services/${name}Service.ts`));
    assert.equal(await service.obterProximoNumero('2026'), base + 1);
    h.tables[table].push({ id: 'baixo', ano: '2026', numero: 2 });
    assert.equal(await service.obterProximoNumero('2026'), base + 1);
    h.tables[table].push({ id: 'alto', ano: '2026', numero: 91 });
    assert.equal(await service.obterProximoNumero('2026'), 92);
    assert.equal(await service.obterProximoNumero('2027'), 1);
    h.tables[table].push({ id: 'novo-ano', ano: '2027', numero: 4 });
    assert.equal(await service.obterProximoNumero('2027'), 5);
    assert.ok(h.requests.every(r => r.cache === 'no-store'));
    h.fail();
    await assert.rejects(service.obterProximoNumero('2027'), /Consulta indisponível/);
  });
  test(`${name}: modo automático é reservado na API e número manual/edição são preservados`, async () => {
    const h = harness();
    const service = h.load(path.join(srcRoot, `services/${name}Service.ts`));
    const input = { equipe: 'Delta', numero: base + 1, ano: '2026', data: '2026-10-13', observacoes: 'Texto alterado' };
    await service[create](input, { numeroAutomatico: true });
    assert.equal(h.requests.at(-1).body.payload.numero, 0);
    await service[create]({ ...input, numero: 98 });
    assert.equal(h.requests.at(-1).body.payload.numero, 98);
    await service[update]('novo-1', { numero: 97, observacoes: '' });
    assert.equal(h.requests.at(-1).body.payload.numero, 97);
    assert.equal(h.requests.at(-1).body.payload.observacoes, '');
  });
}

const h = harness();
const { montarGuarnicoesExercicio } = h.load(path.join(srcRoot, 'utils/efetivoOperacional.ts'));
const member = (id, cargo, substituindo) => ({ bombeiro: { id, nomeGuerra: id, nomeCompleto: `Nome ${id}` }, cargoExercido: cargo, substituindo });
const efetivo = [member('chefe', 'BA-CE'), member('motorista2', 'BA-MC'), member('motorista3', 'BA-MC'), member('resgate', 'BA-MC'), member('lider', 'BA-LR'),
  ...['b2', 'b31', 'b32', 'r1', 'r2', 'radio'].map(id => member(id, 'BA-2'))];
const veiculos = { cciF2: { baMc: 'motorista2', baCe: 'chefe', ba2: 'b2' }, cciF3: { baMc: 'motorista3', ba2_1: 'b31', ba2_2: 'b32' }, crs: { baMc: 'resgate', baLr: 'lider', ba2_1: 'r1', ba2_2: 'r2' } };
const mensal = { config: { equipe: 'Delta', mes: 10, ano: 2026, pessoas: [] }, paradas: [{ data: '2026-10-13', dia: 13, veiculos, radio: [{ horario: '23:00', horarioFim: '00:00', pessoaNomeGuerra: 'radio' }] }] };
const params = { efetivo, escalasCompletas: [mensal], equipe: 'Delta', dataPlantao: '2026-10-13', hora: '23:30' };
test('equipagem segue os veículos do plantão mensal e o comunicante antes da meia-noite', () => {
  const result = montarGuarnicoesExercicio(params);
  assert.equal(result.guarnicoes.cci02.baMc, 'motorista2');
  assert.equal(result.guarnicoes.cci03.baMc, 'motorista3');
  assert.equal(result.guarnicoes.crs.baMc, 'resgate');
  assert.equal(result.guarnicoes.crs.baRe2, 'r2');
  assert.equal(result.chefeEquipe, 'Nome chefe');
  assert.equal(result.operadorComunicacoes, 'radio');
});
test('diária tem prioridade e substituto ocupa a vaga do titular ausente', () => {
  const cobertura = member('extra', 'BA-MC', { id: 'motorista2', nome: 'Nome motorista2', cargo: 'BA-MC' });
  const diaria = { equipe: 'Delta', dataPlantao: params.dataPlantao, chefeEquipe: 'chefe', radio: [], guarnicoes: {
    cci02: { baMc: 'Nome motorista2', baCe: 'chefe', ba2: 'b31' }, cci03: { baMc: 'motorista3', ba2_1: 'b2', ba2_2: 'b32' }, crs: { baMc: 'resgate', baLr: 'lider', baRe1: 'r1', baRe2: 'r2' },
  } };
  const result = montarGuarnicoesExercicio({ ...params, escalaDiaria: diaria, efetivo: [...efetivo.filter(e => e.bombeiro.id !== 'motorista2'), cobertura] });
  assert.equal(result.guarnicoes.cci02.baMc, 'extra');
  assert.equal(result.guarnicoes.cci02.ba2, 'b31');
  assert.equal(result.guarnicoes.cci03.ba2_1, 'b2');
});
test('ausente sem cobertura não é preenchido, nem se repetem pessoas ou se usa outra equipe/data', () => {
  const m = structuredClone(mensal);
  m.paradas[0].veiculos.cciF3.ba2_2 = 'b2';
  const result = montarGuarnicoesExercicio({ ...params, efetivo: efetivo.filter(e => e.bombeiro.id !== 'motorista2'), escalasCompletas: [m] });
  assert.equal(result.guarnicoes.cci02.baMc, '');
  assert.equal(result.guarnicoes.cci03.ba2_2, '');
  assert.equal(montarGuarnicoesExercicio({ ...params, equipe: 'Alfa' }).guarnicoes.cci02.baCe, '');
  assert.equal(montarGuarnicoesExercicio({ ...params, dataPlantao: '2026-11-13' }).guarnicoes.cci02.baCe, '');
});
test('cobertura resolve também o nome de guerra da vaga no plantão mensal', () => {
  const extra = member('extra', 'BA-MC', { id: 'motorista2', nome: 'Nome motorista2', cargo: 'BA-MC' });
  const result = montarGuarnicoesExercicio({ ...params, bombeiros: efetivo.map(e => e.bombeiro), efetivo: [...efetivo.filter(e => e.bombeiro.id !== 'motorista2'), extra] });
  assert.equal(result.guarnicoes.cci02.baMc, 'extra');
});
test('padrões são apenas textos; nomes, tempos, conceitos e números não vêm dos PDFs históricos', () => {
  for (const [file, name] of [['tempoResposta', 'TEMPO_RESPOSTA_PADRAO'], ['exercicioPosicionamento', 'POSICIONAMENTO_PADRAO']]) {
    const defaults = h.load(path.join(srcRoot, `types/${file}.ts`))[name];
    assert.ok(defaults.observacoes && defaults.acionamento && defaults.feedbackSci);
    assert.ok(Object.keys(defaults).every(key => !/^(f[23]|faisca|crs|numero|ano|data|hora|chefe|gerente|operador)/.test(key)));
  }
});
