import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createPtrbaMemoryDatabase } from './ptrba-memory-database.mjs';

// Service + adapter HTTP + backend reais, com SQL em memória, sem banco externo.
const require = createRequire(import.meta.url);
const { ResourcesService } = require('../../backend/dist/resources/resources.service.js');
const srcRoot = path.resolve(import.meta.dirname, '..', 'src');
const table = 'ptrba_completo_registros';
const participante = (nomeCompleto = 'Pessoa APOC', funcao = 'APOC') => ({ nomeCompleto, funcao, situacao: 'P' });
const registro = (overrides = {}) => ({
  data: '2026-10-13', equipe: 'Bravo', createdBy: 'qa', isExtra: false, isApoc: true,
  identificacaoAeroporto: 'NVT', chefeEquipe: 'Pessoa Chefe', observacoes: '',
  participantes: [participante()], evidencias: [{ horaInicio: '08:00', horaTermino: '09:00', assunto: 'Instrução', descricao: '', imagem: '' }],
  ...overrides,
});

function harness(initial = []) {
  let rows = structuredClone(initial);
  let fail = false;
  const database = createPtrbaMemoryDatabase(() => rows, value => { rows = value; });
  const sqlCalls = database.sqlCalls;
  const backend = new ResourcesService(database);
  const context = vm.createContext({
    console: { ...console, error() {} }, structuredClone, FormData, Blob,
    fetch: async (url, init) => {
      const [, resource, action] = new URL(url).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
      try {
        if (fail) throw new Error('API indisponível');
        const result = await backend[action](resource, JSON.parse(init.body));
        return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ message: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
    },
  });
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const source = fs.readFileSync(filename, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    vm.runInContext(`(function(exports, require, module) {\n${output}\n})`, context, { filename })(module.exports,
      spec => load(path.resolve(path.dirname(filename), `${spec}.ts`)), module);
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { backend, database, service: load(path.join(srcRoot, 'services/ptrbaCompletoService.ts')), load, sqlCalls, fail: () => { fail = true; } };
}

test('lista operacional exclui APOC mesmo após cache da gestão e preserva histórico sem modalidade', async () => {
  const h = harness([
    { id: 'legado', data: '2026-10-13', equipe: 'Bravo', participantes: [participante('Pessoa Equipe', 'BA-CE'), participante()] },
    { id: 'normal-extra', data: '2026-10-13', equipe: 'Bravo', is_apoc: false, is_extra: true },
    { id: 'apoc', data: '2026-10-13', equipe: 'Bravo', is_apoc: true, participantes: [participante()] },
  ]);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos' })).length, 3);
  const normais = await h.service.listarPTRBACompletos();
  assert.deepEqual(Array.from(normais, r => r.id), ['legado', 'normal-extra']);
  assert.equal(normais[0].participantes[1].funcao, 'APOC'); // APOC junto à equipe continua contado.
  assert.equal(normais[1].isExtra, true);
  assert.deepEqual(Array.from(await h.service.listarPTRBACompletos({ modalidade: 'apoc' }), r => r.id), ['apoc']);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos', equipe: 'Alfa' })).length, 0);
});

test('criação, leitura, edição parcial e exclusão preservam modalidade e não acrescentam bombeiros', async () => {
  const h = harness();
  const created = await h.service.criarPTRBACompleto(registro({ participantes: [participante(), participante('Outro APOC')] }));
  assert.equal(created.isApoc, true);
  assert.equal(created.participantes.length, 2);
  assert.ok(created.participantes.every(p => p.funcao === 'APOC'));
  const edited = await h.service.atualizarPTRBACompleto(created.id, { observacoes: 'Editado', participantes: [participante('Outro APOC')] });
  assert.equal(edited.isApoc, true);
  assert.equal(edited.participantes.length, 1);
  assert.equal(edited.observacoes, 'Editado');
  assert.ok(h.sqlCalls.some(sql => sql.endsWith('FOR UPDATE')));
  assert.equal((await h.service.obterPTRBACompleto(created.id)).isApoc, true);
  assert.equal((await h.service.listarPTRBACompletos()).length, 0);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'apoc', ano: '2026', dataGte: '2026-10-01', dataLte: '2026-10-31' })).length, 1);
  await h.service.excluirPTRBACompleto(created.id);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos' })).length, 0);
});

