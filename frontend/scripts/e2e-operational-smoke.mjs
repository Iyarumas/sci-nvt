import { chromium } from 'playwright';

const appUrl = process.env.APP_URL || 'http://127.0.0.1:5174';
const username = process.env.E2E_USERNAME || 'serra';
const password = process.env.E2E_PASSWORD || '210291';

function ascii(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function waitIdle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

async function login(page) {
  await page.goto(`${appUrl}/login`, { waitUntil: 'domcontentloaded' });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: /entrar|login|acessar/i }).first().click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 });
  await waitIdle(page);
}

async function assertRoute(page, path, textRegex) {
  await page.goto(`${appUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await waitIdle(page);
  await page.getByText(textRegex).first().waitFor({ state: 'visible', timeout: 15000 });
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const consoleErrors = [];
const pageErrors = [];

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => pageErrors.push(err.message));

await login(page);

const bodyAfterLogin = await page.locator('body').innerText();
const menuFeriasEntries = bodyAfterLogin
  .split('\n')
  .filter(line => ascii(line.trim()) === 'Ferias')
  .length;

await assertRoute(page, '/cadastro/ferias', /Escala Anual|Ferias|Férias/i);
await assertRoute(page, '/escalas', /Escala Di|Escalas/i);
await assertRoute(page, '/funcionarios/substituicoes', /Tempor|Nova Substitui|Substitu/i);
await assertRoute(page, '/registros-diarios/gerar-lro', /Gerar LRO|Plantao|Plantão/i);
await assertRoute(page, '/registros-diarios/ptr-ba', /PTR-BA|Plano de Trabalho/i);

await browser.close();

const result = {
  appUrl,
  menuFeriasEntries,
  consoleErrors,
  pageErrors,
};

console.log(JSON.stringify(result, null, 2));

if (menuFeriasEntries < 3 || consoleErrors.length > 0 || pageErrors.length > 0) {
  process.exit(1);
}
