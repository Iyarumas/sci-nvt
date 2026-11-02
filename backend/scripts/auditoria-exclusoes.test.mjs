import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { ResourcesService } = require('../dist/resources/resources.service.js');
const { ResourcesController } = require('../dist/resources/resources.controller.js');
const { AuditoriaController } = require('../dist/auditoria/auditoria.controller.js');
const { AuditoriaService } = require('../dist/auditoria/auditoria.service.js');
const { ListarExclusoesDto } = require('../dist/auditoria/dto/listar-exclusoes.dto.js');
const { DatabaseService } = require('../dist/database/database.service.js');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const actor = { id: '00000000-0000-4000-8000-000000000001', username: 'qa_admin', role: 'admin' };

test('controller usa a identidade autenticada, ignorando autoria enviada pelo navegador', async () => {
  let received;
  const controller = new ResourcesController({ delete: async (...args) => { received = args; return { data: null, error: null }; } }, { invalidateUserCache() {} });
  const body = { filters: [{ column: 'id', operator: 'eq', value: 'test' }], actor: { username: 'outra_pessoa' } };
  await controller.delete('bombeiros', body, { authUser: actor });
  assert.equal(received[2], actor);
});

test('exclusão exige ator e filtro antes de abrir transação', async () => {
  const service = new ResourcesService({ transaction() { assert.fail('Não deve abrir transação'); } });
  await assert.rejects(service.delete('bombeiros', { filters: [] }), /Autenticação necessária/);
  await assert.rejects(service.delete('bombeiros', { filters: [] }, actor), /at least one filter/);
  await assert.rejects(service.delete('auditoria_exclusoes', { filters: [{ column: 'id', operator: 'eq', value: 'test' }] }, actor), /not exposed/);
});

test('transação identifica exclusões comuns e PTR-BA, mantendo proteção das cópias legadas', async () => {
  for (const table of ['bombeiros', 'ptrba_completo_registros']) {
    const calls = [];
    const service = new ResourcesService({ transaction: async run => run({ query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: sql.startsWith('DELETE') ? [{ id: 'test', nome_guerra: 'QA' }] : [] };
    } }) });
    const dto = { filters: [{ column: 'id', operator: 'eq', value: 'test' }], select: 'id' };
    assert.deepEqual((await service.delete(table, dto, actor)).data, table === 'bombeiros' ? [{ id: 'test', nome_guerra: 'QA' }] : [{ id: 'test' }]);
    assert.match(calls[0].sql, /set_config\('app.audit_actor', \$1, true\)/);
    assert.deepEqual(JSON.parse(calls[0].params[0]), actor);
    assert.match(calls.at(-1).sql, /^DELETE/);
  }
  const service = new ResourcesService({ transaction: async run => run({ query: async sql => {
    if (sql.startsWith('SELECT *')) return { rows: [{ origem_ptrba_id: 'original' }] };
    assert.ok(!sql.startsWith('DELETE'));
    return { rows: [] };
  } }) });
  await assert.rejects(service.delete('ptrba_completo_registros', { filters: [{ column: 'id', operator: 'eq', value: 'legacy' }] }, actor), /preservado/);
});

test('falha na gravação de auditoria causa rollback da exclusão', async () => {
  const calls = [];
  const database = new DatabaseService({ get: () => 'postgresql://test:test@127.0.0.1:1/test' });
  await database.onModuleDestroy();
  database.pool = { connect: async () => ({ release() { calls.push('release'); }, query: async sql => {
    calls.push(sql);
    if (sql.startsWith('DELETE')) throw new Error('Falha do trigger de auditoria');
    return { rows: [] };
  } }) };
  await assert.rejects(new ResourcesService(database).delete('bombeiros', { filters: [{ column: 'id', operator: 'eq', value: 'test' }] }, actor), /Falha do trigger/);
  assert.equal(calls[0], 'BEGIN');
  assert.ok(!calls.includes('COMMIT'));
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
});

test('somente admin e desenvolvedor leem a auditoria', async () => {
  const controller = new AuditoriaController({ listar: async () => 'ok' });
  for (const role of ['admin', 'desenvolvedor']) assert.equal(await controller.listar({}, { authUser: { ...actor, role } }), 'ok');
  for (const role of ['gerente', 'chefe', 'lider', 'bombeiro', 'sem_funcao']) assert.throws(() => controller.listar({}, { authUser: { ...actor, role } }), /Apenas administradores/);
  assert.throws(() => controller.listar({}, {}), /Apenas administradores/);
});

test('consulta usa filtros parametrizados, dias de Brasília e paginação estável', async () => {
  const calls = [];
  const service = new AuditoriaService({ query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('count(*)')) return { rows: [{ total: 51 }] };
    if (sql.includes('schema_migrations')) return { rows: [{ applied_at: '2026-11-02T04:00:00Z' }] };
    return { rows: [] };
  } });
  const result = await service.listar({ tabela: 'bombeiros', termo: "QA_%'", inicio: '2026-11-01', fim: '2026-11-02', pagina: 2 });
  assert.equal(result.total, 51);
  assert.equal(result.porPagina, 50);
  assert.match(calls[0].sql, /America\/Sao_Paulo/);
  assert.match(calls[0].sql, /::date \+ 1/);
  assert.ok(!calls[0].sql.includes("QA_%'"));
  assert.equal(calls[0].params[1], "%QA\\_\\%'%");
  assert.equal(calls[1].params.at(-1), 50);
  assert.match(calls[1].sql, /created_at DESC, id DESC LIMIT 50/);
  await assert.rejects(service.listar({ inicio: '2026-11-02', fim: '2026-11-01' }), /data final/);
});

test('DTO rejeita datas impossíveis, timestamps e paginação inválida', async () => {
  for (const dto of [{ inicio: '2026-02-30' }, { inicio: '2026-11-02T00:00:00Z' }, { pagina: '0' }, { pagina: '1.5' }, { termo: 'x'.repeat(101) }]) {
    assert.ok((await validate(plainToInstance(ListarExclusoesDto, dto))).length > 0, JSON.stringify(dto));
  }
  assert.equal((await validate(plainToInstance(ListarExclusoesDto, { inicio: '2026-11-02', pagina: '2' }))).length, 0);
});