test('API impede outra função, nomes ausentes, duplicatas e excesso de participantes', async () => {
  const h = harness();
  for (const participantes of [[], [participante('')], [participante('Bombeiro', 'BA-CE')], [participante(), participante(' Pessoa APOC ')], Array.from({ length: 16 }, (_, i) => participante(`APOC ${i}`))]) {
    await assert.rejects(h.backend.insert(table, { payload: { is_apoc: true, participantes }, select: '*' }), /APOC|participantes/);
  }
  await assert.rejects(h.backend.insert(table, { payload: { is_apoc: 'true', participantes: [participante()] } }), /modalidade/);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos' })).length, 0);
});

test('edição sem modalidade continua validada e não pode converter APOC em normal ou normal em APOC', async () => {
  const h = harness();
  const apoc = await h.service.criarPTRBACompleto(registro());
  await assert.rejects(h.service.atualizarPTRBACompleto(apoc.id, { participantes: [participante('Bombeiro', 'BA-CE')] }), /apenas participantes/);
  await assert.rejects(h.service.atualizarPTRBACompleto(apoc.id, { isApoc: false }), /modalidade/);
  assert.equal((await h.service.obterPTRBACompleto(apoc.id)).participantes[0].nomeCompleto, 'Pessoa APOC');
  const normal = await h.service.criarPTRBACompleto(registro({ isApoc: false, isExtra: true, participantes: [participante('Chefe', 'BA-CE'), participante()] }));
  await assert.rejects(h.service.atualizarPTRBACompleto(normal.id, { isApoc: true }), /modalidade/);
  assert.equal((await h.service.listarPTRBACompletos())[0].isExtra, true);
});

test('nome do PDF usa DD-MM-AAAA no APOC e conserva nomes normal/EXTRA', () => {
  const h = harness();
  const { nomeArquivoPTRBACompleto } = h.load(path.join(srcRoot, 'utils/documentFileNames.ts'));
  assert.equal(nomeArquivoPTRBACompleto(registro()), 'PTR-BA_APOC_13-10-2026.pdf');
  assert.equal(nomeArquivoPTRBACompleto(registro({ isApoc: false })), '13-10-2026 NVT PTRBA BRAVO.pdf');
  assert.equal(nomeArquivoPTRBACompleto(registro({ isApoc: false, isExtra: true })), '13-10-2026 NVT PTRBA EXTRA BRAVO.pdf');
});

test('falhas da API são propagadas para a tela', async () => {
  const h = harness();
  h.fail();
  await assert.rejects(h.service.listarPTRBACompletos(), /API indisponível/);
  await assert.rejects(h.service.criarPTRBACompleto(registro()), /API indisponível/);
});

