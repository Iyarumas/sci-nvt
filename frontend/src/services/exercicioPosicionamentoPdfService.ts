import jsPDF from 'jspdf';
import { downloadPdf } from './pdfService';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';
import type { ExercicioPosicionamento } from '../types/exercicioPosicionamento';

const PAGE_W = 210;
const M = 4;
const CONTENT_W = PAGE_W - M * 2;
const SIGNATURE_H = 30;
const AIRPORTO_PADRAO = 'AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER SBNF/NVT';

type Align = 'left' | 'center' | 'right';

interface CellOptions {
  bold?: boolean;
  size?: number;
  align?: Align;
  valign?: 'top' | 'middle';
  fill?: [number, number, number];
  minSize?: number;
  uppercase?: boolean;
  lineHeightFactor?: number;
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
  return (value || 'posicionamento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function upper(value: string): string {
  return (value || '').toLocaleUpperCase('pt-BR');
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

  const padX = 1.4;
  const padY = 1.2;
  let size = opts.size || 8;
  const minSize = opts.minSize || 5.8;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let lines = toLines(doc, value, w - padX * 2);

  while (size > minSize) {
    const lineHeight = size * (opts.lineHeightFactor || 0.36);
    const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineHeight));
    if (lines.length <= maxLines) break;
    size -= 0.4;
    doc.setFontSize(size);
    lines = toLines(doc, value, w - padX * 2);
  }

  const lineHeight = size * (opts.lineHeightFactor || 0.36);
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
  doc.setLineWidth(0.18);
  if (opts.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.rect(x, y, w, h);
  drawTextInCell(doc, x, y, w, h, text, opts);
}

function drawEquipagemCell(doc: jsPDF, x: number, y: number, w: number, h: number, nomes: string[]) {
  drawCell(doc, x, y, w, h);
  const linhas = nomes.filter(Boolean).map(upper);
  if (!linhas.length) return;

  doc.setFont('helvetica', 'normal');
  linhas.forEach((nome, index) => {
    const size = fitFontSize(doc, nome, w - 2.8, 8.8, 6.8);
    const text = doc.getTextWidth(nome) > w - 2.8 ? withEllipsis(doc, nome, w - 2.8) : nome;
    const textY = y + ((index + 1) * h) / (linhas.length + 1) + size * 0.13;
    doc.setFontSize(size);
    doc.text(text, x + w / 2, textY, { align: 'center' });
  });
}

function drawLogo(doc: jsPDF, logoDataUrl: string | null, x: number, y: number, w: number, h: number) {
  drawCell(doc, x, y, w, h);
  drawMedGroupLogo(doc, logoDataUrl, x, y, w, h, false);
  doc.setTextColor(0, 0, 0);
}

