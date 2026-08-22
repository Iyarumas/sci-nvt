import jsPDF from 'jspdf';
import { criarBonaDadosVazios, normalizarFuncaoBona } from '../types/ocorrencia';
import type { Ocorrencia } from '../types/ocorrencia';
import { formatarDataBR } from '../utils/datas';
import { nomeDocumentoOcorrencia } from '../utils/documentFileNames';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';

const PAGE_W = 210;
const PAGE_H = 297;
const L = 5;
const R = 205;
const W = R - L;
const AIRPORTO_PADRAO = 'AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER - SBNF';
const CODIGO_FORMULARIO = 'MMS.BR.BA.FOR.003';

type Align = 'left' | 'center' | 'right';
type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

function texto(value: unknown): string {
  return String(value || '').trim();
}

function upper(value: unknown): string {
  return texto(value).toLocaleUpperCase('pt-BR');
}

export function nomeArquivoBonaPdf(registro: Ocorrencia): string {
  return nomeDocumentoOcorrencia(registro.data, 'BONA', registro.numero, registro.equipe);
}

function setStroke(doc: jsPDF) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.16);
  doc.setTextColor(0, 0, 0);
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  setStroke(doc);
  doc.rect(x, y, w, h);
}

function fillText(doc: jsPDF, value: string, x: number, y: number, opts: {
  size?: number;
  style?: FontStyle;
  align?: Align;
} = {}) {
  doc.setFont('helvetica', opts.style || 'normal');
  doc.setFontSize(opts.size || 8);
  doc.setTextColor(0, 0, 0);
  doc.text(value, x, y, { align: opts.align || 'left' });
}

function fitSingleLine(doc: jsPDF, value: string, width: number, maxSize: number, minSize: number, style: FontStyle): number {
  const text = texto(value);
  let size = maxSize;
  doc.setFont('helvetica', style);
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= width) return size;
    size -= 0.3;
  }
  return minSize;
}

function drawSingleLine(doc: jsPDF, value: string, x: number, y: number, w: number, h: number, opts: {
  maxSize?: number;
  minSize?: number;
  style?: FontStyle;
  align?: Align;
  valign?: 'middle' | 'top';
} = {}) {
  const text = texto(value);
  if (!text) return;
  const style = opts.style || 'normal';
  const align = opts.align || 'left';
  const size = fitSingleLine(doc, text, w - 2.4, opts.maxSize || 10, opts.minSize || 5.5, style);
  const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.2 : x + 1.2;
  const ty = opts.valign === 'top' ? y + size * 0.36 + 1 : y + h / 2 + size * 0.13;
  fillText(doc, text, tx, ty, { size, style, align });
}

function wrappedLines(doc: jsPDF, value: string, width: number, size: number, style: FontStyle): string[] {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(texto(value), width);
  return Array.isArray(lines) ? lines : [String(lines)];
}

function drawWrapped(doc: jsPDF, value: string, x: number, y: number, w: number, h: number, opts: {
  maxSize?: number;
  minSize?: number;
  style?: FontStyle;
  uppercase?: boolean;
} = {}) {
  const raw = opts.uppercase === false ? texto(value) : upper(value);
  if (!raw) return;
  const style = opts.style || 'italic';
  const minSize = opts.minSize || 6;
  let size = opts.maxSize || 11;
  let lines = wrappedLines(doc, raw, w - 2.4, size, style);
  while (size > minSize && lines.length * size * 0.43 > h - 1.8) {
    size -= 0.3;
    lines = wrappedLines(doc, raw, w - 2.4, size, style);
  }

  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.text(lines, x + 1.2, y + size * 0.38 + 1.2, { lineHeightFactor: 1.12 });
}

function numeroCurto(numero: string): string {
  const match = texto(numero).match(/(\d+)/);
  return match ? String(Number(match[1])) : texto(numero);
}

function normalizarFuncao(funcao: string): string {
  return normalizarFuncaoBona(texto(funcao));
}

function linhasBombeiros(raw: string): Array<{ nome: string; funcao: string }> {
  return texto(raw)
    .split(/\r?\n|;|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 11)
    .map(item => {
      const [nome, ...funcao] = item.split(/\s+-\s+|\s+–\s+|\s+\|\s+/);
      return { nome: upper(nome), funcao: normalizarFuncao(funcao.join(' - ')) };
    });
}

