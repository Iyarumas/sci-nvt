import { useState } from 'react';
import { Check, Clock, MessageCircle, Signature, X } from 'lucide-react';
import {
  linkDeAssinatura,
  linkWhatsAppAssinatura,
  type EnvioAssinatura,
  type PreviaSignatario,
  type SignatarioEnvio,
} from '../../services/autentiqueEnviosService';

export type SituacaoAssinatura = 'rascunho' | 'aguardando' | 'assinado' | 'recusado';

/** PTR-BA com plantão antes deste dia foram assinados fora do sistema: sem envio pelo Autentique daqui. */
export const INICIO_ASSINATURA_PTRBA = '2026-11-06';

export function anteriorAssinaturaPeloSistema(data: string): boolean {
  return !!data && data.slice(0, 10) < INICIO_ASSINATURA_PTRBA;
}

export function situacaoAssinatura(envio?: EnvioAssinatura): SituacaoAssinatura {
  return envio?.status ?? 'rascunho';
}

/** Quem não precisa ter assinado para liberar o download: o gerente/embaixador, o APOC e quem só reconhece. */
const NAO_PRECISAM_PARA_BAIXAR = new Set(['GERENTE', 'APOC', 'RECONHECIMENTO']);

/**
 * O PDF só pode ser baixado depois que toda a equipe assinou no Autentique (assim ninguém baixa,
 * colhe assinatura por fora e sobe de volta). Pode faltar só o gerente/embaixador.
 */
export function podeBaixarAssinado(envio?: EnvioAssinatura): boolean {
  if (!envio || !envio.temPdfAssinado || envio.status === 'recusado') return false;
  if (envio.status === 'assinado') return true;
  return envio.signatarios.every(s =>
    s.status === 'assinado' || (s.funcoes.length > 0 && s.funcoes.every(f => NAO_PRECISAM_PARA_BAIXAR.has(f.trim().toUpperCase()))),
  );
}

/** Borda do card: verde quando todos assinaram, laranja aguardando, vermelha se alguém recusou. */
export function bordaAssinatura(situacao: SituacaoAssinatura): string | null {
  if (situacao === 'assinado') return 'border-emerald-500/70 dark:border-emerald-500/60';
  if (situacao === 'aguardando') return 'border-amber-500/70 dark:border-amber-500/60';
  if (situacao === 'recusado') return 'border-red-500/70 dark:border-red-500/60';
  return null;
}

const CHIP = 'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold';
const CHIP_COR = {
  assinado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pendente: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  recusado: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  rascunho: 'bg-graphite-100 text-graphite-600 dark:bg-surface-hover dark:text-graphite-300',
} as const;

function dataHora(valor: string | null): string {
  if (!valor) return '';
  const data = new Date(valor);
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const CHEFE_DE_EQUIPE = 'Chefe de equipe';

/**
 * Na tela basta a função da tabela (ex.: BA-CE). O papel de chefe continua guardado
 * para a assinatura ir também na linha do chefe; só aparece se for a única função.
 */
export function funcoesVisiveis(funcoes: string[]): string {
  const daTabela = funcoes.filter(funcao => funcao !== CHEFE_DE_EQUIPE);
  return (daTabela.length ? daTabela : funcoes).join(' / ') || '-';
}

function primeiroUltimoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0] ?? '';
}

export function SeloAssinatura({ envio }: { envio?: EnvioAssinatura }) {
  const situacao = situacaoAssinatura(envio);
  if (!envio || situacao === 'rascunho') {
    return <span className={`${CHIP} ${CHIP_COR.rascunho} rounded-full px-2.5 py-1`}>Rascunho</span>;
  }
  const total = envio.signatarios.length;
  const assinados = envio.signatarios.filter(s => s.status === 'assinado').length;
  if (situacao === 'assinado') {
    return <span className={`${CHIP} ${CHIP_COR.assinado} rounded-full px-2.5 py-1`}><Check className="h-3.5 w-3.5" /> Todos assinaram</span>;
  }
  if (situacao === 'recusado') {
    const quem = envio.signatarios.find(s => s.status === 'recusado');
    return <span className={`${CHIP} ${CHIP_COR.recusado} rounded-full px-2.5 py-1`}><X className="h-3.5 w-3.5" /> Recusado{quem ? ` por ${primeiroUltimoNome(quem.nome)}` : ''}</span>;
  }
  return <span className={`${CHIP} ${CHIP_COR.pendente} rounded-full px-2.5 py-1`}><Clock className="h-3.5 w-3.5" /> {assinados} de {total} assinaturas</span>;
}

