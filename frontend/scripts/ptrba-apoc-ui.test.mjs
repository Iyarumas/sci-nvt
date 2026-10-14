import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

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
      { id: 'normal', created_by: 'serra', data: '2026-10-13', equipe: 'Bravo', participantes: [{ funcao: 'BA-CE', nomeCompleto: 'Pessoa Chefe', situacao: 'P' }, { funcao: 'APOC', nomeCompleto: 'Pessoa Ana APOC', situacao: 'P' }], evidencias: evidence(assuntoNormal) },
      { id: 'apoc', created_by: 'serra', data: '2026-10-13', equipe: 'Bravo', is_apoc: true, chefe_equipe: 'Pessoa Chefe', participantes: [{ funcao: 'APOC', nomeCompleto: 'Pessoa José APOC', situacao: 'P' }], evidencias: evidence('INSTRUÇÃO EXCLUSIVA APOC') },
    ],
    escalas_diarias: [{ id: 'diaria', equipe: 'Bravo', data_plantao: '2026-10-13', chefe_equipe: 'Chefe', ptr1: { nomeGuerra: 'Chefe', funcao: 'BA-CE', assunto: 'INSTRUÇÃO AUTOMÁTICA' } }],
  };
  const writes = [];
  await page.clock.install({ time: new Date('2026-10-13T10:00:00-03:00') });
  await page.addInitScript(() => localStorage.setItem('sescinc-session', JSON.stringify({ name: 'QA', username: 'serra', role: 'desenvolvedor', avatar: 'Q' })));
  await page.route('**/api/**', async route => {
    const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
    if (!match) { await route.fulfill({ json: { data: null, error: null } }); return; }
    const [, table, action] = match;
    const body = route.request().postDataJSON();
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
  await main.getByRole('button', { name: 'PTR-BA APOC', exact: true }).click();
  await main.getByRole('heading', { name: 'PTR-BA APOC - Bravo - 13/10/2026', exact: true }).waitFor();
  const search = main.getByRole('searchbox', { name: 'Pesquisar pelo nome do APOC' });
  await search.fill('jose');
  assert.equal(await main.getByRole('heading', { name: /PTR-BA APOC -/ }).count(), 1);
  await search.fill('Ana');
  await main.getByText('Nenhum registro encontrado', { exact: true }).waitFor();
  await search.fill('');
  await page.screenshot({ path: path.join(out, 'aba-apoc.png'), fullPage: true, animations: 'disabled' });

  await main.getByRole('button', { name: 'Criar PTR-BA APOC', exact: true }).click();
  await main.getByRole('heading', { name: 'PTR-BA somente APOC - Novo Registro' }).waitFor();
  const form = main.locator('form');
  await form.locator('select').first().selectOption('Bravo');
  assert.equal(await form.locator('select:disabled').count(), 1);
  assert.equal(await form.locator('select:disabled').inputValue(), 'APOC');
  assert.equal(await form.getByText('Pessoa Chefe', { exact: true }).count(), 0);
  await form.getByText('Selecione o APOC', { exact: true }).click();
  await form.getByRole('button').filter({ hasText: 'Pessoa Ana APOC' }).waitFor();
  assert.equal(await form.getByRole('button').filter({ hasText: 'Pessoa Supervisor' }).count(), 0);
  assert.equal(await form.getByRole('button').filter({ hasText: 'Pessoa Coordenador' }).count(), 0);
  await form.getByRole('button').filter({ hasText: 'Pessoa Ana APOC' }).click();
  await form.getByRole('button', { name: 'Adicionar APOC', exact: true }).click();
  await form.getByText('Selecione o APOC', { exact: true }).click();
  assert.equal(await form.getByRole('button').filter({ hasText: 'Pessoa Ana APOC' }).isDisabled(), true);
  await form.getByRole('button').filter({ hasText: 'Pessoa José APOC' }).click();
  await form.locator('input[type="time"]').nth(0).fill('08:00');
  await form.locator('input[type="time"]').nth(1).fill('09:00');
  const subject = form.getByText('Assunto', { exact: true }).first().locator('..').locator('select');
  await subject.selectOption({ index: 1 });
  await form.locator('textarea').first().fill('Descrição exclusiva APOC');
  await form.locator('input[placeholder="Nome do chefe"]').fill('Pessoa Chefe');
  await page.screenshot({ path: path.join(out, 'form-apoc.png'), fullPage: true, animations: 'disabled' });
  await form.getByRole('button', { name: 'Criar PTR-BA APOC', exact: true }).click();
  await page.getByRole('heading', { name: 'PTR-BA salvo', exact: true }).waitFor();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  assert.equal(writes.at(-1).payload.is_apoc, true);
  assert.equal(JSON.parse(writes.at(-1).payload.participantes).length, 2);
  assert.ok(JSON.parse(writes.at(-1).payload.participantes).every(p => p.funcao === 'APOC'));
  assert.equal(await main.getByRole('heading', { name: /PTR-BA APOC -/ }).count(), 2);

  const createdCard = main.locator('div.overflow-hidden.rounded-2xl').filter({ hasText: '2 participante(s)' });
  await createdCard.getByRole('button', { name: /Ver detalhes/ }).click();
  await createdCard.getByRole('button', { name: 'Editar', exact: true }).click();
  await main.getByRole('heading', { name: 'PTR-BA somente APOC - Editar Registro' }).waitFor();
  assert.equal(await form.locator('select:disabled').count(), 2);
  await form.locator('textarea').last().fill('Observação editada');
  await form.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await page.getByRole('heading', { name: 'PTR-BA salvo', exact: true }).waitFor();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await createdCard.getByRole('button', { name: /Ver detalhes/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await createdCard.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'PTR-BA_APOC_13-10-2026.pdf');
  await download.saveAs(path.join(out, download.suggestedFilename()));

  // Verifica os relatórios com o registro normal e dois documentos APOC no mesmo período.
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

  // PDFs com 15 APOCs e normal, usando o gerador real para inspecionar o limite da página.
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
  await main.getByRole('button', { name: 'PTR-BA APOC', exact: true }).click();
  await createdCard.getByRole('button', { name: /Ver detalhes/ }).click();
  await createdCard.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirmar exclusão', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelectorAll('main h3').length === 1);
  assert.equal(tables.ptrba_completo_registros.length, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'aba-apoc-mobile.png'), fullPage: true, animations: 'disabled' });
  assert.ok(await main.evaluate(el => el.scrollWidth <= el.clientWidth), 'Conteúdo mobile não deve transbordar horizontalmente');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(out, 'aba-apoc-dark.png'), fullPage: true, animations: 'disabled' });
  assert.deepEqual(dialogs, []);
  assert.deepEqual(errors, []);
  console.log('PTR-BA APOC: abas, pesquisa por nome, somente APOCs, duplicatas, criar/editar/excluir, relatórios, PDF, mobile e tema escuro passaram.');
} finally {
  await browser?.close();
  await server.close();
}