test('elegibilidade APOC segue os números da coluna OC; todos os demais até 31 ficam excluídos', () => {
  const h = harness();
  const { apocParticipaDoAssuntoPTRBA, participanteContaNoAssuntoPTRBA } = h.load(path.join(srcRoot, 'types/ptrb.ts'));
  const referencia = [
    ['Familiarização com o aeródromo', true],
    ['Familiarização com as aeronaves que operam com regularidade no aeródromo', true],
    ['Familiarização com o(s) CCI em operação no aeródromo', false],
    ['Procedimentos de segurança na execução de atividades operacionais', false],
    ['Condução de veículos de emergência na área operacional do aeródromo', false],
    ['Sistemas de comunicação e alarme', true],
    ['Sistemas de combate a incêndio', false],
    ['Equipamentos de apoio às operações de resgate', false],
    ['Procedimentos de aplicação de agentes extintores', false],
    ['Procedimentos de assistência na evacuação de aeronaves', false],
    ['Reabastecimento do CCI com água', false],
    ['Emergências com artigos perigosos', true],
    ['Plano de Emergência em Aeródromo (PLEM)', true],
    ['Plano Contraincêndio de Aeródromo (PCINC)', true],
    ['Equipamentos de Proteção', false],
    ['Prática de treinamentos de socorro e urgência', false],
    ['Operações em baixa visibilidade, quando aplicável', true],
  ];
  for (const [index, [titulo, participa]] of referencia.entries()) {
    const assunto = `${String(index + 1).padStart(2, '0')}. ${titulo}`;
    assert.equal(apocParticipaDoAssuntoPTRBA(assunto), participa, titulo);
    assert.equal(participanteContaNoAssuntoPTRBA({ funcao: 'APOC' }, assunto), participa);
    assert.equal(participanteContaNoAssuntoPTRBA({ funcao: 'BA-CE' }, assunto), true);
  }
  for (let numero = 18; numero <= 31; numero++) assert.equal(apocParticipaDoAssuntoPTRBA(`${numero}. INSTRUÇÃO EXTRA`), false);
  for (const titulo of ['01', '6. SISTEMA DE COMUNICAÇÃO E ALARME', '17. OPERAÇÃO EM BAIXA VISIBILIDADE', '01. FAMILIARIZAÇÃO COM AERÓDROMO', '06. OUTRA GRAFIA']) assert.equal(apocParticipaDoAssuntoPTRBA(titulo), true);
  for (const titulo of ['99. SISTEMA DE COMUNICAÇÃO E ALARME', '07. SISTEMAS DE COMBATE A INCÊNDIO', '25. TEMA EXTRA - NÓS E AMARRAÇÕES', '170. OPERAÇÃO EM BAIXA VISIBILIDADE', 'FAMILIARIZAÇÃO COM O AERÓDROMO', '']) assert.equal(apocParticipaDoAssuntoPTRBA(titulo), false);
});

test('novas opções corrigem títulos sem apagar a opção histórica selecionada', () => {
  const h = harness();
  const { opcoesAssuntoPTRBA, canonicalizarAssuntoPTRBA } = h.load(path.join(srcRoot, 'types/ptrb.ts'));
  const antigo = '17. OPERAÇÃO EM BAIXA VISIBILIDADE';
  assert.ok(opcoesAssuntoPTRBA(antigo).includes(antigo));
  assert.equal(canonicalizarAssuntoPTRBA(antigo), '17. OPERAÇÕES EM BAIXA VISIBILIDADE, QUANDO APLICÁVEL');
  assert.equal(canonicalizarAssuntoPTRBA('06. SISTEMA DE COMUNICAÇÃO E ALARME'), '06. SISTEMAS DE COMUNICAÇÃO E ALARME');
  assert.equal(canonicalizarAssuntoPTRBA('88. SISTEMA DE COMUNICAÇÃO E ALARME'), '88. SISTEMA DE COMUNICAÇÃO E ALARME');
  assert.equal(canonicalizarAssuntoPTRBA('Título personalizado'), 'Título personalizado');
});

