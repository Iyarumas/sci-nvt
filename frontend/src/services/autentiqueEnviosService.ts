import { apiFetch, apiUrl, authorizedFetch } from '../lib/apiClient';

export type TipoEnvioAssinatura = 'ptrba';
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
  participantes: ParticipanteParaAssinar[];
  chefeEquipe: string;
}): Promise<{ id: string }> {
  const body = new FormData();
  body.append('tipo', input.tipo);
  body.append('referenciaId', input.referenciaId);
  body.append('participantes', JSON.stringify(input.participantes));
  body.append('chefeEquipe', input.chefeEquipe);
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
  participantes: ParticipanteParaAssinar[];
  chefeEquipe: string;
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

/** Baixa o PDF com as assinaturas, guardado no servidor. */
export async function baixarPdfAssinado(envioId: string, nomeArquivo: string): Promise<void> {
  const resposta = await authorizedFetch(apiUrl(`/autentique/envios/${envioId}/pdf`));
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null) as { message?: string } | null;
    throw new Error(corpo?.message || 'Não foi possível baixar o PDF assinado.');
  }
  const url = URL.createObjectURL(await resposta.blob());
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
