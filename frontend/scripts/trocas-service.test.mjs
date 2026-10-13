import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Executa a validacao da pagina, o service e o adapter reais com HTTP em memoria.
// Nenhuma conexao ou dado de producao e utilizado.
const srcRoot = path.resolve(import.meta.dirname, '..', 'src');
const clone = value => structuredClone(value);
const dadosTroca = {
  nome_solicitante: 'Pessoa Adalto', nome_solicitado: 'Pessoa Robson',
  funcao_solicitante: 'BA-LR', funcao_solicitado: 'BA-LR',
  data_solicitada: '2026-10-06', data_folga_solicitado: '2026-10-13',
  motivo_troca: 'Particular',
};
const pessoas = ['Adalto', 'Robson', 'Outra'].map(nome => ({
  id: nome.toLowerCase(), tipo: 'bombeiro', cargo: 'BA-LR',
  nomeCompleto: `Pessoa ${nome}`, nomeGuerra: nome,
}));
const documento = {
  id: 'trocas', source_module: 'trocas', name: 'Trocas', active: true,
  created_at: '2026-10-01T12:00:00Z',
};

function fill(overrides = {}) {
  return {
    id: 'anterior', document_id: 'trocas', filled_data: clone(dadosTroca), status: 'signed',
    created_at: '2026-10-01T12:00:00Z', ...overrides,
  };
}

function harness(initialFills = [fill()], editingId = null) {
  const tables = { documents: [clone(documento)], document_fills: clone(initialFills) };
  const requests = [];
  let failTable = null;
  let holdQuery = null;
  const modules = new Map();
  const context = vm.createContext({
    console: { ...console, error: () => {} }, structuredClone, FormData, Blob,
    fetch: async (url, init) => {
      const [, table, action] = new URL(url).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
      const body = JSON.parse(init.body);
      requests.push({ table, action, cache: init.cache });
      if (table === failTable) return new Response(JSON.stringify({ message: 'Falha simulada' }), {
        status: 503, headers: { 'content-type': 'application/json' },
      });
      let rows = tables[table].filter(row => (body.filters || []).every(filter => row[filter.column] === filter.value));
      if (action === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
      if (action === 'insert') {
        rows = [{ id: 'nova', created_at: '2026-10-13T12:00:00Z', ...clone(body.payload) }];
        tables[table].push(...rows);
      }
      if (action === 'update') rows.forEach(row => Object.assign(row, clone(body.payload)));
      const response = new Response(JSON.stringify({ data: rows, error: null }), {
        headers: { 'content-type': 'application/json' },
      });
      if (action === 'query' && holdQuery) {
        const hold = holdQuery;
        holdQuery = null;
        await hold;
      }
      return response;
    },
  });

  function evaluate(source, filename, bindings = {}) {
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      fileName: filename,
    }).outputText;
    const module = { exports: {} };
    const requireLocal = spec => loadModule(path.resolve(path.dirname(filename), `${spec}.ts`));
    const names = Object.keys(bindings);
    const wrapper = vm.runInContext(`(function(exports, require, module, ${names.join(', ')}) {\n${output}\n})`, context, { filename });
    wrapper(module.exports, requireLocal, module, ...Object.values(bindings));
    return module.exports;
  }

  function loadModule(filename) {
    if (modules.has(filename)) return modules.get(filename);
    let source = fs.readFileSync(filename, 'utf8');
    source = source.replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
    const exports = evaluate(source, filename);
    modules.set(filename, exports);
    return exports;
  }

  const service = loadModule(path.join(srcRoot, 'services/documentoService.ts'));
  const { normalizarDataISO } = loadModule(path.join(srcRoot, 'utils/datas.ts'));
  const filename = path.join(srcRoot, 'pages/Relatorios/Trocas.tsx');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = [
    'documentoEhTroca', 'listarPreenchimentosDeDocumentosTroca', 'recarregarPreenchimentosTroca',
    'normalizarChavePessoaTroca', 'getPessoaConflitoTrocaInfo', 'getOcorrenciasConflitoTroca',
    'statusTrocaLabel', 'buscarConflitoTroca', 'validarConflitoTroca',
    'handleVisualizar', 'handleGerarPdf', 'handleSaveDraft', 'handleConfirmGerarPdf',
  ];
  const functions = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.set(node.name.text, node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(functions.size, names.length, 'Todas as funcoes reais da pagina precisam ser exercitadas.');
  const statusStatement = ast.statements.find(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'STATUS_TROCA_BLOQUEIA_CONFLITO'));
  assert.ok(statusStatement, 'Os status que bloqueiam precisam vir da pagina real.');
  const source = `
    ${statusStatement.getText(ast)}
    let fills = initialFills;
    const formData = dadosTroca;
    const editingFillId = editingId;
    const user = { username: 'teste' };
    const state = { fills, saving: false, conflict: null, notification: null, preview: false, approval: false };
    const setFills = value => { fills = value; state.fills = value; };
    const setSaving = value => { state.saving = value; };
    const setConflitoTroca = value => { state.conflict = value; };
    const setShowNotifPopup = value => { state.notification = value; };
    const setShowPreviewInfo = value => { state.preview = value; };
    const setShowConfirmPdf = value => { state.approval = value; };
    const setShowAutorizacaoAviso = value => { state.manager = value; };
    const setEditingFillId = () => {};
    const setSubView = value => { state.subView = value; };
    const validateForm = () => true;
    const canManageFormData = () => true;
    const canManageFill = () => true;
    const prepareFormDataWithAuth = value => value;
    const ensureDocumentExists = async () => ({ id: 'trocas' });
    const getTrocaPdfBlob = async () => new Blob(['template']);
    const preencherPdf = async () => new Blob(['pdf']);
    const buildPdfData = value => value;
    const fieldPositionsFromDoc = () => [];
    const nomeArquivoTroca = () => 'troca.pdf';
    const abrirPdfPreview = () => { state.pdf = true; };
    const hojeLocalISO = () => '2026-10-13';
    const precisaAutorizacaoGerente = (_data, registrosAtuais) => { state.managerFills = registrosAtuais; return false; };
    ${names.map(name => functions.get(name)).join('\n')}
    export { state, validarConflitoTroca, handleVisualizar, handleGerarPdf, handleSaveDraft, handleConfirmGerarPdf };
  `;
  const page = evaluate(source, filename, {
    ...service, normalizarDataISO, initialFills: clone(initialFills), dadosTroca: clone(dadosTroca), editingId,
    findTemplate: () => null,
    getPessoaByNome: nome => pessoas.find(pessoa => pessoa.nomeCompleto === nome || pessoa.nomeGuerra === nome),
  });
  return {
    tables, requests, service, page,
    fail: table => { failTable = table; },
    holdNext: () => {
      let release;
      holdQuery = new Promise(resolve => { release = resolve; });
      return release;
    },
  };
}

