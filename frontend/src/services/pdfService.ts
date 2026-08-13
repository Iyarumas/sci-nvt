import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

type TextAlign = 'left' | 'center' | 'right';

interface PdfFieldPosition {
  field_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  is_signature?: boolean;
  field_type?: string;
  page?: number;
  text_align?: TextAlign;
}

function splitLongWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of word) {
    const next = current + char;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const wordParts = font.widthOfTextAtSize(word, size) > maxWidth
        ? splitLongWord(font, word, size, maxWidth)
        : [word];
      for (const part of wordParts) {
        const next = current ? `${current} ${part}` : part;
        if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(current);
          current = part;
        } else {
          current = next;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function truncateText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let out = text;
  while (out.length > 3 && font.widthOfTextAtSize(`${out.slice(0, -1)}...`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length < text.length ? `${out}...` : out;
}

function drawTextFit(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  align: TextAlign = 'left',
) {
  const padX = 2;
  const maxWidth = Math.max(4, width - padX * 2);
  const maxHeight = Math.max(size, height);
  let fontSize = size;
  let lineHeight = fontSize * 1.18;
  let lines = wrapText(font, value, fontSize, maxWidth);

  while (fontSize > 6 && lines.length * lineHeight > maxHeight) {
    fontSize -= 0.5;
    lineHeight = fontSize * 1.18;
    lines = wrapText(font, value, fontSize, maxWidth);
  }

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = truncateText(font, lines[lines.length - 1], fontSize, maxWidth);
  }

  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);
    const textX = align === 'center'
      ? x + width / 2 - lineWidth / 2
      : align === 'right'
        ? x + width - padX - lineWidth
        : x + padX;
    page.drawText(line, {
      x: textX,
      y: y - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

function drawCleanCheckbox(page: PDFPage, x: number, y: number, size: number, checked: boolean) {
  const boxSize = Math.max(7, Math.min(9, size * 0.5));
  const boxX = x + 1.4;
  const boxY = y - 0.2;
  const coverPad = 2.6;
  page.drawRectangle({
    x: boxX - coverPad,
    y: boxY - coverPad,
    width: boxSize + coverPad * 2,
    height: boxSize + coverPad * 2,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.7,
  });
  if (!checked) return;
  page.drawLine({
    start: { x: boxX + boxSize * 0.22, y: boxY + boxSize * 0.48 },
    end: { x: boxX + boxSize * 0.42, y: boxY + boxSize * 0.27 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: boxX + boxSize * 0.42, y: boxY + boxSize * 0.27 },
    end: { x: boxX + boxSize * 0.8, y: boxY + boxSize * 0.72 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
}

export async function lerCamposPdf(pdfBytes: ArrayBuffer): Promise<string[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  return fields.map(f => f.getName());
}

export async function preencherPdf(
  pdfBytes: ArrayBuffer,
  dados: Record<string, string>,
  fieldPositions?: PdfFieldPosition[],
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  try {
    const form = pdfDoc.getForm();
    const acroFields = form.getFields();
    if (acroFields.length > 0) {
      for (const [fieldName, value] of Object.entries(dados)) {
        try {
          const field = form.getField(fieldName);
          if (field instanceof PDFTextField) {
            field.setText(value);
          } else if (field instanceof PDFCheckBox) {
            if (value === 'V' || value === 'true' || value === 'Sim' || value === '1') {
              field.check();
            } else {
              field.uncheck();
            }
          } else if (field instanceof PDFDropdown) {
            field.select(value);
          }
        } catch { /* ignore */ }
      }
      form.flatten();
    }
  } catch { /* ignore */ }

  if (fieldPositions && fieldPositions.length > 0) {
    for (const pos of fieldPositions) {
      let value = dados[pos.field_name];
      const isCheckField = pos.field_name.startsWith('check_');
      if ((!value || value.trim() === '') && !isCheckField) continue;
      if (pos.is_signature) continue;
      // Campos checkbox/select não devem ser desenhados como texto:
      // a marcação visual fica nos campos correspondentes (check_*).
      if (pos.field_type === 'checkbox') continue;

      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-');
        value = `${d}/${m}/${y}`;
      }

      const page = pages[(pos.page ?? 1) - 1] || pages[0];
      const { height: pageHeight } = page.getSize();
      const fontSize = pos.font_size || 10;
      const VIEWPORT_SCALE = 1.5;
      const pdfX = pos.x / VIEWPORT_SCALE;
      const pdfW = pos.width / VIEWPORT_SCALE;
      const pdfH = pos.height / VIEWPORT_SCALE;
      const pdfY = pageHeight - (pos.y / VIEWPORT_SCALE) - fontSize - 2;

      if (isCheckField) {
        drawCleanCheckbox(page, pdfX, pdfY, fontSize, value === 'V');
      } else {
        drawTextFit(page, font, value, pdfX, pdfY, pdfW, pdfH, fontSize, pos.text_align);
      }
    }
  }

  const filledPdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(filledPdfBytes)], { type: 'application/pdf' });
}

export async function lerCamposPdfDeUrl(url: string): Promise<string[]> {
  const response = await fetch(url);
  const pdfBytes = await response.arrayBuffer();
  return lerCamposPdf(pdfBytes);
}

export function downloadPdf(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════
// GERADOR DE GRADE - Gera PDFs com linhas/colunas
// ═══════════════════════════════════════════════════

export interface GradeConfig {
  titulo: string;
  subtitulo?: string;
  colunas: { label: string; width: number }[];
  numLinhas: number;
  alturaLinha: number;
  margemEsquerda: number;
  margemDireita: number;
  margemTopo: number;
  margemBaixo: number;
  fontSizeTitulo: number;
  fontSizeCabecalho: number;
  fontSizeCelula: number;
  larguraPagina: number;
  alturaPagina: number;
  corLinhas: string;
  espessuraLinhas: number;
  preenchimentos?: Record<number, string>;
}

export async function gerarGrade(config: GradeConfig): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([config.larguraPagina, config.alturaPagina]);
  const { width: pageW, height: pageH } = page.getSize();

  const cor = hexToRgb(config.corLinhas || '#000000');
  const lineColor = rgb(cor.r, cor.g, cor.b);
  const thickness = config.espessuraLinhas || 1;

  const marginL = config.margemEsquerda;
  const marginR = config.margemDireita;
  const marginT = config.margemTopo;
  const marginB = config.margemBaixo;

  const contentW = pageW - marginL - marginR;
  const totalColW = config.colunas.reduce((s, c) => s + c.width, 0);
  const scaleX = contentW / totalColW;

  let cursorY = pageH - marginT;

  // Title
  if (config.titulo) {
    const titleSize = config.fontSizeTitulo || 16;
    const titleW = fontBold.widthOfTextAtSize(config.titulo, titleSize);
    page.drawText(config.titulo, {
      x: marginL + (contentW - titleW) / 2,
      y: cursorY - titleSize,
      size: titleSize,
      font: fontBold,
      color: lineColor,
    });
    cursorY -= titleSize + 8;
  }

  // Subtitle
  if (config.subtitulo) {
    const subSize = config.fontSizeCabecalho || 10;
    const subW = font.widthOfTextAtSize(config.subtitulo, subSize);
    page.drawText(config.subtitulo, {
      x: marginL + (contentW - subW) / 2,
      y: cursorY - subSize,
      size: subSize,
      font,
      color: lineColor,
    });
    cursorY -= subSize + 12;
  }

  // Header row
  const headerH = config.alturaLinha;
  let cellX = marginL;
  for (const col of config.colunas) {
    const colW = col.width * scaleX;
    page.drawRectangle({
      x: cellX, y: cursorY - headerH,
      width: colW, height: headerH,
      borderColor: lineColor, borderWidth: thickness,
    });
    const textSize = config.fontSizeCabecalho || 10;
    const textW = fontBold.widthOfTextAtSize(col.label, textSize);
    page.drawText(col.label, {
      x: cellX + (colW - textW) / 2,
      y: cursorY - headerH / 2 - textSize / 3,
      size: textSize,
      font: fontBold,
      color: lineColor,
    });
    cellX += colW;
  }
  cursorY -= headerH;

  // Data rows
  const cellFontSize = config.fontSizeCelula || 10;
  for (let row = 0; row < config.numLinhas; row++) {
    cellX = marginL;
    for (let colIdx = 0; colIdx < config.colunas.length; colIdx++) {
      const col = config.colunas[colIdx];
      const colW = col.width * scaleX;
      page.drawRectangle({
        x: cellX, y: cursorY - config.alturaLinha,
        width: colW, height: config.alturaLinha,
        borderColor: lineColor, borderWidth: thickness,
      });

      const cellKey = row * config.colunas.length + colIdx;
      const cellText = config.preenchimentos?.[cellKey];
      if (cellText) {
        const tw = font.widthOfTextAtSize(cellText, cellFontSize);
        page.drawText(cellText, {
          x: cellX + (colW - tw) / 2,
          y: cursorY - config.alturaLinha / 2 - cellFontSize / 3,
          size: cellFontSize,
          font,
          color: lineColor,
        });
      }
      cellX += colW;
    }
    cursorY -= config.alturaLinha;

    // Pagination: if grid exceeds page, add new page
    if (cursorY < marginB && row < config.numLinhas - 1) {
      cursorY = pageH - marginT;
      const newPage = pdfDoc.addPage([config.larguraPagina, config.alturaPagina]);
      page = newPage;
    }
  }

  // Signature area at bottom
  cursorY -= 30;
  if (cursorY > marginB + 40) {
    const sigText = '___________________________________';
    const sigLabel = 'Assinatura';
    const sigW = font.widthOfTextAtSize(sigText, 10);
    const sigLabelW = font.widthOfTextAtSize(sigLabel, 8);
    page.drawText(sigText, { x: marginL, y: cursorY, size: 10, font, color: lineColor });
    page.drawText(sigLabel, { x: marginL + (sigW - sigLabelW) / 2, y: cursorY - 12, size: 8, font, color: lineColor });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 }
    : { r: 0, g: 0, b: 0 };
}
