import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const out = path.resolve(import.meta.dirname, '../../tmp/ordens-servico-qa');
await fs.mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:5191';
const server = await createServer({ server: { host: '127.0.0.1', port: 5191, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-28T10:00:00-03:00') });
  await page.addInitScript(() => localStorage.setItem('sescinc-session', JSON.stringify({ username: 'serra', name: 'QA', avatar: 'Q', role: 'desenvolvedor' })));
  const row = (id, numero, data_emissao, created_at, numero_cliente = '') => ({ id, numero, numero_cliente, data_emissao, created_at, updated_at: created_at, equipe: 'Alfa', solicitante_nome: '', solicitante_id: '', prioridade: 'Média', status: 'Aberta', descricao: `Reparo ${id}`, observacoes: '21/09/2026 — Responsável registrou a solicitação.' });
  const ordens = [
    row('antiga', 'SCI-NVT-OS-111111/2026', '2026-01-03', '2026-10-28T18:00:00Z', '002393857/A'),
    row('recente', 'OS SCI-006/2026', '2026-10-21', '2026-01-01T10:00:00Z', 'CLI-55'),
    row('intermediaria', 'SCI-NVT-OS-247712/2026', '2026-09-21', '2026-09-21T10:00:00Z'),
  ];
  const writes = [];
  await page.route('**/api/**', async route => {
    const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
    if (!match) return route.fulfill({ json: { data: null, error: null } });
    const [, table, action] = match;
    const body = route.request().postDataJSON() || {};
    const source = table === 'ordens_servico' ? ordens : table === 'usuarios' ? [{ username: 'serra', name: 'QA', role: 'desenvolvedor' }] : [];
    const data = source.filter(r => (body.filters || []).every(f => f.operator !== 'eq' || r[f.column] === f.value));
    if (action !== 'query') {
      writes.push({ table, action, payload: body.payload });
      if (action === 'update') data.forEach(r => Object.assign(r, body.payload));
    }
    return route.fulfill({ json: { data, error: null, count: data.length } });
  });
  const allMonths = () => page.locator('select').filter({ has: page.locator('option', { hasText: 'Todos os meses' }) });
  const expected = ['OS SCI-006/2026', 'SCI-NVT-OS-247712/2026', 'SCI-NVT-OS-111111/2026'];
  await page.goto(`${origin}/relatorios/ordem-servico`);
  await allMonths().selectOption('');
  const cards = page.locator('[data-os-tour="os-lista"] > div');
  await cards.filter({ hasText: 'SCI-NVT-OS-111111/2026' }).waitFor();
  assert.deepEqual(await cards.locator('p.font-bold').allTextContents(), expected);
  const search = page.locator('input[placeholder*="Buscar"]');
  await search.fill('002393857/A');
  await page.waitForFunction(() => document.querySelectorAll('[data-os-tour="os-lista"] > div').length === 1);
  assert.equal(await cards.locator('p.font-bold').textContent(), expected[2]);
  await cards.first().click();
  const document = page.locator('#print-area');
  await document.waitFor();
  assert.match(await document.innerText(), /Número SCI: SCI-NVT-OS-111111\/2026/);
  assert.match(await document.innerText(), /Nº da ordem do cliente: 002393857\/A/);
  await page.emulateMedia({ media: 'print' });
  assert(await document.getByText('Nº da ordem do cliente:', { exact: true }).isVisible());
  await page.emulateMedia({ media: 'screen' });
  await page.screenshot({ path: path.join(out, 'documento-interno.png'), fullPage: true });

  await page.goto(`${origin}/relatorios/ordem-servico`);
  await allMonths().selectOption('');
  await page.getByTitle('Editar', { exact: true }).last().click();
  const clientInput = page.getByLabel('Número da ordem do cliente', { exact: true });
  assert.equal(await clientInput.inputValue(), '002393857/A');
  await clientInput.fill('000987');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await clientInput.waitFor({ state: 'hidden' });
  const saved = writes.find(w => w.table === 'ordens_servico' && w.action === 'update');
  assert.equal(saved.payload.numero_cliente, '000987');
  assert.equal(saved.payload.numero, 'SCI-NVT-OS-111111/2026');
  assert.equal(saved.payload.observacoes, ordens[0].observacoes);

  await page.goto(`${origin}/os/publica`);
  await allMonths().selectOption('');
  const publicCards = page.locator('.space-y-2 > button');
  await publicCards.filter({ hasText: expected[2] }).waitFor();
  assert.deepEqual(await publicCards.locator('p.font-bold').allTextContents(), expected);
  await publicCards.last().click();
  await page.locator('#print-area').waitFor();
  assert.match(await page.locator('#print-area').innerText(), /Nº da ordem do cliente: 000987/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'documento-publico-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('UI verified: all-month chronology, client-number search/edit with SCI number and history preserved, distinct document numbers in internal/public print and mobile.');
} finally {
  await browser?.close();
  await server.close();
}
