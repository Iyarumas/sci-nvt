import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Dados sintéticos e API interceptada: nenhum acesso ao backend ou à produção.
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5180';
const server = process.env.E2E_START_SERVER === '1'
  ? await createServer({ server: { host: '127.0.0.1', port: Number(new URL(appUrl).port), strictPort: true } }) : null;
await server?.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const errors = [];
  const dialogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  const people = [['CE', 'BA-CE'], ['MC2', 'BA-MC'], ['MC3', 'BA-MC'], ['MCR', 'BA-MC'], ['LR', 'BA-LR'], ...['B2', 'B31', 'B32', 'R1', 'R2', 'RADIO'].map(id => [id, 'BA-2'])]
    .map(([id, cargo]) => ({ id, nome_guerra: id, nome_completo: `Pessoa ${id}`, cargo, equipe: 'Bravo', data_desligamento: '', created_at: '2026-10-01', updated_at: '2026-10-01' }));
  const tables = {
    usuarios: [{ username: 'serra', name: 'Teste', role: 'desenvolvedor' }],
    bombeiros: people,
    escalas_diarias: [{ id: 'diaria', equipe: 'Bravo', data_plantao: '2026-10-13', chefe_equipe: 'CE', created_at: '2026-10-13', guarnicoes: {
      cci02: { baMc: 'MC2', baCe: 'CE', ba2: 'B2' }, cci03: { baMc: 'MC3', ba2_1: 'B31', ba2_2: 'B32' }, crs: { baMc: 'MCR', baLr: 'LR', baRe1: 'R1', baRe2: 'R2' },
    }, radio: [{ nomeGuerra: 'RADIO', funcao: 'BA-2', horarioInicio: '00:00', horarioFim: '23:59' }] }],
    exercicios_posicionamento: [], treinamentos_tempo_resposta: [],
  };
  const writes = [];
  await page.clock.install({ time: new Date('2026-10-13T22:00:00-03:00') });
  await page.addInitScript(() => localStorage.setItem('sescinc-session', JSON.stringify({
    name: 'Pessoa MC2', username: 'qa', role: 'bombeiro', avatar: 'Q',
    pessoa: { id: 'MC2', nomeGuerra: 'MC2', funcao: 'BA-MC', equipe: 'Bravo', personType: 'bombeiro' },
  })));
  await page.route('**/api/**', async route => {
    const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
    if (!match) { await route.fulfill({ json: { data: null, error: null } }); return; }
    const [, table, action] = match;
    const body = route.request().postDataJSON();
    tables[table] ||= [];
    let rows = tables[table].filter(row => (body.filters || []).every(f => {
      if (f.operator === 'eq') return row[f.column] === f.value;
      if (f.operator === 'is') return f.value === null ? row[f.column] == null : row[f.column] === f.value;
      return true;
    }));
    if (action === 'query') {
      for (const order of body.orders || []) rows.sort((a, b) => (a[order.column] > b[order.column] ? 1 : a[order.column] < b[order.column] ? -1 : 0) * (order.ascending === false ? -1 : 1));
      if (body.limit) rows = rows.slice(0, body.limit);
    } else if (action === 'insert') {
      const row = { id: `${table}-${tables[table].length + 1}`, ...body.payload };
      if (row.numero === 0) row.numero = Math.max(row.ano === '2026' ? (table === 'exercicios_posicionamento' ? 42 : 24) : 0, ...tables[table].filter(r => r.ano === row.ano).map(r => r.numero)) + 1;
      rows = [row]; tables[table].push(row); writes.push({ table, payload: body.payload });
    } else if (action === 'update') { rows.forEach(row => Object.assign(row, body.payload)); writes.push({ table, payload: body.payload }); }
    else if (action === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
    await route.fulfill({ json: { data: rows, error: null, count: rows.length } });
  });
  for (const [slug, title, button, base, table, mcField] of [
    ['tempo-resposta', 'Novo Treino de Tempo Resposta', 'Novo Treino', 25, 'treinamentos_tempo_resposta', 'f2_ba_mc'],
    ['posicionamento', 'Novo Exercício de Posicionamento', 'Novo Exercício', 43, 'exercicios_posicionamento', 'faisca2_ba_mc'],
  ]) {
    await page.goto(`${appUrl}/treinamentos/${slug}`);
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    const number = page.getByRole('spinbutton', { name: 'Número do documento' });
    await page.waitForFunction(() => document.querySelector('input[aria-label="Número do documento"]')?.value > 0);
    assert.equal(await number.inputValue(), String(base));
    const save = page.getByRole('button', { name: 'Salvar rascunho', exact: true });
    await save.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Salvar rascunho') && !b.disabled));
    assert.ok((await page.locator('textarea').first().inputValue()).length > 0);
    assert.ok((await page.locator('body').innerText()).includes('BA-MC · MC2 · Bravo'));
    const mc2 = page.getByText('BA-MC · MC2 · Bravo', { exact: true }).first();
    await mc2.click();
    await page.getByRole('button').filter({ hasText: 'BA-MC · MC3 · Bravo' }).click();
    await page.locator('textarea').first().fill('Texto personalizado do criador');
    await number.fill('80');
    await save.click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'hidden' });
    assert.equal(writes.at(-1).payload.numero, 80);
    assert.equal(writes.at(-1).payload.observacoes, 'Texto personalizado do criador');
    assert.equal(writes.at(-1).payload[mcField], 'MC3');
    if (slug === 'tempo-resposta') assert.equal(writes.at(-1).payload.f2_t1, '');
    else assert.equal(writes.at(-1).payload.faisca2_tempo, '');
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Número do documento"]')?.value === '81');
    await page.locator('input[type="date"]').fill('2027-01-01');
    await page.waitForFunction(() => document.querySelector('input[aria-label="Número do documento"]')?.value === '1');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Salvar rascunho') && !b.disabled));
    await save.click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'hidden' });
    assert.equal(writes.at(-1).payload.numero, 0);
    assert.equal(writes.at(-1).payload.ano, '2027');
    assert.equal(tables[table].at(-1).numero, 1);
    console.log(`${slug}: criador BA-MC altera equipagem/textos/número; sequência 80 → 81; novo ano → 001.`);
  }
  assert.deepEqual(dialogs, []);
  assert.deepEqual(errors, []);
} finally { await browser.close(); await server?.close(); }
