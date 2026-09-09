import jsPDF from 'jspdf';
import type {
  AgenteExtintorMovimentacao,
  AgenteExtintorRelatorio,
  AgenteExtintorRelatorioItem,
} from '../types/agenteExtintorRelatorio';
import { downloadPdf } from './pdfService';

const PAGE_W = 210;
const PAGE_H = 297;
const X = 30;
const W = 165;
const TIMBRADO_URL = '/assets/timbrado-medmais-2026.jpg';
const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

let timbradoCache: string | null | undefined;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(chunks.join(''))}`;
}

async function carregarTimbrado(): Promise<string | null> {
  if (timbradoCache !== undefined) return timbradoCache;
  try {
    const response = await fetch(TIMBRADO_URL);
    if (!response.ok) throw new Error('Timbrado não encontrado.');
    timbradoCache = await blobToDataUrl(await response.blob());
  } catch {
    timbradoCache = null;
  }
  return timbradoCache;
}

function formatarData(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function numero(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value || 0);
}

function totalItem(item: AgenteExtintorRelatorioItem): number {
  if (item.quantidadeRecipientes > 0 && item.capacidadeRecipiente > 0) {
    return item.quantidadeRecipientes * item.capacidadeRecipiente;
  }
  return item.quantidade;
}

function ehCci(item: AgenteExtintorRelatorioItem): boolean {
  return /CCI\s*\d+/i.test(item.localizacao);
}

function cci(item: AgenteExtintorRelatorioItem): string {
  return item.localizacao.match(/CCI\s*(\d+)/i)?.[1] || item.localizacao;
}

function validadeItem(item: AgenteExtintorRelatorioItem, movimentos: AgenteExtintorMovimentacao[]): string {
  const testes = movimentos.filter(m => m.agenteExtintorId === item.agenteExtintorId && m.validadeResultante);
  if (testes.length) {
    return testes.map(m => `${m.tipo.replace('Ensaio ', '')}: ${formatarData(m.validadeResultante)}`).join(' / ');
  }
  const legadas = [
    item.validadeEnsaioLaboratorial ? `Laboratorial ${formatarData(item.validadeEnsaioLaboratorial)}` : '',
    item.validadeEnsaioFogo ? `Fogo ${formatarData(item.validadeEnsaioFogo)}` : '',
    item.validadeTesteHidrostatico ? `Hidrostático ${formatarData(item.validadeTesteHidrostatico)}` : '',
  ].filter(Boolean);
  return legadas.join(' / ') || formatarData(item.validade);
}

function adicionarTimbrado(doc: jsPDF, timbrado: string | null) {
  if (timbrado) doc.addImage(timbrado, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
}

function tituloPagina(doc: jsPDF, complemento = '') {
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Aeroporto Internacional de Navegantes - SC', PAGE_W / 2, 36, { align: 'center' });
  doc.text('Med+ Group - Seção Contraincêndio NVT-SBNF', PAGE_W / 2, 42, { align: 'center' });
  if (complemento) {
    doc.setFontSize(9.5);
    doc.text(complemento, PAGE_W / 2, 49, { align: 'center' });
  }
}

function secao(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(216, 226, 244);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.18);
  doc.rect(X, y, W, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, X + W / 2, y + 5.2, { align: 'center' });
  return y + 8;
}

function tabela(doc: jsPDF, y: number, headers: string[], widths: number[], rows: string[][]): number {
  const headerH = 8;
  const rowH = 8;
  let x = X;
  doc.setFillColor(184, 181, 181);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  headers.forEach((header, index) => {
    doc.rect(x, y, widths[index], headerH, 'FD');
    doc.text(doc.splitTextToSize(header, widths[index] - 2), x + widths[index] / 2, y + 3.4, { align: 'center' });
    x += widths[index];
  });
  y += headerH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const safeRows = rows.length ? rows : [['SEM REGISTROS', ...headers.slice(1).map(() => '')]];
  safeRows.forEach(row => {
    x = X;
    row.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowH);
      const lines = doc.splitTextToSize(String(value || ''), widths[index] - 2).slice(0, 2);
      doc.text(lines, x + widths[index] / 2, y + (lines.length > 1 ? 3.1 : 5), { align: 'center' });
      x += widths[index];
    });
    y += rowH;
  });
  return y;
}

function resumoQuantidade(itens: AgenteExtintorRelatorioItem[], produto: string, local: 'linha' | 'rt' | 'estoque'): number {
  return itens
    .filter(item => item.produto === produto)
    .filter(item => {
      const loc = item.localizacao.toLowerCase();
      if (local === 'linha') return /319|320/.test(loc);
      if (local === 'rt') return /333|reserva/.test(loc);
      return !ehCci(item) || loc.includes('estoque');
    })
    .reduce((sum, item) => sum + totalItem(item), 0);
}

function nomeMesCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  return `${MESES[mes - 1] || 'MÊS'} ${ano || ''}`.trim();
}

export function nomeArquivoRelatorioAgentesExtintores(competencia: string): string {
  return `RELATORIO MENSAL AGENTES EXTINTORES ${nomeMesCompetencia(competencia)}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '.pdf';
}

