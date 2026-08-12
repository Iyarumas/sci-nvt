import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  agenteExtintorReaKey,
  REA_AGENTES_EXTINTORES,
  REA_RECURSO_LINHAS,
  recursoReaKey,
} from '../types/rea';
import type { ReaRegistro } from '../types/rea';

const TEMPLATE_URL = '/templates/rea-template.pdf';
const TEXT_COLOR = rgb(0, 0, 0);

interface TextFieldPosition {
  key: string;
  page: number;
  x: number;
  top: number;
  width: number;
  fontSize?: number;
  lineHeight?: number;
  maxLines?: number;
  height?: number;
  date?: boolean;
  align?: 'left' | 'center';
}

interface CheckPosition {
  key: string;
  page: number;
  x: number;
  top: number;
  value?: string;
}

function sanitizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\t\n\r -~\u00a0-\u00ff]/g, '');
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function isMarked(value: string | undefined): boolean {
  return value === 'true' || value === 'Sim' || value === '1' || value === 'V';
}

function splitLongWord(word: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) return [word];

  const chunks: string[] = [];
  let current = '';
  for (const char of Array.from(word)) {
    const candidate = `${current}${char}`;
    if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    current = char;
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = sanitizeText(text).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        if (current) {
          lines.push(current);
          current = '';
        }
        const chunks = splitLongWord(word, font, fontSize, maxWidth);
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] || '';
        continue;
      }

      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
    }
    if (current) lines.push(current);
  }

  return lines;
}

function resolveMaxLines(field: TextFieldPosition, lineHeight: number): number {
  const maxByHeight = field.height ? Math.max(1, Math.floor(field.height / lineHeight)) : Number.MAX_SAFE_INTEGER;
  return Math.min(field.maxLines || maxByHeight || 1, maxByHeight);
}

function drawTextField(page: PDFPage, font: PDFFont, field: TextFieldPosition, rawValue: string | undefined) {
  let value = rawValue || '';
  if (!value.trim()) return;
  if (field.date) value = formatDate(value);

  const { height } = page.getSize();
  const fontSize = field.fontSize || 7;
  const lineHeight = field.lineHeight || fontSize + 2;
  const maxLines = resolveMaxLines(field, lineHeight);
  const lines = wrapText(value, font, fontSize, field.width).slice(0, maxLines);

  lines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, fontSize);
    const x = field.align === 'center' ? field.x + Math.max(0, (field.width - textWidth) / 2) : field.x;
    page.drawText(line, {
      x,
      y: height - field.top - fontSize - (index * lineHeight),
      size: fontSize,
      font,
      color: TEXT_COLOR,
    });
  });
}

function drawCheck(page: PDFPage, field: CheckPosition) {
  const { height } = page.getSize();
  const boxSize = 8.5;
  const size = 6.2;
  const x = field.x + 1.15;
  const y = height - field.top - boxSize + 1.25;
  page.drawLine({
    start: { x, y: y + size * 0.45 },
    end: { x: x + size * 0.38, y },
    thickness: 1,
    color: TEXT_COLOR,
  });
  page.drawLine({
    start: { x: x + size * 0.38, y },
    end: { x: x + size, y: y + size },
    thickness: 1,
    color: TEXT_COLOR,
  });
}

function footerDateParts() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(now);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(now);
  const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now);
  return { day, month, year };
}