function dadosBona(registro: Ocorrencia) {
  const dados = criarBonaDadosVazios(registro.bonaDados || {});
  const bombeiros = dados.bombeiros.length > 0 ? dados.bombeiros : linhasBombeiros(registro.envolvidos);
  return criarBonaDadosVazios({
    ...dados,
    aeroporto: dados.aeroporto || AIRPORTO_PADRAO,
    areaEvento: dados.areaEvento || registro.local || '',
    tipoOcorrencia: dados.tipoOcorrencia || registro.titulo || registro.categoria || '',
    bombeiros,
    acionamento: dados.acionamento || registro.hora || '',
    descricaoOcorrencia: dados.descricaoOcorrencia || registro.descricao || '',
    descricaoAtuacaoEquipe: dados.descricaoAtuacaoEquipe || registro.acoesTomadas || '',
  });
}

function label(doc: jsPDF, value: string, x: number, y: number, w: number, h: number, align: Align = 'center', size = 8.5) {
  drawSingleLine(doc, value, x, y, w, h, { maxSize: size, minSize: 5.6, style: 'bold', align });
}

function value(doc: jsPDF, content: string, x: number, y: number, w: number, h: number, opts: {
  align?: Align;
  maxSize?: number;
  minSize?: number;
  style?: FontStyle;
} = {}) {
  drawSingleLine(doc, content, x, y, w, h, {
    align: opts.align || 'center',
    maxSize: opts.maxSize || 10,
    minSize: opts.minSize || 5.5,
    style: opts.style || 'normal',
  });
}

function drawHeader(doc: jsPDF, logo: string | null) {
  drawMedGroupLogo(doc, logo, L, 4, 38, 19, true);
  rect(doc, L + 38, 4, 127, 19);
  drawSingleLine(doc, 'RELATÓRIO DE OCORRÊNCIAS DO SESCINC', L + 38, 4, 127, 19, {
    maxSize: 13,
    minSize: 9,
    style: 'bold',
    align: 'center',
  });

  const codeX = L + 165;
  rect(doc, codeX, 4, 35, 19);
  doc.line(codeX, 13, R, 13);
  doc.line(codeX, 16.5, R, 16.5);
  label(doc, 'Código:', codeX, 4, 35, 5.8, 'center', 8);
  value(doc, CODIGO_FORMULARIO, codeX, 8.5, 35, 4.5, { maxSize: 7.6 });
  label(doc, 'Revisão:', codeX, 13, 35, 3.5, 'center', 7.4);
  value(doc, '00', codeX, 16.5, 35, 6.5, { maxSize: 8 });
}

function drawDadosIniciais(doc: jsPDF, registro: Ocorrencia, dados: ReturnType<typeof dadosBona>) {
  rect(doc, L, 24, W, 7.6);
  drawSingleLine(doc, `IDENTIFICAÇÃO DO AEROPORTO: ${dados.aeroporto || AIRPORTO_PADRAO}`, L + 1, 24, W - 2, 7.6, {
    maxSize: 9.8,
    minSize: 7,
    style: 'bold',
    align: 'left',
  });

  rect(doc, L, 34, 42, 7.2);
  rect(doc, 47, 34, 26, 7.2);
  rect(doc, 73, 34, 25, 7.2);
  label(doc, 'Data / Hora Ocorrência', L, 34, 42, 7.2, 'center', 8.8);
  value(doc, formatarDataBR(registro.data), 47, 34, 26, 7.2, { maxSize: 9.5 });
  value(doc, texto(registro.hora), 73, 34, 25, 7.2, { maxSize: 9.5 });

  rect(doc, 112, 34, 18, 7.2);
  rect(doc, 130, 34, 18, 7.2);
  rect(doc, 148, 34, 32, 7.2);
  rect(doc, 180, 34, 25, 7.2);
  label(doc, 'Equipe:', 112, 34, 18, 7.2, 'center', 8.3);
  value(doc, upper(registro.equipe), 130, 34, 18, 7.2, { maxSize: 9.2 });
  label(doc, 'Nº Ocorrência:', 148, 34, 32, 7.2, 'center', 7.5);
  value(doc, numeroCurto(registro.numero), 180, 34, 25, 7.2, { maxSize: 10.5 });

  rect(doc, L, 43.2, 48, 7);
  rect(doc, 53, 43.2, 45, 7);
  rect(doc, 112, 43.2, 62, 7);
  rect(doc, 174, 43.2, 31, 7);
  label(doc, 'Bombeiros Envolvidos: (nº)', L, 43.2, 48, 7, 'center', 8.2);
  value(doc, dados.bombeiros.length ? String(dados.bombeiros.length) : '', 53, 43.2, 45, 7, { maxSize: 10 });
  label(doc, 'Área do evento ( Mapa de Grade):', 112, 43.2, 62, 7, 'center', 8.2);
  value(doc, upper(dados.areaEvento), 174, 43.2, 31, 7, { maxSize: 10 });

  rect(doc, L, 52.1, 48, 7);
  rect(doc, 53, 52.1, 152, 7);
  label(doc, 'Tipo de Ocorrência:', L, 52.1, 48, 7, 'center', 8.4);
  value(doc, upper(dados.tipoOcorrencia), 53, 52.1, 152, 7, { maxSize: 10.5 });
}

