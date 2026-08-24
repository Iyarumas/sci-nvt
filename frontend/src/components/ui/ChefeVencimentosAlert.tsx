import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Shield, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listarAtivos } from '../../services/bombeiroService';
import { listarCertificacoes } from '../../services/certificacaoService';
import type { Bombeiro } from '../../types/bombeiro';
import type { CertificacaoNR } from '../../types/certificacao';
import { resolverContextoOperacional } from '../../utils/permissoes';
import { formatarDataBR, hojeLocalISO, normalizarDataISO, parseDataLocalISO } from '../../utils/datas';

type AlertStatus = 'warning' | 'expired';

type VencimentoItem = {
  id: string;
  bombeiroId: string;
  nome: string;
  nomeCompleto: string;
  foto?: string;
  cargo?: string;
  equipe?: string;
  dataValidade: string;
  dias: number;
  detalhe?: string;
};

type AlertGroup = {
  key: string;
  status: AlertStatus;
  titulo: string;
  subtitulo: string;
  documento: string;
  itens: VencimentoItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * DAY_MS;
const STORAGE_PREFIX = 'sescinc-alerta-vencimentos-chefia-v1';
const ITENS_POR_PAGINA = 6;

const LIMITES_AVISO = {
  cve: 365,
  cnh: 240,
  cracha: 120,
  nr: 90,
} as const;

function diasAte(data: unknown): number | null {
  const iso = normalizarDataISO(data);
  if (!iso) return null;
  const validade = parseDataLocalISO(iso);
  const hoje = parseDataLocalISO(hojeLocalISO());
  if (Number.isNaN(validade.getTime()) || Number.isNaN(hoje.getTime())) return null;
  return Math.ceil((validade.getTime() - hoje.getTime()) / DAY_MS);
}

function criarItemBombeiro(
  bombeiro: Bombeiro,
  dataValidade: unknown,
  documento: string,
  detalhe?: string,
): VencimentoItem | null {
  const iso = normalizarDataISO(dataValidade);
  const dias = diasAte(iso);
  if (!iso || dias === null) return null;

  return {
    id: `${bombeiro.id}-${documento}-${detalhe || 'validade'}`,
    bombeiroId: bombeiro.id,
    nome: bombeiro.nomeGuerra || bombeiro.nomeCompleto,
    nomeCompleto: bombeiro.nomeCompleto,
    foto: bombeiro.foto || undefined,
    cargo: bombeiro.cargo,
    equipe: bombeiro.equipe,
    dataValidade: iso,
    dias,
    detalhe,
  };
}

function criarItemCertificacao(certificacao: CertificacaoNR, bombeiro: Bombeiro | undefined): VencimentoItem | null {
  const iso = normalizarDataISO(certificacao.dataValidade);
  const dias = diasAte(iso);
  if (!iso || dias === null) return null;

  return {
    id: `${certificacao.funcionarioId}-nr-${certificacao.id}`,
    bombeiroId: certificacao.funcionarioId,
    nome: bombeiro?.nomeGuerra || certificacao.funcionarioNome,
    nomeCompleto: bombeiro?.nomeCompleto || certificacao.funcionarioNome,
    foto: bombeiro?.foto || undefined,
    cargo: bombeiro?.cargo,
    equipe: bombeiro?.equipe,
    dataValidade: iso,
    dias,
    detalhe: `${certificacao.nrNumero} - ${certificacao.nrNome}`,
  };
}

function selecionarItens(itens: VencimentoItem[], status: AlertStatus, limiteDias: number): VencimentoItem[] {
  return itens
    .filter(item => status === 'expired' ? item.dias < 0 : item.dias >= 0 && item.dias <= limiteDias)
    .sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome));
}

function criarGrupo(
  key: string,
  status: AlertStatus,
  titulo: string,
  subtitulo: string,
  documento: string,
  itens: VencimentoItem[],
  limiteDias: number,
): AlertGroup | null {
  const selecionados = selecionarItens(itens, status, limiteDias);
  if (selecionados.length === 0) return null;

  return {
    key,
    status,
    titulo,
    subtitulo,
    documento,
    itens: selecionados,
  };
}