test('estatísticas preservam horas da equipe e só registram participação/instrução APOC em assuntos elegíveis', () => {
  const h = harness();
  const regras = h.load(path.join(srcRoot, 'types/ptrb.ts'));
  const tipos = h.load(path.join(srcRoot, 'types/ptrbaCompleto.ts'));
  const filename = path.join(srcRoot, 'pages/Estatisticas/Estatisticas.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['calcHoras', 'horasPtrbaCompleto', 'instrucoesDaSituacao', 'instrutoresPtrbaCompleto', 'tempoParaSegundos', 'montarTreinos'];
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const montar = vm.runInNewContext(`(function(PTRBA_COMPLETO_EVIDENCIA_PARES, canonicalizarAssuntoPTRBA, participanteContaNoAssuntoPTRBA) { ${compiled}; return montarTreinos; })`)(tipos.PTRBA_COMPLETO_EVIDENCIA_PARES, regras.canonicalizarAssuntoPTRBA, regras.participanteContaNoAssuntoPTRBA);
  const evidencia = (assunto, horaInicio, horaTermino) => ({ assunto, horaInicio, horaTermino });
  const autorizado = evidencia('06. SISTEMA DE COMUNICAÇÃO E ALARME', '08:00', '09:00');
  const outro = evidencia('07. SISTEMAS DE COMBATE A INCÊNDIO', '10:00', '12:00');
  const membros = [{ ...participante(), situacao: 'INSTR. 1-2' }, participante('Chefe', 'BA-CE')];
  const itens = montar([
    registro({ id: 'normal-misto', isApoc: false, participantes: membros, evidencias: [autorizado, autorizado, outro, outro] }),
    registro({ id: 'normal-outro', isApoc: false, participantes: membros, evidencias: [outro] }),
    registro({ id: 'documento-apoc', isApoc: true }),
  ], [], [], [], []);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].horas, 3);
  assert.ok(itens[0].participantes.includes('Pessoa APOC'));
  assert.equal(itens[0].instrutores.length, 1);
  assert.equal(itens[1].horas, 2);
  assert.ok(!itens[1].participantes.includes('Pessoa APOC'));
  assert.ok(itens[1].participantes.includes('Chefe'));
  assert.equal(itens[1].instrutores.length, 0);
});

const par = (assunto, horaInicio, horaTermino, descricao = assunto) => [
  { assunto, horaInicio, horaTermino, descricao, imagem: `${assunto}-foto1` },
  { assunto, horaInicio, horaTermino, descricao, imagem: `${assunto}-foto2` },
];
const normalMisto = () => registro({
  isApoc: false, isExtra: true, observacoes: 'Observação geral',
  participantes: [participante('Chefe', 'BA-CE'), { ...participante(), situacao: 'INSTR. 2-3' }],
  evidencias: [
    ...par('03. CCI', '07:00', '08:00'),
    ...par('06. SISTEMAS DE COMUNICAÇÃO E ALARME', '08:00', '09:00'),
    ...par('13. PLEM', '10:00', '11:00'),
  ],
});

test('normal gera uma cópia vinculada com chefe, somente APOCs e pares permitidos compactados', async () => {
  const h = harness();
  const input = normalMisto();
  const normal = await h.service.criarPTRBACompleto(input);
  const copias = await h.service.listarPTRBACompletos({ modalidade: 'apoc' });
  assert.equal(copias.length, 1);
  const copia = copias[0];
  assert.equal(copia.origemPtrbaId, normal.id);
  for (const key of ['chefeEquipe', 'identificacaoAeroporto', 'data', 'equipe', 'observacoes', 'createdBy', 'isExtra']) assert.equal(copia[key], input[key]);
  assert.equal(copia.participantes.length, 1);
  assert.equal(copia.participantes[0].nomeCompleto, 'Pessoa APOC');
  assert.equal(copia.participantes[0].situacao, 'INSTR. 1-2');
  assert.deepEqual(JSON.parse(JSON.stringify(copia.evidencias.slice(0, 4))), input.evidencias.slice(2));
  assert.equal(copia.evidencias[4].assunto, '');
  assert.equal(copia.evidencias[5].imagem, '');
  assert.equal(normal.evidencias[0].assunto, '03. CCI');
  assert.equal((await h.service.listarPTRBACompletos()).length, 1);
});

