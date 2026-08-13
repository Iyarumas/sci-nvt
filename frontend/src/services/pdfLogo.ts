import type jsPDF from 'jspdf';

const MED_GROUP_LOGO_URL = '/assets/med-group-logo.png';

let cachedMedGroupLogo: string | null | undefined;

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

export async function carregarMedGroupLogo(): Promise<string | null> {
  if (cachedMedGroupLogo !== undefined) return cachedMedGroupLogo;

  try {
    const response = await fetch(MED_GROUP_LOGO_URL);
    if (!response.ok) throw new Error(`Nao foi possivel carregar ${MED_GROUP_LOGO_URL}`);
    cachedMedGroupLogo = await blobToDataUrl(await response.blob());
  } catch {
    cachedMedGroupLogo = null;
  }

  return cachedMedGroupLogo;
}

export function drawMedGroupLogo(
  doc: jsPDF,
  logoDataUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  withBorder = false,
) {
  if (withBorder) {
    doc.rect(x, y, w, h);
  }

  if (!logoDataUrl) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 65, 24);
    doc.text('med+', x + w / 2, y + h / 2 + 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    return;
  }

  const logoRatio = 151 / 68;
  const paddingX = withBorder ? 4 : 1;
  const paddingY = withBorder ? 3 : 1;
  const maxW = Math.max(1, w - paddingX * 2);
  const maxH = Math.max(1, h - paddingY * 2);
  const drawW = Math.min(maxW, maxH * logoRatio);
  const drawH = drawW / logoRatio;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;

  doc.addImage(logoDataUrl, 'PNG', drawX, drawY, drawW, drawH);
}