export async function gerarRelatorioAgentesExtintoresPdf(params: {
  relatorio: AgenteExtintorRelatorio;
  itens: AgenteExtintorRelatorioItem[];
  movimentacoes: AgenteExtintorMovimentacao[];
}): Promise<Blob> {
  const { relatorio, itens, movimentacoes } = params;
  const timbrado = await carregarTimbrado();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: nomeArquivoRelatorioAgentesExtintores(relatorio.competencia).replace(/\.pdf$/i, ''),
    subject: 'Relatório mensal de agentes extintores',
    creator: 'SCI NVT',
  });
  adicionarTimbrado(doc, timbrado);
  tituloPagina(doc, `RELATÓRIO MENSAL - ${nomeMesCompetencia(relatorio.competencia)}`);

  const lgeCci = itens.filter(i => i.produto === 'LGE' && ehCci(i));
  const pqCci = itens.filter(i => i.produto === 'Pó Químico Seco' && ehCci(i));
  const estoque = itens.filter(i => !ehCci(i) || i.localizacao.toLowerCase().includes('estoque'));

  let y = secao(doc, 55, 'AGENTES EXTINTORES ARMAZENADOS NOS CCI’S');
  y = tabela(doc, y, ['AGENTE', 'LOTE', 'VALIDADE', 'FABRICANTE', 'CCI', 'TOTAL'], [25, 22, 38, 35, 15, 30],
    lgeCci.map(i => [
      `LGE ${i.dosagem} ${i.classe}`.trim(), i.lote, validadeItem(i, movimentacoes), i.marcaAgente,
      cci(i), `${numero(totalItem(i))} ${i.unidade}`,
    ]));

  y += 6;
  y = tabela(doc, y, ['AGENTE', 'LOTE', 'VALIDADE', 'FABRICANTE', 'CCI', 'TOTAL'], [25, 24, 30, 40, 16, 30],
    pqCci.map(i => ['PÓ QUÍMICO', i.lote, formatarData(i.validade), i.marcaAgente, cci(i), `${numero(totalItem(i))} ${i.unidade}`]));

  y += 9;
  y = secao(doc, y, 'AGENTES EXTINTORES EM ESTOQUE');
  y = tabela(doc, y, ['AGENTE', 'LOTE', 'VALIDADE', 'FABRICANTE', 'RECIPIENTE', 'QUANTIDADE', 'TOTAL'], [22, 18, 28, 27, 28, 20, 22],
    estoque.map(i => [
      i.produto === 'Pó Químico Seco' ? 'PÓ QUÍMICO' : i.produto,
      i.lote,
      validadeItem(i, movimentacoes),
      i.marcaAgente,
      i.recipiente || '-',
      i.quantidadeRecipientes > 0 ? numero(i.quantidadeRecipientes) : '-',
      `${numero(totalItem(i))} ${i.unidade}`,
    ]));

  y += 9;
  y = secao(doc, y, 'QUANTIDADE DE AGENTES EXTINTORES EXIGIDOS E DISPONÍVEIS');
  const pqLinha = resumoQuantidade(itens, 'Pó Químico Seco', 'linha');
  const pqRt = resumoQuantidade(itens, 'Pó Químico Seco', 'rt');
  const pqEstoque = resumoQuantidade(itens, 'Pó Químico Seco', 'estoque');
  const lgeLinha = resumoQuantidade(itens, 'LGE', 'linha');
  const lgeRt = resumoQuantidade(itens, 'LGE', 'rt');
  const lgeEstoque = resumoQuantidade(itens, 'LGE', 'estoque');
  y = tabela(doc, y,
    ['AGENTE', 'EXIGIDO CAT-AV 7', 'DISPONÍVEL EM LINHA', 'RESERVA TÉCNICA', 'CCI-RT', 'ESTOQUE SCI', 'TOTAL RESERVA'],
    [18, 27, 27, 27, 20, 23, 23],
    [
      ['PQ (KG)', numero(relatorio.pqExigido), numero(pqLinha), `${numero(relatorio.reservaTecnicaPercentual)}%`, numero(pqRt), numero(pqEstoque), numero(pqRt + pqEstoque)],
      ['LGE (L)', numero(relatorio.lgeExigido), numero(lgeLinha), `${numero(relatorio.reservaTecnicaPercentual)}%`, numero(lgeRt), numero(lgeEstoque), numero(lgeRt + lgeEstoque)],
      ['ÁGUA (L)', numero(relatorio.aguaExigida), numero(relatorio.aguaEmLinha), `${numero(relatorio.reservaTecnicaPercentual)}%`, numero(relatorio.aguaCciRt), numero(relatorio.aguaEstoque), numero(relatorio.aguaCciRt + relatorio.aguaEstoque)],
    ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Navegantes-SC, ${formatarData(relatorio.dataRelatorio)}.`, PAGE_W / 2, Math.min(y + 12, 275), { align: 'center' });

  if (movimentacoes.length || relatorio.observacoes.trim()) {
    doc.addPage();
    adicionarTimbrado(doc, timbrado);
    tituloPagina(doc, `MOVIMENTAÇÕES E TESTES - ${nomeMesCompetencia(relatorio.competencia)}`);
    let y2 = secao(doc, 55, 'MOVIMENTAÇÕES E TESTES DO PERÍODO');
    y2 = tabela(doc, y2, ['DATA', 'AGENTE / LOTE', 'TIPO', 'RESULTADO', 'NOVA VALIDADE', 'OBSERVAÇÕES'], [20, 32, 31, 29, 25, 28],
      movimentacoes.map(m => {
        const item = itens.find(i => i.agenteExtintorId === m.agenteExtintorId);
        return [formatarData(m.data), item ? `${item.produto} / ${item.lote}` : '-', m.tipo, m.resultado, formatarData(m.validadeResultante), m.observacoes];
      }));
    if (relatorio.observacoes.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('OBSERVAÇÕES GERAIS', X, y2 + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(relatorio.observacoes, W), X, y2 + 16);
    }
  }

  return doc.output('blob');
}

export async function baixarRelatorioAgentesExtintoresPdf(params: {
  relatorio: AgenteExtintorRelatorio;
  itens: AgenteExtintorRelatorioItem[];
  movimentacoes: AgenteExtintorMovimentacao[];
}): Promise<void> {
  const blob = await gerarRelatorioAgentesExtintoresPdf(params);
  downloadPdf(blob, nomeArquivoRelatorioAgentesExtintores(params.relatorio.competencia));
}