function drawBombeiros(doc: jsPDF, bombeiros: Array<{ nome: string; funcao: string }>) {
  const y = 61;
  const hHeader = 7.1;
  const rowH = 5.55;
  const rows = 11;
  rect(doc, L, y, 98.5, hHeader);
  rect(doc, 105.8, y, 99.2, hHeader);
  label(doc, 'Bombeiro:', L, y, 98.5, hHeader, 'center', 9.4);
  label(doc, 'Função:', 105.8, y, 99.2, hHeader, 'center', 9.4);

  for (let i = 0; i < rows; i += 1) {
    const rowY = y + hHeader + i * rowH;
    rect(doc, L, rowY, 98.5, rowH);
    rect(doc, 105.8, rowY, 99.2, rowH);
    const linha = bombeiros[i];
    if (linha) {
      drawSingleLine(doc, linha.nome, L + 1.2, rowY, 96, rowH, {
        maxSize: 8.2,
        minSize: 5.6,
        style: 'italic',
        align: 'left',
      });
      drawSingleLine(doc, linha.funcao, 105.8 + 1.2, rowY, 96.8, rowH, {
        maxSize: 7.4,
        minSize: 5,
        style: 'italic',
        align: 'left',
      });
    }
  }
}

function drawCronologia(doc: jsPDF, dados: ReturnType<typeof dadosBona>) {
  const y = 130.9;
  rect(doc, L, y, 29, 16.1);
  doc.line(L, y + 6, 34, y + 6);
  doc.line(L, y + 11.05, 34, y + 11.05);
  doc.line(20, y + 6, 20, y + 16.1);
  label(doc, 'Vítimas:', L, y, 29, 6, 'center', 8.7);
  label(doc, 'Fatais:', L, y + 6, 15, 5.05, 'left', 8);
  label(doc, 'Feridas:', L, y + 11.05, 15, 5.05, 'left', 8);
  value(doc, dados.vitimasFatais || '0', 20, y + 6, 14, 5.05, { maxSize: 8.5 });
  value(doc, dados.vitimasFeridas || '0', 20, y + 11.05, 14, 5.05, { maxSize: 8.5 });

  rect(doc, 42, y, 73.3, 31.2);
  doc.line(42, y + 6, 115.3, y + 6);
  label(doc, 'Cronologia da ocorrência:', 42, y, 73.3, 6, 'center', 8.6);
  const labels = [
    'Acionamento:',
    'Hora de Saída:',
    'Hora de chegada no local:',
    'Hora de Término da ocorrência:',
    'Hora de retorno à SCI:',
  ];
  const values = [dados.acionamento, dados.saida, dados.chegadaLocal, dados.terminoOcorrencia, dados.retornoSci];
  const rowH = 5.04;
  for (let i = 0; i < labels.length; i += 1) {
    const rowY = y + 6 + i * rowH;
    if (i > 0) doc.line(42, rowY, 115.3, rowY);
    doc.line(98, rowY, 98, rowY + rowH);
    label(doc, labels[i], 42, rowY, 56, rowH, 'right', 7.8);
    value(doc, values[i], 98, rowY, 17.3, rowH, { maxSize: 8.5 });
  }

  rect(doc, 124, y, 51, 6.1);
  rect(doc, 175, y, 30, 6.1);
  label(doc, 'Tempo gasto no atendimento:', 124, y, 51, 6.1, 'center', 7.7);
  value(doc, dados.tempoGastoAtendimento, 175, y, 30, 6.1, { maxSize: 8.5 });
}

