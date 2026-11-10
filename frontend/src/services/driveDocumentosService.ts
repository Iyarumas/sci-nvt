import { apiFetch, apiUrl, authorizedFetch } from '../lib/apiClient';

/** Arquivo como o servidor lê do Google Drive (pasta de cada pessoa). */
export interface ArquivoDriveApi {
  id: string;
  dataCurso?: string | null;
  validadeTexto?: string | null;
  origemData?: string | null;
  dataLida?: boolean;
  nome: string;
  pasta: string;
  caminho: string[];
  mime: string;
  tamanho: number;
  modificado: string | null;
}

export interface DocumentosDriveApi {
  configurado: boolean;
  atualizadoEm: string | null;
  pessoas: Array<{ bombeiroId: string; pasta: string; arquivos: ArquivoDriveApi[] }>;
  semVinculo: Array<{ pasta: string; arquivos: number }>;
  leituraDatas?: { lendo: boolean; total: number; feitos: number };
}

export function buscarDocumentosDrive(atualizar = false): Promise<DocumentosDriveApi> {
  return apiFetch<DocumentosDriveApi>(`/drive/documentos${atualizar ? '?atualizar=1' : ''}`, { cache: 'no-store' });
}

/** Configuração da aba "Validade dos documentos" guardada no banco (vale para todos). */
export function lerConfigDrive(): Promise<{ config: unknown; atualizadoEm: string | null; atualizadoPor: string | null }> {
  return apiFetch('/drive/config', { cache: 'no-store' });
}

export function salvarConfigDrive(config: unknown): Promise<{ ok: boolean }> {
  return apiFetch('/drive/config', { method: 'PUT', body: JSON.stringify({ config }), headers: { 'Content-Type': 'application/json' } });
}

/** Data do curso digitada (PDF sem texto ou data lida errada). null apaga. */
export function informarDataDrive(arquivoId: string, data: string | null): Promise<{ ok: boolean }> {
  return apiFetch('/drive/data', { method: 'POST', body: JSON.stringify({ arquivoId, data }), headers: { 'Content-Type': 'application/json' } });
}

/** Conteúdo do arquivo para o visualizador (passa pelo servidor; o Drive não fica exposto). */
export async function abrirArquivoDrive(id: string): Promise<{ pdf?: ArrayBuffer; imagem?: string }> {
  const resposta = await authorizedFetch(apiUrl(`/drive/arquivo/${encodeURIComponent(id)}`));
  if (!resposta.ok) throw new Error('Não foi possível abrir o documento.');
  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('pdf')) return { pdf: await resposta.arrayBuffer() };
  if (tipo.startsWith('image/')) return { imagem: URL.createObjectURL(await resposta.blob()) };
  return {};
}
