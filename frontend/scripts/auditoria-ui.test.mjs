import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = path.resolve(import.meta.dirname, '../../tmp/auditoria-qa');
await fs.mkdir(output, { recursive: true });
const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { host: '127.0.0.1', port: 5192, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
  let role = 'admin';
  let fail = false;
  let empty = false;
  const requests = [];
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('sescinc-auth-token', 'qa-synthetic-token');
    localStorage.setItem('sescinc-session', JSON.stringify({ username: 'qa_admin', name: 'QA Admin', role: 'admin', avatar: 'QA' }));
  });
  const register = {
    id: 'test-event', created_at: '2026-11-02T03:15:00Z', tabela: 'bombeiros', registro_id: 'pessoa-qa',
    identificacao: 'Pessoa de teste', usuario_id: 'usuario-qa', usuario_login: 'qa_admin', usuario_funcao: 'admin', origem: 'sistema',
  };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) { await route.fulfill({ json: { user: { id: 'usuario-qa', username: 'qa_admin', name: 'QA Admin', role } } }); return; }
    if (url.pathname.endsWith('/auditoria/exclusoes')) {
      requests.push(url);
      assert.equal(route.request().headers().authorization, 'Bearer qa-synthetic-token');
      if (fail) { await route.fulfill({ status: 503, json: { message: 'Falha simulada ao carregar auditoria.' } }); return; }
      const second = url.searchParams.get('pagina') === '2';
      await route.fulfill({ json: { data: empty ? [] : [second ? { ...register, id: 'event-2', identificacao: 'Outro registro', usuario_login: null, usuario_funcao: null, origem: 'sem_usuario' } : register], total: empty ? 0 : 51, pagina: second ? 2 : 1, porPagina: 50, tabelas: ['bombeiros','apocs'], inicioAuditoria: '2026-11-02T03:00:00Z' } });
      return;
    }
    await route.fulfill({ json: { data: [], error: null, count: 0 } });
  });
  await page.goto('http://127.0.0.1:5192/auditoria');
  await page.getByRole('heading', { name: 'Auditoria de exclusões' }).waitFor();
  await page.getByText('Pessoa de teste', { exact: true }).waitFor();
  assert.ok(await page.getByText('02/11/2026, 00:15:00', { exact: true }).isVisible());
  assert.ok(await page.getByRole('cell', { name: 'qa_admin Administrador' }).isVisible());
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await page.getByText('Outro registro', { exact: true }).waitFor();
  assert.ok(await page.getByText('Usuário não identificado', { exact: true }).isVisible());
  await page.getByLabel('Pesquisar', { exact: true }).fill('Pessoa');
  await page.getByLabel('Módulo', { exact: true }).selectOption('bombeiros');
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Data final', { exact: true }).fill('2026-11-02');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await page.getByText('Pessoa de teste', { exact: true }).waitFor();
  assert.equal(requests.at(-1).searchParams.get('pagina'), '1');
  assert.equal(requests.at(-1).searchParams.get('termo'), 'Pessoa');
  assert.equal(requests.at(-1).searchParams.get('tabela'), 'bombeiros');
  assert.equal(requests.at(-1).searchParams.get('inicio'), '2026-11-01');
  assert.equal(requests.at(-1).searchParams.get('fim'), '2026-11-02');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('main').parentElement).marginLeft === '0px');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  empty = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByRole('heading', { name: 'Nenhuma exclusão encontrada' }).waitFor();
  fail = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada' }).waitFor();
  fail = false;
  empty = false;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByText('Pessoa de teste', { exact: true }).waitFor();
  role = 'bombeiro';
  await page.evaluate(() => localStorage.setItem('sescinc-session', JSON.stringify({ username: 'qa_admin', name: 'QA', role: 'bombeiro', avatar: 'QA' })));
  const before = requests.length;
  await page.reload();
  await page.waitForURL('http://127.0.0.1:5192/');
  assert.equal(requests.length, before);
  assert.equal(await page.getByRole('link', { name: 'Auditoria de exclusões', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: autoria, horário de Brasília, filtros, paginação, origem desconhecida, vazio, erro/retry, mobile e rota restrita.');
} finally {
  await browser?.close();
  await server.close();
}
