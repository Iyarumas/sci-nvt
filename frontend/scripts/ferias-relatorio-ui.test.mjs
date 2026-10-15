import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Sessão e API sintéticas: nenhum registro real é consultado ou alterado.
const out = path.resolve(import.meta.dirname, '../../tmp/ferias-relatorio-qa');
await fs.mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:5187';
const server = await createServer({ server: { host: '127.0.0.1', port: 5187, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const pessoa = (id, nome, cargo, equipe) => ({ id, nome_completo: nome, nome_guerra: nome, cargo, equipe, data_admissao: '2020-03-10', data_desligamento: '' });
  const ferias = (id, funcionario_id, funcionario_nome, equipe, extra = {}) => ({ id, funcionario_id, funcionario_nome, equipe, periodo_numero: 5, data_inicio: '2026-10-05', data_fim: '2026-11-03', dias: 30, status: 'Programadas', ...extra });
  const vigencia = (id, original, nomeOriginal, sub, nomeSub, cargo, nivel, extra = {}) => ({ id, funcionario_original_id: original, funcionario_original_nome: nomeOriginal, substituto_id: sub, substituto_nome: nomeSub, cargo_original_substituto: 'BA-2', cargo_exercido: cargo, equipe: 'Alfa', data_inicio: '2026-10-05', data_fim: '2026-11-03', nivel_cascata: nivel, motivo: nivel === 1 ? 'ferias' : 'cascata', ferias_id: 'f1', ativa: true, ...extra });
  const tables = {
    usuarios: [{ username: 'serra', name: 'QA', role: 'desenvolvedor' }],
    bombeiros: [
      pessoa('chefe', 'Carlos Almeida', 'BA-CE', 'Alfa'), pessoa('lider', 'Bruno Rocha', 'BA-LR', 'Alfa'),
      pessoa('motorista', 'Daniel Costa', 'BA-MC', 'Alfa'), pessoa('ferista', 'Eduardo Silva', 'BA-2', 'Ferista'),
      pessoa('bravo', 'Fernando Lima', 'BA-2', 'Bravo'), pessoa('ferista2', 'Gabriel Martins', 'BA-2', 'Ferista'),
      pessoa('afastado', 'Henrique Souza', 'BA-MC', 'Charlie'), pessoa('anterior', 'Pessoa Férias Setembro', 'BA-2', 'Delta'),
    ],
    ferias: [ferias('f1', 'chefe', 'Carlos Almeida', 'Alfa'), ferias('f2', 'bravo', 'Fernando Lima', 'Bravo'), ferias('f3', 'anterior', 'Pessoa Férias Setembro', 'Delta', { data_inicio: '2026-09-25', data_fim: '2026-10-24' })],
    ferias_escala: [{ id: 'escala', ano: 2026, status: 'Aprovado', equipe: 'Bravo' }, { id: 'rascunho', ano: 2026, status: 'Rascunho', equipe: 'Alfa' }],
    ferias_escala_item: [{ id: 'item', escala_id: 'escala', ferias_gozo_id: 'f2', funcionario_id: 'bravo', funcionario_nome: 'Fernando Lima', mes: 10, data_inicio: '2026-10-05', data_fim: '2026-11-03', substituto_id: 'ferista2', substituto_nome: 'Gabriel Martins', funcao_substituicao: 'BA-2', rejeitado: false }],
    vigencia_substituicoes: [
      vigencia('v1', 'chefe', 'Carlos Almeida', 'lider', 'Bruno Rocha', 'BA-CE', 1, { cargo_original_substituto: 'BA-LR' }),
      vigencia('v2', 'lider', 'Bruno Rocha', 'motorista', 'Daniel Costa', 'BA-LR', 2, { cargo_original_substituto: 'BA-MC' }),
      vigencia('v3', 'motorista', 'Daniel Costa', 'ferista', 'Eduardo Silva', 'BA-MC', 3),
    ],
    substituicoes_temporarias: [{ id: 'af1', funcionario_id: 'afastado', funcionario_nome: 'Henrique Souza', funcionario_cargo: 'BA-MC', tipo: 'Afastamento', motivo: 'INSS Indeterminado', motivo_outro: 'Recuperação após procedimento.\nAcompanhamento periódico.\nPrazo: indeterminado.', status: 'Aprovada', data_inicio: '2026-09-10', data_fim: '9999-12-31', dias: 0 }],
  };
  let falhar = false;
  const writes = [];
  await page.clock.install({ time: new Date('2026-10-15T10:00:00-03:00') });
  await page.addInitScript(() => localStorage.setItem('sescinc-session', JSON.stringify({ username: 'serra', name: 'QA', avatar: 'Q', role: 'desenvolvedor' })));
  await page.route('**/api/**', async route => {
    const match = new URL(route.request().url()).pathname.match(/\/data\/([^/]+)\/([^/]+)$/);
    if (!match) { await route.fulfill({ json: { data: null, error: null } }); return; }
    const [, table, action] = match;
    const body = route.request().postDataJSON() || {};
    if (falhar && table === 'ferias') { await route.fulfill({ status: 503, json: { message: 'Falha de teste ao carregar férias.' } }); return; }
    if (action !== 'query') writes.push({ table, action });
    const rows = (tables[table] || []).filter(row => (body.filters || []).every(filter => {
      if (filter.operator === 'eq') return row[filter.column] === filter.value;
      if (filter.operator === 'gte') return row[filter.column] >= filter.value;
      if (filter.operator === 'lte') return row[filter.column] <= filter.value;
      return true;
    }));
    await route.fulfill({ json: { data: rows, error: null, count: rows.length } });
  });

  await page.goto(`${origin}/cadastro/ferias`);
  const generate = page.getByRole('button', { name: 'Gerar Relatório de Férias', exact: true });
  await generate.waitFor();
  assert.equal(await page.getByRole('button', { name: 'Quadro de Efetivos', exact: true }).evaluate(button => button.nextElementSibling?.textContent?.trim()), 'Gerar Relatório de Férias');
  await generate.click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });

  async function filtros(incluirAfastados) {
    await generate.click();
    await modal.getByLabel('Mês', { exact: true }).selectOption('10');
    await modal.getByLabel('Ano', { exact: true }).fill('2026');
    await modal.getByRole('checkbox').setChecked(incluirAfastados);
  }
  async function salvar(nome) {
    const promise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Salvar em PDF', exact: true }).click();
    const download = await promise;
    assert.equal(download.suggestedFilename(), 'Relatorio_Ferias_10-2026.pdf');
    await download.saveAs(path.join(out, nome));
    return Array.from(await fs.readFile(path.join(out, nome)));
  }
  async function inspecionar(bytes) {
    return page.evaluate(async buffer => {
      const { default: pdfjs } = await import('/src/lib/pdfjs-setup.ts');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const textos = [];
      const imagens = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const pagina = await pdf.getPage(index);
        const conteudo = await pagina.getTextContent();
        textos.push(conteudo.items.map(item => item.str).join(' '));
        const viewport = pagina.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pagina.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
        imagens.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return { textos, imagens };
    }, bytes);
  }

  await filtros(false);
  await page.screenshot({ path: path.join(out, 'filtros.png'), fullPage: true, animations: 'disabled' });
  await modal.getByRole('button', { name: 'Gerar', exact: true }).click();
  await modal.getByRole('heading', { name: 'Prévia do Relatório de Férias', exact: true }).waitFor();
  await modal.locator('canvas:not(.opacity-0)').waitFor();
  const semAfastados = await inspecionar(await salvar('sem-afastados.pdf'));
  const textoSem = semAfastados.textos.join(' ');
  for (const valor of ['EQUIPE ALFA', 'EQUIPE BRAVO', 'Carlos Almeida', 'Fernando Lima', 'Bruno Rocha', 'Daniel Costa', 'Eduardo Silva', 'Gabriel Martins', 'BA-CE', 'BA-LR', 'BA-MC', '10/03/2024', '09/03/2025', '03/11/2026']) assert.ok(textoSem.includes(valor), valor);
  assert.ok(!textoSem.includes('Henrique Souza'));
  assert.ok(!textoSem.includes('Pessoa Férias Setembro'));
  await fs.writeFile(path.join(out, 'sem-afastados.png'), Buffer.from(semAfastados.imagens[0], 'base64'));
  await modal.getByRole('button', { name: 'Alterar filtros', exact: true }).click();
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Gerar', exact: true }).click();
  await modal.getByRole('heading', { name: 'Prévia do Relatório de Férias', exact: true }).waitFor();
  await modal.locator('canvas:not(.opacity-0)').waitFor();
  const comAfastados = await inspecionar(await salvar('com-afastados.pdf'));
  const textoCom = comAfastados.textos.join(' ');
  assert.ok(textoCom.indexOf('PESSOAS AFASTADAS NO MÊS') > textoCom.indexOf('EQUIPE BRAVO'));
  for (const valor of ['Henrique Souza', 'Charlie', '10/09/2026', 'Indeterminado', 'Sem previsão', 'Tipo de afastamento', 'Motivo', 'Recuperação após procedimento.', 'Acompanhamento periódico.']) assert.ok(textoCom.includes(valor), valor);
  assert.ok(!textoCom.includes('Prazo: indeterminado.'));
  await fs.writeFile(path.join(out, 'com-afastados.png'), Buffer.from(comAfastados.imagens[0], 'base64'));
  await page.screenshot({ path: path.join(out, 'preview-desktop.png'), fullPage: true, animations: 'disabled' });

  // Intercepta só a abertura do diálogo de impressão do navegador.
  await page.evaluate(() => {
    window.__impressoes = 0;
    const append = document.body.appendChild.bind(document.body);
    document.body.appendChild = node => {
      if (node instanceof HTMLIFrameElement) Object.defineProperty(node, 'contentWindow', { value: { focus() {}, print() { window.__impressoes++; } } });
      return append(node);
    };
  });
  await modal.getByRole('button', { name: 'Imprimir', exact: true }).click();
  await page.waitForFunction(() => window.__impressoes === 1);
  await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });

  // Falha é visível e permite tentar novamente, sem produzir PDF parcial.
  await filtros(false);
  await page.clock.fastForward(21_000); // Expira o cache de leitura do adapter antes de simular a falha.
  falhar = true;
  await modal.getByRole('button', { name: 'Gerar', exact: true }).click();
  await modal.getByRole('alert').waitFor();
  assert.match(await modal.getByRole('alert').innerText(), /Falha de teste/);
  falhar = false;
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await generate.click();
  await page.screenshot({ path: path.join(out, 'filtros-mobile.png'), fullPage: true, animations: 'disabled' });
  assert.ok(await modal.evaluate(el => el.getBoundingClientRect().right <= innerWidth));
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  assert.ok(await generate.evaluate(el => document.activeElement === el));

  // Nomes grandes, muitas equipes/pessoas e uma cadeia que ocupa mais de uma página.
  const stressBytes = await page.evaluate(async () => {
    const { carregarRelatorioFerias } = await import('/src/services/feriasRelatorioService.ts');
    const { gerarRelatorioFeriasPdf } = await import('/src/services/feriasRelatorioPdfService.ts');
    const relatorio = await carregarRelatorioFerias({ mes: 10, ano: 2026, incluirAfastados: true });
    const original = relatorio.equipes[0].pessoas[0];
    relatorio.equipes[0].pessoas = Array.from({ length: 45 }, (_, index) => ({ ...original, id: `qa-${index}`, nome: `PESSOA DE TESTE COM NOME COMPLETO LONGO ${index + 1}`, coberturas: original.coberturas }));
    relatorio.equipes[0].pessoas[0].coberturas = Array.from({ length: 38 }, (_, index) => ({ ...original.coberturas[index % 3], nome: `SUBSTITUTO DE TESTE ${index + 1}` }));
    return Array.from(new Uint8Array(await (await gerarRelatorioFeriasPdf(relatorio)).arrayBuffer()));
  });
  await fs.writeFile(path.join(out, 'paginacao.pdf'), Buffer.from(stressBytes));
  const stress = await inspecionar(stressBytes);
  assert.ok(stress.textos.length > 3);
  assert.ok(stress.textos.join(' ').includes('SUBSTITUTO DE TESTE 38'));
  assert.ok(stress.textos.join(' ').includes('LONGO 45'));
  assert.ok(stress.textos[1].includes('LONGO 1'), 'Continuação da cadeia mantém a pessoa identificada');
  for (let index = 0; index < stress.textos.length; index++) {
    assert.ok(stress.textos[index].includes(`Página ${index + 1} de ${stress.textos.length}`));
    await fs.writeFile(path.join(out, `paginacao-${index + 1}.png`), Buffer.from(stress.imagens[index], 'base64'));
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  console.log(`Relatório de férias: filtros, cancelar, prévia real, equipes, aquisitivo, cadeia/funções, afastados opcionais, impressão, download, falha, mobile e ${stress.textos.length} páginas sem perda de linhas passaram.`);
} finally {
  await browser?.close();
  await server.close();
}