for (const action of ['handleVisualizar', 'handleGerarPdf', 'handleSaveDraft', 'handleConfirmGerarPdf']) {
  test(`${action}: exclusao em outra sessao libera troca apesar da lista e cache antigos`, async () => {
    const h = harness();
    await h.service.listarPreenchimentos('trocas');
    h.tables.document_fills = []; // Outra sessao excluiu, sem invalidar este cache.
    await h.page[action]();
    assert.equal(h.page.state.conflict, null);
    assert.equal(h.page.state.saving, false);
    assert.ok(h.requests.some(request => request.table === 'document_fills' && request.cache === 'no-store'));
    if (action === 'handleVisualizar') assert.equal(h.page.state.preview, true);
    if (action === 'handleGerarPdf') {
      assert.equal(h.page.state.approval, true);
      assert.equal(h.page.state.managerFills.length, 0);
    }
    if (action === 'handleSaveDraft') assert.equal(h.tables.document_fills[0]?.status, 'draft');
    if (action === 'handleConfirmGerarPdf') assert.equal(h.tables.document_fills[0]?.status, 'signed');
  });
}

test('excluir pelo service remove o registro e libera um novo rascunho', async () => {
  const h = harness();
  await h.service.listarPreenchimentos('trocas');
  await h.service.excluirPreenchimento('anterior');
  await h.page.handleSaveDraft();
  assert.equal(h.tables.document_fills.length, 1);
  assert.equal(h.tables.document_fills[0].id, 'nova');
});

for (const status of ['draft', 'pending', 'signed']) {
  test(`troca ${status} ainda existente bloqueia pela data de retorno e nao permite escrita`, async () => {
    const h = harness([]);
    h.tables.document_fills.push(fill({ status, filled_data: { ...dadosTroca, data_solicitada: '2026-10-13', data_folga_solicitado: '2026-10-20' } }));
    await h.page.handleSaveDraft();
    assert.equal(h.page.state.conflict?.pessoa, 'BA-LR Adalto');
    assert.equal(h.page.state.conflict?.dataPlantao, '2026-10-13');
    assert.ok(!h.requests.some(request => request.action === 'insert'));
  });
}

test('edicao ignora o proprio registro mas mantem conflitos com outro documento de troca', async () => {
  const h = harness([fill()], 'anterior');
  assert.ok(await h.page.validarConflitoTroca());
  h.tables.documents.push({ ...documento, id: 'outro-template' });
  h.tables.document_fills.push(fill({ id: 'outra', document_id: 'outro-template' }));
  assert.equal(await h.page.validarConflitoTroca(), null);
  assert.ok(h.page.state.conflict);
});

for (const status of ['cancelled', 'archived']) {
  test(`troca ${status} nao bloqueia nova troca`, async () => {
    const h = harness([fill({ status })]);
    assert.ok(await h.page.validarConflitoTroca());
    assert.equal(h.page.state.conflict, null);
  });
}

test('datas diferentes nao geram conflito', async () => {
  const h = harness([fill({ filled_data: { ...dadosTroca, data_solicitada: '2026-10-08', data_folga_solicitado: '2026-10-15' } })]);
  assert.ok(await h.page.validarConflitoTroca());
});

for (const table of ['documents', 'document_fills']) {
  test(`falha ao consultar ${table} interrompe a validacao e informa o usuario`, async () => {
    const h = harness([]);
    h.fail(table);
    await h.page.handleSaveDraft();
    assert.equal(h.page.state.notification?.type, 'error');
    assert.match(h.page.state.notification.msg, /conferir as trocas/);
    assert.equal(h.page.state.saving, false);
    assert.ok(!h.requests.some(request => request.action === 'insert'));
  });
}

test('falha de exclusao preserva troca e o bloqueio real', async () => {
  const h = harness();
  h.fail('document_fills');
  await assert.rejects(h.service.excluirPreenchimento('anterior'), /Falha simulada/);
  h.fail(null);
  assert.equal(await h.page.validarConflitoTroca(), null);
  assert.equal(h.tables.document_fills.length, 1);
});

test('validacao nao reutiliza uma consulta antiga ainda em andamento', async () => {
  const h = harness();
  const release = h.holdNext();
  const previousQuery = h.service.listarPreenchimentos('trocas');
  // Aguarda a consulta capturar o registro antes da exclusao externa.
  await Promise.resolve();
  h.tables.document_fills = [];
  try {
    await h.page.handleVisualizar();
    assert.equal(h.page.state.preview, true);
    assert.equal(h.page.state.conflict, null);
  } finally {
    release();
    await previousQuery;
  }
});
