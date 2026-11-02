import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { createPtrbaMemoryDatabase } from './ptrba-memory-database.mjs';

const require = createRequire(import.meta.url);
const { ResourcesService } = require('../../backend/dist/resources/resources.service.js');

// API e sessão sintéticas: criação/edição/exclusão não acessam dados reais.
const appUrl = 'http://127.0.0.1:5183';
const out = path.resolve(import.meta.dirname, '../../tmp/ptrba-apoc-qa');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5183, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const errors = [];
  const dialogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  const member = (id, nome, funcao = 'APOC') => ({ id, nome_completo: nome, nome_guerra: nome, funcao, equipe: 'ASUR' });
  const evidence = assunto => [{ horaInicio: '08:00', horaTermino: '09:00', assunto, descricao: 'Descrição da instrução', imagem: '' }];
  const assuntoNormal = '01. FAMILIARIZAÇÃO COM AERÓDROMO';
  const tables = {
    usuarios: [{ username: 'serra', name: 'QA', role: 'desenvolvedor' }],
    bombeiros: [{ id: 'ce', nome_guerra: 'Chefe', nome_completo: 'Pessoa Chefe', cargo: 'BA-CE', equipe: 'Bravo', data_desligamento: '' }],
    apocs: [member('apoc1', 'Pessoa Ana APOC'), member('apoc2', 'Pessoa José APOC'), member('supervisor', 'Pessoa Supervisor', 'SUPERVISOR'), member('coordenador', 'Pessoa Coordenador', 'COORDENADOR')],
    ptrba_completo_registros: [
      { id: 'normal', is_apoc: false, created_by: 'serra', data: '2026-10-13', equipe: 'Bravo', participantes: [{ funcao: 'BA-CE', nomeCompleto: 'Pessoa Chefe', situacao: 'P' }, { funcao: 'APOC', nomeCompleto: 'Pessoa Ana APOC', situacao: 'P' }], evidencias: evidence(assuntoNormal) },
      { id: 'apoc', created_by: 'serra', data: '2026-10-13', equipe: 'Bravo', is_apoc: true, chefe_equipe: 'Pessoa Chefe', participantes: [{ funcao: 'APOC', nomeCompleto: 'Pessoa José APOC', situacao: 'P' }], evidencias: evidence('INSTRUÇÃO EXCLUSIVA APOC') },
    ],
    escalas_diarias: [{ id: 'diaria', equipe: 'Bravo', data_plantao: '2026-10-13', chefe_equipe: 'Chefe', ptr1: { nomeGuerra: 'Chefe', funcao: 'BA-CE', assunto: 'INSTRUÇÃO AUTOMÁTICA' } }],
  };
  const writes = [];
  const backend = new ResourcesService(createPtrbaMemoryDatabase(
    () => tables.ptrba_completo_registros,
    rows => { tables.ptrba_completo_registros = rows; },
  ));
  await page.clock.install({ time: new Date('2026-10-13T10:00:00-03:00') });
  await page.addInitScript(() => localStorage.setItem('sescinc-session', JSON.stringify({ name: 'QA', username: 'serra', role: 'desenvolvedor', avatar: 'Q' })));
  await page.route('**/api/**', async route => {
    const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
    if (!match) { await route.fulfill({ json: { data: null, error: null } }); return; }
    const [, table, action] = match;
    const body = route.request().postDataJSON();
    if (table === 'ptrba_completo_registros') {
      try {
        const result = await backend[action](table, body, { id: 'qa-user', username: 'qa', role: 'admin' });
        if (action !== 'query') writes.push({ table, action, payload: body.payload });
        await route.fulfill({ json: result });
      } catch (error) {
        await route.fulfill({ status: 400, json: { message: error.message } });
      }
      return;
    }
    tables[table] ||= [];
    let rows = tables[table].filter(row => (body.filters || []).every(f => {
      if (f.operator === 'eq') return row[f.column] === f.value;
      if (f.operator === 'is') return f.value === null ? row[f.column] == null : row[f.column] === f.value;
      if (f.operator === 'gte') return row[f.column] >= f.value;
      if (f.operator === 'lte') return row[f.column] <= f.value;
      return true;
    }));
    if (action === 'insert') {
      rows = [{ id: `novo-${tables[table].length + 1}`, ...body.payload }];
      tables[table].push(...rows);
    } else if (action === 'update') rows.forEach(row => Object.assign(row, body.payload));
    else if (action === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
    if (action !== 'query') writes.push({ table, action, payload: body.payload });
    await route.fulfill({ json: { data: rows, error: null, count: rows.length } });
  });

  await page.goto(`${appUrl}/registros-diarios/ptr-ba-completo`);
  const main = page.locator('main');
  await main.getByRole('heading', { name: 'PTR-BA - Bravo - 13/10/2026', exact: true }).waitFor();
  assert.equal(await main.getByRole('heading', { name: /PTR-BA APOC -/ }).count(), 0);
  assert.equal(await main.getByRole('button', { name: 'Criar PTR-BA APOC', exact: true }).count(), 0);
  await main.getByRole('button', { name: 'Novo PTR-BA', exact: true }).click();
  const normalForm = main.locator('form');
  await normalForm.locator('select').first().selectOption('Bravo');
  await normalForm.getByText('BA-CE Pessoa Chefe', { exact: true }).waitFor();
  const spareParticipant = normalForm.locator('div.grid.grid-cols-1.gap-3').nth(1);
  await spareParticipant.locator('select').first().selectOption('APOC');
  await spareParticipant.getByText('Selecione o nome', { exact: true }).click();
  await spareParticipant.getByRole('button').filter({ hasText: 'Pessoa Ana APOC' }).click();
  await spareParticipant.getByText('APOC Pessoa Ana APOC', { exact: true }).waitFor();
  await normalForm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await main.getByRole('button', { name: 'PTR-BA Normais', exact: true }).count(), 0);
  assert.equal(await main.getByRole('button', { name: 'PTR-BA APOC', exact: true }).count(), 0);
  const search = main.getByRole('searchbox', { name: 'Pesquisar pelo nome do APOC' });
  const participation = main.getByRole('combobox', { name: 'Filtrar por participação APOC' });
  await participation.selectOption('apoc');
  await search.fill('  ana  ');
  assert.equal(await main.getByRole('heading', { name: /^PTR-BA - Bravo/ }).count(), 1);
  await search.fill('Chefe');
  await main.getByText('Nenhum registro encontrado', { exact: true }).waitFor();
  await search.fill('jose');
  await main.getByText('Nenhum registro encontrado', { exact: true }).waitFor();
  await search.fill('');
  await participation.selectOption('todos');
  await main.getByRole('button', { name: 'Novo PTR-BA', exact: true }).click();
  const form = main.locator('form');
  await form.locator('select').first().selectOption('Bravo');
  await form.getByText('BA-CE Pessoa Chefe', { exact: true }).waitFor();
  const apocRow = form.locator('div.grid.grid-cols-1.gap-3').nth(1);
  await apocRow.locator('select').first().selectOption('APOC');
  await apocRow.getByText('Selecione o nome', { exact: true }).click();
  await apocRow.getByRole('button').filter({ hasText: 'Pessoa Ana APOC' }).click();
  const subjects = ['03. FAMILIARIZAÇÃO COM O(S) CCI EM OPERAÇÃO NO AERÓDROMO', '06. SISTEMAS DE COMUNICAÇÃO E ALARME', '13. PLANO DE EMERGÊNCIA EM AERÓDROMO (PLEM)'];
  const subjectSelects = form.getByText('Assunto', { exact: true }).locator('..').locator('select');
  for (let index = 0; index < 3; index++) {
    // Escolhe pelo número, preservando as opções oficiais do formulário.
    const option = await subjectSelects.nth(index).locator('option').allTextContents();
    subjects[index] = option.find(text => text.startsWith(subjects[index].slice(0, 3)));
    await subjectSelects.nth(index).selectOption({ label: subjects[index] });
    await form.locator('input[type="time"]').nth(index * 2).fill(`${String(7 + index).padStart(2, '0')}:00`);
    await form.locator('input[type="time"]').nth(index * 2 + 1).fill(`${String(8 + index).padStart(2, '0')}:00`);
    await form.locator('textarea').nth(index).fill(`Descrição da instrução ${index + 1}`);
  }
  const imagensTeste = await page.evaluate(() => Array.from({ length: 6 }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = ['#e2e8f0', '#dbeafe', '#dcfce7'][Math.floor(index / 2)];
    ctx.fillRect(0, 0, 640, 320);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`EVIDÊNCIA ILUSTRATIVA ${index + 1}`, 40, 140);
    ctx.font = '20px Arial';
    ctx.fillText(`Instrução ${Math.floor(index / 2) + 1} do PTR-BA normal`, 40, 185);
    return canvas.toDataURL('image/png').split(',')[1];
  }));
  for (let index = 0; index < 6; index++) {
    await form.locator('input[type="file"]').nth(index).setInputFiles({ name: `evidencia-${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(imagensTeste[index], 'base64') });
  }
  await form.locator('img').nth(5).waitFor();
  await form.locator('textarea').last().fill('Observações do PTR-BA normal.');
  await form.locator('input[placeholder="Nome do chefe"]').fill('Pessoa Chefe');
  await page.screenshot({ path: path.join(out, 'form-normal.png'), fullPage: true, animations: 'disabled' });
  await form.getByRole('button', { name: 'Criar PTR-BA', exact: true }).click();
  await page.getByRole('heading', { name: 'PTR-BA salvo', exact: true }).waitFor();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  assert.equal(writes.at(-1).payload.is_apoc, false);
  const normalCriado = tables.ptrba_completo_registros.find(row => row.id !== 'normal' && !row.is_apoc);
  assert.ok(normalCriado);
  assert.equal(tables.ptrba_completo_registros.length, 3, 'A criação deve gravar apenas um documento');
  assert.equal(tables.ptrba_completo_registros.filter(row => row.origem_ptrba_id).length, 0);
  assert.equal(await main.getByRole('heading', { name: /PTR-BA APOC -/ }).count(), 0);
  const createdCard = main.locator('div.overflow-hidden.rounded-2xl').filter({ hasText: subjects[1] });
  await createdCard.getByRole('button', { name: /Ver detalhes/ }).click();
  assert.ok((await createdCard.innerText()).includes(subjects[0]));
  assert.ok((await createdCard.innerText()).includes(subjects[1]));
  await createdCard.getByRole('button', { name: 'Editar', exact: true }).click();
  await main.getByRole('heading', { name: 'PTR-BA - Editar Registro' }).waitFor();
  await form.locator('textarea').last().fill('Observação editada');
  await form.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await page.getByRole('heading', { name: 'PTR-BA salvo', exact: true }).waitFor();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  assert.equal(tables.ptrba_completo_registros.length, 3, 'A edição também não deve gerar cópia');
  assert.equal(tables.ptrba_completo_registros.find(row => row.id === normalCriado.id).observacoes, 'Observação editada');
  await createdCard.getByRole('button', { name: /Ver detalhes/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await createdCard.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), '13-10-2026 NVT PTRBA BRAVO.pdf');
  await download.saveAs(path.join(out, download.suggestedFilename()));
  const pdfBytes = await fs.readFile(path.join(out, download.suggestedFilename()));
  const rendered = await page.evaluate(async bytes => {
    const { default: pdfjs } = await import('/src/lib/pdfjs-setup.ts');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const pdfPage = await pdf.getPage(1);
    const text = (await pdfPage.getTextContent()).items.map(item => item.str).join(' ');
    const canvas = document.createElement('canvas');
    const viewport = pdfPage.getViewport({ scale: 1.6 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
    return { pages: pdf.numPages, text, png: canvas.toDataURL('image/png').split(',')[1] };
  }, Array.from(pdfBytes));
  assert.equal(rendered.pages, 1);
  assert.ok(rendered.text.includes('PESSOA CHEFE'));
  assert.ok(rendered.text.includes('PESSOA ANA APOC'));
  assert.ok(rendered.text.includes('ASSINATURA DO CHEFE DE EQUIPE'));
  assert.ok(rendered.text.includes('03.'));
  assert.ok(rendered.text.indexOf('06.') < rendered.text.indexOf('13.'));
  await fs.writeFile(path.join(out, 'normal-pdf.png'), Buffer.from(rendered.png, 'base64'));

  // Normal original 1h + novo normal 3h. Ana participa de 1h original + 2h permitidas no novo.
  await page.goto(`${appUrl}/relatorios/ptr-ba`);
  await main.getByRole('heading', { name: /^Relatório PTR-BA/ }).waitFor();
  await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('de atividade'));
  assert.match(await main.innerText(), /4h\s*de atividade · 4 registro\(s\)/);
  const anaComParticipacao = main.locator('tr').filter({ hasText: 'Pessoa Ana APOC' });
  assert.match(await anaComParticipacao.first().innerText(), /3h/);
  await page.goto(`${appUrl}/registros-diarios/ptr-ba-completo`);
  await main.getByRole('heading', { name: 'PTR-BA - Bravo - 13/10/2026', exact: true }).first().waitFor();

  // Exclusão do novo normal mantém os registros anteriores.
  const normalCard = main.locator('div.overflow-hidden.rounded-2xl').filter({ hasText: '06. SISTEMAS DE COMUNICAÇÃO E ALARME' });
  await normalCard.getByRole('button', { name: /Ver detalhes/ }).click();
  await normalCard.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelectorAll('main h3').length === 1);
  assert.equal(tables.ptrba_completo_registros.length, 2);

  // Documento APOC histórico não entra na listagem nem nas horas dos relatórios.
  await page.goto(`${appUrl}/relatorios/ptr-ba-registros`);
  await main.getByRole('heading', { name: 'PTR-BA Registros', exact: true }).waitFor();
  await main.getByText(assuntoNormal, { exact: true }).first().waitFor();
  assert.equal(await main.getByText('INSTRUÇÃO EXCLUSIVA APOC', { exact: true }).count(), 0);
  assert.equal(await main.locator('tbody tr').filter({ hasText: '13/10/2026' }).count(), 1);
  await page.goto(`${appUrl}/relatorios/ptr-ba`);
  await main.getByRole('heading', { name: /^Relatório PTR-BA/ }).waitFor();
  await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('de atividade'));
  assert.equal(await main.getByText('INSTRUÇÃO EXCLUSIVA APOC', { exact: true }).count(), 0);
  assert.match(await main.innerText(), /1h\s*de atividade · 1 registro\(s\)/);
  const anaReport = main.locator('tr').filter({ hasText: 'Pessoa Ana APOC' });
  await anaReport.first().waitFor();
  assert.match(await anaReport.first().innerText(), /1h/);

  // Mistura assuntos elegíveis/não elegíveis por número e documento
  // normal sem o APOC: equipe soma 6h, mas Ana continua apenas com sua 1h.
  const normalOriginal = structuredClone(tables.ptrba_completo_registros[0]);
  const instruction = (assunto, horaInicio, horaTermino) => ({ assunto, horaInicio, horaTermino, descricao: '', imagem: '' });
  const elegivel = instruction('01. FAMILIARIZAÇÃO COM AERÓDROMO', '08:00', '09:00');
  const inelegivel = instruction('07. SISTEMA DE COMBATE A INCÊNDIO', '10:00', '12:00');
  tables.ptrba_completo_registros[0].evidencias = [elegivel, elegivel, inelegivel, inelegivel];
  tables.ptrba_completo_registros.push({ ...normalOriginal, id: 'normal-sem-apoc', participantes: normalOriginal.participantes.filter(p => p.funcao !== 'APOC'), evidencias: [instruction(assuntoNormal, '13:00', '16:00')] });
  await page.reload();
  await main.getByRole('heading', { name: /^Relatório PTR-BA/ }).waitFor();
  await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('de atividade'));
  assert.match(await main.innerText(), /6h\s*de atividade · 3 registro\(s\)/);
  assert.match(await anaReport.first().innerText(), /1h/);
  const chefeReport = main.locator('tr').filter({ hasText: 'BA-CE' }).filter({ hasText: 'Chefe' });
  assert.match(await chefeReport.first().innerText(), /6h/);
  await anaReport.first().click();
  await main.getByRole('heading', { name: /^PTR-BA · Pessoa Ana APOC/ }).waitFor();
  assert.equal(await main.getByRole('button').filter({ hasText: '07. SISTEMAS DE COMBATE A INCÊNDIO' }).count(), 0);
  assert.equal(await main.getByRole('button').filter({ hasText: '08:00' }).count(), 1);
  await page.evaluate(() => {
    window.__qaPrintHtml = '';
    window.open = () => ({ document: { write(html) { window.__qaPrintHtml = html; }, close() {} }, print() {} });
  });
  await main.getByRole('button', { name: 'Imprimir Pessoa', exact: true }).click();
  const printRows = await page.evaluate(() => [...new DOMParser().parseFromString(window.__qaPrintHtml, 'text/html').querySelector('table').querySelectorAll('tbody tr')].map(tr => tr.textContent));
  assert.equal(printRows.length, 1);
  assert.ok(printRows[0].includes('08:00 às 09:00'));
  assert.ok(!printRows.some(row => row.includes('10:00') || row.includes('13:00')));
  await page.goto(`${appUrl}/relatorios/ptr-ba`);
  await main.getByRole('heading', { name: /^Relatório PTR-BA/ }).waitFor();
  const personFilter = main.locator('select').filter({ has: page.locator('option[value="Pessoa Ana APOC"]') });
  await personFilter.selectOption('Pessoa Ana APOC');
  await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('1hde atividade'));
  assert.match(await main.innerText(), /1h\s*de atividade · 1 registro\(s\)/);
  tables.ptrba_completo_registros[0] = normalOriginal;
  tables.ptrba_completo_registros = tables.ptrba_completo_registros.filter(r => r.id !== 'normal-sem-apoc');

  // Compatibilidade do gerador com PDFs históricos e normais.
  const pdfs = await page.evaluate(async () => {
    const { gerarPTRBACompletoPdf } = await import('/src/services/ptrbaCompletoPdfService.ts');
    const registro = { id: 'qa', createdBy: 'qa', createdAt: '', updatedAt: '', data: '2026-10-13', equipe: 'Bravo', isApoc: true, isExtra: false, identificacaoAeroporto: 'SBNF - Aeroporto Internacional de Navegantes', observacoes: 'Observações da instrução. Todos os participantes são APOCs.', chefeEquipe: 'Pessoa Chefe', participantes: Array.from({ length: 15 }, (_, i) => ({ funcao: 'APOC', nomeCompleto: `PESSOA APOC PARTICIPANTE ${i + 1}`, situacao: 'P' })), evidencias: [{ horaInicio: '08:00', horaTermino: '09:00', assunto: 'Instrução operacional', descricao: 'Descrição de teste', imagem: '' }] };
    const max = await gerarPTRBACompletoPdf(registro);
    const normal = await gerarPTRBACompletoPdf({ ...registro, isApoc: false, participantes: registro.participantes.slice(0, 10).map(p => ({ ...p, funcao: 'BA-2' })) });
    return [Array.from(new Uint8Array(await max.arrayBuffer())), Array.from(new Uint8Array(await normal.arrayBuffer()))];
  });
  await fs.writeFile(path.join(out, 'apoc-15.pdf'), Buffer.from(pdfs[0]));
  await fs.writeFile(path.join(out, 'normal.pdf'), Buffer.from(pdfs[1]));

  await page.goto(`${appUrl}/registros-diarios/ptr-ba-completo`);
  await main.getByRole('heading', { name: 'PTR-BA - Bravo - 13/10/2026', exact: true }).waitFor();
  assert.equal(tables.ptrba_completo_registros.length, 2);
  const fixture = structuredClone(tables.ptrba_completo_registros[0]);
  tables.ptrba_completo_registros.push(
    { ...fixture, id: 'sem-apoc', participantes: fixture.participantes.filter(p => p.funcao !== 'APOC') },
    { ...fixture, id: 'jose-31', data: '2026-09-15', equipe: 'Alfa', participantes: [{ funcao: 'APOC', nomeCompleto: 'Pessoa José APOC', situacao: 'P' }], evidencias: evidence('31. INSTRUÇÃO EXTRA') },
  );
  await page.reload();
  await main.getByRole('heading', { name: 'PTR-BA', exact: true }).waitFor();
  await main.getByRole('combobox', { name: 'Filtrar por mês' }).selectOption('');
  await main.getByRole('combobox', { name: 'Filtrar por participação APOC' }).selectOption('apoc');
  await main.getByText('2 registro(s)', { exact: true }).waitFor();
  await main.getByRole('searchbox', { name: 'Pesquisar pelo nome do APOC' }).fill(' JOSE ');
  await main.getByText('1 registro(s)', { exact: true }).waitFor();
  await main.getByRole('heading', { name: 'PTR-BA - Alfa - 15/09/2026', exact: true }).waitFor();
  assert.ok((await main.innerText()).includes('31. INSTRUÇÃO EXTRA'));
  await main.getByRole('combobox', { name: 'Filtrar por equipe' }).selectOption('Bravo');
  await main.getByText('Nenhum registro encontrado', { exact: true }).waitFor();
  await main.getByRole('combobox', { name: 'Filtrar por equipe' }).selectOption('');
  await main.getByRole('combobox', { name: 'Filtrar por mês' }).selectOption('10');
  await main.getByText('Nenhum registro encontrado', { exact: true }).waitFor();
  await main.getByRole('combobox', { name: 'Filtrar por mês' }).selectOption('');
  await main.getByRole('searchbox', { name: 'Pesquisar pelo nome do APOC' }).fill('');
  await main.getByRole('combobox', { name: 'Filtrar por participação APOC' }).selectOption('todos');
  await main.getByText('3 registro(s)', { exact: true }).waitFor();
  await main.getByRole('searchbox', { name: 'Pesquisar pelo nome do APOC' }).fill('Ana');
  await main.getByText('1 registro(s)', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'filtro-apoc.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'filtro-apoc-mobile.png'), fullPage: true, animations: 'disabled' });
  assert.ok(await main.evaluate(el => el.scrollWidth <= el.clientWidth), 'Conteúdo mobile não deve transbordar horizontalmente');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(out, 'filtro-apoc-dark.png'), fullPage: true, animations: 'disabled' });
  assert.deepEqual(dialogs, []);
  assert.deepEqual(errors, []);
  console.log('PTR-BA: lista única, filtros APOC/nome/equipe/mês, criação e edição sem cópia, horas elegíveis, relatórios, impressão, PDF, mobile e tema escuro passaram.');
} finally {
  await browser?.close();
  await server.close();
}
