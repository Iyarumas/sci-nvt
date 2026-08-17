import jsPDF from 'jspdf';
import { downloadPdf } from './pdfService';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';
import type { TreinamentoTempoResposta } from '../types/tempoResposta';

const PAGE_W = 210;
const M = 3;
const CONTENT_W = PAGE_W - M * 2;
const AIRPORTO_PADRAO = 'AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER - SBNF - NVT';

type Align = 'left' | 'center' | 'right';

interface CellOptions {
  bold?: boolean;
  size?: number;
  align?: Align;
  valign?: 'top' | 'middle';
  fill?: [number, number, number];
  uppercase?: boolean;
  minSize?: number;
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

function safeFilePart(value: string): string {
  return (value || 'tempo-resposta')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function upper(value: string): string {
  return (value || '').toLocaleUpperCase('pt-BR');
}

function toLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const result = doc.splitTextToSize(text, Math.max(1, maxWidth));
  return Array.isArray(result) ? result : [String(result)];
}

function withEllipsis(doc: jsPDF, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 3 && doc.getTextWidth(`${out.slice(0, -1)}...`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length < text.length ? `${out}...` : out;
}

function fitFontSize(doc: jsPDF, text: string, maxWidth: number, startSize: number, minSize: number): number {
  let size = startSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.2;
    doc.setFontSize(size);
  }
  return size;
}

function drawTextInCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts: CellOptions = {}) {
  const value = opts.uppercase ? upper(text) : text;
  if (!value) return;

  const padX = 1.2;
  const padY = 0.9;
  let size = opts.size || 7.4;
  const minSize = opts.minSize || 5.2;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let lines = toLines(doc, value, w - padX * 2);

  while (size > minSize) {
    const lineHeight = size * 0.36;
    const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineHeight));
    if (lines.length <= maxLines) break;
    size -= 0.35;
    doc.setFontSize(size);
    lines = toLines(doc, value, w - padX * 2);
  }

  const lineHeight = size * 0.36;
  const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = withEllipsis(doc, lines[lines.length - 1], w - padX * 2);
  }

  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  const textX = opts.align === 'center'
    ? x + w / 2
    : opts.align === 'right'
      ? x + w - padX
      : x + padX;
  const textY = opts.valign === 'top'
    ? y + padY + size * 0.32
    : y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.13;
  doc.text(lines, textX, textY, { align: opts.align || 'left' });
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts: CellOptions = {}) {
  doc.setLineWidth(0.16);
  if (opts.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.rect(x, y, w, h);
  drawTextInCell(doc, x, y, w, h, text, opts);
}

function drawLogo(doc: jsPDF, logoDataUrl: string | null, x: number, y: number, w: number, h: number) {
  drawCell(doc, x, y, w, h);
  drawMedGroupLogo(doc, logoDataUrl, x, y, w, h, false);
  doc.setTextColor(0, 0, 0);
}

function drawStackedCell(doc: jsPDF, x: number, y: number, w: number, h: number, values: string[], opts: {
  size?: number;
  minSize?: number;
  uppercase?: boolean;
  bold?: boolean;
} = {}) {
  drawCell(doc, x, y, w, h);
  const lines = values.filter(Boolean).map(value => opts.uppercase ? upper(value) : value);
  if (!lines.length) return;

  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  lines.forEach((line, index) => {
    const size = fitFontSize(doc, line, w - 2.8, opts.size || 7.4, opts.minSize || 6);
    const text = doc.getTextWidth(line) > w - 2.8 ? withEllipsis(doc, line, w - 2.8) : line;
    const textY = y + ((index + 1) * h) / (lines.length + 1) + size * 0.13;
    doc.setFontSize(size);
    doc.text(text, x + w / 2, textY, { align: 'center' });
  });
}

function drawTemposCell(doc: jsPDF, x: number, y: number, w: number, h: number, tempos: string[]) {
  drawCell(doc, x, y, w, h);
  const labels = ['T1 =', 'T2 =', 'T3 ='];
  const size = 6.9;
  labels.forEach((label, index) => {
    const textY = y + ((index + 1) * h) / (labels.length + 1) + size * 0.13;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(label, x + 1.3, textY);
    doc.setFont('helvetica', 'normal');
    doc.text(tempos[index] || '', x + 1.3 + doc.getTextWidth(label) + 1, textY);
  });
}

function drawHeader(doc: jsPDF, registro: TreinamentoTempoResposta, logoDataUrl: string | null) {
  const y = 3;
  const logoW = 26;
  const codeW = 24;
  const titleW = CONTENT_W - logoW - codeW;
  drawLogo(doc, logoDataUrl, M, y, logoW, 16.5);
  drawCell(doc, M + logoW, y, titleW, 16.5, 'FORMULÁRIO PARA AFERIÇÃO DE TEMPO RESPOSTA', {
    bold: true,
    size: 10.5,
    align: 'center',
    minSize: 8,
  });
  drawCell(doc, M + logoW + titleW, y, codeW, 5.5, 'Código:', { bold: true, size: 5.8, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 5.5, codeW, 5.5, 'MMS.BR.BA.FOR.005', { size: 5.6, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 11, codeW, 3.2, 'Revisão:', { bold: true, size: 5.6, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 14.2, codeW, 2.3, '00', { size: 5.4, align: 'center' });

  const infoY = y + 16.5;
  const rightLabelW = 47;
  const rightValueW = 36;
  const leftW = CONTENT_W - rightLabelW - rightValueW;
  drawCell(doc, M, infoY, leftW, 5.6, 'IDENTIFICAÇÃO DO AEROPORTO:', { bold: true, size: 7.4, align: 'center' });
  drawCell(doc, M + leftW, infoY, rightLabelW, 5.6, 'RELATÓRIO EXERCÍCIO Nº:', { bold: true, size: 7.2, align: 'left' });
  drawCell(doc, M + leftW + rightLabelW, infoY, rightValueW, 5.6, String(registro.numero || ''), { size: 7.2, align: 'right' });
  drawCell(doc, M, infoY + 5.6, leftW, 11.2, AIRPORTO_PADRAO, { bold: true, size: 7.2, align: 'center', minSize: 6 });
  drawCell(doc, M + leftW, infoY + 5.6, rightLabelW, 5.6, 'DATA:', { bold: true, size: 7.2, align: 'left' });
  drawCell(doc, M + leftW + rightLabelW, infoY + 5.6, rightValueW, 5.6, formatDate(registro.data), { size: 7.2, align: 'right' });
  drawCell(doc, M + leftW, infoY + 11.2, rightLabelW, 5.6, 'HORA:', { bold: true, size: 7.2, align: 'left' });
  drawCell(doc, M + leftW + rightLabelW, infoY + 11.2, rightValueW, 5.6, registro.hora || '', { size: 7.2, align: 'right' });
  drawCell(doc, M, infoY + 16.8, 25, 6, 'LOCAL:', { bold: true, size: 7.4, align: 'center' });
  drawCell(doc, M + 25, infoY + 16.8, CONTENT_W - 25, 6, registro.local || '', { bold: true, size: 7.4, uppercase: true });
}

function drawVehicleRow(doc: jsPDF, y: number, cci: string, motorista: string, equipagem: string[], tempos: string[], conceito: string, performance: string) {
  const cols = [25, 19, 37, 24, 37, 23, 18, 21];
  const xs = [M];
  for (let i = 0; i < cols.length - 1; i += 1) xs.push(xs[i] + cols[i]);
  const h = 34.5;
  drawCell(doc, xs[0], y, cols[0], h, cci ? `CCI ${cci}` : '', { bold: true, size: 7.2, align: 'center' });
  drawCell(doc, xs[1], y, cols[1], h, motorista, { size: 7.5, align: 'center', uppercase: true, minSize: 5.8 });
  drawCell(doc, xs[2], y, cols[2], h);
  drawStackedCell(doc, xs[3], y, cols[3], h, equipagem, { size: 7.4, minSize: 6.1, uppercase: true });
  drawCell(doc, xs[4], y, cols[4], h);
  drawTemposCell(doc, xs[5], y, cols[5], h, tempos);
  drawCell(doc, xs[6], y, cols[6], h, conceito || '', { bold: true, size: 8.4, align: 'center' });
  drawCell(doc, xs[7], y, cols[7], h, performance || '', { bold: true, size: 7.3, align: 'center', minSize: 5.6 });
}

function drawVehicles(doc: jsPDF, registro: TreinamentoTempoResposta) {
  const y0 = 47.3;
  const cols = [25, 19, 37, 24, 37, 23, 18, 21];
  const headers = ['Viatura CCI', 'BA-MC', 'Assinatura', 'Equipagem', 'Assinatura', 'Tempo', 'Conceito', 'Performance'];
  let x = M;
  headers.forEach((header, index) => {
    drawCell(doc, x, y0, cols[index], 6, header, { bold: true, size: 6.8, align: 'center', fill: [245, 245, 245], minSize: 5.6 });
    x += cols[index];
  });
  drawVehicleRow(doc, y0 + 6, registro.f2Cci, registro.f2BaMc, [registro.f2BaCe, registro.f2Ba2], [registro.f2T1, registro.f2T2, registro.f2T3], registro.f2Conceito, registro.f2Performance);
  drawVehicleRow(doc, y0 + 40.5, registro.f3Cci, registro.f3BaMc, [registro.f3Ba21, registro.f3Ba22], [registro.f3T1, registro.f3T2, registro.f3T3], registro.f3Conceito, registro.f3Performance);
  return y0 + 75;
}

function drawSummary(doc: jsPDF, registro: TreinamentoTempoResposta, y: number) {
  const labelW = 25;
  const rowH = 9.8;
  const rows: [string, string][] = [
    ['OBSERVAÇÕES', registro.observacoes],
    ['RESUMO DO\nEXERCÍCIO', registro.resumoExercicio],
    ['CONSIDERAÇÕES\nFINAIS', registro.consideracoesFinais],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowH;
    drawCell(doc, M, rowY, labelW, rowH, label, { bold: true, size: 6.8, align: 'center', minSize: 5.8 });
    drawCell(doc, M + labelW, rowY, CONTENT_W - labelW, rowH, value, { size: 6.7, uppercase: true, minSize: 5.4 });
  });
  return y + rows.length * rowH;
}

function drawPerformance(doc: jsPDF, y: number) {
  const labelW = 25;
  const h = 27;
  drawCell(doc, M, y, labelW, h, 'DESEMPENHO\nDA EQUIPE', { bold: true, size: 7, align: 'center', minSize: 5.8 });
  const rightX = M + labelW;
  const rightW = CONTENT_W - labelW;
  const midW = rightW / 2;
  drawCell(doc, rightX, y, midW, 5, 'CONCEITO', { bold: true, size: 6.8, align: 'center', fill: [245, 245, 245] });
  drawCell(doc, rightX + midW, y, midW, 5, 'PERFORMANCE DO CCI', { bold: true, size: 6.8, align: 'center', fill: [245, 245, 245] });
  drawCell(doc, rightX, y + 5, midW, 7, "100% da capacidade de agua e regime de descarga >= 4'   (C)\n100% da capacidade de agua e regime de descarga < 3'   (A)", { size: 5.6, minSize: 5 });
  drawCell(doc, rightX + midW, y + 5, midW, 7, "Deslocamento do CCI ate o local da afericao >= 4'   (Satisfatorio)\nDeslocamento do CCI ate o local da afericao < 3   (Regular)", { size: 5.6, minSize: 5 });
  drawCell(doc, rightX, y + 12, midW, 15, "50% da capacidade de agua e regime de descarga < 3'\n50% da capacidade de agua e regime de descarga >= 3' e < 4'   (B)", { size: 5.6, minSize: 5 });
  drawCell(doc, rightX + midW, y + 12, midW, 15, "Deslocamento do CCI ate o local de afericao >= 3' e < 4'   (Irregular)", { size: 5.6, minSize: 5 });
  return y + h;
}

function drawChecklist(doc: jsPDF, registro: TreinamentoTempoResposta, y: number) {
  drawCell(doc, M, y, CONTENT_W, 5.2, 'CHECK LIST DE OBSERVAÇÕES / CONSIDERAÇÕES', {
    bold: true,
    size: 7,
    align: 'center',
    fill: [245, 245, 245],
  });
  const labelW = 77;
  const rowH = 8.3;
  const rows: [string, string][] = [
    ['Coordenação TWR/SPE/SCI:', registro.coordenacaoTwrSpeSci],
    ['ACIONAMENTO:', registro.acionamento],
    ['SISTEMA DE ALARMES:', registro.sistemaAlarmes],
    ['COMUNICAÇÃO/FRASEOLOGIA:', registro.comunicacaoFraseologia],
    ["DESLOCAMENTO VTR´s:", registro.deslocamentoVtrs],
    ['VISIBILIDADE E SUPERFÍCIE:', registro.visibilidadeSuperficie],
    ['PROCEDIMENTO PCINC:', registro.procedimentoPcinc],
    ['TEMPO RESPOSTA:', registro.tempoResposta],
    ['FEEDBACK SPE', registro.feedbackSpe],
    ['FEEDBACK TWR:', registro.feedbackTwr],
    ['FEEDBACK SCI:', registro.feedbackSci],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + 5.2 + index * rowH;
    drawCell(doc, M, rowY, labelW, rowH, label, { bold: true, size: 6.4, align: 'center', minSize: 5.4 });
    drawCell(doc, M + labelW, rowY, CONTENT_W - labelW, rowH, value, { size: 6.4, uppercase: true, minSize: 5 });
  });
  return y + 5.2 + rows.length * rowH;
}

function drawSignatureBlock(doc: jsPDF, x: number, lineY: number, lineW: number, name: string, role: string) {
  const centerX = x + lineW / 2;
  doc.setFont('helvetica', 'bold');
  const nomeCompleto = upper(name);
  if (nomeCompleto) {
    const nameSize = fitFontSize(doc, nomeCompleto, lineW - 2, 6.9, 5.6);
    doc.setFontSize(nameSize);
    doc.text(nomeCompleto, centerX, lineY + 3.1, { align: 'center' });
  }
  doc.setFontSize(6.8);
  doc.text(role, centerX, lineY + 6.7, { align: 'center' });
}

function drawSignatureArea(doc: jsPDF, y: number, registro: TreinamentoTempoResposta) {
  const h = 18;
  drawCell(doc, M, y, CONTENT_W, h);
  const lineY = y + 10.2;
  const lineW = 70;
  const leftX = M + 18;
  const rightX = M + CONTENT_W - 18 - lineW;
  doc.setLineWidth(0.16);
  doc.line(leftX, lineY, leftX + lineW, lineY);
  doc.line(rightX, lineY, rightX + lineW, lineY);
  drawSignatureBlock(doc, leftX, lineY, lineW, registro.chefeEquipe, 'BA-CE');
  drawSignatureBlock(doc, rightX, lineY, lineW, registro.gerente || registro.aprovadoPorNome || registro.aprovadoPor, 'GS / EMBAIXADOR');
}

export async function gerarTempoRespostaPdf(registro: TreinamentoTempoResposta): Promise<Blob> {
  const logoDataUrl = await carregarMedGroupLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Tempo Resposta - ${registro.equipe} - ${formatDate(registro.data)}`,
    subject: 'Formulário para Aferição de Tempo Resposta',
    creator: 'SESCINC Manager',
  });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  drawHeader(doc, registro, logoDataUrl);
  const vehicleEnd = drawVehicles(doc, registro);
  const summaryEnd = drawSummary(doc, registro, vehicleEnd);
  const performanceEnd = drawPerformance(doc, summaryEnd);
  const checklistEnd = drawChecklist(doc, registro, performanceEnd);
  drawSignatureArea(doc, checklistEnd, registro);
  doc.setLineWidth(0.22);
  doc.rect(M, 3, CONTENT_W, checklistEnd + 18 - 3);

  return doc.output('blob');
}

export async function baixarTempoRespostaPdf(registro: TreinamentoTempoResposta): Promise<void> {
  const blob = await gerarTempoRespostaPdf(registro);
  const nome = `${formatFileDate(registro.data)} NVT TEMPO RESPOSTA ${safeFilePart(upper(registro.equipe))}.pdf`;
  downloadPdf(blob, nome);
}
