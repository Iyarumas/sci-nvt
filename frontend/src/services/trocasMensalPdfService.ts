import jsPDF from 'jspdf';

export interface RelatorioTrocasMensalRow {
  nomeSolicitante: string;
  dataSolicitada: string;
  dataATrabalhar: string;
  nomeSolicitado: string;
}

export interface RelatorioTrocasMensalParams {
  mes: number;
  ano: number;
  rows: RelatorioTrocasMensalRow[];
  observacao?: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_X = 10;
const CONTENT_W = 190;
const TABLE_Y = 55;
const TABLE_HEADER_H = 7;
const ROW_H = 6;
const ROWS_PER_PAGE = 30;
const TABLE_TEXT_SIZE = 7.8;
const TIMBRADO_URL = '/assets/relatorio-trocas-timbrado.jpg';
const MONTHS_UPPER = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

type Align = 'left' | 'center' | 'right';

let cachedTimbrado: string | null | undefined;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }

  return `data:${blob.type || 'image/png'};base64,${btoa(chunks.join(''))}`;
}

async function carregarTimbradoRelatorio(): Promise<string | null> {
  if (cachedTimbrado !== undefined) return cachedTimbrado;

  try {
    const response = await fetch(TIMBRADO_URL);
    if (!response.ok) throw new Error(`Nao foi possivel carregar ${TIMBRADO_URL}`);
    cachedTimbrado = await blobToDataUrl(await response.blob());
  } catch {
    cachedTimbrado = null;
  }

  return cachedTimbrado;
}

function upper(value: string): string {
  return String(value || '').toLocaleUpperCase('pt-BR');
}

function formatDate(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const br = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;

  return raw;
}