/** Etiquetas com função e nome de quem assina, embaixo do título do card. */
export function EtiquetasAssinantes({
  envio,
  rascunho,
  nomesGuerra,
}: {
  envio?: EnvioAssinatura;
  rascunho: { nome: string; funcoes: string[] }[];
  /** Nome completo normalizado (chaveNome) → nome de guerra do cadastro. */
  nomesGuerra: Map<string, string>;
}) {
  const apelido = (nome: string) => (nomesGuerra.get(chaveNome(nome)) || primeiroUltimoNome(nome)).toLocaleUpperCase('pt-BR');
  const itens = envio
    ? envio.signatarios.map(s => ({ chave: s.id, nome: s.nome, funcoes: s.funcoes, status: s.status as keyof typeof CHIP_COR, quando: s.assinadoEm || s.recusadoEm }))
    : rascunho.map(p => ({ chave: p.nome, nome: p.nome, funcoes: p.funcoes, status: 'rascunho' as const, quando: null }));
  if (!itens.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {itens.map(item => {
        const titulo = item.status === 'assinado'
          ? `Assinou em ${dataHora(item.quando)}`
          : item.status === 'recusado'
            ? `Recusou em ${dataHora(item.quando)}`
            : item.status === 'pendente' ? 'Assinatura pendente' : 'Ainda não enviado para assinatura';
        return (
          <span key={item.chave} title={`${item.nome} · ${titulo}`} className={`${CHIP} ${CHIP_COR[item.status]}`}>
            {item.status === 'assinado' && <Check className="h-3 w-3" />}
            {item.status === 'pendente' && <Clock className="h-3 w-3" />}
            {item.status === 'recusado' && <X className="h-3 w-3" />}
            <span className="font-bold">{funcoesVisiveis(item.funcoes)}</span>
            <span className="font-medium">{apelido(item.nome)}</span>
          </span>
        );
      })}
    </div>
  );
}

export function chaveNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function signatarioDoNome(envio: EnvioAssinatura | undefined, nome: string): SignatarioEnvio | undefined {
  if (!envio) return undefined;
  const chave = chaveNome(nome);
  return envio.signatarios.find(s => chaveNome(s.nome) === chave);
}