test('edição sincroniza a mesma cópia e recompacta blocos e instrutores sem duplicar', async () => {
  const h = harness();
  const normal = await h.service.criarPTRBACompleto(normalMisto());
  const copia = (await h.service.listarPTRBACompletos({ modalidade: 'apoc' }))[0];
  const input = normalMisto();
  input.evidencias.splice(2, 2, ...par('07. COMBATE', '08:00', '09:00'));
  await h.service.atualizarPTRBACompleto(normal.id, { evidencias: input.evidencias, chefeEquipe: 'Novo chefe', updatedBy: 'editor' });
  await h.service.atualizarPTRBACompleto(normal.id, { observacoes: 'Editado novamente' });
  const copias = await h.service.listarPTRBACompletos({ modalidade: 'apoc' });
  assert.equal(copias.length, 1);
  assert.equal(copias[0].id, copia.id);
  assert.equal(copias[0].evidencias[0].assunto, '13. PLEM');
  assert.equal(copias[0].evidencias[0].horaInicio, '10:00');
  assert.equal(copias[0].evidencias[0].imagem, '13. PLEM-foto1');
  assert.equal(copias[0].evidencias[1].imagem, '13. PLEM-foto2');
  assert.equal(copias[0].evidencias[2].assunto, '');
  assert.equal(copias[0].participantes[0].situacao, 'INSTR. 1');
  assert.equal(copias[0].chefeEquipe, 'Novo chefe');
  assert.equal(copias[0].updatedBy, 'editor');
  assert.equal(copias[0].observacoes, 'Editado novamente');
  await assert.rejects(h.service.atualizarPTRBACompleto(copia.id, { observacoes: 'Divergente' }), /origem/);
  await assert.rejects(h.service.excluirPTRBACompleto(copia.id), /origem/);
});

test('sem APOC ou sem assunto elegível não gera cópia; remoção e exclusão acompanham origem', async () => {
  const h = harness();
  const normal = await h.service.criarPTRBACompleto(normalMisto());
  await h.service.atualizarPTRBACompleto(normal.id, { participantes: [participante('Chefe', 'BA-CE')] });
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'apoc' })).length, 0);
  await h.service.atualizarPTRBACompleto(normal.id, { participantes: normalMisto().participantes });
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'apoc' })).length, 1);
  await h.service.atualizarPTRBACompleto(normal.id, { evidencias: par('03. CCI', '08:00', '09:00') });
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'apoc' })).length, 0);
  await h.service.atualizarPTRBACompleto(normal.id, { evidencias: normalMisto().evidencias });
  await h.service.excluirPTRBACompleto(normal.id);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos' })).length, 0);
});

test('falha na cópia desfaz criação e edição do normal na mesma transação', async () => {
  const h = harness();
  h.database.failNextCopy();
  await assert.rejects(h.service.criarPTRBACompleto(normalMisto()), /Falha ao gravar/);
  assert.equal((await h.service.listarPTRBACompletos({ modalidade: 'todos' })).length, 0);
  const normal = await h.service.criarPTRBACompleto(normalMisto());
  h.database.failNextCopy();
  await assert.rejects(h.service.atualizarPTRBACompleto(normal.id, { chefeEquipe: 'Não persistir' }), /Falha ao gravar/);
  assert.equal((await h.service.obterPTRBACompleto(normal.id)).chefeEquipe, normal.chefeEquipe);
});

test('geração usa os mesmos números da contagem e não permite forjar o vínculo', async () => {
  const h = harness();
  const { NUMEROS_ASSUNTOS_PTRBA_APOC } = require('../../backend/dist/resources/ptrba-apoc.js');
  const regras = h.load(path.join(srcRoot, 'types/ptrb.ts'));
  assert.deepEqual(NUMEROS_ASSUNTOS_PTRBA_APOC, Array.from(regras.NUMEROS_ASSUNTOS_PTRBA_APOC));
  for (let numero = 1; numero <= 31; numero++) {
    const normal = await h.service.criarPTRBACompleto(registro({ isApoc: false, evidencias: par(`${String(numero).padStart(2, '0')}. Assunto`, '08:00', '09:00') }));
    const copias = await h.service.listarPTRBACompletos({ modalidade: 'apoc' });
    assert.equal(copias.some(copia => copia.origemPtrbaId === normal.id), NUMEROS_ASSUNTOS_PTRBA_APOC.includes(numero), `Assunto ${numero}`);
  }
  await assert.rejects(h.backend.insert(table, { payload: { origem_ptrba_id: 'forjado' } }), /gerenciado automaticamente/);
  const normal = (await h.service.listarPTRBACompletos())[0];
  await assert.rejects(h.backend.update(table, { payload: { origem_ptrba_id: null }, filters: [{ column: 'id', operator: 'eq', value: normal.id }] }), /gerenciado automaticamente/);
});
