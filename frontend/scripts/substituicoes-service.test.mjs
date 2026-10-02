import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Executa o service e as regras reais, substituindo apenas suas fronteiras de I/O.
// Nao importa o adapter HTTP, nao abre conexoes e nao cria dados fora da memoria.
const srcRoot = path.resolve(import.meta.dirname, '..', 'src');
const TABLE = 'substituicoes_temporarias';
const INDETERMINADO = '9999-12-31';
const clone = value => structuredClone(value);
const pessoas = [
  { id: 'afastado', nomeCompleto: 'Pessoa Afastada', nomeGuerra: 'Afastada', cargo: 'BA-2', equipe: 'Charlie', dataDesligamento: '' },
  { id: 'anterior', nomeCompleto: 'Substituto Anterior', nomeGuerra: 'Anterior', cargo: 'BA-2', equipe: 'Charlie', dataDesligamento: '' },
  { id: 'novo', nomeCompleto: 'Novo Substituto', nomeGuerra: 'Novo', cargo: 'BA-2', equipe: 'Charlie', dataDesligamento: '' },
];

function afastamentoRow(overrides = {}) {
  return {
    id: 'origem',
    funcionario_id: 'afastado',
    funcionario_nome: 'Pessoa Afastada',
    funcionario_cargo: 'BA-2',
    substituto_id: 'anterior',
    substituto_nome: 'Substituto Anterior',
    substituto_cargo: 'BA-2',
    tipo: 'Afastamento',
    motivo: 'INSS Indeterminado',
    motivo_outro: 'Afastamento aprovado sem data de retorno.',
    plantao_extra: false,
    data_inicio: '2026-09-01',
    data_fim: INDETERMINADO,
    dias: 0,
    status: 'Aprovada',
    observacoes_rejeicao: '',
    criado_por: 'chefe',
    criado_por_nome: 'Chefe',
    aprovado_por: 'admin',
    aprovado_por_nome: 'Administrador',
    aprovado_em: '2026-08-31T12:00:00.000Z',
    cadeia_substituicao: [],
    created_at: '2026-08-31T12:00:00.000Z',
    updated_at: '2026-08-31T12:00:00.000Z',
    ...overrides,
  };
}

class MemoryDb {
  constructor(rows) {
    this.tables = new Map([[TABLE, clone(rows)]]);
    this.writes = [];
    this.failNext = null;
    this.nextId = 1;
  }

  from(table) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return new MemoryQuery(this, table);
  }

  row(id) {
    return clone(this.tables.get(TABLE).find(row => row.id === id));
  }
}

class MemoryQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.operation = 'select';
    this.filters = [];
    this.singleResult = false;
    this.ordering = null;
    this.result = null;
  }

  select(_columns, options) { this.options = options; return this; }
  eq(column, value) { this.filters.push(row => row[column] === value); return this; }
  order(column, options = {}) { this.ordering = { column, ...options }; return this; }
  insert(payload) { this.operation = 'insert'; this.payload = clone(payload); return this; }
  update(payload) { this.operation = 'update'; this.payload = clone(payload); return this; }
  delete() { this.operation = 'delete'; return this; }
  single() { this.singleResult = true; return this; }

  // Reproduz o contrato thenable do adapter para permitir await na query encadeada.
  // oxlint-disable-next-line unicorn/no-thenable
  then(resolve, reject) {
    if (!this.result) this.result = Promise.resolve().then(() => this.execute());
    return this.result.then(resolve, reject);
  }

  execute() {
    const rows = this.db.tables.get(this.table);
    let matched = rows.filter(row => this.filters.every(filter => filter(row)));
    const request = { table: this.table, operation: this.operation, payload: this.payload, ids: matched.map(row => row.id) };
    if (this.db.failNext?.(request)) {
      this.db.failNext = null;
      return { data: null, error: new Error('Falha simulada de persistencia.'), count: null };
    }
    if (this.operation === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      matched = payloads.map(payload => ({ id: `nova-${this.db.nextId++}`, ...clone(payload) }));
      rows.push(...matched);
    } else if (this.operation === 'update') {
      for (const row of matched) Object.assign(row, clone(this.payload));
    } else if (this.operation === 'delete') {
      this.db.tables.set(this.table, rows.filter(row => !matched.includes(row)));
    }
    if (this.operation !== 'select') this.db.writes.push(clone(request));
    if (this.ordering) {
      const { column, ascending = true } = this.ordering;
      matched = [...matched].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
    }
    if (this.singleResult && matched.length !== 1) {
      return { data: null, error: new Error(`Esperado um registro, recebido ${matched.length}.`), count: matched.length };
    }
    return { data: clone(this.singleResult ? matched[0] : matched), error: null, count: matched.length };
  }
}