function drawSecaoTexto(doc: jsPDF, titulo: string, conteudo: string, x: number, y: number, w: number, h: number, titleH: number, maxSize: number) {
  rect(doc, x, y, w, h);
  doc.line(x, y + titleH, x + w, y + titleH);
  label(doc, titulo, x, y, w, titleH, 'left', 8.8);
  drawWrapped(doc, conteudo, x, y + titleH, w, h - titleH, {
    maxSize,
    minSize: 6,
    style: 'italic',
  });
}

function drawRodapeFormulario(doc: jsPDF, dados: ReturnType<typeof dadosBona>) {
  rect(doc, L, 222.3, 149.5, 22);
  doc.line(L, 228, 154.5, 228);
  label(doc, 'Veículos Utilizados', L, 222.3, 149.5, 5.7, 'left', 8.8);
  drawWrapped(doc, dados.veiculosUtilizados, L, 228, 149.5, 16.3, { maxSize: 10.5, minSize: 6, style: 'italic' });

  rect(doc, 161.8, 222.3, 37, 22);
  doc.line(161.8, 232.5, 198.8, 232.5);
  doc.line(161.8, 238, 198.8, 238);
  doc.line(180.3, 232.5, 180.3, 244.3);
  label(doc, 'Agentes', 161.8, 222.3, 37, 5, 'center', 8.3);
  label(doc, 'Extintores', 161.8, 227, 37, 5, 'center', 8.3);
  label(doc, 'LGE', 161.8, 232.5, 18.5, 5.5, 'center', 8.4);
  label(doc, 'PQ', 180.3, 232.5, 18.5, 5.5, 'center', 8.4);
  value(doc, dados.agentesLge || '0', 161.8, 238, 18.5, 6.3, { maxSize: 8.5, style: 'italic' });
  value(doc, dados.agentesPq || '0', 180.3, 238, 18.5, 6.3, { maxSize: 8.5, style: 'italic' });

  rect(doc, L, 245.3, W, 21);
  doc.line(L, 252.1, R, 252.1);
  label(doc, 'Outros Recursos Utilizados', L, 245.3, W, 6.8, 'left', 8.8);
  drawWrapped(doc, dados.outrosRecursosUtilizados, L, 252.1, W, 14.2, { maxSize: 10.5, minSize: 6, style: 'italic' });

  rect(doc, L, 267.4, W, 13.2);
  doc.line(73, 267.4, 73, 280.6);
  label(doc, 'Assinatura do Chefe de Equipe:', L, 267.4, 68, 13.2, 'left', 8.6);
}

export async function gerarBonaPdf(registro: Ocorrencia): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: nomeArquivoBonaPdf(registro).replace(/\.pdf$/i, ''),
    subject: 'Boletim de Ocorrencia Nao Aeronautico',
    creator: 'SESCINC Manager',
  });
  const logo = await carregarMedGroupLogo();
  const dados = dadosBona(registro);
  const bombeiros = dados.bombeiros;

  setStroke(doc);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  drawHeader(doc, logo);
  drawDadosIniciais(doc, registro, dados);
  drawBombeiros(doc, bombeiros);
  drawCronologia(doc, dados);
  drawSecaoTexto(doc, 'Descrição Sucinta da Ocorrência / Acionamento', dados.descricaoOcorrencia, L, 164.1, W, 20.8, 6.8, 10.8);
  drawSecaoTexto(doc, 'Descrição Sucinta da Atuação da Equipe do SESCINC', dados.descricaoAtuacaoEquipe, L, 185.9, W, 35, 6.8, 10.8);
  drawRodapeFormulario(doc, dados);

  return doc.output('blob');
}