/** Célula da coluna "Assinatura" na tabela de efetivo dos detalhes. */
export function CelulaAssinatura({
  envioId,
  signatario,
  documento,
}: {
  envioId: string;
  signatario?: SignatarioEnvio;
  documento: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  if (!signatario) return <span className="text-xs text-graphite-400">Não assina</span>;
  if (signatario.status === 'assinado') {
    return <span className={`${CHIP} ${CHIP_COR.assinado}`}><Check className="h-3 w-3" /> {dataHora(signatario.assinadoEm)}</span>;
  }
  if (signatario.status === 'recusado') {
    return <span className={`${CHIP} ${CHIP_COR.recusado}`}><X className="h-3 w-3" /> Recusou</span>;
  }
  const celular = signatario.celular && signatario.celular.replace(/\D/g, '').length >= 10 ? signatario.celular : null;
  const pessoa = signatario;

  // A janela abre já no clique (senão o navegador bloqueia) e recebe o endereço quando o link chega.
  async function abrirWhatsApp() {
    if (!celular) return;
    const janela = window.open('', '_blank');
    setAbrindo(true);
    try {
      const link = await linkDeAssinatura(envioId, pessoa.id);
      const whatsapp = linkWhatsAppAssinatura(celular, pessoa.nome, documento, link);
      if (janela && whatsapp) janela.location.href = whatsapp;
      else if (whatsapp) window.location.href = whatsapp;
    } catch (err) {
      janela?.close();
      alert(err instanceof Error ? err.message : 'Não foi possível gerar o link de assinatura.');
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`${CHIP} ${CHIP_COR.pendente}`}><Clock className="h-3 w-3" /> Pendente</span>
      {celular && (
        <button
          type="button"
          onClick={abrirWhatsApp}
          disabled={abrindo}
          title={`Enviar o link de assinatura para ${signatario.nome} pelo WhatsApp`}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <MessageCircle className="h-3 w-3" /> {abrindo ? 'Gerando link...' : 'WhatsApp'}
        </button>
      )}
    </span>
  );
}

/** Janela de confirmação antes de enviar: depois disso o documento não muda mais. */
export function ConfirmarEnvioModal({
  titulo,
  assinantes,
  enviando,
  erro,
  onCancelar,
  onConfirmar,
  documento = 'PTR-BA',
}: {
  titulo: string;
  /** Nome do tipo de documento no aviso (ex.: "PTR-BA", "LRO"). */
  documento?: string;
  /** null enquanto busca os e-mails no cadastro. */
  assinantes: PreviaSignatario[] | null;
  enviando: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const comProblema = (assinantes ?? []).filter(pessoa => pessoa.problema);
  const podeEnviar = !!assinantes?.length && !comProblema.length && !enviando;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">
          <Signature className="h-5 w-5 text-aviation-600 dark:text-aviation-400" /> Enviar para assinatura
        </h3>
        <p className="mb-4 text-sm text-graphite-500 dark:text-graphite-400">{titulo}</p>
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-graphite-400">
          Quem vai assinar{assinantes ? ` (${assinantes.length})` : ''}
        </p>
        <div className="mb-2 min-h-0 flex-1 overflow-auto rounded-xl border border-graphite-200/70 dark:border-border-dark">
          {assinantes === null ? (
            <p className="px-3 py-6 text-center text-sm text-graphite-500 dark:text-graphite-400">Conferindo os e-mails no cadastro...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 text-left text-[11px] uppercase tracking-wider text-graphite-400 dark:border-border-dark">
                  <th className="px-3 py-2 font-black">Função</th>
                  <th className="px-3 py-2 font-black">Nome</th>
                  <th className="px-3 py-2 font-black">E-mail do cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100 dark:divide-border-dark">
                {assinantes.map(pessoa => (
                  <tr key={pessoa.nome} className={pessoa.problema ? 'bg-red-500/5' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-graphite-500 dark:text-graphite-400">{funcoesVisiveis(pessoa.funcoes)}</td>
                    <td className="px-3 py-2 font-semibold text-graphite-900 dark:text-graphite-100">{pessoa.nome}</td>
                    <td className="px-3 py-2">
                      {pessoa.problema === 'sem_cadastro' && <span className="text-xs font-semibold text-alert-red">Não encontrado no cadastro</span>}
                      {pessoa.problema === 'sem_email' && <span className="text-xs font-semibold text-alert-red">Sem e-mail válido no cadastro</span>}
                      {pessoa.problema === 'email_repetido' && <span className="text-xs font-semibold text-alert-red">E-mail {pessoa.email} usado por outra pessoa no cadastro</span>}
                      {!pessoa.problema && <span className="break-all text-graphite-700 dark:text-graphite-200">{pessoa.email}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mb-4 text-xs text-graphite-500 dark:text-graphite-400">
          Confira os e-mails. Se algum estiver errado, corrija no cadastro do bombeiro antes de enviar.
        </p>
        {comProblema.length > 0 && (
          <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-alert-red">
            {comProblema.length === 1 ? '1 pessoa está' : `${comProblema.length} pessoas estão`} sem e-mail válido. Corrija o cadastro para poder enviar.
          </p>
        )}
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Depois do envio, não será mais possível editar nem excluir este documento ({documento}).
        </div>
        <p className="mb-4 text-xs text-graphite-500 dark:text-graphite-400">Cada pessoa receberá um e-mail do Autentique com o link para assinar.</p>
        {erro && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-alert-red">{erro}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancelar} disabled={enviando} className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} disabled={!podeEnviar} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60">
            <Signature className="h-4 w-4" /> {enviando ? 'Enviando...' : 'Enviar para assinatura'}
          </button>
        </div>
      </div>
    </div>
  );
}
