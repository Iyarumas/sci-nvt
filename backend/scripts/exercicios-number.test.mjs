import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Usa os services compilados com um pool em memória; não acessa nenhum banco.
const require = createRequire(import.meta.url);
const { DatabaseService } = require('../dist/database/database.service.js');
const { ResourcesService } = require('../dist/resources/resources.service.js');

async function harness() {
  const tables = { exercicios_posicionamento: [], treinamentos_tempo_resposta: [] };
  const calls = [];
  const locks = new Map();
  let nextId = 1;
  const database = new DatabaseService({ get: () => 'postgresql://test:test@127.0.0.1:1/test' });
  await database.onModuleDestroy();
  database.pool = {
    connect: async () => {
      let unlock;
      let snapshot;
      let tableName;
      return {
        release: () => { calls.push('release'); },
        query: async (sql, params = []) => {
          calls.push(sql);
          if (sql === 'BEGIN') return { rows: [] };
          if (sql.includes('pg_advisory_xact_lock')) {
            tableName = params[0].split(':')[1];
            const previous = locks.get(tableName) || Promise.resolve();
            const waiting = new Promise(resolve => { unlock = resolve; });
            locks.set(tableName, previous.then(() => waiting));
            await previous;
            snapshot = structuredClone(tables[tableName]);
            return { rows: [] };
          }
          if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql === 'ROLLBACK' && snapshot) tables[tableName] = snapshot;
            unlock?.();
            return { rows: [] };
          }
          const table = sql.match(/(?:FROM|INTO|UPDATE) "([a-z_]+)"/)[1];
          if (sql.includes('MAX(numero)')) return { rows: [{ numero: Math.max(0, ...tables[table].filter(r => r.ano === params[0]).map(r => r.numero)) }] };
          if (sql.startsWith('SELECT id FROM')) return { rows: tables[table].filter(r => r.ano === params[0] && r.numero === params[1] && r.id !== params[2]).slice(0, 1) };
          if (sql.startsWith('SELECT id, numero')) return { rows: tables[table].filter(r => r.id === params[0]) };
          if (sql.startsWith('INSERT')) {
            const columns = sql.match(/\(([^)]+)\) VALUES/)[1].split(', ').map(v => v.replaceAll('"', ''));
            const row = { id: `document-${nextId++}`, ...Object.fromEntries(columns.map((column, index) => [column, params[index]])) };
            tables[table].push(row);
            return { rows: [structuredClone(row)] };
          }
          if (sql.startsWith('UPDATE')) {
            const columns = sql.match(/SET (.*?) WHERE/)[1].split(', ').map(v => v.match(/"([a-z_]+)"/)[1]);
            const rows = tables[table].filter(r => r.id === params.at(-1));
            rows.forEach(row => columns.forEach((column, index) => { row[column] = params[index]; }));
            return { rows: structuredClone(rows) };
          }
          throw new Error(`SQL inesperado: ${sql}`);
        },
      };
    },
  };
  return { service: new ResourcesService(database), tables, calls };
}
const payload = (numero = 0, ano = '2026') => ({ equipe: 'Delta', numero, ano, data: `${ano}-10-13` });
const insert = (service, table, values = payload()) => service.insert(table, { payload: values, select: '*' });
const edit = (service, table, id, values) => service.update(table, { payload: values, filters: [{ column: 'id', operator: 'eq', value: id }], select: '*' });

for (const [table, base] of [['exercicios_posicionamento', 42], ['treinamentos_tempo_resposta', 24]]) {
  test(`${table}: referência, criação simultânea e sequência anual`, async () => {
    const h = await harness();
    const results = await Promise.all(Array.from({ length: 8 }, () => insert(h.service, table)));
    assert.deepEqual(results.map(r => r.data[0].numero), Array.from({ length: 8 }, (_, i) => base + i + 1));
    assert.equal((await insert(h.service, table, payload(0, '2027'))).data[0].numero, 1);
    assert.equal((await insert(h.service, table, payload(0, '2027'))).data[0].numero, 2);
    assert.equal(h.calls.filter(sql => sql.includes('pg_advisory_xact_lock')).length, 10);
    assert.equal(h.calls.filter(sql => sql === 'COMMIT').length, 10);
    assert.equal(h.calls.filter(sql => sql === 'release').length, 10);
  });
  test(`${table}: ajuste manual influencia o próximo número, sem duplicar nem alterar o próprio número na aprovação`, async () => {
    const h = await harness();
    const first = (await insert(h.service, table, payload(80))).data[0];
    assert.equal((await insert(h.service, table)).data[0].numero, 81);
    await edit(h.service, table, first.id, { numero: 90 });
    assert.equal((await insert(h.service, table)).data[0].numero, 91);
    await edit(h.service, table, first.id, { numero: 90, ano: '2026', data: '2026-10-13' });
    await assert.rejects(insert(h.service, table, payload(90)), /Já existe um documento/);
    await assert.rejects(edit(h.service, table, first.id, { numero: 91 }), /Já existe um documento/);
    assert.equal(h.tables[table].find(r => r.id === first.id).numero, 90);
    assert.equal(h.calls.filter(sql => sql === 'ROLLBACK').length, 2);
  });
  test(`${table}: rejeita número inválido/ano divergente e desfaz lote parcialmente salvo`, async () => {
    const h = await harness();
    for (const value of [-1, 1.5, 2147483648, '5']) await assert.rejects(insert(h.service, table, payload(value)), /número inteiro/);
    await assert.rejects(insert(h.service, table, { ...payload(50), data: '2027-01-01' }), /ano do documento/);
    await assert.rejects(h.service.insert(table, { payload: [payload(50), payload(50)], select: '*' }), /Já existe/);
    assert.equal(h.tables[table].length, 0);
    assert.equal((await insert(h.service, table)).data[0].numero, base + 1);
  });
}
test('Tempo Resposta e Posicionamento têm sequências independentes', async () => {
  const h = await harness();
  assert.equal((await insert(h.service, 'exercicios_posicionamento')).data[0].numero, 43);
  assert.equal((await insert(h.service, 'treinamentos_tempo_resposta')).data[0].numero, 25);
});
