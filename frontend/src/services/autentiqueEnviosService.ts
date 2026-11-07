import { apiFetch, apiUrl, authorizedFetch } from '../lib/apiClient';

export type TipoEnvioAssinatura = 'ptrba' | 'lro';
export type StatusEnvioAssinatura = 'aguardando' | 'assinado' | 'recusado';
export type StatusSignatario = 'pendente' | 'assinado' | 'recusado';

export interface SignatarioEnvio {
  id: string;
  ordem: number;
  funcoes: string[];
  nome: string;
  status: StatusSignatario;
  assinadoEm: string | null;
  recusadoEm: string | null;
  /** Só vem para quem pode cobrar a assinatura. */
  celular: string | null;
}

export interface EnvioAssinatura {
  id: string;
  tipo: TipoEnvioAssinatura;
  referenciaId: string;
  status: StatusEnvioAssinatura;
  enviadoPorNome: string;
  enviadoEm: string;
  concluidoEm: string | null;
  /** Documento de teste do Autentique (não vale como assinatura oficial). */
  sandbox: boolean;
  temPdfAssinado: boolean;
  podeGerir: boolean;
  signatarios: SignatarioEnvio[];
}

export interface ParticipanteParaAssinar {
  funcao: string;
  nomeCompleto: string;
  situacao: string;
}

/** Sem referências, traz todos os envios ativos do tipo. */
export async function listarEnviosAssinatura(tipo: TipoEnvioAssinatura, referencias: string[] = []): Promise<EnvioAssinatura[]> {
  const params = new URLSearchParams({ tipo });
  if (referencias.length) params.set('referencias', referencias.join(','));
  return apiFetch<EnvioAssinatura[]>(`/autentique/envios?${params.toString()}`);
}

export async function enviarParaAssinatura(input: {
  tipo: TipoEnvioAssinatura;
  referenciaId: string;
  pdf: Blob;
  nomeArquivo: string;
  /** PTR-BA: lista completa de participantes. O LRO usa o chefe e o gerente do próprio registro. */
  participantes?: ParticipanteParaAssinar[];
  chefeEquipe?: string;
  /** LRO: onde caíram as linhas de assinatura no PDF. */
  linhasAssinatura?: unknown[];
}): Promise<{ id: string }> {
  const body = new FormData();
  body.append('tipo', input.tipo);
  body.append('referenciaId', input.referenciaId);
  body.append('participantes', JSON.stringify(input.participantes ?? []));
  body.append('chefeEquipe', input.chefeEquipe ?? '');
  if (input.linhasAssinatura) body.append('linhasAssinatura', JSON.stringify(input.linhasAssinatura));
  body.append('nomeArquivo', input.nomeArquivo);
  body.append('pdf', input.pdf, input.nomeArquivo);
  return apiFetch<{ id: string }>('/autentique/envios', { method: 'POST', body });
}

export interface PreviaSignatario {
  nome: string;
  funcoes: string[];
  /** E-mail do cadastro de bombeiros/APOCs. */
  email: string;
  problema: 'sem_cadastro' | 'sem_email' | 'email_repetido' | null;
}

/** Quem vai assinar e o e-mail de cada um no cadastro, para conferir antes de enviar. */
export async function previaEnvioAssinatura(input: {
  tipo: TipoEnvioAssinatura;
  referenciaId: string;
  participantes?: ParticipanteParaAssinar[];
  chefeEquipe?: string;
}): Promise<PreviaSignatario[]> {
  return apiFetch<PreviaSignatario[]>('/autentique/envios/previa', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reenviarAvisosAssinatura(envioId: string): Promise<{ reenviados: number }> {
  return apiFetch<{ reenviados: number }>(`/autentique/envios/${envioId}/reenviar`, { method: 'POST' });
}

/** Consulta o Autentique agora (para quando o aviso automático ainda não chegou). */
export async function atualizarEnvioAssinatura(envioId: string): Promise<{ status: StatusEnvioAssinatura }> {
  return apiFetch<{ status: StatusEnvioAssinatura }>(`/autentique/envios/${envioId}/atualizar`, { method: 'POST' });
}

/** Link pessoal de assinatura de uma pessoa (gerado na hora, só para quem pode cobrar). */
export async function linkDeAssinatura(envioId: string, signatarioId: string): Promise<string> {
  const { link } = await apiFetch<{ link: string }>(`/autentique/envios/${envioId}/signatarios/${signatarioId}/link`, { method: 'POST' });
  return link;
}

/** O PDF com as assinaturas, guardado no servidor (todas as páginas e a auditoria do Autentique). */
export async function obterPdfAssinado(envioId: string): Promise<Blob> {
  const resposta = await authorizedFetch(apiUrl(`/autentique/envios/${envioId}/pdf`));
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null) as { message?: string } | null;
    throw new Error(corpo?.message || 'Não foi possível abrir o PDF assinado.');
  }
  return resposta.blob();
}

