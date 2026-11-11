import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Usa o código compilado com um banco em memória; não acessa nenhum banco real.
const require = createRequire(import.meta.url);
const { authorizeResource } = require('../dist/resources/resources.policy.js');
const { ResourcesService } = require('../dist/resources/resources.service.js');

const bombeiros = [
  { id: '00000000-0000-0000-0000-000000000001', equipe: 'Alfa', autorizacao_registros_diarios_equipe: null },
  { id: '00000000-0000-0000-0000-000000000002', equipe: 'Bravo', autorizacao_registros_diarios_equipe: null },
];
const usuarios = { 'u-ce-alfa': 'Alfa' };

function servico() {
  const database = {
    async query(sql, params = []) {
      if (sql.includes('FROM usuarios u JOIN bombeiros')) return { rows: usuarios[params[0]] ? [{ equipe: usuarios[params[0]] }] : [] };
      if (sql.startsWith('SELECT equipe, autorizacao_registros_diarios_equipe FROM bombeiros')) {
        return { rows: bombeiros.filter(b => params.includes(b.id)) };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  return new ResourcesService(database);
}

const usuario = (role, funcao, id = 'u-1') => ({ id, username: 'fulano', role, funcao });
const alvo = id => [{ column: 'id', operator: 'eq', value: id }];

test('usuário comum não muda o próprio vínculo com a pessoa do cadastro (só o nome)', () => {
  const dto = {
    filters: [{ column: 'username', operator: 'eq', value: 'fulano' }],
    payload: { name: 'Fulano', person_id: 'id-do-gs', person_type: 'bombeiro', role: 'admin' },
  };
  authorizeResource(usuario('bombeiro', 'BA-2'), 'usuarios', 'update', dto);
  assert.deepEqual(Object.keys(dto.payload), ['name']);
});

test('administrador continua ligando uma conta a uma pessoa', () => {
  const dto = { filters: [{ column: 'username', operator: 'eq', value: 'outro' }], payload: { person_id: 'x', person_type: 'bombeiro' } };
  authorizeResource(usuario('admin', null), 'usuarios', 'update', dto);
  assert.equal(dto.payload.person_id, 'x');
});

test('BA-2 não cria, edita nem exclui bombeiro ou APOC', async () => {
  const s = servico();
  const quem = usuario('bombeiro', 'BA-2');
  await assert.rejects(s.conferirCadastroPessoas('bombeiros', 'update', { filters: alvo(bombeiros[0].id), payload: { cargo: 'GS' } }, quem), /Só administrador ou GS/);
  await assert.rejects(s.conferirCadastroPessoas('bombeiros', 'insert', { payload: { nome_completo: 'X' } }, quem), /Só administrador ou GS/);
  await assert.rejects(s.conferirCadastroPessoas('apocs', 'delete', { filters: alvo('qualquer') }, quem), /Só administrador ou GS/);
});

test('GS e administrador alteram o cadastro', async () => {
  const s = servico();
  await s.conferirCadastroPessoas('bombeiros', 'update', { filters: alvo(bombeiros[1].id), payload: { cargo: 'BA-CE' } }, usuario('bombeiro', 'GS'));
  await s.conferirCadastroPessoas('apocs', 'insert', { payload: { nome_completo: 'X' } }, usuario('admin', null));
});

test('BA-CE decide a autorização de registros diários só da própria equipe e só esses campos', async () => {
  const s = servico();
  const ce = usuario('chefe', 'BA-CE', 'u-ce-alfa');
  const decisao = { autorizado_registros_diarios: true, autorizacao_registros_diarios_status: 'aprovado' };
  await s.conferirCadastroPessoas('bombeiros', 'update', { filters: alvo(bombeiros[0].id), payload: decisao }, ce);
  await assert.rejects(s.conferirCadastroPessoas('bombeiros', 'update', { filters: alvo(bombeiros[1].id), payload: decisao }, ce), /Só administrador ou GS/);
  await assert.rejects(s.conferirCadastroPessoas('bombeiros', 'update', { filters: alvo(bombeiros[0].id), payload: { ...decisao, cargo: 'GS' } }, ce), /Só administrador ou GS/);
});

test('outras tabelas não passam por essa regra', async () => {
  await servico().conferirCadastroPessoas('epis', 'delete', { filters: alvo('x') }, usuario('bombeiro', 'BA-2'));
});
