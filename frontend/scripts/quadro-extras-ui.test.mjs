import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// API e sessão sintéticas, sem consultar nem alterar dados reais.
const out = path.resolve(import.meta.dirname, '../../tmp/quadro-extras-qa');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { host: '127.0.0.1', port: 5188, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
  const pessoa = (id, nome, equipe) => ({ id, nome_completo: nome, nome_guerra: nome, cargo: 'BA-2', equipe, data_desligamento: '' });
  const extra = (data, id, nome) => ({ tipo: 'extra', dataPlantao: data, pessoaId: id, substitutoId: id, substitutoNome: nome, funcionarioId: 'stephanie', equipePlantao: 'Charlie', cargoExercido: 'BA-2' });
  const afastamento = {
    id: 'atestado', funcionario_id: 'stephanie', funcionario_nome: 'Stephanie', funcionario_cargo: 'BA-2',
    tipo: 'Afastamento', motivo: 'Atestado Medico', motivo_outro: 'Recuperação', status: 'Aprovada',
    data_inicio: '2026-11-02', data_fim: '2026-11-08', dias: 7, plantao_extra: true,
    cadeia_substituicao: [extra('2026-11-03', 'extra1', 'Cobertura Hoje'), extra('2026-11-05', 'extra2', 'Cobertura Seguinte')],
  };
  const tables = {
    usuarios: [{ username: 'qa', name: 'QA', role: 'desenvolvedor' }],
    bombeiros: [pessoa('stephanie', 'Stephanie', 'Charlie'), pessoa('titular', 'Titular', 'Charlie'), pessoa('extra1', 'Cobertura Hoje', 'Bravo'), pessoa('extra2', 'Cobertura Seguinte', 'Charlie')],
    substituicoes_temporarias: [afastamento],
  };
  async function verificar({ dia, esperado, total = 3, status = 'Aprovada', mobile = false }) {
    afastamento.status = status;
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date(`2026-11-${dia}T10:00:00-03:00`) });
    await page.addInitScript(dark => {
      localStorage.setItem('sescinc-auth-token', 'qa-synthetic-token');
      localStorage.setItem('sescinc-session', JSON.stringify({ username: 'qa', name: 'QA', avatar: 'Q', role: 'desenvolvedor' }));
      localStorage.setItem('sescinc-theme', dark ? 'dark' : 'light');
    }, mobile);
    await page.route('**/api/**', async route => {
      const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
      if (!match) return route.fulfill({ json: { data: null, error: null } });
      const [, table, action] = match;
      if (action !== 'query') writes.push({ table, action });
      const body = route.request().postDataJSON() || {};
      const rows = (tables[table] || []).filter(row => (body.filters || []).every(filter => {
        if (filter.operator === 'eq') return row[filter.column] === filter.value;
        if (filter.operator === 'gte') return row[filter.column] >= filter.value;
        if (filter.operator === 'lte') return row[filter.column] <= filter.value;
        return true;
      }));
      await route.fulfill({ json: { data: rows, error: null, count: rows.length } });
    });
    await page.goto('http://127.0.0.1:5188/cadastro/ferias');
    await page.getByRole('button', { name: 'Quadro de Efetivos', exact: true }).click();
    const equipe = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: 'Equipe Charlie', exact: true }) }).first();
    await equipe.waitFor();
    const roxos = equipe.locator('[data-extra-afastamento]');
    assert.equal(await roxos.count(), esperado ? 1 : 0, `Extra do dia ${dia}`);
    if (esperado) {
      assert.ok((await roxos.innerText()).includes(esperado));
      assert.ok((await roxos.innerText()).includes('Stephanie'));
      assert.ok((await roxos.innerText()).includes(`${dia}/11/2026`));
      assert.ok((await roxos.getAttribute('class')).includes('border-purple-'));
      assert.equal(await equipe.getByText(`BA-2 ${esperado}`, { exact: true }).count(), 1, 'Cobertura não deve repetir na própria equipe');
      await roxos.screenshot({ path: path.join(out, `extra-${dia}.png`), animations: 'disabled' });
      if (mobile) await roxos.tap();
      else await roxos.hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-extra-ausente]')).opacity === '1');
      assert.ok((await roxos.locator('[data-extra-ausente]').innerText()).includes('BA-2 Stephanie'));
      await roxos.screenshot({ path: path.join(out, `afastada-${dia}.png`), animations: 'disabled' });
      if (mobile) {
        assert.equal(await roxos.getAttribute('aria-pressed'), 'true');
        await roxos.tap();
        assert.equal(await roxos.getAttribute('aria-pressed'), 'false');
      } else {
        await page.mouse.move(0, 0);
        await roxos.focus();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-extra-ausente]')).opacity === '1');
        await roxos.blur();
      }
    }
    assert.ok((await equipe.innerText()).includes(`${total} efetivo(s)`), await equipe.innerText());
    if (mobile) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(out, `dia-${dia}-${status}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    await page.close();
  }
  await verificar({ dia: '03', esperado: 'Cobertura Hoje' });
  await verificar({ dia: '05', esperado: 'Cobertura Seguinte', total: 2, mobile: true });
  await verificar({ dia: '04', total: 2 });
  // O quadro mantém seu recorte mensal de afastados; somente o extra varia por dia.
  await verificar({ dia: '09', total: 2 });
  await verificar({ dia: '03', status: 'Pendente', total: 3 });
  await verificar({ dia: '03', status: 'Rejeitada', total: 3 });
  console.log('Quadro de efetivos: extras por dia, aprovação, contagem, hover, teclado e toque no mobile OK.');
} finally {
  await browser?.close();
  await server.close();
}
