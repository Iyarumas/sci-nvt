import jsPDF from 'jspdf';
import type { PTRBACompleto, PTRBACompletoEvidencia, PTRBACompletoParticipante } from '../types/ptrbaCompleto';
import { normalizarEvidenciasPTRBACompleto, PTRBA_COMPLETO_EQUIPES } from '../types/ptrbaCompleto';
import { downloadPdf } from './pdfService';

const PAGE_H = 297;
const M = 10;

function formatDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function periodo(ev: PTRBACompletoEvidencia): string {
  if (!ev.horaInicio && !ev.horaTermino) return '';
  return `${ev.horaInicio || '--:--'} as ${ev.horaTermino || '--:--'}`;
}

function upper(value: string): string {
  return (value || '').toLocaleUpperCase('pt-BR');
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text = '', opts?: {
  bold?: boolean;
  size?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle';
  fill?: [number, number, number];
}) {
  if (opts?.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.rect(x, y, w, h);
  if (!text) return;
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(opts?.size || 8);
  const lines = doc.splitTextToSize(text, w - 2);
  const lineHeight = (opts?.size || 8) * 0.36;
  const textY = opts?.valign === 'top'
    ? y + 3
    : y + (h / 2) - ((lines.length - 1) * lineHeight / 2) + 1.1;
  const textX = opts?.align === 'center' ? x + w / 2 : opts?.align === 'right' ? x + w - 1.2 : x + 1.2;
  doc.text(lines, textX, textY, { align: opts?.align || 'left' });
}

function drawTextFit(doc: jsPDF, text: string, x: number, y: number, maxW: number, options?: {
  size?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  const size = options?.size || 8;
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let out = text || '';
  while (out.length > 3 && doc.getTextWidth(out) > maxW) out = `${out.slice(0, -4)}...`;
  doc.text(out, x, y, { align: options?.align || 'left' });
}

function drawHeader(doc: jsPDF) {
  doc.setLineWidth(0.25);
  drawCell(doc, M, 7, 34, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Group', M + 4, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(205, 31, 47);
  doc.text('med', M + 4, 19);
  doc.setTextColor(64, 168, 92);
  doc.text('+', M + 27, 19);
  doc.setTextColor(0, 0, 0);

  drawCell(doc, M + 34, 7, 112, 14, 'RELATÓRIO DE REGISTRO PTR-BA', {
    bold: true,
    size: 12,
    align: 'center',
  });
  drawCell(doc, M + 146, 7, 50, 7, 'Código:\nMMS.BR.BA.FOR.004', {
    bold: true,
    size: 7,
    align: 'center',
  });
  drawCell(doc, M + 146, 14, 50, 7, 'Revisão:\n00', {
    bold: true,
    size: 7,
    align: 'center',
  });
}

function drawEquipeLinha(doc: jsPDF, registro: PTRBACompleto) {
  drawCell(doc, M, 23, 196, 6, 'IDENTIFICAÇÃO DO AEROPORTO:', { bold: true, size: 10 });
  if (registro.identificacaoAeroporto) {
    drawTextFit(doc, upper(registro.identificacaoAeroporto), M + 75, 27.2, 109, { size: 8 });
  }
  drawCell(doc, M, 29, 32, 6, 'EQUIPE:', { bold: true, size: 8, align: 'center' });
  drawCell(doc, M + 32, 29, 110, 6);
  PTRBA_COMPLETO_EQUIPES.forEach((equipe, index) => {
    const x = M + 36 + index * 28;
    doc.rect(x, 30.2, 2.7, 2.7);
    if (registro.equipe === equipe) {
      doc.line(x + 0.4, 31.5, x + 1.1, 32.4);
      doc.line(x + 1.1, 32.4, x + 2.3, 30.5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(equipe.toLocaleUpperCase('pt-BR'), x + 5.2, 32.7);
  });
  drawCell(doc, M + 142, 29, 13, 6, 'DATA:', { bold: true, size: 8, align: 'center' });
  drawCell(doc, M + 155, 29, 41, 6, formatDate(registro.data), { bold: true, size: 8, align: 'center' });
}

function drawParticipantes(doc: jsPDF, participantes: PTRBACompletoParticipante[]) {
  const y0 = 36.5;
  const rowH = 6.7;
  const widths = [15, 18, 68, 19, 76];
  const xs = [M];
  for (let i = 0; i < widths.length - 1; i += 1) xs.push(xs[i] + widths[i]);
  const headers = ['ORD', 'Função', 'NOME COMPLETO', "Situação dos\nBA's", 'ASSINATURA DO BA'];
  headers.forEach((header, i) => drawCell(doc, xs[i], y0, widths[i], 7, header, { bold: true, size: 7, align: 'center' }));

  const preenchidos = participantes.filter(p => p.nomeCompleto);
  for (let i = 0; i < preenchidos.length; i += 1) {
    const y = y0 + 7 + i * rowH;
    const p = preenchidos[i] || { funcao: '', nomeCompleto: '', situacao: '' };
    drawCell(doc, xs[0], y, widths[0], rowH, String(i + 1), { size: 7, align: 'center' });
    drawCell(doc, xs[1], y, widths[1], rowH, p.funcao || '', { size: 7, align: 'center' });
    drawCell(doc, xs[2], y, widths[2], rowH);
    drawTextFit(doc, upper(p.nomeCompleto || ''), xs[2] + 1.2, y + 4.3, widths[2] - 2.4, { size: 7 });
    drawCell(doc, xs[3], y, widths[3], rowH, p.situacao || '', { size: 7, align: 'center' });
    drawCell(doc, xs[4], y, widths[4], rowH);
  }
}

function drawObservacoes(doc: jsPDF, registro: PTRBACompleto) {
  const y = 144;
  drawCell(doc, M, y, 196, 8, 'OBSERVAÇÕES:', { bold: true, size: 8, valign: 'top' });
  if (registro.observacoes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(registro.observacoes, 170).slice(0, 2);
    doc.text(lines, M + 32, y + 3.2);
  }
  drawCell(
    doc,
    M,
    y + 8,
    196,
    8,
    'LEGENDAS: P - Presente / A - Ausente / EO - Empenho Ocorrência / OC - Operador Comunicação / INSTR.1 - Instrutor PTR 1 / INSTR.2 - Instrutor PTR 2 / INSTR.1-2 - Instrutor PTR 1 e 2.',
    { bold: true, size: 6.4, valign: 'middle' },
  );
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function drawEvidenceImage(doc: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number) {
  if (!dataUrl) return;
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(w / props.width, h / props.height);
    const imgW = Math.min(props.width * ratio * 1.15, w);
    const imgH = props.height * ratio;
    const imgX = x + (w - imgW) / 2;
    const imgY = y + (h - imgH) / 2;
    doc.addImage(dataUrl, imageFormat(dataUrl), imgX, imgY, imgW, imgH, undefined, 'FAST');
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Imagem invalida', x + w / 2, y + h / 2, { align: 'center' });
  }
}

function drawEvidenceCell(doc: jsPDF, ev: PTRBACompletoEvidencia, x: number, y: number, w: number, h: number) {
  const footerH = 6;
  const imgH = h - footerH;
  drawCell(doc, x, y, w, imgH);
  drawEvidenceImage(doc, ev.imagem, x + 0.5, y + 0.5, w - 1, imgH - 1);
  if (!ev.imagem && ev.descricao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(ev.descricao, w - 6).slice(0, 6);
    doc.text(lines, x + 3, y + 6);
  }
  drawCell(doc, x, y + imgH, 34, footerH, periodo(ev), {
    bold: true,
    size: 7,
    align: 'center',
    fill: [220, 220, 220],
  });
  drawCell(doc, x + 34, y + imgH, w - 34, footerH, ev.assunto || '', {
    bold: true,
    size: 6.5,
    align: 'center',
    fill: [220, 220, 220],
  });
}

function drawEvidencias(doc: jsPDF, evidencias: PTRBACompletoEvidencia[]) {
  const titleY = 160;
  drawCell(doc, M, titleY, 196, 5, 'ASSUNTOS MINISTRADOS E EVIDÊNCIAS', { bold: true, size: 8, align: 'center' });
  const xLeft = M;
  const xRight = M + 98;
  const cellW = 98;
  const labelH = 4;
  const cellH = 34;
  // 3 instruções, cada uma com 2 evidências juntas
  for (let n = 0; n < 3; n += 1) {
    const labelY = titleY + 5 + n * (labelH + cellH);
    drawCell(doc, M, labelY, 196, labelH, `INSTRUÇÃO ${n + 1}`, { bold: true, size: 7, align: 'center', fill: [230, 230, 230] });
    const y = labelY + labelH;
    const i = n * 2;
    drawEvidenceCell(doc, evidencias[i], xLeft, y, cellW, cellH);
    drawEvidenceCell(doc, evidencias[i + 1], xRight, y, cellW, cellH);
  }
}

function drawAssinatura(doc: jsPDF) {
  const y = 288.5;
  doc.setLineWidth(0.2);
  doc.line(58, y, 152, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ASSINATURA DO CHEFE DE EQUIPE', 105, y + 4, { align: 'center' });
  doc.line(M, 295, M + 196, 295);
}

export async function gerarPTRBACompletoPdf(registro: PTRBACompleto): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `PTR-BA Completo - ${registro.equipe} - ${formatDate(registro.data)}`,
    subject: 'Relatório de Registro PTR-BA',
    creator: 'SESCINC Manager',
  });
  drawHeader(doc);
  drawEquipeLinha(doc, registro);
  drawParticipantes(doc, registro.participantes);
  drawObservacoes(doc, registro);
  drawEvidencias(doc, normalizarEvidenciasPTRBACompleto(registro.evidencias));
  drawAssinatura(doc);
  doc.setLineWidth(0.25);
  doc.rect(M, 7, 196, PAGE_H - 9);
  return doc.output('blob');
}

export async function baixarPTRBACompletoPdf(registro: PTRBACompleto): Promise<void> {
  const blob = await gerarPTRBACompletoPdf(registro);
  const dataArquivo = registro.data ? registro.data.split('-').reverse().join('-') : 'sem_data';
  const nome = `${dataArquivo} NVT PTRBA ${String(registro.equipe).toLocaleUpperCase('pt-BR')}.pdf`;
  downloadPdf(blob, nome);
}