function drawHeader(doc: jsPDF, registro: ExercicioPosicionamento, logoDataUrl: string | null) {
  const y = 3;
  const logoW = 25;
  const codeW = 31;
  const titleW = CONTENT_W - logoW - codeW;
  drawLogo(doc, logoDataUrl, M, y, logoW, 19);
  drawCell(doc, M + logoW, y, titleW, 19, 'FORMULÁRIO PARA AFERIÇÃO DE POSICIONAMENTO PARA INTERVENÇÃO', {
    bold: true,
    size: 10.5,
    align: 'center',
    minSize: 8,
  });
  drawCell(doc, M + logoW + titleW, y, codeW, 7.2, 'Código:', { bold: true, size: 7.5, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 7.2, codeW, 5.6, 'MMS.BR.BA.FOR.006', { size: 7, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 12.8, codeW, 3.8, 'Revisão:', { bold: true, size: 6.8, align: 'center' });
  drawCell(doc, M + logoW + titleW, y + 16.6, codeW, 2.4, '00', { size: 6.5, align: 'center' });

  const infoY = y + 19;
  const rightLabelW = 38;
  const rightValueW = 27;
  const leftW = CONTENT_W - rightLabelW - rightValueW;
  drawCell(doc, M, infoY, leftW, 6, 'IDENTIFICAÇÃO DO AEROPORTO:', { bold: true, size: 8.5, align: 'center' });
  drawCell(doc, M + leftW, infoY, rightLabelW, 6, 'RELATÓRIO EXERCÍCIO N°', { bold: true, size: 7.5, align: 'center', minSize: 6 });
  drawCell(doc, M + leftW + rightLabelW, infoY, rightValueW, 6, String(registro.numero || ''), { size: 8.5, align: 'center' });
  drawCell(doc, M, infoY + 6, leftW, 12, AIRPORTO_PADRAO, { bold: true, size: 8.8, align: 'center', minSize: 7 });
  drawCell(doc, M + leftW, infoY + 6, rightLabelW, 6, 'DATA', { bold: true, size: 8.2, align: 'left' });
  drawCell(doc, M + leftW + rightLabelW, infoY + 6, rightValueW, 6, formatDate(registro.data), { size: 8.2, align: 'center' });
  drawCell(doc, M + leftW, infoY + 12, rightLabelW, 6, 'HORA', { bold: true, size: 8.2, align: 'left' });
  drawCell(doc, M + leftW + rightLabelW, infoY + 12, rightValueW, 6, registro.hora || '', { size: 8.2, align: 'center' });
}

function drawVehicleRow(doc: jsPDF, y: number, label: string, motorista: string, equipagem: string[], tempo: string) {
  const cols = [27, 27, 45, 27, 45, 31];
  const xs = [M];
  for (let i = 0; i < cols.length - 1; i += 1) xs.push(xs[i] + cols[i]);
  const h = 19.5;
  drawCell(doc, xs[0], y, cols[0], h, label, { bold: true, size: 8.2, align: 'center' });
  drawCell(doc, xs[1], y, cols[1], h, motorista, { size: 8, align: 'center', uppercase: true });
  drawCell(doc, xs[2], y, cols[2], h);
  drawEquipagemCell(doc, xs[3], y, cols[3], h, equipagem);
  drawCell(doc, xs[4], y, cols[4], h);
  drawCell(doc, xs[5], y, cols[5], h, tempo || '', { size: 8.4, align: 'center' });
}

function observacoesComOperador(registro: ExercicioPosicionamento): string {
  const partes = [registro.observacoes];
  if (registro.operadorComunicacoes) {
    partes.push(`Central Faísca: ${upper(registro.operadorComunicacoes)}`);
  }
  return partes.filter(Boolean).join('    ');
}

function drawMainTable(doc: jsPDF, registro: ExercicioPosicionamento) {
  const localY = 40;
  drawCell(doc, M, localY, 27, 8, 'LOCAL', { bold: true, size: 8.8, align: 'center' });
  drawCell(doc, M + 27, localY, CONTENT_W - 27, 8, registro.local || '', {
    bold: true,
    size: 8.2,
    align: 'center',
    uppercase: true,
    minSize: 6.8,
  });

  const tableY = localY + 8;
  const cols = [27, 27, 45, 27, 45, 31];
  const headers = ['Viatura CCI', 'BA-MC', 'Assinatura', 'Equipagem', 'Assinatura', 'Tempo'];
  let x = M;
  headers.forEach((header, index) => {
    drawCell(doc, x, tableY, cols[index], 6, header, { bold: true, size: 8, align: 'center', fill: [245, 245, 245] });
    x += cols[index];
  });
  drawVehicleRow(doc, tableY + 6, 'Faísca 2', registro.faisca2BaMc, [registro.faisca2BaCe, registro.faisca2Ba2], registro.faisca2Tempo);
  drawVehicleRow(doc, tableY + 25.5, 'Faísca 3', registro.faisca3BaMc, [registro.faisca3Ba21, registro.faisca3Ba22], registro.faisca3Tempo);
  drawVehicleRow(doc, tableY + 45, 'CRS', registro.crsBaMc, [registro.crsBaLr, registro.crsBaRe1, registro.crsBaRe2], registro.crsTempo);

  const textY = tableY + 64.5;
  const labelW = 27;
  drawCell(doc, M, textY, labelW, 10, 'OBSERVAÇÕES', { bold: true, size: 7.8, align: 'center' });
  drawCell(doc, M + labelW, textY, CONTENT_W - labelW, 10, observacoesComOperador(registro), { size: 7.2, uppercase: true, minSize: 5.8 });
  drawCell(doc, M, textY + 10, labelW, 10, 'RESUMO DO\nEXERCÍCIO', { bold: true, size: 7.4, align: 'center' });
  drawCell(doc, M + labelW, textY + 10, CONTENT_W - labelW, 10, registro.resumoExercicio, { size: 7.2, uppercase: true, minSize: 5.8 });
  drawCell(doc, M, textY + 20, labelW, 10, 'CONSIDERAÇÕES\nFINAIS', { bold: true, size: 7.4, align: 'center' });
  drawCell(doc, M + labelW, textY + 20, CONTENT_W - labelW, 10, registro.consideracoesFinais, { size: 7.2, uppercase: true, minSize: 5.8 });
}

function drawChecklist(doc: jsPDF, registro: ExercicioPosicionamento) {
  const y0 = 142.5;
  drawCell(doc, M, y0, CONTENT_W, 6, 'CHECK LIST DE OBSERVAÇÕES / CONSIDERAÇÕES', {
    bold: true,
    size: 8.2,
    align: 'center',
    fill: [245, 245, 245],
  });

  const labelW = 51;
  const rowH = 9.8;
  const rows: [string, string][] = [
    ['COORDENAÇÃO TWR/COE/SCI:', registro.coordenacaoTwrCoeSci],
    ['ACIONAMENTO', registro.acionamento],
    ['SISTEMA DE ALARMES', registro.sistemaAlarmes],
    ['COMUNICAÇÃO / FRASEOLOGIA', registro.comunicacaoFraseologia],
    ["DESLOCAMENTO VTR's", registro.deslocamentoVtrs],
    ['VISIBILIDADE E SUPERFÍCIE', registro.visibilidadeSuperficie],
    ['PROCEDIMENTOS PCINC', registro.procedimentosPcinc],
    ['TEMPO RESPOSTA', registro.tempoResposta],
    ['FEEDBACK COE', registro.feedbackCoe],
    ['FEEDBACK TWR', registro.feedbackTwr],
    ['FEEDBACK SCI', registro.feedbackSci],
  ];

  rows.forEach(([label, value], index) => {
    const y = y0 + 6 + index * rowH;
    drawCell(doc, M, y, labelW, rowH, label, { bold: true, size: 7.3, align: 'center', minSize: 6.2 });
    drawCell(doc, M + labelW, y, CONTENT_W - labelW, rowH, value, {
      size: 7.2,
      uppercase: true,
      valign: 'middle',
      minSize: 5.8,
    });
  });

  return y0 + 6 + rows.length * rowH;
}

function drawSignatureBlock(doc: jsPDF, x: number, lineY: number, lineW: number, name: string, role: string) {
  const centerX = x + lineW / 2;
  doc.setFont('helvetica', 'bold');
  const nomeCompleto = upper(name);
  if (nomeCompleto) {
    const nameSize = fitFontSize(doc, nomeCompleto, lineW - 2, 8.8, 6.8);
    doc.setFontSize(nameSize);
    doc.text(nomeCompleto, centerX, lineY + 5.2, { align: 'center' });
  }
  doc.setFontSize(8.2);
  doc.text(role, centerX, lineY + 11, { align: 'center' });
}

function drawSignatureArea(doc: jsPDF, y: number, registro: ExercicioPosicionamento) {
  drawCell(doc, M, y, CONTENT_W, SIGNATURE_H);
  const lineY = y + 12.6;
  const lineW = 82;
  const leftX = M + 13;
  const rightX = M + CONTENT_W - 13 - lineW;
  doc.setLineWidth(0.18);
  doc.line(leftX, lineY, leftX + lineW, lineY);
  doc.line(rightX, lineY, rightX + lineW, lineY);
  drawSignatureBlock(doc, leftX, lineY, lineW, registro.chefeEquipe, 'BA-CE');
  drawSignatureBlock(doc, rightX, lineY, lineW, registro.gerente || registro.aprovadoPorNome || registro.aprovadoPor, 'GS');
}

export async function gerarExercicioPosicionamentoPdf(registro: ExercicioPosicionamento): Promise<Blob> {
  const logoDataUrl = await carregarMedGroupLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Exercício de Posicionamento - ${registro.equipe} - ${formatDate(registro.data)}`,
    subject: 'Formulário para Aferição de Posicionamento para Intervenção',
    creator: 'SESCINC Manager',
  });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  drawHeader(doc, registro, logoDataUrl);
  drawMainTable(doc, registro);
  const checklistEnd = drawChecklist(doc, registro);
  drawSignatureArea(doc, checklistEnd, registro);
  doc.setLineWidth(0.22);
  doc.rect(M, 3, CONTENT_W, checklistEnd + SIGNATURE_H - 3);

  return doc.output('blob');
}

export async function baixarExercicioPosicionamentoPdf(registro: ExercicioPosicionamento): Promise<void> {
  const blob = await gerarExercicioPosicionamentoPdf(registro);
  const nome = `${formatFileDate(registro.data)} NVT EXERCICIO DE POSICIONAMENTO ${safeFilePart(upper(registro.equipe))}.pdf`;
  downloadPdf(blob, nome);
}
