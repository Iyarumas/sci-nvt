import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../src');
function harness() {
  const rows = [];
  const requests = [];
  const context = vm.createContext({
    console, structuredClone, FormData, Blob,
    fetch: async (url, init) => {
      const action = new URL(url).pathname.split('/').at(-1);
      const body = JSON.parse(init.body);
      requests.push({ action, body });
      let data = rows.filter(row => (body.filters || []).every(f => row[f.column] === f.value));
      if (action === 'insert') {
        data = [{ id: 'importada', ...body.payload }];
        rows.push(...data);
      } else if (action === 'update') data.forEach(row => Object.assign(row, body.payload));
      return new Response(JSON.stringify({ data, error: null }), { headers: { 'content-type': 'application/json' } });
    },
  });
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const source = fs.readFileSync(filename, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    vm.runInContext(`(function(exports, require, module) {\n${output}\n})`, context, { filename })(module.exports,
      spec => load(path.resolve(path.dirname(filename), `${spec}.ts`)), module);
    cache.set(filename, module.exports);
    return module.exports;
  }
  return { rows, requests, load };
}

test('número SCI e número do cliente permanecem independentes na criação, leitura e edição', async () => {
  const h = harness();
  const service = h.load(path.join(root, 'services/ordemServicoService.ts'));
  const created = await service.criarOrdemServico({ numero: 'SCI-NVT-OS-247712/2026', numeroCliente: '002393857/A', descricao: 'Reparo', observacoes: 'Histórico preservado.' });
  assert.equal(created.numero, 'SCI-NVT-OS-247712/2026');
  assert.equal(created.numeroCliente, '002393857/A');
  assert.equal(h.rows[0].numero_cliente, '002393857/A');
  await service.atualizarOrdemServico('importada', { descricao: 'Reparo concluído' });
  assert.equal(h.rows[0].numero_cliente, '002393857/A');
  assert(!Object.hasOwn(h.requests.at(-1).body.payload, 'numero_cliente'));
  const edited = await service.atualizarOrdemServico('importada', { numeroCliente: '000987' });
  assert.equal(edited.numeroCliente, '000987');
  assert.equal(edited.numero, created.numero);
  assert.equal(edited.observacoes, 'Histórico preservado.');
  await service.atualizarOrdemServico('importada', { numeroCliente: '' });
  assert.equal(h.rows[0].numero_cliente, '');
});

test('registros sem número de cliente não recebem o número SCI como substituição', async () => {
  const h = harness();
  h.rows.push({ id: 'legado', numero: 'OS SCI-006/2026' });
  const service = h.load(path.join(root, 'services/ordemServicoService.ts'));
  assert.equal((await service.listarOrdensServico())[0].numeroCliente, '');
});

test('todos os meses seguem emissão decrescente, mesmo com cadastros fora de ordem e sem mutar o estado', () => {
  const h = harness();
  const { compararOrdensServicoPorData } = h.load(path.join(root, 'utils/ordemServico.ts'));
  const rows = [
    { numero: 'antiga-importada', dataEmissao: '2026-01-03', createdAt: '2026-10-28T15:00:00Z' },
    { numero: 'nova', dataEmissao: '2026-09-21', createdAt: '2026-09-21T15:00:00Z' },
    { numero: 'mesmo-dia', dataEmissao: '2026-09-21', createdAt: '2026-09-21T16:00:00Z' },
    { numero: 'sem-emissao', dataEmissao: '', createdAt: '2026-08-15T15:00:00Z' },
    { numero: 'sem-data', dataEmissao: '', createdAt: '' },
  ];
  const sorted = [...rows].sort(compararOrdensServicoPorData);
  assert.deepEqual(sorted.map(r => r.numero), ['mesmo-dia', 'nova', 'sem-emissao', 'antiga-importada', 'sem-data']);
  assert.equal(rows[0].numero, 'antiga-importada');
});
