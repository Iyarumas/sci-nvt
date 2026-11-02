import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Dados sintéticos em schema isolado. Todas as tabelas e alterações são revertidas.
if (!process.env.DATABASE_URL) throw new Error('Informe DATABASE_URL para testar a auditoria no PostgreSQL.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const schema = `audit_test_${randomUUID().replaceAll('-', '')}`;
const migration = (await readFile(new URL('../database/migrations/074_auditoria_exclusoes.sql', import.meta.url), 'utf8'))
  .replaceAll('public.', `${schema}.`).replaceAll("schemaname = 'public'", `schemaname = '${schema}'`);
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='3s'");
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path = ${schema}, public`);
  await client.query(`CREATE TABLE ${schema}.bombeiros(id uuid PRIMARY KEY, nome_guerra text, cpf text, password text)`);
  await client.query(`CREATE TABLE ${schema}.usuarios(id uuid PRIMARY KEY, username text, senha_hash text)`);
  await client.query(`CREATE TABLE ${schema}.filhos(id uuid PRIMARY KEY, pai_id uuid REFERENCES ${schema}.bombeiros(id) ON DELETE CASCADE)`);
  await client.query(migration);
  await client.query(migration);
  const id = randomUUID();
  const actor = { id: randomUUID(), username: 'qa_auditoria', role: 'admin' };
  await client.query("SELECT set_config('app.audit_actor', $1, true)", [JSON.stringify(actor)]);
  await client.query(`INSERT INTO ${schema}.bombeiros VALUES ($1, 'Pessoa QA', 'cpf_secreto', 'senha_secreta')`, [id]);
  await client.query(`INSERT INTO ${schema}.filhos VALUES ($1, $2)`, [randomUUID(), id]);
  await client.query(`DELETE FROM ${schema}.bombeiros WHERE id=$1`, [id]);
  let logs = (await client.query(`SELECT * FROM ${schema}.auditoria_exclusoes ORDER BY tabela`)).rows;
  assert.equal(logs.length, 2);
  assert.equal(logs[0].identificacao, 'Pessoa QA');
  assert.equal(logs[0].usuario_login, actor.username);
  assert.equal(logs[1].usuario_id, actor.id);
  assert.equal(logs[0].origem, 'sistema');
  assert.ok(!JSON.stringify(logs).includes('cpf_secreto'));
  assert.ok(!JSON.stringify(logs).includes('senha_secreta'));
  await client.query(`DELETE FROM ${schema}.bombeiros WHERE id=$1`, [id]);
  assert.equal((await client.query(`SELECT count(*)::int AS total FROM ${schema}.auditoria_exclusoes`)).rows[0].total, 2);
  const blocked = randomUUID();
  await client.query(`ALTER TABLE ${schema}.auditoria_exclusoes ADD CONSTRAINT reject_test CHECK (identificacao <> 'Bloqueado')`);
  await client.query(`INSERT INTO ${schema}.bombeiros VALUES ($1, 'Bloqueado', '', '')`, [blocked]);
  await client.query('SAVEPOINT audit_failure');
  await assert.rejects(client.query(`DELETE FROM ${schema}.bombeiros WHERE id=$1`, [blocked]), /reject_test/);
  await client.query('ROLLBACK TO SAVEPOINT audit_failure');
  assert.equal((await client.query(`SELECT count(*)::int AS total FROM ${schema}.bombeiros WHERE id=$1`, [blocked])).rows[0].total, 1);
  await client.query('SAVEPOINT failed_delete');
  const other = randomUUID();
  await client.query(`INSERT INTO ${schema}.bombeiros VALUES ($1, 'Revertido', '', '')`, [other]);
  await client.query(`DELETE FROM ${schema}.bombeiros WHERE id=$1`, [other]);
  await client.query('ROLLBACK TO SAVEPOINT failed_delete');
  assert.equal((await client.query(`SELECT count(*)::int AS total FROM ${schema}.auditoria_exclusoes`)).rows[0].total, 2);
  await client.query("SELECT set_config('app.audit_actor', '', true)");
  await client.query(`INSERT INTO ${schema}.usuarios VALUES ($1, 'qa_direto', 'hash_secreto')`, [id]);
  await client.query(`DELETE FROM ${schema}.usuarios WHERE id=$1`, [id]);
  logs = (await client.query(`SELECT * FROM ${schema}.auditoria_exclusoes WHERE tabela='usuarios'`)).rows;
  assert.equal(logs[0].origem, 'sem_usuario');
  assert.equal(logs[0].usuario_id, null);
  assert.equal(logs[0].identificacao, 'qa_direto');
  assert.ok(!JSON.stringify(logs).includes('hash_secreto'));
  for (const sql of [`UPDATE ${schema}.auditoria_exclusoes SET identificacao='alterado'`, `DELETE FROM ${schema}.auditoria_exclusoes`, `TRUNCATE ${schema}.auditoria_exclusoes`]) {
    await client.query('SAVEPOINT immutable');
    await assert.rejects(client.query(sql), /não pode ser alterado ou apagado/);
    await client.query('ROLLBACK TO SAVEPOINT immutable');
  }
  console.log('PASS: triggers idempotentes, identidade, cascata, dados sensíveis, exclusão inexistente, rollback, acesso direto e imutabilidade.');
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
