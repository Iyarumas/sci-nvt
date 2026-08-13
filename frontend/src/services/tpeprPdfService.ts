import jsPDF from 'jspdf';
import { downloadPdf } from './pdfService';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';
import type { TreinamentoTPEPR } from '../types/tpepr';
import { ordenarParticipantesTPEPR } from '../types/tpepr';

const PAGE_W = 297;
const M = 12;
const CONTENT_W = PAGE_W - M * 2;
const AIRPORTO_PADRAO = 'AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER (SBNF) NAVEGANTES - SC';

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
  return `${Number(day)}-${Number(month)}-${year}`;
}

function upper(value: string): string {
  return (value || '').toLocaleUpperCase('pt-BR');
}

function safeFilePart(value: string): string {
  return (value || 'tp-epr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts?: {
  bold?: boolean;
  size?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle';
  fill?: [number, number, number];
  lineWidth?: number;
}) {
  doc.setLineWidth(opts?.lineWidth || 0.25);
  if (opts?.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.rect(x, y, w, h);
  if (!text) return;

  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(opts?.size || 8);
  const lines = doc.splitTextToSize(text, w - 2);
  const size = opts?.size || 8;
  const lineHeight = size * 0.36;
  const yText = opts?.valign === 'top'
    ? y + 3.4
    : y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.13;
  const xText = opts?.align === 'center' ? x + w / 2 : opts?.align === 'right' ? x + w - 1.4 : x + 1.4;
  doc.text(lines, xText, yText, { align: opts?.align || 'left' });
}

function drawTextFit(doc: jsPDF, text: string, x: number, y: number, maxW: number, opts?: {
  size?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  const size = opts?.size || 8;
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let out = text || '';
  while (out.length > 3 && doc.getTextWidth(out) > maxW) out = `${out.slice(0, -4)}...`;
  doc.text(out, x, y, { align: opts?.align || 'left' });
}

function drawLogo(doc: jsPDF, logoDataUrl: string | null, x: number, y: number, w: number, h: number) {
  doc.setLineWidth(0.25);
  drawMedGroupLogo(doc, logoDataUrl, x, y, w, h, true);
  doc.setTextColor(0, 0, 0);
}

function drawHeader(doc: jsPDF, registro: TreinamentoTPEPR, logoDataUrl: string | null) {
  const logoW = 51;
  const codeW = 33;
  const topH = 24;
  const titleW = CONTENT_W - logoW - codeW;
  drawLogo(doc, logoDataUrl, M, 12, logoW, topH);
  drawCell(doc, M + logoW, 12, titleW, topH, 'RELATORIO AFERICAO TP-EPR', { bold: true, size: 16, align: 'center' });
  drawCell(doc, M + logoW + titleW, 12, codeW, 12, 'Codigo:\nMMS.BR.BA.FOR.018', { bold: true, size: 7, align: 'center' });
  drawCell(doc, M + logoW + titleW, 24, codeW, 12, 'Revisao:\n00', { bold: true, size: 7, align: 'center' });

  const y = 36;
  const dateW = 38;
  const hourW = 33;
  const leftW = CONTENT_W - dateW - hourW;
  drawCell(doc, M, y, leftW, 7, 'IDENTIFICACAO DO AEROPORTO:', { bold: true, size: 10, align: 'center' });
  drawCell(doc, M + leftW, y, dateW, 7, 'DATA:', { bold: true, size: 10, align: 'center' });
  drawCell(doc, M + leftW + dateW, y, hourW, 7, 'HORA:', { bold: true, size: 10, align: 'center' });
  drawCell(doc, M, y + 7, leftW, 8);
  drawCell(doc, M + leftW, y + 7, dateW, 8);
  drawCell(doc, M + leftW + dateW, y + 7, hourW, 8);

  drawTextFit(doc, AIRPORTO_PADRAO, M + leftW / 2, y + 12.4, leftW - 4, { bold: true, size: 10, align: 'center' });
  drawTextFit(doc, formatDate(registro.data), M + leftW + dateW / 2, y + 12.4, dateW - 3, { bold: true, size: 9, align: 'center' });
  drawTextFit(doc, registro.hora || '', M + leftW + dateW + hourW / 2, y + 12.4, hourW - 3, { bold: true, size: 9, align: 'center' });
  drawCell(doc, M, y + 15, CONTENT_W, 10, 'EXERCICIO DE AFERICAO DE TP / EPR', {
    bold: true,
    size: 13,
    align: 'center',
    fill: [220, 220, 220],
  });
}

function drawTabela(doc: jsPDF, registro: TreinamentoTPEPR) {
  const y0 = 61;
  const nameW = 100;
  const funcW = 34;
  const timeW = (CONTENT_W - nameW - funcW) / 4;
  const xName = M;
  const xFunc = xName + nameW;
  const xTempo = xFunc + funcW;
  const headerH = 23;
  const rowH = 5.8;
  const rows = 12;
  const grey: [number, number, number] = [200, 200, 200];

  drawCell(doc, xName, y0, nameW, headerH, 'NOME', { bold: true, size: 9, align: 'center' });
  drawCell(doc, xFunc, y0, funcW, headerH, 'FUNCAO', { bold: true, size: 9, align: 'center' });
  drawCell(doc, xTempo, y0, timeW * 4, 6, 'Tempo Individual de cada Bombeiro', { bold: true, size: 9, align: 'center' });

  const labels = ['Calca + Bota', 'TP Completo', 'EPR + TP\nCompleto', 'EPR sem TP'];
  labels.forEach((label, index) => {
    drawCell(doc, xTempo + index * timeW, y0 + 6, timeW, 9, label, { bold: true, size: 8.5, align: 'center' });
  });
  ['1a Tomada', '2a Tomada', '3a Tomada', '4a Tomada'].forEach((label, index) => {
    drawCell(doc, xTempo + index * timeW, y0 + 15, timeW, 8, label, { bold: true, size: 8.5, align: 'center', fill: grey });
  });

  const participantes = ordenarParticipantesTPEPR(registro.participantes)
    .filter(p => p.pessoaId || p.nomeCompleto || p.nomeGuerra);

  for (let i = 0; i < rows; i += 1) {
    const participante = participantes[i];
    const y = y0 + headerH + i * rowH;
    drawCell(doc, xName, y, nameW, rowH);
    drawCell(doc, xFunc, y, funcW, rowH);
    for (let col = 0; col < 4; col += 1) {
      drawCell(doc, xTempo + col * timeW, y, timeW, rowH);
    }
    if (!participante) continue;

    drawTextFit(doc, upper(participante.nomeCompleto || participante.nomeGuerra), xName + 1, y + 4.1, nameW - 2, { bold: true, size: 7.8 });
    drawTextFit(doc, participante.funcao || '', xFunc + funcW / 2, y + 4.1, funcW - 2, { size: 8, align: 'center' });
    const tempos = [
      participante.primeiraTomada,
      participante.segundaTomada,
      participante.terceiraTomada,
      participante.quartaTomada,
    ];
    tempos.forEach((tempo, col) => {
      drawTextFit(doc, tempo || '', xTempo + col * timeW + timeW / 2, y + 4.1, timeW - 2, { size: 8, align: 'center' });
    });
  }

  return y0 + headerH + rows * rowH;
}

function drawAssinaturas(doc: jsPDF, y: number) {
  const h = 43;
  drawCell(doc, M, y, CONTENT_W, h);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ASSINATURAS:', M + 1, y + 4.5);

  const lineY = y + 31.5;
  const lineW = 72;
  const leftX = M + 48;
  const rightX = M + CONTENT_W - 84;
  doc.setLineWidth(0.25);
  doc.line(leftX, lineY, leftX + lineW, lineY);
  doc.line(rightX, lineY, rightX + lineW, lineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Chefe de Equipe', leftX + lineW / 2, lineY + 5.2, { align: 'center' });
  doc.text('Gerente / Embaixador - SCI', rightX + lineW / 2, lineY + 5.2, { align: 'center' });
}

export async function gerarTPEPRPdf(registro: TreinamentoTPEPR): Promise<Blob> {
  const logoDataUrl = await carregarMedGroupLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `TP-EPR - ${registro.equipe} - ${formatDate(registro.data)}`,
    subject: 'Relatorio Afericao TP-EPR',
    creator: 'SESCINC Manager',
  });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  drawHeader(doc, registro, logoDataUrl);
  const tableEnd = drawTabela(doc, registro);
  drawAssinaturas(doc, tableEnd);
  doc.setLineWidth(0.25);
  doc.rect(M, 12, CONTENT_W, tableEnd + 43 - 12);
  return doc.output('blob');
}

export async function baixarTPEPRPdf(registro: TreinamentoTPEPR): Promise<void> {
  const blob = await gerarTPEPRPdf(registro);
  const nome = `${formatFileDate(registro.data)} NVT TP EPR ${safeFilePart(upper(String(registro.equipe)))}.pdf`;
  downloadPdf(blob, nome);
}