/** Páginas do PDF antes do relatório de auditoria do Autentique (que vem sempre no fim). */
async function paginasAntesDaAuditoria(pdf: ArrayBuffer): Promise<number | null> {
  const { default: pdfjsLib } = await import('../lib/pdfjs-setup');
  const tarefa = pdfjsLib.getDocument({ data: new Uint8Array(pdf.slice(0)) });
  const documento = await tarefa.promise;
  try {
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items.map(item => ('str' in item ? item.str : '')).join(' ')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (texto.includes('relatorio de auditoria')) return numero - 1;
    }
    return null;
  } finally {
    await tarefa.destroy();
  }
}

/**
 * Baixa o PDF assinado do jeito que vai para o relatório da empresa:
 * - PTR-BA: só a 1ª página (a tabela com as assinaturas);
 * - LRO: todas as páginas do livro, sem o relatório de auditoria do Autentique no fim.
 * O PDF completo, com a auditoria, continua guardado no sistema (Ver documento).
 */
export async function baixarPdfAssinado(
  envioId: string,
  nomeArquivo: string,
  modo: 'primeiraPagina' | 'semAuditoria' = 'primeiraPagina',
): Promise<void> {
  const assinado = await (await obterPdfAssinado(envioId)).arrayBuffer();
  const { PDFDocument } = await import('pdf-lib');
  const completo = await PDFDocument.load(assinado);
  let quantas = 1;
  if (modo === 'semAuditoria') {
    const antes = await paginasAntesDaAuditoria(assinado).catch(() => null);
    quantas = antes && antes > 0 ? antes : completo.getPageCount();
  }
  const recorte = await PDFDocument.create();
  const paginas = await recorte.copyPages(completo, Array.from({ length: quantas }, (_, i) => i));
  paginas.forEach(pagina => recorte.addPage(pagina));
  const bytes = await recorte.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function cancelarEnvioAssinatura(envioId: string): Promise<void> {
  await apiFetch(`/autentique/envios/${envioId}/cancelar`, { method: 'POST' });
}

/** Quem assina no PTR-BA: todos os participantes, menos os ausentes (A), e o chefe de equipe. */
export function quemAssinaPTRBA(participantes: ParticipanteParaAssinar[], chefeEquipe: string) {
  const pessoas = new Map<string, { nome: string; funcoes: string[] }>();
  const chave = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const adicionar = (nome: string, funcao: string) => {
    if (!nome.trim()) return;
    const pessoa = pessoas.get(chave(nome)) ?? { nome: nome.trim(), funcoes: [] };
    if (funcao && !pessoa.funcoes.includes(funcao)) pessoa.funcoes.push(funcao);
    pessoas.set(chave(nome), pessoa);
  };
  participantes
    .filter(p => p.situacao.trim().toUpperCase() !== 'A')
    .forEach(p => adicionar(p.nomeCompleto, p.funcao));
  adicionar(chefeEquipe, 'Chefe de equipe');
  return [...pessoas.values()];
}

/** Abre o WhatsApp de quem clicou, já na conversa da pessoa, com o link dela. */
export function linkWhatsAppAssinatura(celular: string, nome: string, documento: string, link: string): string | null {
  let numero = celular.replace(/\D/g, '');
  if (numero.length < 10) return null;
  if (!numero.startsWith('55')) numero = `55${numero}`;
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? '';
  const texto = `Olá, ${primeiroNome}! Falta a sua assinatura no ${documento}. Para assinar, acesse: ${link}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
