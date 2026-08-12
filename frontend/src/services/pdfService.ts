import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, StandardFonts, rgb } from 'pdf-lib';

export async function lerCamposPdf(pdfBytes: ArrayBuffer): Promise<string[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  return fields.map(f => f.getName());
}

export async function preencherPdf(
  pdfBytes: ArrayBuffer,
  dados: Record<string, string>,
  fieldPositions?: { field_name: string; x: number; y: number; width: number; height: number; font_size: number; is_signature?: boolean; field_type?: string; page?: number }[],
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
      if (!value || value.trim() === '') continue;
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
      const pdfY = pageHeight - (pos.y / VIEWPORT_SCALE) - fontSize - 2;

      if (value === 'V' && pos.field_name.startsWith('check_')) {
        const cs = fontSize * 0.5;
        const cx = pdfX + 2;
        const cy = pdfY + cs * 0.2;
        page.drawLine({ start: { x: cx, y: cy + cs * 0.5 }, end: { x: cx + cs * 0.4, y: cy }, thickness: fontSize * 0.12, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: cx + cs * 0.4, y: cy }, end: { x: cx + cs, y: cy + cs * 0.7 }, thickness: fontSize * 0.12, color: rgb(0, 0, 0) });
      } else {
        page.drawText(value, { x: pdfX + 2, y: pdfY, size: fontSize, font, color: rgb(0, 0, 0) });
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