function harness(origem = afastamentoRow()) {
  const db = new MemoryDb([origem]);
  const vigencias = origem.substituto_id ? [{
    id: origem.id,
    substitutoId: origem.substituto_id,
    dataInicio: origem.data_inicio,
    dataFim: origem.data_fim,
    ativa: true,
  }] : [];
  const calls = [];
  let failProcess = null;
  const deactivate = id => {
    for (const vigencia of vigencias) if (vigencia.id === id) vigencia.ativa = false;
  };
  const stubs = new Map([
    [path.join(srcRoot, 'lib', 'supabase.ts'), { supabase: db }],
    [path.join(srcRoot, 'services', 'bombeiroService.ts'), { listarAtivos: async () => clone(pessoas) }],
    [path.join(srcRoot, 'services', 'vigenciaSubstituicaoService.ts'), {
      desativarVigencias: async id => { calls.push({ tipo: 'desativar', id }); deactivate(id); },
      processarCadeiaSubstituicao: async registro => {
        assert.ok(registro.substitutoId, 'Nao deve processar uma vigencia sem substituto principal.');
        calls.push({ tipo: 'processar', registro: clone(registro) });
        deactivate(registro.id);
        vigencias.push({
          id: registro.id,
          substitutoId: registro.substitutoId,
          dataInicio: registro.dataInicio,
          dataFim: registro.dataFim,
          ativa: true,
        });
        // Simula tambem erro depois de uma gravacao parcial da corrente.
        if (failProcess?.(registro)) {
          failProcess = null;
          throw new Error('Falha simulada ao processar vigencia.');
        }
        return [];
      },
    }],
  ]);
  const modules = new Map();
  const loadModule = filename => {
    if (stubs.has(filename)) return stubs.get(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    assert.ok(filename.startsWith(`${srcRoot}${path.sep}`), 'O teste so pode carregar fontes locais permitidas.');
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      fileName: filename,
    }).outputText;
    const module = { exports: {} };
    modules.set(filename, module);
    const requireLocal = spec => {
      assert.ok(spec.startsWith('.'), `Dependencia externa inesperada: ${spec}`);
      const resolved = path.resolve(path.dirname(filename), spec);
      return loadModule(path.extname(resolved) ? resolved : `${resolved}.ts`);
    };
    const wrapper = vm.runInThisContext(`(function(exports, require, module, console) {\n${output}\n})`, { filename });
    wrapper(module.exports, requireLocal, module, { ...console, error: () => {} });
    return module.exports;
  };
  const service = loadModule(path.join(srcRoot, 'services', 'substituicaoTemporariaService.ts'));
  return {
    db,
    service,
    calls,
    failProcessing: predicate => { failProcess = predicate; },
    cobrindoNoDia: data => vigencias.filter(v => v.ativa && v.dataInicio <= data && v.dataFim >= data).map(v => v.substitutoId),
    solicitar: novoSubstitutoId => service.solicitarTrocaSubstitutoAfastamentoIndeterminado({
      substituicaoOrigemId: origem.id,
      dataInicio: '2026-10-01',
      novoSubstitutoId,
      criadoPor: 'chefe',
      criadoPorNome: 'Chefe',
    }),
  };
}

function assertOrigemMantida(h) {
  assert.equal(h.db.row('origem').data_fim, INDETERMINADO);
  assert.equal(h.db.row('origem').status, 'Aprovada');
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), ['anterior']);
}

function assertSolicitacaoPendente(h, id) {
  const row = h.db.row(id);
  assert.equal(row.status, 'Pendente');
  assert.equal(row.aprovado_por, '');
  assert.equal(row.aprovado_por_nome, '');
  assert.equal(row.aprovado_em, '');
}

test('solicitar fim da cobertura cria pendencia sem encerrar o afastamento aprovado', async () => {
  const h = harness();
  const origemAntes = h.db.row('origem');
  const solicitacao = await h.solicitar('');
  assert.equal(solicitacao.status, 'Pendente');
  assert.equal(solicitacao.substitutoId, '');
  assert.equal(solicitacao.substitutoNome, '');
  assert.equal(solicitacao.substitutoCargo, '');
  assert.equal(solicitacao.dataFim, INDETERMINADO);
  assert.equal(solicitacao.dias, 0);
  assert.deepEqual(solicitacao.cadeiaSubstituicao, []);
  assert.deepEqual(h.db.row('origem'), origemAntes);
  assertOrigemMantida(h);
  assert.deepEqual(h.calls, []);
});

test('aprovar fim da cobertura preserva vigencia historica ate a vespera e deixa o afastamento sem substituto', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('');
  const aprovada = await h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador');
  assert.equal(aprovada.status, 'Aprovada');
  assert.equal(aprovada.substitutoId, '');
  assert.equal(aprovada.dataFim, INDETERMINADO);
  assert.equal(h.db.row('origem').data_fim, '2026-09-30');
  assert.deepEqual(h.cobrindoNoDia('2026-09-30'), ['anterior']);
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), []);
  assert.equal(h.calls.some(call => call.tipo === 'processar' && call.registro.id === solicitacao.id), false);
});

test('rejeitar fim da cobertura deixa origem e sua vigencia intactas', async () => {
  const h = harness();
  const origemAntes = h.db.row('origem');
  const solicitacao = await h.solicitar('');
  const rejeitada = await h.service.rejeitarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador', 'Manter a cobertura atual.');
  assert.equal(rejeitada.status, 'Rejeitada');
  assert.deepEqual(h.db.row('origem'), origemAntes);
  assertOrigemMantida(h);
});

