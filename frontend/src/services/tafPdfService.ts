import jsPDF from 'jspdf';
import { downloadPdf } from './pdfService';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';
import type { TreinamentoTAF } from '../types/taf';

const PAGE_W = 297;
const M = 6;
const CONTENT_W = PAGE_W - M * 2;
const AIRPORTO_PADRAO = 'AEROPORTO DE NAVEGANTES - SBNF';
const OBS_TAF_1 = 'TAF-1 : 20 FLEXOES DE BRACO, 30 ABDOMINAIS REMADOR E 30 POLICHINELOS SEGUIDOS (ate 40A = 2MIN. / 40A+ = 3MIN.)';
const OBS_TAF_2 = 'TAF-2 : 30 FLEXOES DE BRACO, 45 ABDOMINAIS REMADOR E 45 POLICHINELOS SEGUIDOS (ate 40A = 3MIN. / 40A+ = 4MIN.)';

type Align = 'left' | 'center' | 'right';

interface CellOptions {
  bold?: boolean;
  size?: number;
  align?: Align;
  valign?: 'top' | 'middle';
  fill?: [number, number, number];
  minSize?: number;
  uppercase?: boolean;
}

interface TafParticipantePdf {
  nome: string;
  funcao: string;
  idade: number;
  tempo: string;
}

function formatDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatFileDate(value: string): string {
  if (!value) return 'sem-data';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value.replace(/\//g, '-');
  return `${day}-${month}-${year}`;
}

function upper(value: string): string {
  return (value || '').toLocaleUpperCase('pt-BR');
}

function safeFilePart(value: string): string {
  return (value || 'TAF')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const result = doc.splitTextToSize(text, maxWidth);
  return Array.isArray(result) ? result : [String(result)];
}

function withEllipsis(doc: jsPDF, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 3 && doc.getTextWidth(`${out.slice(0, -1)}...`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length < text.length ? `${out}...` : out;
}

function drawTextInCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts: CellOptions = {}) {
  const value = opts.uppercase ? upper(text) : text;
  if (!value) return;

  const padX = 1.3;
  const padY = 0.9;
  let size = opts.size || 8;
  const minSize = opts.minSize || 5.8;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let lines = toLines(doc, value, w - padX * 2);

  while (size > minSize) {
    const lineHeight = size * 0.36;
    const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineHeight));
    if (lines.length <= maxLines) break;
    size -= 0.4;
    doc.setFontSize(size);
    lines = toLines(doc, value, w - padX * 2);
  }

  const lineHeight = size * 0.36;
  const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = withEllipsis(doc, lines[lines.length - 1], w - padX * 2);
  }

  const textX = opts.align === 'center'
    ? x + w / 2
    : opts.align === 'right'
      ? x + w - padX
      : x + padX;
  const textY = opts.valign === 'top'
    ? y + padY + size * 0.32
    : y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.13;

  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.text(lines, textX, textY, { align: opts.align || 'left' });
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts: CellOptions = {}) {
  doc.setLineWidth(0.18);
  if (opts.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.rect(x, y, w, h);
  drawTextInCell(doc, x, y, w, h, text, opts);
}

function participantes(registro: TreinamentoTAF): TafParticipantePdf[] {
  return Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    const item = registro as unknown as Record<string, string | number>;
    return {
      nome: String(item[`p${slot}Nome`] || ''),
      funcao: String(item[`p${slot}Funcao`] || ''),
      idade: Number(item[`p${slot}Idade`] || 0),
      tempo: String(item[`p${slot}Tempo`] || ''),
    };
  });
}