function montarGrupos(bombeiros: Bombeiro[], certificacoes: CertificacaoNR[]): AlertGroup[] {
  const bombeirosPorId = new Map(bombeiros.map(bombeiro => [bombeiro.id, bombeiro]));
  const cve = bombeiros
    .map(bombeiro => criarItemBombeiro(bombeiro, bombeiro.cveValidade, 'cve', 'Certificado CVE'))
    .filter(Boolean) as VencimentoItem[];
  const cnh = bombeiros
    .map(bombeiro => criarItemBombeiro(bombeiro, bombeiro.cnhValidade, 'cnh', 'Carteira Nacional de Habilitação'))
    .filter(Boolean) as VencimentoItem[];
  const cracha = bombeiros
    .map(bombeiro => criarItemBombeiro(bombeiro, bombeiro.credencialValidade, 'cracha', 'Credencial / crachá operacional'))
    .filter(Boolean) as VencimentoItem[];
  const nrs = certificacoes
    .map(certificacao => criarItemCertificacao(certificacao, bombeirosPorId.get(certificacao.funcionarioId)))
    .filter(Boolean) as VencimentoItem[];

  return [
    criarGrupo('cve-warning', 'warning', 'CVE perto do vencimento', 'CVE com prazo de até 1 ano para vencer.', 'CVE', cve, LIMITES_AVISO.cve),
    criarGrupo('cve-expired', 'expired', 'CVE vencido', 'CVE já passou da data de validade.', 'CVE', cve, LIMITES_AVISO.cve),
    criarGrupo('cnh-warning', 'warning', 'CNH perto do vencimento', 'CNH com prazo de até 8 meses para vencer.', 'CNH', cnh, LIMITES_AVISO.cnh),
    criarGrupo('cnh-expired', 'expired', 'CNH vencida', 'CNH já passou da data de validade.', 'CNH', cnh, LIMITES_AVISO.cnh),
    criarGrupo('cracha-warning', 'warning', 'Crachá perto do vencimento', 'Crachá/credencial com prazo de até 4 meses para vencer.', 'Crachá', cracha, LIMITES_AVISO.cracha),
    criarGrupo('cracha-expired', 'expired', 'Crachá vencido', 'Crachá/credencial já passou da data de validade.', 'Crachá', cracha, LIMITES_AVISO.cracha),
    criarGrupo('nr-warning', 'warning', 'NR perto do vencimento', 'Certificações NR próximas da validade.', 'NR', nrs, LIMITES_AVISO.nr),
    criarGrupo('nr-expired', 'expired', 'NR vencida', 'Certificações NR já vencidas.', 'NR', nrs, LIMITES_AVISO.nr),
  ].filter(Boolean) as AlertGroup[];
}

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}:${username}`;
}

function podeAbrirAviso(username: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return true;
    const lastShown = Number(raw);
    return Number.isNaN(lastShown) || Date.now() - lastShown >= THREE_DAYS_MS;
  } catch {
    return true;
  }
}

function registrarAvisoExibido(username: string) {
  try {
    localStorage.setItem(storageKey(username), String(Date.now()));
  } catch {
    // Sem localStorage, o sistema apenas deixa de memorizar a janela de 3 dias.
  }
}

function textoDias(item: VencimentoItem, status: AlertStatus): string {
  if (item.dias === 0) return 'Vence hoje';
  if (status === 'expired') {
    const dias = Math.abs(item.dias);
    return `Vencido há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }
  return `Faltam ${item.dias} ${item.dias === 1 ? 'dia' : 'dias'}`;
}

function iniciais(item: VencimentoItem): string {
  const partes = (item.nome || item.nomeCompleto || '?').trim().split(/\s+/).slice(0, 2);
  return partes.map(parte => parte.charAt(0).toUpperCase()).join('') || '?';
}