test('editar troca pendente atualiza a mesma solicitacao e preserva cobertura aprovada', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('novo');
  const editada = await h.service.atualizarSubstituicaoTemporaria(solicitacao.id, {
    substitutoId: '', substitutoNome: '', substitutoCargo: '',
  });
  assert.equal(editada.id, solicitacao.id);
  assert.equal(editada.substitutoId, '');
  assertSolicitacaoPendente(h, solicitacao.id);
  assert.equal(h.db.tables.get(TABLE).length, 2, 'Edicao nao pode criar outra solicitacao');
  assertOrigemMantida(h);
  assert.deepEqual(h.calls, []);
});

test('adicionar substituto depois de periodo sem cobertura nao inventa vigencia historica', async () => {
  const h = harness(afastamentoRow({ substituto_id: '', substituto_nome: '', substituto_cargo: '' }));
  const solicitacao = await h.solicitar('novo');
  assert.equal(solicitacao.status, 'Pendente');
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), []);
  await h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador');
  assert.equal(h.db.row('origem').data_fim, '2026-09-30');
  assert.deepEqual(h.cobrindoNoDia('2026-09-30'), []);
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), ['novo']);
  assert.equal(h.calls.some(call => call.tipo === 'processar' && call.registro.id === 'origem'), false);
});

test('pedir sem substituto quando ja nao ha cobertura nao cria movimentacao', async () => {
  const h = harness(afastamentoRow({ substituto_id: '', substituto_nome: '', substituto_cargo: '' }));
  await assert.rejects(h.solicitar(''), /diferente|sem substituto|sem cobertura|encerrar/i);
  assert.deepEqual(h.db.writes, []);
  assert.deepEqual(h.calls, []);
});

test('trocar pessoa aguarda aprovacao e separa cobertura historica da nova na data correta', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('novo');
  assertOrigemMantida(h);
  const aprovada = await h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador');
  assert.equal(aprovada.substitutoId, 'novo');
  assert.deepEqual(h.cobrindoNoDia('2026-09-30'), ['anterior']);
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), ['novo']);
});

test('restricoes de cadastro e conflito continuam usando validacoes reais', async () => {
  const h = harness();
  await assert.rejects(h.solicitar('afastado'), /afastada|proprio/i);
  await assert.rejects(h.solicitar('anterior'), /diferente/i);
  await assert.rejects(h.solicitar('inexistente'), /n[aã]o encontrado/i);
  assert.deepEqual(h.db.writes, []);
  await h.solicitar('novo');
  await assert.rejects(h.solicitar(''), /conflitante/i);
  assertOrigemMantida(h);
});

test('nao permite encerrar cobertura antes do inicio fixo nem alterar fonte ainda pendente', async () => {
  const duranteExtras = harness(afastamentoRow({ dias: 31 }));
  await assert.rejects(duranteExtras.solicitar(''), /depois/i);
  assert.deepEqual(duranteExtras.db.writes, []);
  const naoAprovada = harness(afastamentoRow({ status: 'Pendente' }));
  await assert.rejects(naoAprovada.solicitar(''), /aprovado e ativo/i);
  assert.deepEqual(naoAprovada.db.writes, []);
});

test('falha ao gravar aprovacao restaura origem e deixa solicitacao pendente', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('');
  h.db.failNext = request => request.operation === 'update' && request.ids.includes(solicitacao.id) && request.payload.status === 'Aprovada';
  await assert.rejects(h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador'), /Falha simulada/);
  assertOrigemMantida(h);
  assertSolicitacaoPendente(h, solicitacao.id);
});

test('falha parcial ao criar nova corrente restaura cobertura anterior e permite nova aprovacao', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('novo');
  h.failProcessing(registro => registro.id === solicitacao.id);
  await assert.rejects(h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador'), /Falha simulada/);
  assertOrigemMantida(h);
  assertSolicitacaoPendente(h, solicitacao.id);
  await h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador');
  assert.deepEqual(h.cobrindoNoDia('2026-09-30'), ['anterior']);
  assert.deepEqual(h.cobrindoNoDia('2026-10-01'), ['novo']);
});

test('falha parcial ao reprocessar historico nao encerra origem nem aprova solicitacao', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('');
  h.failProcessing(registro => registro.id === 'origem' && registro.dataFim === '2026-09-30');
  await assert.rejects(h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador'), /Falha simulada/);
  assertOrigemMantida(h);
  assertSolicitacaoPendente(h, solicitacao.id);
});

test('falha ao fechar registro anterior preserva sua cobertura', async () => {
  const h = harness();
  const solicitacao = await h.solicitar('');
  h.db.failNext = request => request.operation === 'update' && request.ids.includes('origem') && request.payload.data_fim === '2026-09-30';
  await assert.rejects(h.service.aprovarSubstituicaoTemporaria(solicitacao.id, 'admin', 'Administrador'), /Falha simulada/);
  assertOrigemMantida(h);
  assertSolicitacaoPendente(h, solicitacao.id);
});