const TEXT_FIELDS: TextFieldPosition[] = [
  { key: 'aerodromo', page: 1, x: 46, top: 112, width: 100 },
  { key: 'cidade', page: 1, x: 158, top: 112, width: 132 },
  { key: 'dataAcidente', page: 1, x: 300, top: 112, width: 95, date: true },
  { key: 'horaLocalAcidente', page: 1, x: 424, top: 112, width: 80 },
  { key: 'tipoAeronave', page: 1, x: 158, top: 151, width: 132 },
  { key: 'matricula', page: 1, x: 300, top: 151, width: 110 },
  { key: 'empresa', page: 1, x: 424, top: 151, width: 118 },
  { key: 'propositoOperacao', page: 1, x: 46, top: 195, width: 102 },
  { key: 'combustivel', page: 1, x: 158, top: 195, width: 132 },
  { key: 'alertaDadoPor', page: 1, x: 300, top: 195, width: 110 },
  { key: 'horaAlerta', page: 1, x: 424, top: 195, width: 80 },
  { key: 'visibilidade', page: 1, x: 46, top: 291, width: 102 },
  { key: 'teto', page: 1, x: 158, top: 291, width: 132 },
  { key: 'temperatura', page: 1, x: 300, top: 291, width: 110 },
  { key: 'direcaoVento', page: 1, x: 424, top: 291, width: 118 },
  { key: 'velocidadeVento', page: 1, x: 46, top: 333, width: 220 },
  { key: 'condicoesGeraisTempo', page: 1, x: 300, top: 333, width: 240 },
  { key: 'totalPessoasBordo', page: 1, x: 46, top: 371, width: 150 },
  { key: 'salvasSemAjudaFeridos', page: 1, x: 251, top: 378, width: 54, align: 'center' },
  { key: 'salvasSemAjudaIlesos', page: 1, x: 251, top: 393, width: 54, align: 'center' },
  { key: 'resgatadasVivasFeridos', page: 1, x: 464, top: 378, width: 54, align: 'center' },
  { key: 'resgatadasVivasIlesos', page: 1, x: 464, top: 393, width: 54, align: 'center' },
  { key: 'mortosPassageiros', page: 1, x: 105, top: 421, width: 178, align: 'center' },
  { key: 'mortosTripulantes', page: 1, x: 105, top: 437, width: 178, align: 'center' },
  { key: 'vitimasTerraMortos', page: 1, x: 355, top: 421, width: 185, align: 'center' },
  { key: 'vitimasTerraFeridos', page: 1, x: 355, top: 437, width: 185, align: 'center' },
  { key: 'obitos24hOcupantes', page: 1, x: 110, top: 464, width: 95, align: 'center' },
  { key: 'obitos24hVitimasTerra', page: 1, x: 132, top: 479, width: 75, align: 'center' },
  { key: 'mortosVitimasFogo', page: 1, x: 300, top: 464, width: 205, align: 'center' },
  { key: 'intervaloAvisoPrevio', page: 1, x: 46, top: 542, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'intervaloSemAvisoPrevio', page: 1, x: 300, top: 542, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoPrimeirosCci', page: 1, x: 46, top: 606, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoDemaisCci', page: 1, x: 300, top: 606, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoFogoControlado', page: 1, x: 46, top: 682, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoExtincaoFogo', page: 1, x: 300, top: 682, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoSaidaUltimoSobrevivente', page: 1, x: 46, top: 758, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'tempoRemocaoUltimosCadaveres', page: 1, x: 300, top: 758, width: 238, fontSize: 6.3, lineHeight: 7.2, maxLines: 3, height: 34 },
  { key: 'descricaoEmergencia', page: 2, x: 46, top: 518, width: 492, maxLines: 10, height: 92 },
  { key: 'relatoCondensadoIncendio', page: 2, x: 46, top: 631, width: 492, maxLines: 7, height: 66 },
  { key: 'descricaoCondicoesResgate', page: 2, x: 46, top: 738, width: 492, maxLines: 6, height: 58 },
  { key: 'condutaOperacoesExtincao', page: 3, x: 46, top: 128, width: 492, maxLines: 7, height: 78 },
  { key: 'descricaoEvacuacao', page: 3, x: 46, top: 236, width: 492, maxLines: 7, height: 78 },
  { key: 'numeroVitimasTrasladadas', page: 3, x: 184, top: 329, width: 350 },
  { key: 'salaPrimeirosSocorros', page: 3, x: 205, top: 346, width: 325 },
  { key: 'hospitais', page: 3, x: 126, top: 365, width: 405 },
  { key: 'necroterios', page: 3, x: 136, top: 382, width: 395 },
  { key: 'outrosDetalhesImportantes', page: 3, x: 46, top: 444, width: 492, maxLines: 8, height: 76 },
  { key: 'dificuldadesLocalizarAtingir', page: 3, x: 46, top: 536, width: 492, maxLines: 8, height: 76 },
  { key: 'avaliacaoEficiencia', page: 3, x: 46, top: 632, width: 492, fontSize: 6.5, lineHeight: 7.4, maxLines: 4, height: 42 },
  { key: 'aeronaveDestruidaAcidente', page: 3, x: 211, top: 732, width: 160 },
  { key: 'aeronaveDestruidaIncendio', page: 3, x: 384, top: 732, width: 160 },
  { key: 'aeronaveGravementeDanificadaAcidente', page: 3, x: 211, top: 750, width: 160 },
  { key: 'aeronaveGravementeDanificadaIncendio', page: 3, x: 384, top: 750, width: 160 },
  { key: 'aeronavePoucosDanosAcidente', page: 3, x: 211, top: 767, width: 160 },
  { key: 'aeronavePoucosDanosIncendio', page: 3, x: 384, top: 767, width: 160 },
  { key: 'aeronaveIncolumeAcidente', page: 3, x: 211, top: 783, width: 160 },
  { key: 'aeronaveIncolumeIncendio', page: 3, x: 384, top: 783, width: 160 },
  { key: 'diagramaViasAcesso', page: 4, x: 46, top: 112, width: 492, fontSize: 6.2, lineHeight: 7, maxLines: 1, height: 10 },
  { key: 'diagramaLocalAcidente', page: 4, x: 46, top: 147, width: 492, fontSize: 6.2, lineHeight: 7, maxLines: 2, height: 17 },
  { key: 'informacoesNaoPassadasChefe', page: 4, x: 46, top: 218, width: 492, fontSize: 6.2, lineHeight: 7, maxLines: 2, height: 16 },
  { key: 'gerenteSescinc', page: 4, x: 46, top: 373, width: 230, maxLines: 3, height: 28 },
  { key: 'coordenadorPrevEmerg', page: 4, x: 301, top: 373, width: 230, maxLines: 3, height: 28 },
];

const CHECK_FIELDS: CheckPosition[] = [
  { key: 'acidentePeriodo', value: 'Dia', page: 1, x: 47.5, top: 160.5 },
  { key: 'acidentePeriodo', value: 'Noite', page: 1, x: 104, top: 160.5 },
  { key: 'faseOperacao', value: 'Pouso', page: 1, x: 92.5, top: 244.5 },
  { key: 'faseOperacao', value: 'Decolagem', page: 1, x: 221.5, top: 244.5 },
  { key: 'faseOperacao', value: 'Taxi', page: 1, x: 354.5, top: 244.5 },
  { key: 'faseOperacao', value: 'Estacionamento', page: 1, x: 481.5, top: 244.5 },
];

const FASE_LEGACY_KEYS: Record<string, string> = {
  Pouso: 'fasePouso',
  Decolagem: 'faseDecolagem',
  Taxi: 'faseTaxi',
  Estacionamento: 'faseEstacionamento',
};

function isCheckFieldMarked(dados: ReaRegistro['dados'], field: CheckPosition): boolean {
  const current = dados[field.key];
  if (field.key === 'faseOperacao' && field.value && !current) {
    return isMarked(dados[FASE_LEGACY_KEYS[field.value]]);
  }
  return field.value ? current === field.value : isMarked(current);
}

function resourceFields(): TextFieldPosition[] {
  const cols = [
    { indice: 1, campo: 'tipo' as const, x: 285, width: 27 },
    { indice: 1, campo: 'quant' as const, x: 316, width: 28 },
    { indice: 2, campo: 'tipo' as const, x: 351, width: 27 },
    { indice: 2, campo: 'quant' as const, x: 383, width: 28 },
    { indice: 3, campo: 'tipo' as const, x: 419, width: 27 },
    { indice: 3, campo: 'quant' as const, x: 453, width: 28 },
    { indice: 4, campo: 'tipo' as const, x: 489, width: 27 },
    { indice: 4, campo: 'quant' as const, x: 522, width: 28 },
  ];

  return [
    ...buildResourceSection('aerodromo', 126.5, cols),
    ...buildResourceSection('externo', 252.2, cols),
  ];
}

function buildResourceSection(prefix: 'aerodromo' | 'externo', startTop: number, cols: { indice: number; campo: 'tipo' | 'quant'; x: number; width: number }[]): TextFieldPosition[] {
  const fields: TextFieldPosition[] = [];
  const rowSpacing = 16.8;
  REA_RECURSO_LINHAS.forEach((linha, rowIndex) => {
    cols.forEach(col => {
      fields.push({
        key: recursoReaKey(prefix, linha.key, col.indice, col.campo),
        page: 2,
        x: col.x,
        top: startTop + (rowIndex * rowSpacing),
        width: col.width,
        fontSize: 5.2,
      });
    });
  });
  return fields;
}

function extinguisherFields(): TextFieldPosition[] {
  const cols = [
    { campo: 'quantidade', x: 244, width: 55 },
    { campo: 'razao', x: 308, width: 55 },
    { campo: 'tempo', x: 371, width: 47 },
    { campo: 'ordem', x: 429, width: 46 },
    { campo: 'suficiente', x: 486, width: 58 },
  ];
  const fields: TextFieldPosition[] = [];
  REA_AGENTES_EXTINTORES.forEach((linha, rowIndex) => {
    cols.forEach(col => {
      fields.push({
        key: agenteExtintorReaKey(linha.key, col.campo),
        page: 2,
        x: col.x,
        top: 385 + (rowIndex * 17.2),
        width: col.width,
        fontSize: 5.8,
      });
    });
  });
  return fields;
}

function drawFooter(page: PDFPage, font: PDFFont, rea: ReaRegistro) {
  const { day, month, year } = footerDateParts();
  drawTextField(page, font, { key: 'cidade', page: 4, x: 130, top: 316, width: 155, fontSize: 7 }, rea.dados.cidade || rea.cidade);
  drawTextField(page, font, { key: 'day', page: 4, x: 292, top: 316, width: 24, fontSize: 7 }, day);
  drawTextField(page, font, { key: 'month', page: 4, x: 341, top: 316, width: 90, fontSize: 7 }, month);
  drawTextField(page, font, { key: 'year', page: 4, x: 446, top: 316, width: 44, fontSize: 7 }, year);
}

export async function gerarReaPdf(rea: ReaRegistro): Promise<Blob> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) throw new Error('Template PDF do REA nao encontrado.');

  const templateBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const dados = rea.dados;
  for (const field of [...TEXT_FIELDS, ...resourceFields(), ...extinguisherFields()]) {
    const page = pages[field.page - 1];
    if (!page) continue;
    drawTextField(page, font, field, dados[field.key]);
  }

  for (const field of CHECK_FIELDS) {
    const page = pages[field.page - 1];
    if (!page) continue;
    if (isCheckFieldMarked(dados, field)) drawCheck(page, field);
  }

  const footerPage = pages[3];
  if (footerPage) drawFooter(footerPage, font, rea);

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