function safeFilePart(value: string): string {
  return upper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nomeArquivoRelatorioTrocasMensal(mes: number, ano: number): string {
  const mesNome = MONTHS_UPPER[mes] || 'MES';
  return `RELATORIO DE TROCAS MENSAL ${safeFilePart(mesNome)} ${ano}.pdf`;
}

function drawTextFit(doc: jsPDF, text: string, x: number, y: number, maxW: number, opts: {
  size?: number;
  bold?: boolean;
  align?: Align;
}) {
  const size = opts.size || 9;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  let out = text || '';
  while (out.length > 3 && doc.getTextWidth(`${out.slice(0, -1)}...`) > maxW) {
    out = out.slice(0, -1);
  }
  doc.text(out.length < text.length ? `${out}...` : out, x, y, { align: opts.align || 'left' });
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text: string, opts: {
  size?: number;
  bold?: boolean;
  align?: Align;
  fill?: [number, number, number];
}) {
  if (opts.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.18);
  doc.rect(x, y, w, h);
  if (!text) return;

  const size = opts.size || 9;
  const align = opts.align || 'left';
  const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
  const textY = y + h / 2 + size * 0.13;
  drawTextFit(doc, text, textX, textY, w - 3, { ...opts, align });
}

function drawCertificationBox(doc: jsPDF, x: number, y: number, label: string, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y + 3.2, 9.4, 14.2, 0.6, 0.6);
  doc.setLineWidth(0.55);
  doc.line(x + 4.7, y, x + 4.7, y + 2.8);
  doc.line(x + 3.3, y + 1.4, x + 6.1, y + 1.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Empresa', x + 4.7, y + 6.8, { align: 'center' });
  doc.text('Certificada', x + 4.7, y + 8.9, { align: 'center' });
  doc.setTextColor(25, 25, 25);
  doc.setFontSize(7.2);
  doc.text('ISO', x + 4.7, y + 12.6, { align: 'center' });
  doc.setFontSize(5.2);
  doc.text(label, x + 4.7, y + 15.6, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function drawPlaneIcon(doc: jsPDF, x: number, y: number, scale = 1) {
  doc.setDrawColor(47, 174, 118);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.setLineWidth(2.1 * scale);
  doc.line(x, y + 11 * scale, x + 13 * scale, y);
  doc.setLineWidth(1.7 * scale);
  doc.line(x + 4.3 * scale, y + 7.3 * scale, x - 2.7 * scale, y + 3 * scale);
  doc.line(x + 6.6 * scale, y + 5.3 * scale, x + 6 * scale, y + 14.7 * scale);
  doc.setLineWidth(1.4 * scale);
  doc.line(x + 1.1 * scale, y + 10 * scale, x - 3.1 * scale, y + 10.8 * scale);
  doc.line(x + 2.4 * scale, y + 8.9 * scale, x + 3.2 * scale, y + 13.2 * scale);
  doc.setLineCap('butt');
  doc.setLineJoin('miter');
  doc.setTextColor(0, 0, 0);
}

function drawHeaderBadgesFallback(doc: jsPDF) {
  drawCertificationBox(doc, 90, 10.6, '9001', [224, 63, 79]);
  drawCertificationBox(doc, 101.6, 10.6, '14001', [142, 149, 154]);
  drawCertificationBox(doc, 113.2, 10.6, '45001', [53, 169, 105]);

  doc.setFillColor(232, 18, 26);
  doc.rect(128, 13.5, 9, 14.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.9);
  doc.text('Great', 132.5, 17.2, { align: 'center' });
  doc.text('Place', 132.5, 20.1, { align: 'center' });
  doc.text('To', 132.5, 23, { align: 'center' });
  doc.text('Work', 132.5, 26, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('SOMOS A', 142, 16.6);
  doc.setFontSize(9.1);
  doc.text('7a MELHOR', 142, 21.1);
  doc.setFontSize(6.8);
  doc.text('EMPRESA', 142, 25.1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.1);
  doc.text('PARA SE TRABALHAR', 142, 28);
  doc.setFontSize(3.5);
  doc.text('NO CENTRO-OESTE', 142, 30.4);

  drawPlaneIcon(doc, 168, 14.2, 0.95);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.3);
  doc.setTextColor(85, 85, 85);
  doc.text('SOMOS LIDERES', 181, 15.6);
  doc.text('EM EMERGENCIAS', 181, 19.6);
  doc.setFontSize(7.1);
  doc.text('MEDICAS', 181, 24);
  doc.setFontSize(5.3);
  doc.text('EM AEROPORTOS', 181, 27.7);
  doc.text('NO BRASIL', 181, 31);
  doc.setTextColor(0, 0, 0);
}

function drawTimbradoFallback(doc: jsPDF) {
  doc.setFillColor(196, 25, 42);
  doc.rect(0, 0, 5, PAGE_H, 'F');
  doc.setDrawColor(61, 164, 108);
  doc.setLineWidth(0.25);
  doc.line(6.2, 0, 6.2, PAGE_H);
  doc.setDrawColor(220, 75, 95);
  doc.setLineWidth(0.12);
  doc.line(7.2, 0, 7.2, PAGE_H);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Group', 18, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(190, 25, 52);
  doc.text('med', 18, 23);
  doc.setTextColor(80, 179, 119);
  doc.text('+', 51, 23);
  doc.setTextColor(0, 0, 0);

  drawHeaderBadgesFallback(doc);
}

function drawPageHeader(doc: jsPDF, timbradoDataUrl: string | null, mes: number, ano: number) {
  if (timbradoDataUrl) {
    doc.addImage(timbradoDataUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H);
  } else {
    drawTimbradoFallback(doc);
  }

  const mesNome = MONTHS_UPPER[mes] || '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.6);
  doc.text(`RELATÓRIO DE TROCAS DE PLANTÃO EFETUADAS EM ${mesNome} DE ${ano}`, PAGE_W / 2, 39.5, { align: 'center' });
  doc.setFontSize(14.4);
  doc.text('SESCINC NAVEGANTES', PAGE_W / 2, 48, { align: 'center' });
}

function drawTableHeader(doc: jsPDF, y: number) {
  const widths = [64, 30, 32, 64];
  const headers = ['NOME SOLICITANTE', 'DATA SOLICITADA', 'DATA A TRABALHAR', 'NOME SOLICITADO'];
  let x = CONTENT_X;
  headers.forEach((header, index) => {
    drawCell(doc, x, y, widths[index], TABLE_HEADER_H, header, {
      bold: true,
      size: TABLE_TEXT_SIZE,
      align: index === 0 || index === 3 ? 'left' : 'center',
    });
    x += widths[index];
  });
}

function drawTableRow(doc: jsPDF, row: RelatorioTrocasMensalRow, y: number) {
  const widths = [64, 30, 32, 64];
  const values = [
    upper(row.nomeSolicitante),
    formatDate(row.dataSolicitada),
    formatDate(row.dataATrabalhar),
    upper(row.nomeSolicitado),
  ];
  let x = CONTENT_X;
  values.forEach((value, index) => {
    drawCell(doc, x, y, widths[index], ROW_H, value, {
      size: TABLE_TEXT_SIZE,
      align: index === 0 || index === 3 ? 'left' : 'center',
    });
    x += widths[index];
  });
}

function drawFooter(doc: jsPDF, y: number, total: number, observacao = '') {
  const footerY = y + 8;
  const singular = total === 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TABLE_TEXT_SIZE);
  doc.text(`*** NO MÊS FORAM TOTALIZADAS ${total} ${singular ? 'PERMUTA' : 'PERMUTAS'}`, 29, footerY);

  const obs = observacao.trim();
  if (!obs) return;

  doc.setFontSize(TABLE_TEXT_SIZE);
  const lines = doc.splitTextToSize(`Obs.: ${obs}`, CONTENT_W - 35);
  doc.text(lines, 29, footerY + 14);
}

export async function gerarRelatorioTrocasMensalPdf(params: RelatorioTrocasMensalParams): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const timbradoDataUrl = await carregarTimbradoRelatorio();
  const rows = params.rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) doc.addPage();
    drawPageHeader(doc, timbradoDataUrl, params.mes, params.ano);
    drawTableHeader(doc, TABLE_Y);

    const pageRows = rows.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
    let y = TABLE_Y + TABLE_HEADER_H;
    pageRows.forEach(row => {
      drawTableRow(doc, row, y);
      y += ROW_H;
    });

    if (pageIndex === pageCount - 1) {
      drawFooter(doc, y, rows.length, params.observacao);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Continua na próxima página - ${pageIndex + 1}/${pageCount}`, PAGE_W - 12, PAGE_H - 8, { align: 'right' });
    }
  }

  return doc.output('blob');
}
