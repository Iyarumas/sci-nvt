import { apiFetch } from '../lib/apiClient';
import { obterPdfAssinado, paginasAntesDaAuditoria, type TipoEnvioAssinatura } from './autentiqueEnviosService';

export type SituacaoRelatorio = 'assinado' | 'aguardando' | 'nao_enviado' | 'fora';

export interface DocumentoRelatorio {
  referenciaId: string;
  data: string;
  equipe: string;
  turno: string;
  numero: string;
  solicitante: string;
  solicitado: string;
  /** Trocas: data a trabalhar (folga do solicitado). */
  dataTrabalhar: string;
  criadoEm: string | null;
  envioId: string | null;
  situacao: SituacaoRelatorio;
}

/** Primeiro dia em que cada documento passou a ser assinado pelo sistema (antes disso: "fora do Autentique"). */
export const INICIO_AUTENTIQUE: Record<TipoEnvioAssinatura, string> = {
  ptrba: '2026-11-06', lro: '2026-11-06', troca: '2026-11-07', tpepr: '2026-11-08', taf: '2026-11-08',
  posicionamento: '2026-11-08', temporesposta: '2026-11-10', bona: '2026-11-10',
};

export async function listarDocumentosRelatorio(tipo: TipoEnvioAssinatura, ano: number, mes: number): Promise<DocumentoRelatorio[]> {
  const linhas = await apiFetch<DocumentoRelatorio[]>(
    `/autentique/envios/relatorio?tipo=${tipo}&ano=${ano}&mes=${mes}`, { cache: 'no-store' },
  );
  return linhas.map(l => ({
    ...l,
    situacao: l.situacao === 'nao_enviado' && l.data && l.data < INICIO_AUTENTIQUE[tipo] ? 'fora' : l.situacao,
  }));
}

/** 1ª quinzena = dias 01 a 15. */
export const naPrimeiraQuinzena = (dataISO: string) => Number(dataISO.slice(8, 10)) <= 15;

/**
 * Junta os documentos assinados, na ordem recebida, sem a página de auditoria do Autentique.
 * PTR-BA entra só com a 1ª página (a tabela com as assinaturas), como no download.
 * `inicio` (opcional) entra antes — usado nas trocas para o relatório de hoje.
 */
export async function montarPdfRelatorio(
  tipo: TipoEnvioAssinatura,
  documentos: DocumentoRelatorio[],
  inicio?: Blob,
  aoAvancar?: (feitos: number, total: number) => void,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const final = await PDFDocument.create();
  if (inicio) {
    const doc = await PDFDocument.load(await inicio.arrayBuffer());
    (await final.copyPages(doc, doc.getPageIndices())).forEach(p => final.addPage(p));
  }
  const assinados = documentos.filter(d => d.situacao === 'assinado' && d.envioId);
  let feitos = 0;
  for (const d of assinados) {
    const bytes = await (await obterPdfAssinado(d.envioId!)).arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    let quantas = 1;
    if (tipo !== 'ptrba') {
      const antes = await paginasAntesDaAuditoria(bytes).catch(() => null);
      quantas = antes && antes > 0 ? antes : doc.getPageCount();
    }
    (await final.copyPages(doc, Array.from({ length: quantas }, (_, i) => i))).forEach(p => final.addPage(p));
    feitos++;
    aoAvancar?.(feitos, assinados.length);
  }
  return final.save({ useObjectStreams: true });
}