function drawHeader(doc: jsPDF, registro: TreinamentoTAF, logoDataUrl: string | null) {
  const y = 6;
  const logoW = 32;
  const x0 = M + logoW;
  const headerW = CONTENT_W - logoW;
  const titleW = 145;
  const labelW = 28;
  const valueW = headerW - titleW - labelW;

  drawMedGroupLogo(doc, logoDataUrl, M, y, logoW, 22, true);
  drawCell(doc, x0, y, titleW, 22, AIRPORTO_PADRAO, { bold: true, size: 15.5, align: 'center', minSize: 11 });
  drawCell(doc, x0 + titleW, y, labelW, 11, 'DATA', { bold: true, size: 11, align: 'center' });
  drawCell(doc, x0 + titleW + labelW, y, valueW, 11, formatDate(registro.data), { size: 8.5, align: 'center' });
  drawCell(doc, x0 + titleW, y + 11, labelW, 11, 'HORA', { bold: true, size: 11, align: 'center' });
  drawCell(doc, x0 + titleW + labelW, y + 11, valueW, 11, registro.hora || '', { size: 8.5, align: 'center' });

  doc.setFillColor(35, 176, 78);
  doc.rect(M, y + 22, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`EXERCICIO DE AFERICAO DO TAF-1 / TAF-2      -      ${upper(registro.equipe)}`, PAGE_W / 2, y + 27.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function drawTabela(doc: jsPDF, registro: TreinamentoTAF) {
  const y0 = 36;
  const cols = {
    nome: 78,
    funcao: 21,
    idade: 17,
    flexao: 21,
    abdominal: 25,
    polichinelo: 29,
    completo: 25,
    assinatura: CONTENT_W - 78 - 21 - 17 - 21 - 25 - 29 - 25,
  };
  const xs = {
    nome: M,
    funcao: M + cols.nome,
    idade: M + cols.nome + cols.funcao,
    flexao: M + cols.nome + cols.funcao + cols.idade,
    abdominal: M + cols.nome + cols.funcao + cols.idade + cols.flexao,
    polichinelo: M + cols.nome + cols.funcao + cols.idade + cols.flexao + cols.abdominal,
    completo: M + cols.nome + cols.funcao + cols.idade + cols.flexao + cols.abdominal + cols.polichinelo,
    assinatura: M + cols.nome + cols.funcao + cols.idade + cols.flexao + cols.abdominal + cols.polichinelo + cols.completo,
  };
  const headerH = 21;
  const rowH = 10.4;

  drawCell(doc, xs.nome, y0, cols.nome, headerH, 'NOME', { bold: true, size: 9, align: 'center' });
  drawCell(doc, xs.funcao, y0, cols.funcao, headerH, 'FUNCAO', { bold: true, size: 8.8, align: 'center', minSize: 7.5 });
  drawCell(doc, xs.idade, y0, cols.idade, headerH, 'IDADE', { bold: true, size: 8.8, align: 'center' });
  drawCell(doc, xs.flexao, y0, cols.flexao + cols.abdominal + cols.polichinelo + cols.completo, 8.2, `Tempo Individual de cada Bombeiro (  ${registro.tipoTaf || 'TAF'}  )`, { bold: true, size: 8.5, align: 'center' });
  drawCell(doc, xs.flexao, y0 + 8.2, cols.flexao, 6.4, 'FLEXAO', { size: 7.4, align: 'center' });
  drawCell(doc, xs.abdominal, y0 + 8.2, cols.abdominal, 6.4, 'ADBOMINAL', { size: 7.4, align: 'center' });
  drawCell(doc, xs.polichinelo, y0 + 8.2, cols.polichinelo, 6.4, 'POLICHINELO', { size: 7.4, align: 'center' });
  drawCell(doc, xs.completo, y0 + 8.2, cols.completo, 6.4, 'COMPLETO', { size: 7.4, align: 'center' });
  drawCell(doc, xs.flexao, y0 + 14.6, cols.flexao, 6.4, '1º Tomada', { size: 7.1, align: 'center' });
  drawCell(doc, xs.abdominal, y0 + 14.6, cols.abdominal, 6.4, '2º Tomada', { size: 7.1, align: 'center' });
  drawCell(doc, xs.polichinelo, y0 + 14.6, cols.polichinelo, 6.4, '3º Tomada', { size: 7.1, align: 'center' });
  drawCell(doc, xs.completo, y0 + 14.6, cols.completo, 6.4, '4º Tomada', { size: 7.1, align: 'center' });
  drawCell(doc, xs.assinatura, y0, cols.assinatura, headerH, 'ASSINATURA', { size: 8.5, align: 'center' });

  const pessoas = participantes(registro);
  for (let i = 0; i < 11; i += 1) {
    const y = y0 + headerH + i * rowH;
    const pessoa = pessoas[i];
    const temPessoa = !!pessoa?.nome;
    drawCell(doc, xs.nome, y, cols.nome, rowH, pessoa?.nome ? upper(pessoa.nome) : '', { size: 7.5, minSize: 6, valign: 'middle' });
    drawCell(doc, xs.funcao, y, cols.funcao, rowH, pessoa?.funcao || '', { bold: true, size: 7.6, align: 'center' });
    drawCell(doc, xs.idade, y, cols.idade, rowH, pessoa?.idade ? String(pessoa.idade) : '', { size: 7.6, align: 'center' });
    drawCell(doc, xs.flexao, y, cols.flexao, rowH, temPessoa ? '--' : '', { size: 8, align: 'center' });
    drawCell(doc, xs.abdominal, y, cols.abdominal, rowH, temPessoa ? '--' : '', { size: 8, align: 'center' });
    drawCell(doc, xs.polichinelo, y, cols.polichinelo, rowH, temPessoa ? '--' : '', { size: 8, align: 'center' });
    drawCell(doc, xs.completo, y, cols.completo, rowH, pessoa?.tempo || '', { size: 8, align: 'center' });
    drawCell(doc, xs.assinatura, y, cols.assinatura, rowH);
  }

  return {
    y: y0 + headerH + 11 * rowH,
    cols,
    xs,
  };
}

function drawObservacoes(doc: jsPDF, y: number, registro: TreinamentoTAF, nameW: number) {
  const obsH = 19.2;
  const rightX = M + nameW;
  const rightW = CONTENT_W - nameW;
  drawCell(doc, M, y, nameW, obsH, 'OBSERVACOES', { bold: true, size: 8.3, align: 'center' });
  drawCell(doc, rightX, y, rightW, 8, registro.observacoes || '', { size: 7.1, uppercase: true, minSize: 5.8 });
  drawCell(doc, rightX, y + 8, rightW, 5.6, OBS_TAF_1, { size: 6.1, align: 'center', minSize: 5.2 });
  drawCell(doc, rightX, y + 13.6, rightW, 5.6, OBS_TAF_2, { size: 6.1, align: 'center', minSize: 5.2 });
}

function drawAssinaturas(doc: jsPDF) {
  const lineY = 199.5;
  const lineW = 67;
  const leftX = M + 49;
  const rightX = PAGE_W - M - 49 - lineW;
  doc.setLineWidth(0.22);
  doc.line(leftX, lineY, leftX + lineW, lineY);
  doc.line(rightX, lineY, rightX + lineW, lineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Chefe de Equipe', leftX + lineW / 2, lineY + 5.5, { align: 'center' });
  doc.text('Gestor do SESCINC', rightX + lineW / 2, lineY + 5.5, { align: 'center' });
}

export function nomeArquivoTAFPdf(registro: TreinamentoTAF): string {
  return `${formatFileDate(registro.data)} NVT TAF ${safeFilePart(upper(registro.equipe))}.pdf`;
}

export async function gerarTAFPdf(registro: TreinamentoTAF): Promise<Blob> {
  const logoDataUrl = await carregarMedGroupLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `TAF - ${registro.equipe} - ${formatDate(registro.data)}`,
    subject: 'Teste de Aptidao Fisica',
    creator: 'SESCINC Manager',
  });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  drawHeader(doc, registro, logoDataUrl);
  const table = drawTabela(doc, registro);
  drawObservacoes(doc, table.y, registro, table.cols.nome);
  drawAssinaturas(doc);

  return doc.output('blob');
}

export async function baixarTAFPdf(registro: TreinamentoTAF): Promise<void> {
  const blob = await gerarTAFPdf(registro);
  downloadPdf(blob, nomeArquivoTAFPdf(registro));
}