function PessoaAvatar({ item, status }: { item: VencimentoItem; status: AlertStatus }) {
  const [erroImagem, setErroImagem] = useState(false);
  const borderClass = status === 'expired' ? 'border-red-300/60 bg-red-500/20' : 'border-yellow-200/70 bg-yellow-400/20';

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 sm:h-14 sm:w-14 ${borderClass}`}>
      {item.foto && !erroImagem ? (
        <img
          src={item.foto}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setErroImagem(true)}
        />
      ) : (
        <span className="text-base font-black text-white">{iniciais(item)}</span>
      )}
    </div>
  );
}

export function ChefeVencimentosAlert() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<AlertGroup[]>([]);
  const [grupoAtualIndex, setGrupoAtualIndex] = useState(0);
  const [paginaItens, setPaginaItens] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function carregarAvisos() {
      if (!user?.username || !podeAbrirAviso(user.username)) return;

      try {
        const contexto = await resolverContextoOperacional(user);
        const cargo = contexto.cargo || (user.pessoa?.personType === 'bombeiro' ? user.pessoa.funcao : null);
        const equipe = contexto.equipe || (user.pessoa?.personType === 'bombeiro' ? user.pessoa.equipe : null);
        const acessoGlobal =
          cargo === 'GS' ||
          equipe === 'Embaixador';
        const deveReceber =
          acessoGlobal ||
          cargo === 'BA-CE' ||
          (user.role === 'chefe' && user.pessoa?.personType === 'bombeiro');

        if (!deveReceber) return;
        if (!acessoGlobal && !equipe) return;

        const bombeiros = acessoGlobal ? await listarAtivos() : await listarAtivos({ equipe: equipe || undefined });
        if (cancelado || bombeiros.length === 0) return;

        const certificacoes = await listarCertificacoes({ funcionarioIds: bombeiros.map(bombeiro => bombeiro.id) });
        if (cancelado) return;

        const proximosGrupos = montarGrupos(bombeiros, certificacoes);
        if (proximosGrupos.length === 0) return;

        registrarAvisoExibido(user.username);
        setGrupoAtualIndex(0);
        setGrupos(proximosGrupos);
      } catch (error) {
        console.warn('Não foi possível carregar os avisos de vencimento da chefia.', error);
      }
    }

    carregarAvisos();

    return () => {
      cancelado = true;
    };
  }, [user]);

  const grupoAtual = grupos[grupoAtualIndex];
  const isUltimo = grupoAtualIndex >= grupos.length - 1;

  useEffect(() => {
    setPaginaItens(0);
  }, [grupoAtual?.key]);

  const tema = useMemo(() => {
    if (grupoAtual?.status === 'expired') {
      return {
        panel: 'border-red-500/80 bg-[#2b0b0e] text-red-50 shadow-red-950/40',
        top: 'bg-red-500',
        icon: 'bg-red-500/20 text-red-100 ring-red-400/30',
        badge: 'border-red-300/40 bg-red-500/15 text-red-50',
        item: 'border-red-300/20 bg-red-500/10',
        days: 'bg-red-500 text-white',
        button: 'bg-red-500 text-white hover:bg-red-400',
      };
    }

    return {
      panel: 'border-yellow-400/80 bg-[#2a2108] text-yellow-50 shadow-yellow-950/30',
      top: 'bg-yellow-400',
      icon: 'bg-yellow-400/20 text-yellow-100 ring-yellow-200/30',
      badge: 'border-yellow-200/50 bg-yellow-400/15 text-yellow-50',
      item: 'border-yellow-200/20 bg-yellow-400/10',
      days: 'bg-yellow-300 text-graphite-950',
      button: 'bg-yellow-300 text-graphite-950 hover:bg-yellow-200',
    };
  }, [grupoAtual?.status]);

  if (!grupoAtual) return null;

  const totalPaginasItens = Math.max(1, Math.ceil(grupoAtual.itens.length / ITENS_POR_PAGINA));
  const paginaAtualItens = Math.min(paginaItens, totalPaginasItens - 1);
  const inicioItens = paginaAtualItens * ITENS_POR_PAGINA;
  const fimItens = Math.min(inicioItens + ITENS_POR_PAGINA, grupoAtual.itens.length);
  const itensVisiveis = grupoAtual.itens.slice(inicioItens, fimItens);
  const temCarrossel = totalPaginasItens > 1;
  const carrosselNoInicio = paginaAtualItens === 0;
  const carrosselNoFim = paginaAtualItens >= totalPaginasItens - 1;
  const botaoCarrosselCls = (disabled: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition sm:flex-none ${
      disabled
        ? 'cursor-not-allowed border-white/5 text-white/30'
        : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
    }`;

  const avancar = () => {
    if (isUltimo) {
      setGrupos([]);
      setGrupoAtualIndex(0);
      setPaginaItens(0);
      return;
    }
    setGrupoAtualIndex(index => index + 1);
    setPaginaItens(0);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`relative my-2 max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl sm:my-0 sm:max-h-[calc(100vh-2rem)] ${tema.panel}`}>
        <div className={`h-2 w-full ${tema.top}`} />
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:gap-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 sm:h-14 sm:w-14 ${tema.icon}`}>
              {grupoAtual.status === 'expired' ? <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" /> : <CalendarClock className="h-6 w-6 sm:h-7 sm:w-7" />}
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${tema.badge}`}>
                  {grupoAtual.documento}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Aviso {grupoAtualIndex + 1} de {grupos.length}
                </span>
              </div>
              <h2 className="text-xl font-black leading-tight text-white sm:text-2xl">{grupoAtual.titulo}</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-white/75">{grupoAtual.subtitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={avancar}
            className="rounded-xl p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white sm:p-2"
            aria-label={isUltimo ? 'Fechar avisos de vencimento' : 'Fechar este aviso e abrir o próximo'}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
              <Shield className="h-4 w-4" />
              <span>{grupoAtual.itens.length} {grupoAtual.itens.length === 1 ? 'registro encontrado' : 'registros encontrados'}</span>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Exibido no login a cada 3 dias
            </span>
          </div>

          {temCarrossel && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-bold text-white/80">
                Exibindo {inicioItens + 1}-{fimItens} de {grupoAtual.itens.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaItens(index => Math.max(0, index - 1))}
                  disabled={carrosselNoInicio}
                  className={botaoCarrosselCls(carrosselNoInicio)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="hidden min-w-20 text-center text-xs font-semibold uppercase tracking-wider text-white/50 sm:inline">
                  {paginaAtualItens + 1} / {totalPaginasItens}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaItens(index => Math.min(totalPaginasItens - 1, index + 1))}
                  disabled={carrosselNoFim}
                  className={botaoCarrosselCls(carrosselNoFim)}
                >
                  Próximos 6
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid max-h-[36vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:max-h-[54vh] md:grid-cols-2 lg:max-h-[60vh] lg:grid-cols-3">
            {itensVisiveis.map(item => (
              <div
                key={item.id}
                className={`flex min-h-36 flex-col items-center justify-between gap-3 rounded-2xl border p-3 text-center ${
                  itensVisiveis.length === 1 ? 'md:col-span-2 lg:col-span-3' : ''
                } ${tema.item}`}
              >
                <div className="flex min-w-0 flex-col items-center gap-2">
                  <PessoaAvatar item={item} status={grupoAtual.status} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-white sm:text-lg">
                      {item.cargo ? `${item.cargo} - ${item.nome}` : item.nome}
                    </p>
                  </div>
                </div>

                <div className="flex w-full flex-col items-center gap-1.5 rounded-2xl bg-black/20 p-2.5 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">Data de vencimento</span>
                  <span className="text-lg font-black text-white">{formatarDataBR(item.dataValidade)}</span>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${tema.days}`}>
                    {textoDias(item, grupoAtual.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm font-medium leading-relaxed text-white/60">
            Fechar este aviso leva para o próximo grupo pendente, quando existir.
          </p>
          <button
            type="button"
            onClick={avancar}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition sm:w-auto ${tema.button}`}
          >
            {isUltimo ? 'Concluir avisos' : 'Próximo aviso'}
            {!isUltimo && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
