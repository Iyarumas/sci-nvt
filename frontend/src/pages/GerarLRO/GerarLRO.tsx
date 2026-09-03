import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Save, Eye, AlertTriangle, ArrowLeft, ArrowRight, Trash2, Search, Check, X, Archive, RefreshCw, ChevronDown, ChevronUp, HelpCircle, MousePointer2 } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { AlertModal } from '../../components/ui/AlertModal';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { listarFeriasGozo } from '../../services/feriasService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarVigencias, type MotivoVigenciaSubstituicao, type VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';
import { listarDocumentos, listarPreenchimentos, criarPreenchimento, criarDocumento } from '../../services/documentoService';
import { listarViaturas } from '../../services/viaturaService';
import { listarPTRBs } from '../../services/ptrbService';
import { listarPTRBACompletos } from '../../services/ptrbaCompletoService';
import { listarCompletas as listarCompletasEscala, listarConfigs as listarConfigsEscala } from '../../services/escalaMensalService';
import type { EscalaMensalCompleta, EscalaMensalConfig } from '../../types/escalaMensal';
import { listarAPOCs } from '../../services/apocService';
import { listarConferencias } from '../../services/conferenciaService';
import { atualizarOcorrencia, listarOcorrencias } from '../../services/ocorrenciaService';
import { listarReas } from '../../services/reaService';
import { listarUsuarios } from '../../services/usuarioService';
import type { Usuario } from '../../services/usuarioService';
import { salvarDraft, listarDrafts, excluirDraft, atualizarStatus, type LRODraft, type LRODraftStatus } from '../../services/lroDraftService';
import { gerarPDF, dividirEmLancamentos } from '../../services/lroGenerator';
import type { Bombeiro } from '../../types/bombeiro';
import type { Conferencia } from '../../types/conferencia';
import type { FeriasGozo } from '../../types/ferias';
import type { Ocorrencia } from '../../types/ocorrencia';
import type { PTRB } from '../../types/ptrb';
import type { PTRBACompleto } from '../../types/ptrbaCompleto';
import type { ReaRegistro } from '../../types/rea';
import { dataSaidaPlantao, equipeEstaNoPlantao, horarioPlantaoPorEquipe } from '../../utils/equipes';
import { estaNoPeriodoISO, formatarDataBR, formatarDataHoraBR, hojeLocalISO, mesmoDiaISO, normalizarDataISO, parseDataLocalISO } from '../../utils/datas';
import {
  canCriarRegistrosDiarios,
  canEditarRegistroDiario,
  canEscolherEquipeRegistrosDiarios,
  canExcluirRegistroDiario,
  equipePadraoRegistrosDiarios,
} from '../../utils/permissoes';
import { validarCursoParaFuncao } from '../../utils/validacaoCursos';
import { formatarUsuarioAuditoria, montarPessoasAuditoria } from '../../utils/auditoria';
import type { PessoaAuditoria } from '../../utils/auditoria';

function SearchSelect({ options, value, onChange, placeholder, label }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      {label && <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">{label}</label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
        <input
          type="text"
          value={open ? search : selected?.label || ''}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder || 'Digite para buscar...'}
          className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400 dark:focus:ring-aviation-400/10"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-graphite-200 bg-white shadow-lg dark:border-border-dark dark:bg-surface-card">
          {filtered.map(o => (
            <button
              key={o.value}
              onMouseDown={() => { onChange(o.value); setSearch(''); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-aviation-50 dark:hover:bg-aviation-900/20 ${value === o.value ? 'bg-aviation-50 font-medium text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-400' : 'text-graphite-700 dark:text-graphite-300'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-graphite-200 bg-white p-3 text-center text-sm text-graphite-400 shadow-lg dark:border-border-dark dark:bg-surface-card">
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  );
}

function normalizarPessoaTexto(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textoNormalizadoContemNome(textoNormalizado: string, nome: string | undefined): boolean {
  const nomeNormalizado = normalizarPessoaTexto(nome);
  return !!nomeNormalizado && ` ${textoNormalizado} `.includes(` ${nomeNormalizado} `);
}

function buscarBombeiroPorTexto(nome: string, pessoas: Bombeiro[]): Bombeiro | undefined {
  const alvo = normalizarPessoaTexto(nome);
  if (!alvo) return undefined;

  const exato = pessoas.find(p =>
    normalizarPessoaTexto(p.nomeGuerra) === alvo ||
    normalizarPessoaTexto(p.nomeCompleto) === alvo
  );
  if (exato) return exato;

  return [...pessoas]
    .filter(p =>
      textoNormalizadoContemNome(alvo, p.nomeCompleto) ||
      textoNormalizadoContemNome(alvo, p.nomeGuerra)
    )
    .sort((a, b) => normalizarPessoaTexto(b.nomeCompleto).length - normalizarPessoaTexto(a.nomeCompleto).length)[0];
}

type LroTourStep = {
  target: string;
  view: 'lista' | 'wizard';
  step?: 'equipe' | 'trocas' | 'preencher' | 'revisar';
  title: string;
  body: string;
  automation: string;
};

type TourRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;

const LRO_TOUR_STEPS: LroTourStep[] = [
  {
    target: 'novo-lro',
    view: 'lista',
    title: 'Comece por Novo LRO',
    body: 'Aqui você cria o documento do plantão. Use Clonar LRO só quando quiser reaproveitar dados de outro dia e revisar tudo antes de finalizar.',
    automation: 'O sistema usa o novo LRO para montar uma sequência limpa de equipe, data, trocas, efetivo, ocorrências e revisão final.',
  },
  {
    target: 'etapas-fluxo',
    view: 'wizard',
    step: 'equipe',
    title: 'Siga as etapas em ordem',
    body: 'O LRO é dividido em Equipe, Trocas, Dados e Revisão. Cada etapa prepara informação para a próxima.',
    automation: 'Pular uma etapa ou deixar dados incompletos pode impedir que a automação puxe o plantão certo ou monte o documento completo.',
  },
  {
    target: 'equipe-plantao',
    view: 'wizard',
    step: 'equipe',
    title: 'Equipe e data comandam tudo',
    body: 'Escolha equipe, data de entrada e data de saída com atenção. Esses campos definem o plantão que será consultado.',
    automation: 'PTR-BA, BONA, REA, ocorrências, inspeções, solicitações, trocas e substituições dependem dessa equipe e dessa data para aparecerem corretamente.',
  },
  {
    target: 'trocas-substituicoes',
    view: 'wizard',
    step: 'trocas',
    title: 'Confirme trocas e substituições',
    body: 'Esta etapa mostra trocas registradas, férias, substituições temporárias e trocas emergenciais do dia.',
    automation: 'Quando você confirma uma troca, o efetivo e a cadeia de substituição entram certos no LRO. Se recusar ou esquecer uma troca, a escala final pode ficar errada.',
  },
  {
    target: 'informacoes-dia',
    view: 'wizard',
    step: 'preencher',
    title: 'Preencha as informações do dia',
    body: 'Aqui ficam chefe, comunicação, efetivo, viaturas, instruções, alterações, emergências, ocorrências e solicitações.',
    automation: 'O sistema já tenta trazer dados cadastrados em outros módulos, mas esta tela é a revisão operacional: confira nomes, funções, viaturas e textos antes de seguir.',
  },
  {
    target: 'visualizar-pdf',
    view: 'wizard',
    step: 'preencher',
    title: 'Visualize antes de finalizar',
    body: 'O botão Visualizar abre o documento no formato final. Ali você pode imprimir ou salvar em PDF para conferir com calma.',
    automation: 'O PDF usa exatamente o que está preenchido aqui. Se notar algo errado no preview, volte e ajuste antes de finalizar.',
  },
  {
    target: 'revisao-final',
    view: 'wizard',
    step: 'revisar',
    title: 'Revise o resumo final',
    body: 'Esta é a última parada antes de enviar o LRO para aprovação. Confira equipe, plantão, responsáveis, trocas e principais textos.',
    automation: 'Depois de finalizar, o LRO fica aguardando aprovação e a equipe não altera mais. Administrador ou desenvolvedor faz a etapa final.',
  },
  {
    target: 'finalizar-lro',
    view: 'wizard',
    step: 'revisar',
    title: 'Finalize só quando estiver pronto',
    body: 'Finalizar envia o LRO para aguardando aprovação. Depois disso, use Ver documento para imprimir ou salvar o PDF.',
    automation: 'Quando o administrador marcar como finalizado, ocorrências vinculadas podem ser fechadas e bloqueadas para manter o histórico do plantão.',
  },
];

function getTourTargetRect(target: string): DOMRect | null {
  const element = document.querySelector(`[data-lro-tour="${target}"]`) as HTMLElement | null;
  return element ? element.getBoundingClientRect() : null;
}

function fallbackTourRect(): TourRect {
  const width = Math.min(320, window.innerWidth - 32);
  const height = 112;
  const left = (window.innerWidth - width) / 2;
  const top = Math.max(80, (window.innerHeight - height) / 2);
  return { top, left, right: left + width, bottom: top + height, width, height };
}

function normalizeTourRect(rect: TourRect): TourRect {
  const margin = 16;
  const maxWidth = Math.max(80, window.innerWidth - margin * 2);
  const maxHeight = Math.max(80, Math.min(window.innerHeight - margin * 2, 260));
  const width = Math.min(Math.max(rect.width, 80), maxWidth);
  const height = Math.min(Math.max(rect.height, 56), maxHeight);
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));

  return { top, left, right: left + width, bottom: top + height, width, height };
}

function overlapArea(a: TourRect, b: TourRect): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function tourPanelStyle(rect: TourRect): CSSProperties {
  const margin = 16;
  const width = Math.min(window.innerWidth < 900 ? 420 : 460, window.innerWidth - margin * 2);
  const estimatedHeight = Math.min(430, window.innerHeight - margin * 2);
  const minHeight = Math.min(360, estimatedHeight);
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - estimatedHeight - margin;

  if (window.innerWidth < 700) {
    return { left: margin, right: margin, bottom: margin, minHeight, maxHeight: estimatedHeight };
  }

  const candidates = [
    { left: rect.right + 20, top: rect.top },
    { left: rect.left - width - 20, top: rect.top },
    { left: rect.left, top: rect.bottom + 20 },
    { left: rect.left, top: rect.top - estimatedHeight - 20 },
    { left: window.innerWidth - width - margin, top: window.innerHeight - estimatedHeight - margin },
  ].map(candidate => {
    const left = clamp(candidate.left, margin, maxLeft);
    const top = clamp(candidate.top, margin, Math.max(margin, maxTop));
    const panelRect = { top, left, right: left + width, bottom: top + estimatedHeight, width, height: estimatedHeight };
    return { left, top, overlap: overlapArea(panelRect, rect) };
  });

  const best = candidates.sort((a, b) => a.overlap - b.overlap)[0];
  return { left: best.left, top: best.top, width, minHeight, maxHeight: estimatedHeight };
}

function AnimatedLroTour({
  open,
  steps,
  stepIndex,
  onBack,
  onNext,
  onClose,
}: {
  open: boolean;
  steps: LroTourStep[];
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex] || steps[0];

  useEffect(() => {
    if (!open) return;

    setRect(null);
    const element = document.querySelector(`[data-lro-tour="${step.target}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    const updateRect = () => setRect(getTourTargetRect(step.target));
    const timers = [
      window.setTimeout(updateRect, 80),
      window.setTimeout(updateRect, 380),
      window.setTimeout(updateRect, 720),
    ];

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    updateRect();

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, step.target]);

  if (!open) return null;

  const targetRect = normalizeTourRect(rect || fallbackTourRect());
  const panelStyle = tourPanelStyle(targetRect);
  const spotlightPadding = 14;
  const spotlightStyle: CSSProperties = {
    top: targetRect.top - spotlightPadding,
    left: targetRect.left - spotlightPadding,
    width: targetRect.width + spotlightPadding * 2,
    height: targetRect.height + spotlightPadding * 2,
  };
  const cursorStyle: CSSProperties = {
    top: targetRect.top + targetRect.height / 2,
    left: targetRect.left + targetRect.width / 2,
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="fixed rounded-2xl border-2 border-aviation-300 bg-white/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.58),0_0_0_8px_rgba(14,116,144,0.16),0_18px_50px_rgba(14,116,144,0.35)] transition-all duration-700 ease-out"
        style={spotlightStyle}
      />
      <span
        className="fixed z-[61] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-aviation-300 bg-aviation-400/20 opacity-70 animate-ping"
        style={cursorStyle}
      />
      <MousePointer2
        className="fixed z-[62] h-9 w-9 -translate-x-1 -translate-y-1 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] transition-all duration-700 ease-out"
        style={cursorStyle}
        fill="white"
      />

      <div
        className="pointer-events-auto fixed z-[63] overflow-y-auto rounded-2xl border border-graphite-200 bg-white p-6 shadow-2xl shadow-black/25 dark:border-border-dark dark:bg-surface-card"
        style={panelStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
              Passo {stepIndex + 1} de {steps.length}
            </span>
            <h3 className="mt-1 text-lg font-bold text-graphite-900 dark:text-graphite-100">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
            title="Pular tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-6 text-graphite-600 dark:text-graphite-300">{step.body}</p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="font-bold">Automação: </span>{step.automation}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover/50"
          >
            Pular
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600"
            >
              {stepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type EquipeOpcao = 'Alfa' | 'Bravo' | 'Charlie' | 'Delta';type Step = 'equipe' | 'trocas' | 'preencher' | 'revisar';
type FrotaLinhaDados = {
  viaturaId: string;
  prefixo: string;
  kmIni: string;
  kmFim: string;
  combIni: string;
  combFim: string;
  situacao: string;
};
type SubstituicaoDetectada = {
  id: string;
  tipo: 'troca' | 'substituicao';
  substituido: string;
  substituto: string;
  dataSolicitada?: string;
  dataFolga?: string;
  confirmada: boolean | null;
};

function chaveSubstituicaoDetectada(item: SubstituicaoDetectada): string {
  return [
    item.tipo,
    item.id,
    normalizarPessoaTexto(item.substituido),
    normalizarPessoaTexto(item.substituto),
    item.dataSolicitada || '',
    item.dataFolga || '',
  ].join('|');
}
type TrocaManualLRO = {
  solicitante: string;
  solicitado: string;
  dataFolga: string;
  motivo: string;
  documentoFillId?: string;
};
type SubstituicaoOrigem = MotivoVigenciaSubstituicao | 'troca' | 'manual';
type SubstituicaoInfo = {
  substitutoNome: string;
  substitutoId: string;
  tipo: 'troca' | 'substituicao';
  origem: SubstituicaoOrigem;
  substituidoId: string;
  substituidoNome: string;
  cargoSubstituido?: string;
  equipeSubstituido?: string;
  cargoExercido?: string;
  substituidoSaiDoPlantao: boolean;
};
type EfetivoDisponivel = {
  bombeiro: Bombeiro;
  cargoExercido: string;
};

function substituicaoVemDeFerias(origem: SubstituicaoOrigem | string | undefined): boolean {
  return origem === 'ferias' || origem === 'cascata';
}

function visualSubstituicaoLRO(info?: Pick<SubstituicaoInfo, 'tipo' | 'origem'>) {
  if (!info) {
    return {
      label: '',
      cardClass: 'border-graphite-100 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-hover/30',
      badgeClass: '',
      hoverBadgeClass: '',
      nameClass: 'text-graphite-900 dark:text-graphite-100',
      detailClass: 'text-graphite-500',
    };
  }

  if (info.tipo === 'troca' || info.origem === 'troca' || info.origem === 'manual') {
    return {
      label: info.origem === 'manual' ? 'EMERGENCIAL' : 'TROCA',
      cardClass: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10',
      badgeClass: 'bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300',
      hoverBadgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-800/30 dark:text-amber-300',
      nameClass: 'text-amber-700 dark:text-amber-300',
      detailClass: 'text-amber-600 dark:text-amber-400',
    };
  }

  if (substituicaoVemDeFerias(info.origem)) {
    return {
      label: info.origem === 'cascata' ? 'CORRENTE DE FERIAS' : 'FERIAS',
      cardClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10',
      badgeClass: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300',
      hoverBadgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/30 dark:text-emerald-300',
      nameClass: 'text-emerald-700 dark:text-emerald-300',
      detailClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  if (info.origem === 'afastamento') {
    return {
      label: 'AFASTAMENTO',
      cardClass: 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/10',
      badgeClass: 'bg-rose-200 text-rose-800 dark:bg-rose-800/40 dark:text-rose-300',
      hoverBadgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-800/30 dark:text-rose-300',
      nameClass: 'text-rose-700 dark:text-rose-300',
      detailClass: 'text-rose-600 dark:text-rose-400',
    };
  }

  return {
    label: 'SUBSTITUICAO',
    cardClass: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10',
    badgeClass: 'bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-300',
    hoverBadgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300',
    nameClass: 'text-blue-700 dark:text-blue-300',
    detailClass: 'text-blue-600 dark:text-blue-400',
  };
}
const EMPTY_FROTA_LINHA: FrotaLinhaDados = {
  viaturaId: '',
  prefixo: '',
  kmIni: '',
  kmFim: '',
  combIni: '',
  combFim: '',
  situacao: '',
};

function normalizarPercentualCombustivel(value: unknown): string {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return '';
  const numero = Number(raw);
  if (!Number.isFinite(numero)) return '';
  const limitado = Math.min(100, Math.max(0, numero));
  return Number.isInteger(limitado)
    ? String(limitado)
    : String(Number(limitado.toFixed(1)));
}

const STATUS_CORES: Record<LRODraftStatus, string> = {
  rascunho: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  aguardando: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
  assinado: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
  cancelado: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
  finalizado: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30',
  arquivado: 'text-graphite-600 bg-graphite-100 dark:text-graphite-300 dark:bg-graphite-800',
};

const STATUS_LABELS: Record<LRODraftStatus, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
  finalizado: 'Finalizado',
  arquivado: 'Arquivado',
};

const STATUS_LRO_TRAVAM_OCORRENCIAS = new Set<LRODraftStatus>(['assinado', 'finalizado', 'arquivado']);
const STATUS_LRO_EDITAVEIS_POR_ADMIN = new Set<LRODraftStatus>(['aguardando', 'assinado', 'finalizado']);
const STATUS_TROCA_ENTRA_LRO = new Set(['draft', 'pending', 'signed']);

export function GerarLRO() {
  const { user, contexto, equipeEfetiva } = useContextoOperacional();
  const navigate = useNavigate();
  const username = user?.username || '';
  const podeCriar = canCriarRegistrosDiarios(contexto);
  const canCreate = podeCriar;
  const canEscolherEquipe = canEscolherEquipeRegistrosDiarios(contexto);
  const equipePadrao = equipePadraoRegistrosDiarios(contexto) || equipeEfetiva;

  const [step, setStep] = useState<Step>('equipe');
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [trocaFills, setTrocaFills] = useState<any[]>([]);
  const [todasSubstituicoes, setTodasSubstituicoes] = useState<any[]>([]);
  const [viaturas, setViaturas] = useState<any[]>([]);
  const [ptrbs, setPtrbs] = useState<PTRB[]>([]);
  const [ptrbaCompletos, setPtrbaCompletos] = useState<PTRBACompleto[]>([]);
  const [escalasCompletas, setEscalasCompletas] = useState<EscalaMensalCompleta[]>([]);
  const [escalasConfigs, setEscalasConfigs] = useState<EscalaMensalConfig[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [ocorrenciasOperacionais, setOcorrenciasOperacionais] = useState<Ocorrencia[]>([]);
  const [reas, setReas] = useState<ReaRegistro[]>([]);
  const [drafts, setDrafts] = useState<LRODraft[]>([]);
  const [apocs, setApocs] = useState<any[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftEmEdicaoStatus, setDraftEmEdicaoStatus] = useState<LRODraftStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // -- Frota state --
  const [frotaDados, setFrotaDados] = useState<Record<string, FrotaLinhaDados>>({});
  const DEFAULT_VIATURAS = [
    { id: 'default-cci-319', prefixo: 'CCI 319', tipo: 'CCI' },
    { id: 'default-cci-320', prefixo: 'CCI 320', tipo: 'CCI' },
    { id: 'default-cci-333', prefixo: 'CCI 333', tipo: 'CCI' },
    { id: 'default-crs', prefixo: 'CRS', tipo: 'CRS' },
  ];
  const FROTA_ROWS = 4;

  // -- Wizard state --
  const [equipe, setEquipe] = useState<EquipeOpcao | ''>('');
  const [dataInicio, setDataInicio] = useState(hojeLocalISO());
  const [dataFim, setDataFim] = useState('');
  const [trocaDocId, setTrocaDocId] = useState<string | null>(null);
  const [houveTrocas, setHouveTrocas] = useState<'sim' | 'nao' | null>(null);
  const [trocaSolicitante, setTrocaSolicitante] = useState('');
  const [trocaSolicitado, setTrocaSolicitado] = useState('');
  const [trocaDataFolga, setTrocaDataFolga] = useState('');
  const [trocaMotivo, setTrocaMotivo] = useState('');
  const [trocasManuais, setTrocasManuais] = useState<TrocaManualLRO[]>([]);
  const [substituicoesDetectadas, setSubstituicoesDetectadas] = useState<SubstituicaoDetectada[]>([]);

  // -- LRO Sections --
  const [chefeEquipe, setChefeEquipe] = useState('');
  const [comunicacao, setComunicacao] = useState('');
  const [equipagemCCI, setEquipagemCCI] = useState<Record<string, string>>({});
  const [equipagemCCIRT, setEquipagemCCIRT] = useState<Record<string, string>>({});
  const [equipagemCRS, setEquipagemCRS] = useState<Record<string, string>>({});
  const [instrucoes, setInstrucoes] = useState('');
  const [instrucoesHorarios, setInstrucoesHorarios] = useState<string | string[]>('');
  const [centralFaisca, setCentralFaisca] = useState('SEM ALTERAÇÕES');
  const [radioComunicacao, setRadioComunicacao] = useState('SEM ALTERAÇÕES');
  const [tpTemAlteracao, setTpTemAlteracao] = useState(false);
  const [tpTexto, setTpTexto] = useState('');
  const [extTemAlteracao, setExtTemAlteracao] = useState(false);
  const [extTexto, setExtTexto] = useState('');
  const [equipTemAlteracao, setEquipTemAlteracao] = useState(false);
  const [equipTexto, setEquipTexto] = useState('');
  const [edifTemAlteracao, setEdifTemAlteracao] = useState(false);
  const [edifTexto, setEdifTexto] = useState('');
  const [emergenciaXI, setEmergenciaXI] = useState('');
  const [ocorrenciasNA, setOcorrenciasNA] = useState('');
  const [inspecoes, setInspecoes] = useState('');
  const [outrasOcorrencias, setOutrasOcorrencias] = useState('');
  const [solicitacoesCCR, setSolicitacoesCCR] = useState('');

  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const equipesFormulario = useMemo(() => {
    if (canEscolherEquipe) return ['Alfa', 'Bravo', 'Charlie', 'Delta'] as EquipeOpcao[];
    return equipePadrao ? [equipePadrao as EquipeOpcao] : [];
  }, [canEscolherEquipe, equipePadrao]);
  const auditoriaPessoas = useMemo<PessoaAuditoria[]>(
    () => montarPessoasAuditoria(bombeiros, usuarios),
    [bombeiros, usuarios],
  );
  const inputClass = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400 dark:focus:ring-aviation-400/10';
  const [view, setView] = useState<'lista' | 'wizard'>('lista');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erroValidacao, setErroValidacao] = useState('');
  const [showConfirmTroca, setShowConfirmTroca] = useState(false);
  const [trocaRecusadaIdx, setTrocaRecusadaIdx] = useState<number | null>(null);
  const [showConfirmCorreta, setShowConfirmCorreta] = useState(false);
  const [trocaConfirmadaIdx, setTrocaConfirmadaIdx] = useState<number | null>(null);
  const [showConfirmAdicionar, setShowConfirmAdicionar] = useState(false);
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroEquipeLista, setFiltroEquipeLista] = useState('');
  const [cloneOrigem, setCloneOrigem] = useState<LRODraft | null>(null);
  const [draftCountdowns, setDraftCountdowns] = useState<Record<string, string>>({});
  const [lroExpandidoId, setLroExpandidoId] = useState<string | null>(null);
  const camposEquipeEditadosRef = useRef<Set<string>>(new Set());
  const tutorialOrigemRef = useRef<{ view: 'lista' | 'wizard'; step: Step } | null>(null);

  function campoEquipeKey(grupo: string, key?: string): string {
    return key ? `${grupo}.${key}` : grupo;
  }

  function marcarCampoEquipeEditado(grupo: string, key?: string) {
    camposEquipeEditadosRef.current.add(campoEquipeKey(grupo, key));
  }

  function campoEquipeFoiEditado(grupo: string, key?: string): boolean {
    return camposEquipeEditadosRef.current.has(campoEquipeKey(grupo, key));
  }

  function limparMarcacoesEquipeEditada() {
    camposEquipeEditadosRef.current.clear();
  }

  function marcarEquipagemCarregada(grupo: string, valores: Record<string, unknown>) {
    Object.keys(valores || {}).forEach(key => marcarCampoEquipeEditado(grupo, key));
  }

  function canManageDraft(draft: LRODraft): boolean {
    const dados = draft.dados as Record<string, unknown>;
    return canEditarRegistroDiario(
      contexto,
      { createdBy: draft.created_by, equipe: draft.equipe || (dados?.equipeNome as string | undefined) || '' },
      username,
      bombeiros,
    );
  }

  function canDeleteDraft(draft: LRODraft): boolean {
    const dados = draft.dados as Record<string, unknown>;
    return canExcluirRegistroDiario(
      contexto,
      { createdBy: draft.created_by, equipe: draft.equipe || (dados?.equipeNome as string | undefined) || '' },
      username,
      bombeiros,
    );
  }

  function bloquearEquipeAtual(acao: string): boolean {
    if (canCriarRegistrosDiarios(contexto)) return false;
    setErroValidacao(`Você não tem permissão para ${acao} LRO.`);
    return true;
  }

  function limparCamposAutomaticosPlantao() {
    limparMarcacoesEquipeEditada();
    setChefeEquipe('');
    setComunicacao('');
    setEquipagemCCI({});
    setEquipagemCCIRT({});
    setEquipagemCRS({});
    setTrocasManuais([]);
    setSubstituicoesDetectadas([]);
  }

  function iniciarNovoLRO() {
    setDraftId(null);
    setDraftEmEdicaoStatus(null);
    setEquipe('');
    setDataInicio(hojeLocalISO());
    setDataFim('');
    setHouveTrocas(null);
    setTrocaSolicitante('');
    setTrocaSolicitado('');
    setTrocaDataFolga('');
    setTrocaMotivo('');
    limparCamposAutomaticosPlantao();
    setInstrucoes('');
    setInstrucoesHorarios('');
    setCentralFaisca('SEM ALTERAÇÕES');
    setRadioComunicacao('SEM ALTERAÇÕES');
    setTpTemAlteracao(false);
    setTpTexto('');
    setExtTemAlteracao(false);
    setExtTexto('');
    setEquipTemAlteracao(false);
    setEquipTexto('');
    setEdifTemAlteracao(false);
    setEdifTexto('');
    setEmergenciaXI('');
    setOcorrenciasNA('');
    setInspecoes('');
    setOutrasOcorrencias('');
    setSolicitacoesCCR('');
    setStep('equipe');
    setView('wizard');
    setErroValidacao('');
  }

  function tutorialIndexInicial(): number {
    if (view === 'lista') return 0;
    if (step === 'equipe') return 1;
    if (step === 'trocas') return 3;
    if (step === 'preencher') return 4;
    return 6;
  }

  function abrirTutorialLRO() {
    tutorialOrigemRef.current = { view, step };
    setTutorialStepIndex(tutorialIndexInicial());
    setShowTutorial(true);
  }

  function fecharTutorialLRO() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    if (origem) {
      setView(origem.view);
      setStep(origem.step);
      tutorialOrigemRef.current = null;
    }
  }

  function voltarTutorialLRO() {
    setTutorialStepIndex(prev => Math.max(0, prev - 1));
  }

  function avancarTutorialLRO() {
    if (tutorialStepIndex >= LRO_TOUR_STEPS.length - 1) {
      fecharTutorialLRO();
      return;
    }
    setTutorialStepIndex(prev => Math.min(prev + 1, LRO_TOUR_STEPS.length - 1));
  }

  useEffect(() => {
    if (!showTutorial) return;
    const tourStep = LRO_TOUR_STEPS[tutorialStepIndex] || LRO_TOUR_STEPS[0];
    if (tourStep.view !== view) setView(tourStep.view);
    if (tourStep.step && tourStep.step !== step) setStep(tourStep.step);
  }, [showTutorial, tutorialStepIndex, view, step]);

  function renderBotaoTutorialFlutuante() {
    if (showTutorial) return null;

    return (
      <button
        type="button"
        onClick={abrirTutorialLRO}
        aria-label="Abrir tutorial animado do LRO"
        title="Tutorial do LRO"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-aviation-600 to-aviation-700 text-white shadow-2xl shadow-aviation-500/30 transition-all hover:-translate-y-0.5 hover:from-aviation-500 hover:to-aviation-600 hover:shadow-aviation-500/40 focus:outline-none focus:ring-4 focus:ring-aviation-500/25 active:scale-95"
      >
        <HelpCircle className="h-7 w-7" />
      </button>
    );
  }

  useEffect(() => {
    if (!canEscolherEquipe && equipePadrao && equipe !== equipePadrao) {
      setEquipe(equipePadrao as EquipeOpcao);
    }
  }, [canEscolherEquipe, equipePadrao, equipe]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const next: Record<string, string> = {};
      drafts.forEach(d => {
        if (d.status !== 'rascunho' || !d.expires_at) return;
        const diff = new Date(d.expires_at).getTime() - now;
        if (diff <= 0) { next[d.id] = 'Excluindo...'; return; }
        const dias = Math.floor(diff / 86400000);
        const horas = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const segs = Math.floor((diff % 60000) / 1000);
        next[d.id] = `${dias}d ${String(horas).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(segs).padStart(2,'0')}`;
      });
      setDraftCountdowns(next);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [drafts]);

  const [vigencias, setVigencias] = useState<VigenciaSubstituicao[]>([]);
  const [vigenciasLoaded, setVigenciasLoaded] = useState(false);
  const carregarVigencias = useCallback(async () => {
    if (vigenciasLoaded) return;
    const v = await listarVigencias({ ativa: true }).catch(() => []);
    setVigencias(v);
    setVigenciasLoaded(true);
  }, [vigenciasLoaded]);

  useEffect(() => {
    async function load() {
      try {
        const [b, usuariosCadastrados, f, docs, a, ptrbRegistros, ptrbaCompletoRegistros, conferenciaRegistros, ocorrenciaRegistros, reaRegistros, escalasCompletasRegistros, escalasConfigsRegistros] = await Promise.all([
          listarAtivos(),
          listarUsuarios().catch(() => []),
          listarFeriasGozo(),
          listarDocumentos(),
          listarAPOCs(),
          listarPTRBs().catch(() => []),
          listarPTRBACompletos().catch(() => []),
          listarConferencias().catch(() => []),
          listarOcorrencias().catch(() => []),
          listarReas().catch(() => []),
          listarCompletasEscala().catch(() => []),
          listarConfigsEscala().catch(() => []),
        ]);
        setApocs(a);
        setBombeiros(b);
        setUsuarios(usuariosCadastrados);
        setFeriasGozo(f);
        setPtrbs(ptrbRegistros);
        setPtrbaCompletos(ptrbaCompletoRegistros);
        setEscalasCompletas(escalasCompletasRegistros);
        setEscalasConfigs(escalasConfigsRegistros);
        setConferencias(conferenciaRegistros);
        setOcorrenciasOperacionais(ocorrenciaRegistros);
        setReas(reaRegistros);

        // Load CCI + CRS viaturas
        const [cci, crs] = await Promise.all([listarViaturas({ tipo: 'CCI' }).catch(() => []), listarViaturas({ tipo: 'CRS' }).catch(() => [])]);
        const todasViaturas = [...cci, ...crs];
        setViaturas(todasViaturas);
        const frotaInit: Record<string, any> = {};
        todasViaturas.forEach((veiculo: any) => { frotaInit[veiculo.id || veiculo.prefixo] = { kmIni: '', kmFim: '', combIni: '', combFim: '', situacao: '' }; });
        setFrotaDados(frotaInit);

        // Load substitutes + troca documents (needed for substitution detection)
        const subs = await listarSubstituicoesTemporarias();
        setTodasSubstituicoes(subs);

        await carregarVigencias();

        const trocaDoc = docs.find((d: any) => d.name?.includes('TROCA') || d.source_module === 'trocas');
        if (trocaDoc) {
          setTrocaDocId(trocaDoc.id);
          const fills = await listarPreenchimentos({ documentId: trocaDoc.id });
          setTrocaFills(fills.filter(trocaFillVisivelNoLRO));
        } else {
          const todosFills = await Promise.all(docs.map((d: any) => listarPreenchimentos({ documentId: d.id }).catch(() => [])));
          const comNome = todosFills.flat().filter((fl: any) => {
            const fd = fl.filled_data || {};
            return trocaFillVisivelNoLRO(fl) && (fd.nome_solicitante || fd.nome_solicitado);
          });
          setTrocaFills(comNome);
        }
        const d = await listarDrafts('').catch(() => []);
        setDrafts(d);
        const saved = sessionStorage.getItem('lro_form_backup');
        if (saved) {
          try {
            const p = JSON.parse(saved);
            sessionStorage.removeItem('lro_form_backup');
            setStep(p.step || 'equipe');
            setEquipe(p.equipe || 'Alfa');
            setDataInicio(p.dataInicio || hojeLocalISO());
            setDataFim(p.dataFim || '');
            setChefeEquipe(p.chefeEquipe || '');
            setComunicacao(p.comunicacao || '');
            setEquipagemCCI(p.equipagemCCI || {});
            setEquipagemCCIRT(p.equipagemCCIRT || {});
            setEquipagemCRS(p.equipagemCRS || {});
            marcarCampoEquipeEditado('chefeEquipe');
            marcarCampoEquipeEditado('comunicacao');
            marcarEquipagemCarregada('equipagemCCI', p.equipagemCCI || {});
            marcarEquipagemCarregada('equipagemCCIRT', p.equipagemCCIRT || {});
            marcarEquipagemCarregada('equipagemCRS', p.equipagemCRS || {});
            setInstrucoes(p.instrucoes || '');
            setInstrucoesHorarios(p.instrucoesHorarios || '');
            setFrotaDados(p.frotaDados || {});
            setCentralFaisca(p.centralFaisca || 'SEM ALTERAÇÕES');
            setRadioComunicacao(p.radioComunicacao || 'SEM ALTERAÇÕES');
            setTpTemAlteracao(p.tpTemAlteracao || false);
            setTpTexto(p.tpTexto || '');
            setExtTemAlteracao(p.extTemAlteracao || false);
            setExtTexto(p.extTexto || '');
            setEquipTemAlteracao(p.equipTemAlteracao || false);
            setEquipTexto(p.equipTexto || '');
            setEdifTemAlteracao(p.edifTemAlteracao || false);
            setEdifTexto(p.edifTexto || '');
            setOcorrenciasNA(p.ocorrenciasNA || '');
            setInspecoes(p.inspecoes || '');
            setEmergenciaXI(p.emergenciaXI || '');
            setOutrasOcorrencias(p.outrasOcorrencias || '');
            setSolicitacoesCCR(p.solicitacoesCCR || '');
            setTrocaSolicitante(p.trocaSolicitante || '');
            setTrocaSolicitado(p.trocaSolicitado || '');
            if (p.trocasManuais) setTrocasManuais(p.trocasManuais);
            if (p.substituicoesDetectadas) setSubstituicoesDetectadas(p.substituicoesDetectadas);
            if (p.draftId) setDraftId(p.draftId);
            setDraftEmEdicaoStatus(p.draftEmEdicaoStatus || null);
            setView('wizard');
          } catch { /* ignore restore errors */ }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [username]);

  // Auto-detect trocas/substituições do dia e equipe selecionados
  useEffect(() => {
    if (!dataInicio) return;
    const pessoaPorNome = (nome: string) => {
      return buscarBombeiroPorTexto(nome, bombeiros);
    };
    const cobreEquipeAtual = (pessoa?: Bombeiro) => {
      if (!pessoa) return false;
      return vigencias.some(v => {
        if (!v.ativa || v.substitutoId !== pessoa.id) return false;
        if (!estaNoPeriodoISO(dataInicio, v.dataInicio, v.dataFim)) return false;
        const original = bombeiros.find((b: any) => b.id === v.funcionarioOriginalId);
        return (original?.equipe || v.equipe) === equipe;
      });
    };
    const pertenceEquipeAtual = (pessoa?: Bombeiro) => !!pessoa && (pessoa.equipe === equipe || cobreEquipeAtual(pessoa));
    const resultados: SubstituicaoDetectada[] = [];
    // De trocaFills (documento Troca de Serviço) — filtra pela data solicitada / folga do solicitado
    trocaFills.forEach((fl: any) => {
      const fd = fl.filled_data || {};
      const nomeSol = fd.nome_solicitante || '';
      const nomeSolic = fd.nome_solicitado || '';
      if (!nomeSol && !nomeSolic) return;
      const naDataSolicitada = mesmoDiaISO(fd.data_solicitada, dataInicio);
      const naDataFolga = mesmoDiaISO(fd.data_folga_solicitado, dataInicio);
      if (!naDataSolicitada && !naDataFolga) return;
      const substituido = naDataSolicitada ? nomeSol : nomeSolic;
      const substituto = naDataSolicitada ? nomeSolic : nomeSol;
      const pessoaSubstituida = pessoaPorNome(substituido);
      const pessoaSubstituta = pessoaPorNome(substituto);
      const pertenceEquipe = pertenceEquipeAtual(pessoaSubstituida) || pertenceEquipeAtual(pessoaSubstituta);
      if (pertenceEquipe) {
        resultados.push({
          id: fl.id,
          tipo: 'troca' as const,
          substituido,
          substituto,
          dataSolicitada: fd.data_solicitada || '',
          dataFolga: fd.data_folga_solicitado || '',
          confirmada: null,
        });
      }
    });
    // De todasSubstituicoes (substituições temporárias aprovadas) — filtra pela data
    todasSubstituicoes.forEach((s: any) => {
      if (s.status !== 'Aprovada') return;
      const dataSubstInicio = s.dataInicio || s.data_inicio || '';
      const dataSubstFim = s.dataFim || s.data_fim || dataSubstInicio;
      if (!estaNoPeriodoISO(dataInicio, dataSubstInicio, dataSubstFim)) return;

      if (s.tipo === 'Afastamento') {
        const dataPlantao = parseDataLocalISO(dataInicio);
        if (Number.isNaN(dataPlantao.getTime()) || !equipeEstaNoPlantao(equipe, dataPlantao)) return;
        (s.cadeiaSubstituicao || s.cadeia_substituicao || []).forEach((elo: any) => {
          if (elo.tipo !== 'extra') return;
          if (!mesmoDiaISO(elo.dataPlantao || elo.data_plantao || '', dataInicio)) return;
          const equipePlantao = elo.equipePlantao || elo.equipe_plantao || elo.funcionarioEquipe || elo.funcionario_equipe || '';
          if (equipePlantao && equipePlantao !== equipe) return;
          const nomeSubstituido = elo.funcionarioNome || elo.funcionario_nome || s.funcionarioNome || s.funcionario_nome || '';
          const nomeSubstituto = elo.substitutoNome || elo.substituto_nome || elo.pessoaNome || elo.pessoa_nome || s.substitutoNome || s.substituto_nome || '';
          if (!nomeSubstituido && !nomeSubstituto) return;
          resultados.push({ id: `${s.id}-${elo.dataPlantao || dataInicio}`, tipo: 'substituicao' as const, substituido: nomeSubstituido, substituto: nomeSubstituto, confirmada: null });
        });
        return;
      }

      const nomeSubstituido = s.funcionarioNome || s.funcionario_nome || '';
      const nomeSubstituto = s.substitutoNome || s.substituto_nome || '';
      if (!nomeSubstituido && !nomeSubstituto) return;
      const idSubstituido = s.funcionarioId || s.funcionario_id || '';
      const idSubstituto = s.substitutoId || s.substituto_id || '';
      const pessoaSubstituida = bombeiros.find((b: any) => b.id === idSubstituido) || pessoaPorNome(nomeSubstituido);
      const pessoaSubstituta = bombeiros.find((b: any) => b.id === idSubstituto) || pessoaPorNome(nomeSubstituto);
      const pertenceEquipe = pertenceEquipeAtual(pessoaSubstituida) || pertenceEquipeAtual(pessoaSubstituta);
      if (pertenceEquipe) {
        resultados.push({ id: s.id, tipo: 'substituicao' as const, substituido: nomeSubstituido, substituto: nomeSubstituto, confirmada: null });
      }
    });
    setSubstituicoesDetectadas(prev => {
      const confirmacoesAnteriores = new Map(prev.map(item => [chaveSubstituicaoDetectada(item), item.confirmada]));
      return resultados.map(item => {
        const confirmada = confirmacoesAnteriores.get(chaveSubstituicaoDetectada(item));
        return confirmada === undefined ? item : { ...item, confirmada };
      });
    });
  }, [dataInicio, equipe, trocaFills, todasSubstituicoes, bombeiros, vigencias]);

  const equipeInversa: Record<string, string> = { Alfa: 'Charlie', Charlie: 'Alfa', Bravo: 'Delta', Delta: 'Bravo' };

  // Auto-pull instructions from PTR-BA (por instrução ou completo) when team/date changes
  useEffect(() => {
    const ptrbsFiltrados = ptrbs
      .filter(p => p.equipe === equipe && p.data && p.data.startsWith(dataInicio))
      .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    const linhas: string[] = [];
    const horarios: string[] = [];
    const dedup = new Set<string>();
    if (ptrbsFiltrados.length === 0) {
      const completosFiltrados = ptrbaCompletos
        .filter(p => String(p.equipe) === equipe && p.data && p.data.startsWith(dataInicio))
        .sort((a, b) => (a.evidencias[0]?.horaInicio || '').localeCompare(b.evidencias[0]?.horaInicio || ''));
      completosFiltrados.forEach(p => {
        p.evidencias.forEach(ev => {
          const assunto = (ev.assunto || '').trim();
          const horario = ev.horaInicio || '';
          if (!assunto) return;
          const chave = `${assunto}|${horario}`;
          if (dedup.has(chave)) return;
          dedup.add(chave);
          linhas.push(assunto);
          horarios.push(horario);
        });
      });
    } else {
      ptrbsFiltrados.forEach(p => {
        const assunto = (p.assuntoMinistrado || '').trim();
        const horario = p.horaInicio || '';
        if (!assunto) return;
        const chave = `${assunto}|${horario}`;
        if (dedup.has(chave)) return;
        dedup.add(chave);
        linhas.push(assunto);
        horarios.push(horario);
      });
    }
    setInstrucoes(linhas.join('\n\n'));
    setInstrucoesHorarios(horarios);
  }, [equipe, dataInicio, ptrbs, ptrbaCompletos]);

  useEffect(() => {
    setDataFim(dataSaidaPlantao(equipe, dataInicio));
  }, [equipe, dataInicio]);

  const horarioBase = horarioPlantaoPorEquipe(equipe);
  const horarioPlantao = {
    inicio: horarioBase.horarioInicio,
    fim: horarioBase.horarioTermino,
    tipo: horarioBase.tipo,
  };

  function dataISO(value?: string): string {
    return normalizarDataISO(value);
  }

  function horaCurta(value?: string): string {
    const match = String(value || '').match(/\d{2}:\d{2}/);
    return match?.[0] || '';
  }

  function textoInline(value?: string): string {
    return String(value || '')
      .split('\n')
      .map(l => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  function linhaLRO(data: string, hora: string, equipeLinha: string, tipo: string, descricao: string): string {
    const descricaoLimpa = textoInline(descricao);
    if (!descricaoLimpa) return '';
    const cabecalho = [horaCurta(hora), textoInline(tipo)].filter(Boolean).join(' - ');
    return cabecalho ? `${cabecalho}\n${descricaoLimpa}` : descricaoLimpa;
  }

  function linhaLXII(hora: string, tipo: string, descricao: string): string {
    const descricaoLimpa = textoInline(descricao);
    if (!descricaoLimpa) return '';
    const cabecalho = [horaCurta(hora), textoInline(tipo)].filter(Boolean).join(' - ');
    return cabecalho ? `${cabecalho}\n${descricaoLimpa}` : descricaoLimpa;
  }

  function linhaBonaLRO(registro: Ocorrencia): string {
    const identificacao = [
      textoInline(registro.numero),
      textoInline(registro.titulo || registro.bonaDados?.tipoOcorrencia || 'BONA'),
    ].filter(Boolean).join(' - ');
    return linhaLRO(registro.data, registro.hora, registro.equipe, identificacao, registro.descricao);
  }

  function lancamentosParaTexto(valor: unknown): string {
    if (!Array.isArray(valor)) return String(valor || '');
    const items = (valor as string[]).filter(Boolean);
    if (items.length === 0) return '';
    if (items.some(x => x.includes('\n'))) return items.join('\n\n');
    const blocos: string[] = [];
    let atual: string[] = [];
    for (const linha of items) {
      if (/^\d{1,2}:\d{2}\s*-/.test(linha) && atual.length > 0) {
        blocos.push(atual.join('\n'));
        atual = [];
      }
      atual.push(linha);
    }
    if (atual.length > 0) blocos.push(atual.join('\n'));
    return blocos.join('\n\n');
  }

  function registroNoPlantaoAlvo(
    dataRegistro: string,
    horaRegistro: string,
    equipeRegistro: string,
    equipeAlvo: string,
    dataInicioAlvo: string,
    dataFimAlvo?: string,
    dataTurno?: string,
  ): boolean {
    if (!equipeAlvo || !dataInicioAlvo || equipeRegistro !== equipeAlvo) return false;
    const turnoInformado = dataISO(dataTurno);
    if (turnoInformado) return turnoInformado === dataInicioAlvo;

    const data = dataISO(dataRegistro);
    const hora = horaCurta(horaRegistro);
    if (!data) return false;

    const horario = horarioPlantaoPorEquipe(equipeAlvo);
    const dataFimResolvida = dataFimAlvo || dataSaidaPlantao(equipeAlvo, dataInicioAlvo);

    if (horario.turno === 'Noturno') {
      if (data === dataInicioAlvo && (!hora || hora >= horario.horarioInicio)) return true;
      if (data === dataFimResolvida && (!hora || hora < horario.horarioTermino)) return true;
      return false;
    }

    if (data !== dataInicioAlvo) return false;
    if (!hora) return true;
    return hora >= horario.horarioInicio && hora < horario.horarioTermino;
  }

  function registroNoPlantao(dataRegistro: string, horaRegistro: string, equipeRegistro: string, dataTurno?: string): boolean {
    return registroNoPlantaoAlvo(dataRegistro, horaRegistro, equipeRegistro, equipe, dataInicio, dataFim, dataTurno);
  }

  function ocorrenciaEntraNoLRO(registro: Ocorrencia, equipeAlvo: string, dataInicioAlvo: string, dataFimAlvo?: string): boolean {
    return !registro.numero?.trim() &&
      registroNoPlantaoAlvo(registro.data, registro.hora, registro.equipe, equipeAlvo, dataInicioAlvo, dataFimAlvo, registro.local);
  }

  const solicitacoesAutomaticas = useMemo(() => {
    return conferencias
      .filter(registro =>
        String(registro.tipo || '').toLowerCase().startsWith('solicita') &&
        registroNoPlantao(registro.dataConferencia, horaCurta(registro.dataConferencia), registro.equipe, registro.dataProximaInspecao)
      )
      .sort((a, b) => `${dataISO(a.dataConferencia)} ${horaCurta(a.dataConferencia)}`.localeCompare(`${dataISO(b.dataConferencia)} ${horaCurta(b.dataConferencia)}`))
      .map(registro => linhaLRO(
        dataISO(registro.dataConferencia),
        horaCurta(registro.dataConferencia),
        registro.equipe,
        registro.itemNome || 'Solicitação',
        registro.observacoes,
      ))
      .filter(Boolean)
      .join('\n\n');
  }, [conferencias, equipe, dataInicio, dataFim, horarioBase.turno, horarioPlantao.inicio, horarioPlantao.fim]);

  const inspecoesAutomaticas = useMemo(() => {
    return conferencias
      .filter(registro =>
        String(registro.tipo || '').toLowerCase().startsWith('inspe') &&
        registroNoPlantao(registro.dataConferencia, horaCurta(registro.dataConferencia), registro.equipe, registro.dataProximaInspecao)
      )
      .sort((a, b) => `${dataISO(a.dataConferencia)} ${horaCurta(a.dataConferencia)}`.localeCompare(`${dataISO(b.dataConferencia)} ${horaCurta(b.dataConferencia)}`))
      .map(registro => linhaLRO(
        dataISO(registro.dataConferencia),
        horaCurta(registro.dataConferencia),
        registro.equipe,
        registro.itemNome || 'Inspeção Operacional',
        registro.observacoes,
      ))
      .filter(Boolean)
      .join('\n\n');
  }, [conferencias, equipe, dataInicio, dataFim, horarioBase.turno, horarioPlantao.inicio, horarioPlantao.fim]);

  const ocorrenciasIncluidasNoLRO = useMemo(() => {
    return ocorrenciasOperacionais
      .filter(registro => ocorrenciaEntraNoLRO(registro, equipe, dataInicio, dataFim));
  }, [ocorrenciasOperacionais, equipe, dataInicio, dataFim]);

  const ocorrenciasAutomaticas = useMemo(() => {
    return [...ocorrenciasIncluidasNoLRO]
      .sort((a, b) => `${dataISO(a.data)} ${horaCurta(a.hora)}`.localeCompare(`${dataISO(b.data)} ${horaCurta(b.hora)}`))
      .map(registro => linhaLXII(
        registro.hora,
        registro.titulo || registro.categoria || 'Ocorrência',
        registro.descricao,
      ))
      .filter(Boolean)
      .join('\n\n');
  }, [ocorrenciasIncluidasNoLRO]);

  const bonaAutomaticas = useMemo(() => {
    return ocorrenciasOperacionais
      .filter(registro =>
        registro.tipoDocumento === 'BONA' &&
        registro.numero?.trim().startsWith('BONA') &&
        registroNoPlantao(registro.data, registro.hora, registro.equipe)
      )
      .sort((a, b) => `${dataISO(a.data)} ${horaCurta(a.hora)}`.localeCompare(`${dataISO(b.data)} ${horaCurta(b.hora)}`))
      .map(linhaBonaLRO)
      .filter(Boolean)
      .join('\n\n');
  }, [ocorrenciasOperacionais, equipe, dataInicio, dataFim, horarioBase.turno, horarioPlantao.inicio, horarioPlantao.fim]);

  const reaAutomaticas = useMemo(() => {
    return reas
      .filter(registro => registroNoPlantao(registro.dataAcidente, registro.horaAcidente, registro.equipe))
      .sort((a, b) => `${dataISO(a.dataAcidente)} ${horaCurta(a.horaAcidente)}`.localeCompare(`${dataISO(b.dataAcidente)} ${horaCurta(b.horaAcidente)}`))
      .map(registro => linhaLRO(registro.dataAcidente, registro.horaAcidente, '', '', registro.dados?.descricaoEmergencia || ''))
      .filter(Boolean)
      .join('\n');
  }, [reas, equipe, dataInicio, dataFim, horarioBase.turno, horarioPlantao.inicio, horarioPlantao.fim]);

  useEffect(() => {
    setSolicitacoesCCR(solicitacoesAutomaticas);
  }, [solicitacoesAutomaticas]);

  useEffect(() => {
    setInspecoes(inspecoesAutomaticas);
  }, [inspecoesAutomaticas]);

  useEffect(() => {
    setOutrasOcorrencias(ocorrenciasAutomaticas);
  }, [ocorrenciasAutomaticas]);

  useEffect(() => {
    setOcorrenciasNA(bonaAutomaticas);
  }, [bonaAutomaticas]);

  useEffect(() => {
    setEmergenciaXI(reaAutomaticas);
  }, [reaAutomaticas]);

  function idsOcorrenciasIncluidasNoTextoAtual(): string[] {
    const textoAtual = Array.isArray(outrasOcorrencias)
      ? outrasOcorrencias.join('\n\n')
      : String(outrasOcorrencias || '');
    const textoAtualNormalizado = textoInline(textoAtual);

    return Array.from(new Set(ocorrenciasIncluidasNoLRO
      .filter(registro => {
        const linha = linhaLXII(registro.hora, registro.titulo || registro.categoria || 'Ocorrência', registro.descricao);
        if (!linha) return false;
        return textoAtual.includes(linha) || textoAtualNormalizado.includes(textoInline(linha));
      })
      .map(registro => registro.id)));
  }

  const membrosEquipe = useMemo(() => {
    return bombeiros.filter(b => b.equipe === equipe && !b.dataDesligamento);
  }, [bombeiros, equipe]);

  const bombeiroPorId = useMemo(() => new Map(bombeiros.map(b => [b.id, b])), [bombeiros]);

  const emFerias = useMemo(() => {
    return feriasGozo.filter(f =>
      f.equipe === equipe &&
      f.status !== 'Gozadas' &&
      estaNoPeriodoISO(dataInicio, f.dataInicio, f.dataFim)
    );
  }, [feriasGozo, equipe, dataInicio]);

  const feriasIds = useMemo(() => new Set(emFerias.map(f => f.funcionarioId)), [emFerias]);

  const formatarFeriasComCargo = useCallback((ferias: FeriasGozo): string => {
    const bombeiro = bombeiroPorId.get(ferias.funcionarioId);
    const cargo = ferias.funcaoSubstituicao || bombeiro?.cargo || '';
    const nome = bombeiro?.nomeGuerra || ferias.funcionarioNome;
    return cargo ? `${cargo} ${nome}` : nome;
  }, [bombeiroPorId]);

  function getNomeGuerra(nome: string): string {
    if (!nome) return '';
    const b = bombeiros.find(p => p.nomeCompleto === nome || p.nomeGuerra === nome);
    return b?.nomeGuerra || nome;
  }

  function buscarBombeiroPorNome(nome: string): Bombeiro | undefined {
    return buscarBombeiroPorTexto(nome, bombeiros);
  }

  function trocaFillVisivelNoLRO(fill: any): boolean {
    const status = String(fill?.status || '');
    if (!STATUS_TROCA_ENTRA_LRO.has(status)) return false;
    const fd = fill?.filled_data || {};
    return !!(fd.nome_solicitante || fd.nome_solicitado);
  }

  const substituicoesMap = useMemo(() => {
    if (!dataInicio) return {};
    const map: Record<string, SubstituicaoInfo> = {};
    const registrar = (
      ausente: Bombeiro | undefined,
      substituto: Bombeiro | undefined,
      tipo: 'troca' | 'substituicao',
      cargoExercido?: string,
      substituidoEfetivo?: Partial<Pick<SubstituicaoInfo, 'substituidoId' | 'substituidoNome' | 'cargoSubstituido' | 'equipeSubstituido'>>,
      origem: SubstituicaoOrigem = tipo,
      substituidoSaiDoPlantao = origem !== 'cascata',
    ) => {
      if (!ausente || !substituto || ausente.id === substituto.id) return;
      map[ausente.id] = {
        substitutoNome: substituto.nomeGuerra || substituto.nomeCompleto,
        substitutoId: substituto.id,
        tipo,
        origem,
        substituidoId: substituidoEfetivo?.substituidoId || ausente.id,
        substituidoNome: substituidoEfetivo?.substituidoNome || ausente.nomeGuerra || ausente.nomeCompleto,
        cargoSubstituido: substituidoEfetivo?.cargoSubstituido || ausente.cargo,
        equipeSubstituido: substituidoEfetivo?.equipeSubstituido || ausente.equipe,
        cargoExercido: cargoExercido || substituidoEfetivo?.cargoSubstituido || ausente.cargo,
        substituidoSaiDoPlantao,
      };
    };

    // De vigências (férias/cascata/substituições salvas) — original ausente -> substituto presente
    vigencias.forEach(v => {
      if (!v.ativa || !v.substitutoId || v.substitutoId === v.funcionarioOriginalId) return;
      if (!estaNoPeriodoISO(dataInicio, v.dataInicio, v.dataFim)) return;
      const original = bombeiros.find((b: any) => b.id === v.funcionarioOriginalId);
      const substituto = bombeiros.find((b: any) => b.id === v.substitutoId || b.nomeGuerra === v.substitutoNome || b.nomeCompleto === v.substitutoNome);
      if ((original?.equipe || v.equipe) !== equipe) return;
      const origem = (v.motivo || 'substituicao') as SubstituicaoOrigem;
      registrar(original, substituto, 'substituicao', v.cargoExercido, {
        substituidoId: v.funcionarioOriginalId,
        substituidoNome: v.funcionarioOriginalNome,
        cargoSubstituido: v.cargoOriginalFuncionario,
        equipeSubstituido: original?.equipe || v.equipe,
      }, origem, origem !== 'cascata');
    });
    // De todasSubstituicoes (substituições temporárias) — filtra pelo período do plantão
    todasSubstituicoes.forEach((s: any) => {
      if (s.status && s.status !== 'Aprovada') return;
      const dataSubstInicio = s.dataInicio || s.data_inicio || '';
      const dataSubstFim = s.dataFim || s.data_fim || dataSubstInicio;
      if (!estaNoPeriodoISO(dataInicio, dataSubstInicio, dataSubstFim)) return;

      if (s.tipo === 'Afastamento') {
        const dataPlantao = parseDataLocalISO(dataInicio);
        if (Number.isNaN(dataPlantao.getTime()) || !equipeEstaNoPlantao(equipe, dataPlantao)) return;
        (s.cadeiaSubstituicao || s.cadeia_substituicao || []).forEach((elo: any) => {
          if (elo.tipo !== 'extra') return;
          if (!mesmoDiaISO(elo.dataPlantao || elo.data_plantao || '', dataInicio)) return;
          const equipePlantao = elo.equipePlantao || elo.equipe_plantao || elo.funcionarioEquipe || elo.funcionario_equipe || '';
          if (equipePlantao && equipePlantao !== equipe) return;
          const idSubstituido = elo.funcionarioId || elo.funcionario_id || s.funcionarioId || s.funcionario_id || '';
          const idSubstituto = elo.substitutoId || elo.substituto_id || elo.pessoaId || elo.pessoa_id || s.substitutoId || s.substituto_id || '';
          const ausente = bombeiros.find((b: any) => b.id === idSubstituido);
          const substituto = bombeiros.find((b: any) =>
            b.id === idSubstituto ||
            b.nomeGuerra === (elo.substitutoNome || elo.substituto_nome || elo.pessoaNome || elo.pessoa_nome) ||
            b.nomeCompleto === (elo.substitutoNome || elo.substituto_nome || elo.pessoaNome || elo.pessoa_nome)
          );
          registrar(ausente, substituto, 'substituicao', elo.cargoExercido || elo.cargo_exercido || elo.cargoVacante || elo.cargo_vacante || s.funcionarioCargo || s.funcionario_cargo || ausente?.cargo, {
            substituidoId: ausente?.id,
            substituidoNome: ausente?.nomeGuerra || ausente?.nomeCompleto,
            cargoSubstituido: elo.funcionarioCargo || elo.funcionario_cargo || s.funcionarioCargo || s.funcionario_cargo || ausente?.cargo,
            equipeSubstituido: equipePlantao || ausente?.equipe,
          }, 'afastamento');
        });
        return;
      }

      const idSubstituido = s.funcionarioId || s.funcionario_id || '';
      const idSubstituto = s.substitutoId || s.substituto_id || '';
      const ausente = bombeiros.find((b: any) => b.id === idSubstituido);
      if (ausente?.equipe !== equipe) return;
      const substituto = bombeiros.find((b: any) =>
        b.id === idSubstituto ||
        b.nomeGuerra === (s.substitutoNome || s.substituto_nome) ||
        b.nomeCompleto === (s.substitutoNome || s.substituto_nome)
      );
      registrar(ausente, substituto, 'substituicao', s.funcionarioCargo || s.funcionario_cargo || ausente?.cargo, undefined, 'substituicao');
    });
    // De trocas detectadas (aprovadas ou pendentes no LRO) — solicitante/solicitado alternam conforme a data
    substituicoesDetectadas
      .filter(s => s.tipo === 'troca' && s.confirmada !== false)
      .forEach(s => {
        const ausente = buscarBombeiroPorNome(s.substituido);
        const substituto = buscarBombeiroPorNome(s.substituto);
        const coberturaAnterior = ausente
          ? Object.values(map).find(info => info.substitutoId === ausente.id)
          : undefined;
        const equipeEfetivaAusente = coberturaAnterior?.equipeSubstituido || ausente?.equipe;
        if (equipeEfetivaAusente !== equipe) return;
        registrar(ausente, substituto, 'troca', coberturaAnterior?.cargoExercido || coberturaAnterior?.cargoSubstituido || ausente?.cargo, coberturaAnterior, 'troca');
    });
    // De trocasManuais (troca emergencial) — solicitante sai, solicitado entra
    trocasManuais.forEach(tm => {
      const solicitante = buscarBombeiroPorNome(tm.solicitante);
      const solicitado = buscarBombeiroPorNome(tm.solicitado);
      const coberturaAnterior = solicitante
        ? Object.values(map).find(info => info.substitutoId === solicitante.id)
        : undefined;
      const equipeEfetivaSolicitante = coberturaAnterior?.equipeSubstituido || solicitante?.equipe;
      if (equipeEfetivaSolicitante !== equipe) return;
      registrar(solicitante, solicitado, 'troca', coberturaAnterior?.cargoExercido || coberturaAnterior?.cargoSubstituido || solicitante?.cargo, coberturaAnterior, 'manual');
    });
    return map;
  }, [dataInicio, vigencias, todasSubstituicoes, substituicoesDetectadas, trocasManuais, bombeiros, equipe]);

  const substituicoesPorSubstituto = useMemo(() => {
    const map: Record<string, SubstituicaoInfo> = {};
    Object.values(substituicoesMap).forEach(info => {
      if (info.substitutoId) map[info.substitutoId] = info;
    });
    return map;
  }, [substituicoesMap]);

  const substituidosAusentesIds = useMemo(() => {
    return new Set(
      Object.entries(substituicoesMap)
        .filter(([, sub]) => sub.substituidoSaiDoPlantao !== false)
        .map(([id]) => id)
    );
  }, [substituicoesMap]);

  const pessoaSaiuDoPlantao = useCallback((bombeiro?: Bombeiro): boolean => {
    return !!bombeiro && (feriasIds.has(bombeiro.id) || substituidosAusentesIds.has(bombeiro.id));
  }, [feriasIds, substituidosAusentesIds]);

  const disponiveis = useMemo(() => {
    const idsAdicionados = new Set<string>();
    const presentes = membrosEquipe.filter(b => {
      if (feriasIds.has(b.id) || substituidosAusentesIds.has(b.id)) return false;
      idsAdicionados.add(b.id);
      return true;
    });
    Object.values(substituicoesMap).forEach(sub => {
      if ((sub.equipeSubstituido || '') !== equipe) return;
      if (feriasIds.has(sub.substitutoId) || substituidosAusentesIds.has(sub.substitutoId)) return;
      const substituto = bombeiros.find((b: any) =>
        b.id === sub.substitutoId ||
        b.nomeGuerra === sub.substitutoNome ||
        b.nomeCompleto === sub.substitutoNome
      );
      if (substituto && !idsAdicionados.has(substituto.id)) {
        presentes.push(substituto);
        idsAdicionados.add(substituto.id);
      }
    });
    return presentes;
  }, [membrosEquipe, feriasIds, substituidosAusentesIds, substituicoesMap, bombeiros, equipe]);

  const efetivoDisponivel = useMemo<EfetivoDisponivel[]>(() => {
    return disponiveis.map(bombeiro => {
      const substituicao = substituicoesPorSubstituto[bombeiro.id];
      return {
        bombeiro,
        cargoExercido: substituicao?.cargoExercido || substituicao?.cargoSubstituido || bombeiro.cargo,
      };
    });
  }, [disponiveis, substituicoesPorSubstituto]);

  const cargoExercidoPorId = useMemo(() => {
    return new Map(efetivoDisponivel.map(entry => [entry.bombeiro.id, entry.cargoExercido]));
  }, [efetivoDisponivel]);

  const cargoExercidoNoPlantao = useCallback((bombeiro?: Bombeiro): string => {
    if (!bombeiro) return '';
    return cargoExercidoPorId.get(bombeiro.id) ||
      substituicoesPorSubstituto[bombeiro.id]?.cargoExercido ||
      substituicoesPorSubstituto[bombeiro.id]?.cargoSubstituido ||
      bombeiro.cargo;
  }, [cargoExercidoPorId, substituicoesPorSubstituto]);

  const formatarOpcaoEfetivo = useCallback((entry: EfetivoDisponivel): { value: string; label: string } => {
    const { bombeiro, cargoExercido } = entry;
    const cargoLabel = cargoExercido && cargoExercido !== bombeiro.cargo
      ? `${bombeiro.cargo} -> ${cargoExercido}`
      : cargoExercido || bombeiro.cargo;
    return {
      value: bombeiro.nomeGuerra,
      label: `${bombeiro.nomeGuerra} - ${bombeiro.nomeCompleto} (${cargoLabel})`,
    };
  }, []);

  const formatarOpcaoNomeEfetivo = useCallback((entry: EfetivoDisponivel): { value: string; label: string } => {
    return {
      value: entry.bombeiro.nomeGuerra,
      label: `${entry.bombeiro.nomeGuerra} - ${entry.bombeiro.nomeCompleto}`,
    };
  }, []);

  const buscarEfetivoDisponivelPorNome = useCallback((nome: string): EfetivoDisponivel | undefined => {
    const bombeiro = buscarBombeiroPorNome(nome);
    return bombeiro
      ? efetivoDisponivel.find(entry => entry.bombeiro.id === bombeiro.id)
      : undefined;
  }, [efetivoDisponivel, bombeiros]);

  const labelCargoNoPlantao = useCallback((bombeiro?: Bombeiro): string => {
    if (!bombeiro) return '';
    const cargoExercido = cargoExercidoNoPlantao(bombeiro);
    return cargoExercido && cargoExercido !== bombeiro.cargo
      ? `${bombeiro.cargo} -> ${cargoExercido}`
      : cargoExercido || bombeiro.cargo;
  }, [cargoExercidoNoPlantao]);

  const podeAtuarComoComunicacao = useCallback((entry: EfetivoDisponivel): boolean => {
    return entry.cargoExercido !== 'BA-CE' && entry.cargoExercido !== 'BA-LR';
  }, []);

  const substituicoesAtivas = useMemo(() => {
    return vigencias.filter(v => {
      const original = bombeiroPorId.get(v.funcionarioOriginalId);
      return v.ativa &&
        v.substitutoId &&
        v.substitutoId !== v.funcionarioOriginalId &&
        estaNoPeriodoISO(dataInicio, v.dataInicio, v.dataFim) &&
        (original?.equipe || v.equipe) === equipe;
    }).map(v => ({
      nomeAusente: v.funcionarioOriginalNome,
      cargoAusente: v.cargoOriginalFuncionario,
      nomePresente: v.substitutoNome,
      cargoPresente: v.cargoExercido,
      motivo: v.motivo,
      nivel: v.nivelCascata,
    }));
  }, [vigencias, bombeiroPorId, equipe, dataInicio]);

  const temSubstituicoesBa = useMemo(() => {
    return substituicoesAtivas.length > 0 ||
      substituicoesDetectadas.some(s => s.tipo === 'troca' && s.confirmada !== false) ||
      trocasManuais.length > 0;
  }, [substituicoesAtivas, substituicoesDetectadas, trocasManuais]);

  // Auto-preenche o Chefe de Equipe, BA-OC e a equipagem (CCI 2, CCI 3, CRS) a partir da escala mensal do dia,
  // aplicando trocas/substituições no lugar das pessoas substituídas
  useEffect(() => {
    if (!dataInicio || !equipe) return;
    const mes = parseInt(dataInicio.substring(5, 7), 10);
    const ano = parseInt(dataInicio.substring(0, 4), 10);
    const configEscala = escalasConfigs.find(c => c.equipe === equipe && c.mes === mes && c.ano === ano);
    const completa = escalasCompletas.find(c => c.config?.equipe === equipe && c.config?.mes === mes && c.config?.ano === ano);
    const parada = completa?.paradas.find(p => mesmoDiaISO(p.data, dataInicio)) || completa?.paradas[0];
    const pessoas = configEscala?.pessoas || completa?.config?.pessoas || [];

    const resolvePessoa = (id: string | undefined, nomeGuerra: string | undefined, visitados = new Set<string>()): string => {
      const b = (id ? bombeiros.find((x: any) => x.id === id) : undefined) ||
        (nomeGuerra ? buscarBombeiroPorNome(nomeGuerra) : undefined);
      if (!b) return nomeGuerra || '';
      if (visitados.has(b.id)) return b.nomeGuerra || nomeGuerra || '';
      const sub = substituicoesMap[b.id];
      if (sub && sub.substituidoSaiDoPlantao !== false) {
        const substituto = bombeiros.find((x: any) =>
          x.id === sub.substitutoId ||
          x.nomeGuerra === sub.substitutoNome ||
          x.nomeCompleto === sub.substitutoNome
        );
        const proximosVisitados = new Set(visitados);
        proximosVisitados.add(b.id);
        return substituto
          ? resolvePessoa(substituto.id, substituto.nomeGuerra, proximosVisitados)
          : sub.substitutoNome;
      }
      return b.nomeGuerra || '';
    };

    const nomeSeExerceChefe = (id: string | undefined, nomeGuerra: string | undefined): string => {
      const nomeFinal = resolvePessoa(id, nomeGuerra);
      const bombeiroFinal = buscarBombeiroPorNome(nomeFinal);
      const entryFinal = bombeiroFinal
        ? efetivoDisponivel.find(entry => entry.bombeiro.id === bombeiroFinal.id)
        : undefined;
      return entryFinal?.cargoExercido === 'BA-CE' ? nomeFinal : '';
    };

    // 1.1 Chefe de Equipe — usa apenas quem está exercendo BA-CE no plantão.
    const nomeChefeDaEscala = (() => {
      const slotChefe = pessoas.find(p =>
        p.funcao === 'chefe' ||
        (p.veiculo === 'cciF2' && p.funcaoNoVeiculo === 'BaCe')
      );
      return slotChefe?.nomeGuerra ? nomeSeExerceChefe(slotChefe.id, slotChefe.nomeGuerra) : '';
    })();
    const nomeChefeEfetivo = efetivoDisponivel.find(entry => entry.cargoExercido === 'BA-CE')?.bombeiro.nomeGuerra || '';
    const chefeAtual = buscarBombeiroPorNome(chefeEquipe);
    const chefeAtualSaiu = pessoaSaiuDoPlantao(chefeAtual);
    const chefeAtualPresente = !!chefeAtual && disponiveis.some(b => b.id === chefeAtual.id);
    const candidatoChefe = [nomeChefeDaEscala, nomeChefeEfetivo].find(Boolean) || '';
    if (!campoEquipeFoiEditado('chefeEquipe') && candidatoChefe && (!chefeEquipe || chefeAtualSaiu || !chefeAtualPresente) && candidatoChefe !== chefeEquipe) {
      setChefeEquipe(candidatoChefe);
    }

    // 1.2 Comunicação BA-OC — comunicante do plantão (rádio fixo da parada do dia)
    const comunicacaoAtual = buscarBombeiroPorNome(comunicacao);
    const comunicacaoAtualSaiu = pessoaSaiuDoPlantao(comunicacaoAtual);
    if (!campoEquipeFoiEditado('comunicacao') && (!comunicacao || comunicacaoAtualSaiu) && parada?.radio) {
      const radioOrdenada = [
        ...parada.radio.filter(r => r.fixo),
        ...parada.radio.filter(r => !r.fixo),
      ];
      const comunicante = radioOrdenada.find(r => {
        const nomeReal = resolvePessoa(undefined, r.pessoaNomeGuerra);
        const entry = buscarEfetivoDisponivelPorNome(nomeReal);
        return !!entry && podeAtuarComoComunicacao(entry);
      });
      if (comunicante?.pessoaNomeGuerra && comunicante.pessoaNomeGuerra !== '-') {
        const nomeReal = resolvePessoa(undefined, comunicante.pessoaNomeGuerra);
        if (nomeReal) {
          setComunicacao(nomeReal);
        }
      } else {
        const fallbackComunicacao = efetivoDisponivel.find(podeAtuarComoComunicacao);
        if (fallbackComunicacao) setComunicacao(fallbackComunicacao.bombeiro.nomeGuerra);
      }
    }

    // 1.3 Equipagem dos CCI — pessoas da escala (CCI F2, CCI F3, CRS), aplicando trocas
    if (!pessoas.length) return;

    const slotPorFuncao: Record<string, Record<string, string>> = {
      cciF2: { BaCe: 'BA-CE_0', BaMc: 'BA-MC_1', Ba2: 'BA-2_2' },
      cciF3: { BaMc: 'BA-MC_0', 'Ba2-1': 'BA-2_1', 'Ba2-2': 'BA-2_2' },
      crs: { BaLr: 'BA-LR_0', BaMc: 'BA-MC_1', 'Ba2-1': 'BA-RE_2', 'Ba2-2': 'BA-RE_3' },
    };
    const cargoEsperadoPorSlot = (slotKey: string): string => slotKey.startsWith('BA-RE') ? 'BA-2' : slotKey.split('_')[0];
    const novoCCI: Record<string, string> = {};
    const novoCCIRT: Record<string, string> = {};
    const novoCRS: Record<string, string> = {};
    const originalCCI: Record<string, string> = {};
    const originalCCIRT: Record<string, string> = {};
    const originalCRS: Record<string, string> = {};
    const alvo: Record<string, Record<string, string>> = { cciF2: novoCCI, cciF3: novoCCIRT, crs: novoCRS };
    const originais: Record<string, Record<string, string>> = { cciF2: originalCCI, cciF3: originalCCIRT, crs: originalCRS };
    const nomesUsadosEquipagem = new Set<string>();

    const preencherSlot = (veiculo: string, slotKey: string, entry?: EfetivoDisponivel): boolean => {
      if (!entry || nomesUsadosEquipagem.has(entry.bombeiro.nomeGuerra)) return false;
      if (entry.cargoExercido !== cargoEsperadoPorSlot(slotKey)) return false;
      alvo[veiculo][slotKey] = entry.bombeiro.nomeGuerra;
      nomesUsadosEquipagem.add(entry.bombeiro.nomeGuerra);
      return true;
    };

    pessoas.forEach(p => {
      const slotKey = slotPorFuncao[p.veiculo]?.[p.funcaoNoVeiculo];
      if (!slotKey) return;
      originais[p.veiculo][slotKey] = p.nomeGuerra;
      const nomeFinal = resolvePessoa(p.id, p.nomeGuerra);
      preencherSlot(p.veiculo, slotKey, buscarEfetivoDisponivelPorNome(nomeFinal));
    });

    Object.entries(slotPorFuncao).forEach(([veiculo, slots]) => {
      Object.values(slots).forEach(slotKey => {
        if (alvo[veiculo][slotKey]) return;
        const cargoEsperado = cargoEsperadoPorSlot(slotKey);
        const candidato = efetivoDisponivel.find(entry =>
          entry.cargoExercido === cargoEsperado &&
          !nomesUsadosEquipagem.has(entry.bombeiro.nomeGuerra)
        );
        preencherSlot(veiculo, slotKey, candidato);
      });
    });

    const mesclarAuto = (
      atual: Record<string, string>,
      novo: Record<string, string>,
      original: Record<string, string>,
      grupo: string,
    ) => {
      const next = { ...atual };
      const keys = new Set([...Object.keys(novo), ...Object.keys(original), ...Object.keys(atual)]);
      keys.forEach(key => {
        if (campoEquipeFoiEditado(grupo, key)) return;
        const nomeFinal = novo[key] || '';
        const valorAtual = next[key] || '';
        const bombeiroAtual = buscarBombeiroPorNome(valorAtual);
        const atualSaiu = pessoaSaiuDoPlantao(bombeiroAtual);
        if (nomeFinal && (!valorAtual || valorAtual === original[key] || atualSaiu || !bombeiroAtual)) {
          next[key] = nomeFinal;
        } else if (!nomeFinal && atualSaiu) {
          next[key] = '';
        }
      });
      return next;
    };

    const registrosIguais = (a: Record<string, string>, b: Record<string, string>) => {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      return Array.from(keys).every(key => (a[key] || '') === (b[key] || ''));
    };

    const nextCCI = mesclarAuto(equipagemCCI, novoCCI, originalCCI, 'equipagemCCI');
    const nextCCIRT = mesclarAuto(equipagemCCIRT, novoCCIRT, originalCCIRT, 'equipagemCCIRT');
    const nextCRS = mesclarAuto(equipagemCRS, novoCRS, originalCRS, 'equipagemCRS');
    if (!registrosIguais(nextCCI, equipagemCCI)) setEquipagemCCI(nextCCI);
    if (!registrosIguais(nextCCIRT, equipagemCCIRT)) setEquipagemCCIRT(nextCCIRT);
    if (!registrosIguais(nextCRS, equipagemCRS)) setEquipagemCRS(nextCRS);
  }, [dataInicio, equipe, escalasConfigs, escalasCompletas, substituicoesMap, disponiveis, efetivoDisponivel, cargoExercidoNoPlantao, buscarEfetivoDisponivelPorNome, podeAtuarComoComunicacao, pessoaSaiuDoPlantao, bombeiros, chefeEquipe, comunicacao, equipagemCCI, equipagemCCIRT, equipagemCRS]);

  function montarSubstituicoesLRO() {
    const cargoNoPlantao = (pessoa?: Bombeiro) => pessoa ? (cargoExercidoNoPlantao(pessoa) || pessoa.cargo) : 'BA-2';
    const porTexto = (texto: string) => buscarBombeiroPorNome(texto);
    const porNomeSelecionado = (nome: string) => bombeiros.find((b: any) =>
      b.nomeGuerra === nome ||
      b.nomeCompleto === nome
    );

    return [
      ...substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada !== false).map(s => {
        const p1 = porTexto(s.substituido);
        const p2 = porTexto(s.substituto);
        return { funcao1: cargoNoPlantao(p1), nome1: p1?.nomeCompleto || s.substituido, funcao2: cargoNoPlantao(p2), nome2: p2?.nomeCompleto || s.substituto };
      }),
      ...trocasManuais.filter(tm => tm.solicitante && tm.solicitado).map(tm => {
        const p1 = porNomeSelecionado(tm.solicitante);
        const p2 = porNomeSelecionado(tm.solicitado);
        return { funcao1: cargoNoPlantao(p1), nome1: p1?.nomeCompleto || tm.solicitante, funcao2: cargoNoPlantao(p2), nome2: p2?.nomeCompleto || tm.solicitado };
      }),
    ];
  }

  async function handleSalvarRascunho() {
    if (bloquearEquipeAtual('salvar')) return;
    setSaving(true);
    try {
      const dados = {
        equipeNome: equipe,
        dataInicio, dataFim,
        chefeEquipe, comunicacao,
        instrucoes: Array.isArray(instrucoes) ? instrucoes : (typeof instrucoes === 'string' ? instrucoes.split('\n').filter(Boolean) : []),
        instrucoesHorarios: Array.isArray(instrucoesHorarios) ? instrucoesHorarios : (typeof instrucoesHorarios === 'string' ? instrucoesHorarios.split('\n').filter(Boolean) : []),
        frota: Array.from({ length: FROTA_ROWS }).map((_, i) => {
          const d = frotaDados[`row_${i}`] || EMPTY_FROTA_LINHA;
          const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
          const sel = frotaLista.find((vv: any) => vv.id === d.viaturaId);
          return { viatura: sel?.prefixo || sel?.nome || (i === FROTA_ROWS - 1 ? '' : '—'), viaturaId: d.viaturaId || '', prefixo: d.prefixo || '', kmIni: d.kmIni || '', kmFim: d.kmFim || '', combIni: normalizarPercentualCombustivel(d.combIni), combFim: normalizarPercentualCombustivel(d.combFim), situacao: d.situacao || '' };
        }),
        centralFaisca, radioComunicacao,
        tpTemAlteracao, tpTexto,
        extTemAlteracao, extTexto,
        equipTemAlteracao, equipTexto,
        edifTemAlteracao, edifTexto,
        ocorrenciasNA, inspecoes,
        emergenciaXI,
        ocorrenciasXII: Array.isArray(outrasOcorrencias) ? outrasOcorrencias : dividirEmLancamentos(outrasOcorrencias || ''),
        solicitacoes: dividirEmLancamentos(solicitacoesCCR),
        substituicao: montarSubstituicoesLRO(),
        cci2: Object.entries(equipagemCCI).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        cci3: Object.entries(equipagemCCIRT).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        crs: Object.entries(equipagemCRS).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        dataAssinatura: formatarDataBR(new Date()),
        chefeAssinatura: bombeiros.find((b: any) => b.nomeGuerra === chefeEquipe || b.nomeCompleto === chefeEquipe)?.nomeCompleto || chefeEquipe,
        gerenteAssinatura: bombeiros.find((b: any) => b.cargo === 'GS')?.nomeCompleto || bombeiros.find((b: any) => b.cargo === 'GS')?.nomeGuerra || '',
        coordenadorAssinatura: apocs.find((a: any) => a.funcao === 'SUPERVISOR')?.nomeCompleto || '',
        _trocasManuais: trocasManuais,
        _substituicoesDetectadas: substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada !== false),
        _ocorrenciasOperacionaisIds: idsOcorrenciasIncluidasNoTextoAtual(),
        substituicoesAtivas,
      };
      const saved = await salvarDraft(dados, equipe, dataInicio, username, draftId || undefined);
      setDraftId(saved.id);
      if (draftEmEdicaoStatus && draftEmEdicaoStatus !== 'rascunho') {
        await atualizarStatus(saved.id, 'rascunho', undefined, username);
        setDraftEmEdicaoStatus('rascunho');
      }
      const updated = await listarDrafts('').catch(() => []);
      setDrafts(updated);
      setView('lista');
      setStep('equipe');
      setErroValidacao('');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setErroValidacao(`Erro ao salvar rascunho: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
    setSaving(false);
  }

  async function handleGerarLRO() {
    if (bloquearEquipeAtual('gerar')) return;
    setSaving(true);
    try {
      const dados = {
        equipeNome: equipe,
        dataInicio, dataFim,
        chefeEquipe, comunicacao,
        frota: Array.from({ length: FROTA_ROWS }).map((_, i) => {
          const d = frotaDados[`row_${i}`] || EMPTY_FROTA_LINHA;
          const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
          const sel = frotaLista.find((vv: any) => vv.id === d.viaturaId);
          return { viatura: sel?.prefixo || sel?.nome || (i === FROTA_ROWS - 1 ? '' : '—'), viaturaId: d.viaturaId || '', prefixo: d.prefixo || '', kmIni: d.kmIni || '', kmFim: d.kmFim || '', combIni: normalizarPercentualCombustivel(d.combIni), combFim: normalizarPercentualCombustivel(d.combFim), situacao: d.situacao || '' };
        }),
        instrucoes: Array.isArray(instrucoes) ? instrucoes : (typeof instrucoes === 'string' ? instrucoes.split('\n').filter(Boolean) : []),
        instrucoesHorarios: Array.isArray(instrucoesHorarios) ? instrucoesHorarios : (typeof instrucoesHorarios === 'string' ? instrucoesHorarios.split('\n').filter(Boolean) : []),
        centralFaisca: centralFaisca || 'SEM ALTERAÇÕES',
        radioComunicacao: radioComunicacao || 'SEM ALTERAÇÕES',
        tpTexto, extTexto, equipTexto, edifTexto,
        emergenciaXI,
        ocorrenciasXII: Array.isArray(outrasOcorrencias) ? outrasOcorrencias : dividirEmLancamentos(outrasOcorrencias || ''),
        solicitacoes: dividirEmLancamentos(solicitacoesCCR),
        substituicao: montarSubstituicoesLRO(),
        cci2: Object.entries(equipagemCCI).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        cci3: Object.entries(equipagemCCIRT).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        crs: Object.entries(equipagemCRS).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        dataAssinatura: formatarDataBR(new Date()),
        chefeAssinatura: bombeiros.find((b: any) => b.nomeGuerra === chefeEquipe || b.nomeCompleto === chefeEquipe)?.nomeCompleto || chefeEquipe,
        _ocorrenciasOperacionaisIds: idsOcorrenciasIncluidasNoTextoAtual(),
        substituicoesAtivas,
      };

      if (draftId) {
        await salvarDraft(dados, equipe, dataInicio, username, draftId);
      }
      const blob = await gerarPDF(dados);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Erro ao gerar LRO:', err);
    }
    setSaving(false);
  }

  function handlePreview() {
    if (bloquearEquipeAtual('visualizar')) return;
    sessionStorage.setItem('lro_form_backup', JSON.stringify({
      step, equipe, dataInicio, dataFim,
      chefeEquipe, comunicacao,
      equipagemCCI, equipagemCCIRT, equipagemCRS,
      instrucoes, instrucoesHorarios,
      frotaDados,
      centralFaisca, radioComunicacao,
      tpTemAlteracao, tpTexto,
      extTemAlteracao, extTexto,
      equipTemAlteracao, equipTexto,
      edifTemAlteracao, edifTexto,
      ocorrenciasNA, inspecoes,
      emergenciaXI, outrasOcorrencias, solicitacoesCCR,
      trocasManuais,
      substituicoesDetectadas, draftId, draftEmEdicaoStatus,
    }));
    const dados = {
      equipeNome: equipe, dataInicio, dataFim, chefeEquipe, comunicacao,
      frota: Array.from({ length: FROTA_ROWS }).map((_, i) => {
        const d = frotaDados[`row_${i}`] || EMPTY_FROTA_LINHA;
        const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
        const sel = frotaLista.find((vv: any) => vv.id === d.viaturaId);
        return { viatura: sel?.prefixo || sel?.nome || '—', viaturaId: d.viaturaId || '', prefixo: d.prefixo || '', kmIni: d.kmIni || '', kmFim: d.kmFim || '', combIni: normalizarPercentualCombustivel(d.combIni), combFim: normalizarPercentualCombustivel(d.combFim), situacao: d.situacao || '' };
      }),
      instrucoes: Array.isArray(instrucoes) ? instrucoes : (typeof instrucoes === 'string' ? instrucoes.split('\n').filter(Boolean) : []),
      instrucoesHorarios: Array.isArray(instrucoesHorarios) ? instrucoesHorarios : (typeof instrucoesHorarios === 'string' ? instrucoesHorarios.split('\n').filter(Boolean) : []),
      centralFaisca: centralFaisca || 'SEM ALTERAÇÕES',
      radioComunicacao: radioComunicacao || 'SEM ALTERAÇÕES',
      tpTemAlteracao, tpTexto,
      extTemAlteracao, extTexto,
      equipTemAlteracao, equipTexto,
      edifTemAlteracao, edifTexto,
      ocorrenciasNA, inspecoes,
      emergenciaXI,
      ocorrenciasXII: Array.isArray(outrasOcorrencias) ? outrasOcorrencias : dividirEmLancamentos(outrasOcorrencias || ''),
      solicitacoes: dividirEmLancamentos(solicitacoesCCR),
      substituicao: montarSubstituicoesLRO(),
        cci2: Object.entries(equipagemCCI).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
      cci3: Object.entries(equipagemCCIRT).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
      crs: Object.entries(equipagemCRS).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
      dataAssinatura: formatarDataBR(new Date()),
      chefeAssinatura: bombeiros.find((b: any) => b.nomeGuerra === chefeEquipe || b.nomeCompleto === chefeEquipe)?.nomeCompleto || chefeEquipe,
      gerenteAssinatura: bombeiros.find((b: any) => b.cargo === 'GS')?.nomeCompleto || '',
      coordenadorAssinatura: apocs.find((a: any) => a.funcao === 'SUPERVISOR')?.nomeCompleto || '',
      cidade: 'NAVEGANTES',
      uf: 'SC',
      _ocorrenciasOperacionaisIds: idsOcorrenciasIncluidasNoTextoAtual(),
      substituicoesAtivas,
      _lroExportavel: true,
    };
    navigate('/registros-diarios/preview-lro', { state: dados });
  }

  async function handleFinalizarLRO() {
    setShowConfirm(false);
    if (bloquearEquipeAtual('finalizar')) return;
    setSaving(true);
    try {
      const dados = {
        equipeNome: equipe, dataInicio, dataFim, chefeEquipe, comunicacao,
        frota: Array.from({ length: FROTA_ROWS }).map((_, i) => {
          const d = frotaDados[`row_${i}`] || EMPTY_FROTA_LINHA;
          const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
          const sel = frotaLista.find((vv: any) => vv.id === d.viaturaId);
          return { viatura: sel?.prefixo || sel?.nome || (i === FROTA_ROWS - 1 ? '' : '—'), viaturaId: d.viaturaId || '', prefixo: d.prefixo || '', kmIni: d.kmIni || '', kmFim: d.kmFim || '', combIni: normalizarPercentualCombustivel(d.combIni), combFim: normalizarPercentualCombustivel(d.combFim), situacao: d.situacao || '' };
        }),
        instrucoes: Array.isArray(instrucoes) ? instrucoes : (typeof instrucoes === 'string' ? instrucoes.split('\n').filter(Boolean) : []),
        instrucoesHorarios: Array.isArray(instrucoesHorarios) ? instrucoesHorarios : (typeof instrucoesHorarios === 'string' ? instrucoesHorarios.split('\n').filter(Boolean) : []),
        centralFaisca: centralFaisca || 'SEM ALTERAÇÕES',
        radioComunicacao: radioComunicacao || 'SEM ALTERAÇÕES',
        tpTemAlteracao, tpTexto,
        extTemAlteracao, extTexto,
        equipTemAlteracao, equipTexto,
        edifTemAlteracao, edifTexto,
        ocorrenciasNA, inspecoes,
        emergenciaXI,
        ocorrenciasXII: Array.isArray(outrasOcorrencias) ? outrasOcorrencias : dividirEmLancamentos(outrasOcorrencias || ''),
        solicitacoes: dividirEmLancamentos(solicitacoesCCR),
        substituicao: montarSubstituicoesLRO(),
        cci2: Object.entries(equipagemCCI).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        cci3: Object.entries(equipagemCCIRT).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        crs: Object.entries(equipagemCRS).filter(([, v]) => v).map(([k, v]) => ({ funcao: k.split('_')[0], nome: v })),
        dataAssinatura: formatarDataBR(new Date()),
        chefeAssinatura: bombeiros.find((b: any) => b.nomeGuerra === chefeEquipe || b.nomeCompleto === chefeEquipe)?.nomeCompleto || chefeEquipe,
        gerenteAssinatura: bombeiros.find((b: any) => b.cargo === 'GS')?.nomeCompleto || bombeiros.find((b: any) => b.cargo === 'GS')?.nomeGuerra || '',
        coordenadorAssinatura: apocs.find((a: any) => a.funcao === 'SUPERVISOR')?.nomeCompleto || '',
        cidade: 'NAVEGANTES',
        uf: 'SC',
        _trocasManuais: trocasManuais,
        _substituicoesDetectadas: substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada !== false),
        _ocorrenciasOperacionaisIds: idsOcorrenciasIncluidasNoTextoAtual(),
        substituicoesAtivas,
      };
      const saved = await salvarDraft(dados, equipe, dataInicio, username, draftId || undefined);
      setDraftId(saved.id);
      await atualizarStatus(saved.id, 'aguardando', undefined, username);
      setDraftEmEdicaoStatus('aguardando');
      const updated = await listarDrafts('').catch(() => []);
      setDrafts(updated);
      navigate('/registros-diarios/preview-lro', { state: { ...dados, draftId: saved.id, status: 'aguardando', _lroFinalizado: false, _lroExportavel: true } });
    } catch (err) {
      console.error('Erro ao finalizar LRO:', err);
      setErroValidacao(`Erro ao finalizar LRO: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
    setSaving(false);
  }

  function idsOcorrenciasIncluidasNoDraft(draft: LRODraft): string[] {
    const dados = (draft.dados as Record<string, unknown>) || {};
    const salvos = Array.isArray(dados._ocorrenciasOperacionaisIds)
      ? dados._ocorrenciasOperacionaisIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
      : [];
    if (salvos.length > 0) return Array.from(new Set(salvos));

    const equipeAlvo = String(dados.equipeNome || draft.equipe || '');
    const dataInicioAlvo = String(dados.dataInicio || draft.data_plantao || '');
    const dataFimAlvo = String(dados.dataFim || dataSaidaPlantao(equipeAlvo, dataInicioAlvo));
    if (!equipeAlvo || !dataInicioAlvo) return [];

    return Array.from(new Set(
      ocorrenciasOperacionais
        .filter(registro => ocorrenciaEntraNoLRO(registro, equipeAlvo, dataInicioAlvo, dataFimAlvo))
        .map(registro => registro.id)
    ));
  }

  async function fecharOcorrenciasIncluidasNoDraft(draft: LRODraft): Promise<number> {
    const ids = idsOcorrenciasIncluidasNoDraft(draft);
    if (ids.length === 0) return 0;

    await Promise.all(ids.map(id => atualizarOcorrencia(id, { status: 'Fechada' })));
    setOcorrenciasOperacionais(prev => prev.map(registro =>
      ids.includes(registro.id) ? { ...registro, status: 'Fechada' } : registro
    ));
    return ids.length;
  }

  async function finalizarDraftComOcorrencias(draft: LRODraft) {
    const atualizado = await atualizarStatus(draft.id, 'finalizado', undefined, username);
    await fecharOcorrenciasIncluidasNoDraft(draft);
    setDrafts(prev => prev.map(x => x.id === draft.id ? atualizado : x));
  }

  function draftTravaOcorrencias(draft: LRODraft): boolean {
    return STATUS_LRO_TRAVAM_OCORRENCIAS.has(draft.status);
  }

  function handleVerDocumentoLRO(draft: LRODraft) {
    const dados = (draft.dados as Record<string, unknown>) || {};
    navigate('/registros-diarios/preview-lro', {
      state: {
        ...dados,
        draftId: draft.id,
        status: draft.status,
        _lroFinalizado: draft.status === 'finalizado' || draft.status === 'arquivado',
        _lroExportavel: draft.status !== 'rascunho' && draft.status !== 'cancelado',
      },
    });
  }

  function abrirDraftParaEdicao(draft: LRODraft) {
    const dd = draft.dados as Record<string, any> || {};
    setDraftId(draft.id);
    setDraftEmEdicaoStatus(draft.status);
    setStep('preencher');
    setEquipe((dd.equipeNome || draft.equipe || 'Alfa') as EquipeOpcao);
    setDataInicio(dd.dataInicio || draft.data_plantao || hojeLocalISO());
    setDataFim(dd.dataFim || '');
    setChefeEquipe(dd.chefeEquipe || '');
    setComunicacao(dd.comunicacao || '');
    const equipagemCCICarregada = dd.cci2 ? Object.fromEntries((dd.cci2 as any[]).map((c: any, i: number) => [`${c.funcao}_${i}`, c.nome])) : {};
    const equipagemCCIRTCarregada = dd.cci3 ? Object.fromEntries((dd.cci3 as any[]).map((c: any, i: number) => [`${c.funcao}_${i}`, c.nome])) : {};
    const equipagemCRSCarregada = dd.crs ? Object.fromEntries((dd.crs as any[]).map((c: any, i: number) => [`${c.funcao}_${i}`, c.nome])) : {};
    setEquipagemCCI(equipagemCCICarregada);
    setEquipagemCCIRT(equipagemCCIRTCarregada);
    setEquipagemCRS(equipagemCRSCarregada);
    limparMarcacoesEquipeEditada();
    marcarCampoEquipeEditado('chefeEquipe');
    marcarCampoEquipeEditado('comunicacao');
    marcarEquipagemCarregada('equipagemCCI', equipagemCCICarregada);
    marcarEquipagemCarregada('equipagemCCIRT', equipagemCCIRTCarregada);
    marcarEquipagemCarregada('equipagemCRS', equipagemCRSCarregada);
    setInstrucoes(Array.isArray(dd.instrucoes) ? dd.instrucoes.join('\n') : (dd.instrucoes || ''));
    setInstrucoesHorarios(dd.instrucoesHorarios || '');
    if (dd.frota) {
      const fDados: Record<string, any> = {};
      (dd.frota as any[]).forEach((f: any, i: number) => {
        const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
        const match = f.viaturaId
          ? frotaLista.find((vv: any) => vv.id === f.viaturaId)
          : frotaLista.find((vv: any) => (vv.prefixo || vv.nome) === f.viatura);
        fDados[`row_${i}`] = { viaturaId: match?.id || f.viaturaId || '', prefixo: f.prefixo || '', kmIni: f.kmIni || '', kmFim: f.kmFim || '', combIni: normalizarPercentualCombustivel(f.combIni), combFim: normalizarPercentualCombustivel(f.combFim), situacao: f.situacao || '' };
      });
      setFrotaDados(fDados);
    }
    setCentralFaisca(dd.centralFaisca || 'SEM ALTERAÇÕES');
    setRadioComunicacao(dd.radioComunicacao || 'SEM ALTERAÇÕES');
    setTpTemAlteracao(!!dd.tpTemAlteracao);
    setTpTexto(dd.tpTexto || '');
    setExtTemAlteracao(!!dd.extTemAlteracao);
    setExtTexto(dd.extTexto || '');
    setEquipTemAlteracao(!!dd.equipTemAlteracao);
    setEquipTexto(dd.equipTexto || '');
    setEdifTemAlteracao(!!dd.edifTemAlteracao);
    setEdifTexto(dd.edifTexto || '');
    setOcorrenciasNA(dd.ocorrenciasNA || '');
    setInspecoes(dd.inspecoes || '');
    setEmergenciaXI(dd.emergenciaXI || '');
    setOutrasOcorrencias(lancamentosParaTexto(dd.ocorrenciasXII));
    setSolicitacoesCCR(lancamentosParaTexto(dd.solicitacoes));
    setTrocasManuais(Array.isArray(dd._trocasManuais) ? dd._trocasManuais : []);
    setSubstituicoesDetectadas(Array.isArray(dd._substituicoesDetectadas) ? dd._substituicoesDetectadas : []);
    setView('wizard');
  }

  function countDraftArray(dados: Record<string, any>, key: string): number {
    return Array.isArray(dados[key]) ? dados[key].length : 0;
  }

  function countDraftTextLines(value: unknown): number {
    if (Array.isArray(value)) return value.filter(Boolean).length;
    return String(value || '').split('\n').map(line => line.trim()).filter(Boolean).length;
  }

  function draftLines(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
  }

  function formatarEquipagemDraft(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value
      .map((item: any) => [item.funcao, item.nome].filter(Boolean).join(' - '))
      .filter(Boolean)
      .join('\n');
  }

  function formatarFrotaDraft(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value
      .map((item: any) => {
        const partes = [
          item.viatura || item.prefixo || '',
          item.kmIni || item.kmFim ? `KM ${item.kmIni || '-'} -> ${item.kmFim || '-'}` : '',
          item.combIni || item.combFim ? `Comb. ${item.combIni || '-'}% -> ${item.combFim || '-'}%` : '',
          item.situacao || '',
        ].filter(Boolean);
        return partes.join(' | ');
      })
      .filter(Boolean)
      .join('\n');
  }

  function formatarTrocasDraft(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value
      .map((item: Partial<TrocaManualLRO>) => {
        const nomes = [item.solicitante, item.solicitado].filter(Boolean).join(' x ');
        const detalhes = [item.dataFolga ? `Folga: ${formatarDataBR(item.dataFolga)}` : '', item.motivo].filter(Boolean).join(' | ');
        return [nomes, detalhes].filter(Boolean).join(' - ');
      })
      .filter(Boolean)
      .join('\n');
  }

  function formatarSubstituicoesDraft(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value
      .map((item: Partial<SubstituicaoInfo>) => {
        const nomes = [item.substituidoNome, item.substitutoNome].filter(Boolean).join(' -> ');
        const detalhes = [item.cargoSubstituido, item.cargoExercido, item.equipeSubstituido].filter(Boolean).join(' / ');
        return [nomes, detalhes].filter(Boolean).join(' - ');
      })
      .filter(Boolean)
      .join('\n');
  }

  function resumoAlteracoesLRO(dados: Record<string, any>): string {
    const itens = [
      dados.tpTemAlteracao ? 'TP' : '',
      dados.extTemAlteracao ? 'Extintores' : '',
      dados.equipTemAlteracao ? 'Equipamentos' : '',
      dados.edifTemAlteracao ? 'Edificações' : '',
    ].filter(Boolean);
    return itens.length ? itens.join(', ') : 'Sem alterações';
  }

  function valorAuditoria(value: unknown): string {
    return String(value || '').trim();
  }

  function usuarioAuditoria(value: unknown): string {
    const raw = valorAuditoria(value);
    return formatarUsuarioAuditoria(raw, auditoriaPessoas);
  }

  function dadosAuditoriaDraft(draft: LRODraft): Record<string, unknown> {
    return (draft.dados as Record<string, unknown>) || {};
  }

  function draftCriadoPor(draft: LRODraft): string {
    const dados = dadosAuditoriaDraft(draft);
    return usuarioAuditoria(draft.created_by || dados._createdBy);
  }

  function draftFinalizadoPor(draft: LRODraft): string {
    return usuarioAuditoria(draftFinalizadoPorRaw(draft));
  }

  function draftFinalizadoPorRaw(draft: LRODraft): string {
    const dados = dadosAuditoriaDraft(draft);
    return valorAuditoria(dados._completedBy);
  }

  function draftFinalizadoEm(draft: LRODraft): string {
    const dados = dadosAuditoriaDraft(draft);
    return valorAuditoria(dados._completedAt);
  }

  function draftTemFinalizacao(draft: LRODraft): boolean {
    return !!draftFinalizadoPorRaw(draft) && !!draftFinalizadoEm(draft);
  }

  function draftAuditoriaPrincipalLabel(draft: LRODraft): string {
    return draftTemFinalizacao(draft) ? 'Finalizado por' : 'Criado por';
  }

  function draftAuditoriaPrincipalPor(draft: LRODraft): string {
    return draftTemFinalizacao(draft) ? draftFinalizadoPor(draft) : draftCriadoPor(draft);
  }

  function draftAuditoriaPrincipalEm(draft: LRODraft): string {
    return draftTemFinalizacao(draft) ? draftFinalizadoEm(draft) : draft.created_at;
  }

  function draftEditadoPor(draft: LRODraft): string {
    return usuarioAuditoria(draftEditadoPorRaw(draft));
  }

  function draftEditadoPorRaw(draft: LRODraft): string {
    const dados = dadosAuditoriaDraft(draft);
    return valorAuditoria(dados._lastPostCompletionEditBy);
  }

  function draftEditadoEm(draft: LRODraft): string {
    const dados = dadosAuditoriaDraft(draft);
    return valorAuditoria(dados._lastPostCompletionEditAt);
  }

  function draftTemEdicao(draft: LRODraft): boolean {
    return !!draftEditadoPorRaw(draft) && !!draftEditadoEm(draft);
  }

  function dataHoraAuditoria(value: unknown): string {
    return formatarDataHoraBR(value, formatarDataBR(value, '—'));
  }

  function lroDetailCard(label: string, value: ReactNode) {
    return (
      <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/70">
        <p className="text-[10px] font-black uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</p>
        <div className="mt-1 text-sm font-semibold text-graphite-900 dark:text-graphite-100">{value || '—'}</div>
      </div>
    );
  }

  function lroTextCard(label: string, value: unknown, className = '') {
    const texto = draftLines(value).join('\n');
    return (
      <div className={`rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/70 ${className}`}>
        <p className="text-[10px] font-black uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-graphite-900 dark:text-graphite-100">{texto || '—'}</p>
      </div>
    );
  }

  function idsOcorrenciasTravadasPorOutrosLROs(draftAtual: LRODraft, ids: string[]): Set<string> {
    const idsAlvo = new Set(ids);
    const travadas = new Set<string>();
    drafts.forEach(draft => {
      if (draft.id === draftAtual.id || !draftTravaOcorrencias(draft)) return;
      idsOcorrenciasIncluidasNoDraft(draft).forEach(id => {
        if (idsAlvo.has(id)) travadas.add(id);
      });
    });
    return travadas;
  }

  async function reabrirOcorrenciasIncluidasNoDraftExcluido(draft: LRODraft): Promise<number> {
    if (!draftTravaOcorrencias(draft)) return 0;

    const ids = idsOcorrenciasIncluidasNoDraft(draft);
    if (ids.length === 0) return 0;

    const idsTravadosPorOutroLRO = idsOcorrenciasTravadasPorOutrosLROs(draft, ids);
    const idsParaReabrir = ids.filter(id => !idsTravadosPorOutroLRO.has(id));
    if (idsParaReabrir.length === 0) return 0;

    await Promise.all(idsParaReabrir.map(id => atualizarOcorrencia(id, { status: 'Aberta' })));
    setOcorrenciasOperacionais(prev => prev.map(registro =>
      idsParaReabrir.includes(registro.id) ? { ...registro, status: 'Aberta' } : registro
    ));
    return idsParaReabrir.length;
  }

  async function excluirDraftComOcorrencias(draft: LRODraft) {
    if (!canDeleteDraft(draft)) return;

    await excluirDraft(draft.id);
    await reabrirOcorrenciasIncluidasNoDraftExcluido(draft);
    setDrafts(prev => prev.filter(x => x.id !== draft.id));
  }

  async function arquivarDraftComoDocumento(draft: LRODraft) {
    const dados = (draft.dados as Record<string, any>) || {};
    const docs = await listarDocumentos().catch(() => []);
    let doc = docs.find((x: any) => x.source_module === 'lro');
    if (!doc) {
      doc = await criarDocumento({
        name: 'LIVRO ATA DE CHEFE DE EQUIPE',
        description: 'LRO gerado pelo wizard',
        category: 'lro',
        template_pdf_url: '',
        template_pdf_pages: 0,
        template_pdf_width: 0,
        template_pdf_height: 0,
        active: true,
        source_module: 'lro',
        created_by: username || null,
      });
    }
    await criarPreenchimento({
      document_id: doc.id,
      filled_by: username,
      filled_data: { ...dados, equipeNome: dados.equipeNome || draft.equipe, dataInicio: dados.dataInicio || draft.data_plantao },
      status: 'archived',
      autentique_document_id: null,
      autentique_link: null,
    });
  }

  function handleConfirmTrocaRecusada() {
    if (trocaRecusadaIdx !== null) {
      setSubstituicoesDetectadas(prev => prev.map((s, i) => i === trocaRecusadaIdx ? { ...s, confirmada: false } : s));
    }
    setShowConfirmTroca(false);
    setTrocaRecusadaIdx(null);
  }

  function handleConfirmAdicionarTrocaManual() {
    if (!trocaSolicitante || !trocaSolicitado) return;
    setTrocasManuais(prev => [...prev, { solicitante: trocaSolicitante, solicitado: trocaSolicitado, dataFolga: trocaDataFolga, motivo: trocaMotivo }]);
    setTrocaSolicitante('');
    setTrocaSolicitado('');
    setTrocaDataFolga('');
    setTrocaMotivo('');
    setShowConfirmAdicionar(false);
  }

  function handleConfirmTrocaCorreta() {
    if (trocaConfirmadaIdx !== null) {
      setSubstituicoesDetectadas(prev => prev.map((s, i) => i === trocaConfirmadaIdx ? { ...s, confirmada: true } : s));
    }
    setShowConfirmCorreta(false);
    setTrocaConfirmadaIdx(null);
  }

  if (loading) return (
    <PageContainer>
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
      </div>
    </PageContainer>
  );

  if (view === 'lista') {
    const anos = [...new Set(drafts.map(d => d.data_plantao?.substring(0, 4)).filter(Boolean))].sort().reverse();
    if (anos.length === 0) anos.push(new Date().getFullYear().toString());

    const filtradas = drafts.filter(d => {
      if (filtroAno && !d.data_plantao?.startsWith(filtroAno)) return false;
      if (filtroMes && d.data_plantao) {
        const mes = String(parseInt(d.data_plantao.substring(5, 7), 10));
        if (mes !== filtroMes) return false;
      }
      if (filtroEquipeLista && d.equipe !== filtroEquipeLista) return false;
      return true;
    });

    return (
      <PageContainer>
        <div className="mb-6 flex items-center justify-between">
          <PageTitle icon={FileText} title="LRO - Livro Ata de Chefe de Equipe" />
          <div className="flex flex-wrap justify-end gap-3">
            {canCreate && (
              <>
                <button onClick={() => setCloneOrigem({ id: 'novo', equipe: equipePadrao || '', data_plantao: '', status: 'rascunho', dados: {}, created_by: username, created_at: '', updated_at: '', expires_at: '' } as any)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]">
                  <FileText className="h-4 w-4" /> Clonar LRO
                </button>
                <button
                  onClick={iniciarNovoLRO}
                  data-lro-tour="novo-lro"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
                  <FileText className="h-4 w-4" /> Novo LRO
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filtros estilo LRODiario */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
              <option value="">Todos os anos</option>
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
              <option value="">Todos os meses</option>
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={filtroEquipeLista} onChange={e => setFiltroEquipeLista(e.target.value)} className={inputClass}>
              <option value="">Todas as equipes</option>
              {['Alfa','Bravo','Charlie','Delta'].map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            <p className="text-sm text-graphite-500 dark:text-graphite-400">{filtradas.length} LRO(s)</p>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-16 text-center dark:border-border-dark dark:bg-surface-card">
            <FileText className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum LRO encontrado</h3>
            <p className="text-sm text-graphite-400">Clique em "Novo LRO" para criar o primeiro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map(d => {
              const dotColor = d.status === 'assinado' ? 'bg-green-500' : d.status === 'aguardando' ? 'bg-blue-500' : d.status === 'cancelado' ? 'bg-red-500' : d.status === 'finalizado' ? 'bg-green-500' : d.status === 'arquivado' ? 'bg-graphite-400' : 'bg-yellow-500';
              const dd = d.dados as Record<string, any> || {};
              const expanded = lroExpandidoId === d.id;
              const podeEditarDraft = canManageDraft(d) &&
                (d.status === 'rascunho' || (contexto.isAdministradorSistema && STATUS_LRO_EDITAVEIS_POR_ADMIN.has(d.status)));
              return (
              <div key={d.id} className="rounded-xl border border-graphite-200 bg-white transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setLroExpandidoId(expanded ? null : d.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium text-graphite-900 dark:text-graphite-100">
                        <FileText className="h-4 w-4 text-graphite-400" />
                        <span>LRO - Equipe {d.equipe}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-graphite-500 dark:text-graphite-400">
                        <span>{formatarDataBR(d.data_plantao)}</span>
                        <span>· {draftAuditoriaPrincipalLabel(d)} {draftAuditoriaPrincipalPor(d)} em {formatarDataBR(draftAuditoriaPrincipalEm(d))}</span>
                        {draftTemEdicao(d) && (
                          <span>· Editado por {draftEditadoPor(d)} em {formatarDataBR(draftEditadoEm(d))}</span>
                        )}
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-graphite-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-graphite-400" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_CORES[d.status] || STATUS_CORES.rascunho}`}>
                      {STATUS_LABELS[d.status] || d.status}
                    </span>
                    {d.status === 'rascunho' && draftCountdowns[d.id] && (
                      <span className="text-[10px] text-yellow-600 dark:text-yellow-400" title="Tempo até exclusão automática">
                        Exclui em: {draftCountdowns[d.id]}
                      </span>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="space-y-4 border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                    <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                      {lroDetailCard('Criado por', `${draftCriadoPor(d)} em ${dataHoraAuditoria(d.created_at)}`)}
                      {draftTemFinalizacao(d) && lroDetailCard('Finalizado por', `${draftFinalizadoPor(d)} em ${dataHoraAuditoria(draftFinalizadoEm(d))}`)}
                      {draftTemEdicao(d) && lroDetailCard('Editado por', `${draftEditadoPor(d)} em ${dataHoraAuditoria(draftEditadoEm(d))}`)}
                      {lroDetailCard('Status', STATUS_LABELS[d.status] || d.status)}
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
                      {lroDetailCard('Data do plantão', formatarDataBR(d.data_plantao))}
                      {lroDetailCard('Equipe', d.equipe || dd.equipeNome || '—')}
                      {lroDetailCard('Chefe da equipe', dd.chefeEquipe || '—')}
                      {lroDetailCard('Comunicação BA-OC', dd.comunicacao || '—')}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {lroDetailCard('CCI 2', `${countDraftArray(dd, 'cci2')} integrante(s)`)}
                      {lroDetailCard('CCI 3', `${countDraftArray(dd, 'cci3')} integrante(s)`)}
                      {lroDetailCard('CRS', `${countDraftArray(dd, 'crs')} integrante(s)`)}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      {lroDetailCard('Instruções', `${countDraftTextLines(dd.instrucoes)} lançamento(s)`)}
                      {lroDetailCard('Frota', `${countDraftArray(dd, 'frota')} viatura(s)`)}
                      {lroDetailCard('Trocas', `${countDraftArray(dd, '_trocasManuais')} manual(is)`)}
                      {lroDetailCard('Substituições', `${countDraftArray(dd, '_substituicoesDetectadas')} detectada(s)`)}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      {lroDetailCard('Ocorrências/BONA', `${countDraftTextLines(dd.ocorrenciasNA)} lançamento(s)`)}
                      {lroDetailCard('REA', `${countDraftTextLines(dd.emergenciaXI)} lançamento(s)`)}
                      {lroDetailCard('Inspeções', `${countDraftTextLines(dd.inspecoes)} lançamento(s)`)}
                      {lroDetailCard('Solicitações CCR', `${countDraftTextLines(dd.solicitacoes)} lançamento(s)`)}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {lroDetailCard('Central Faísca', dd.centralFaisca || 'SEM ALTERAÇÕES')}
                      {lroDetailCard('Rádio Comunicação', dd.radioComunicacao || 'SEM ALTERAÇÕES')}
                      {lroDetailCard('Alterações', resumoAlteracoesLRO(dd))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {lroTextCard('CCI 2 - Equipagem', formatarEquipagemDraft(dd.cci2))}
                      {lroTextCard('CCI 3 - Equipagem', formatarEquipagemDraft(dd.cci3))}
                      {lroTextCard('CRS - Equipagem', formatarEquipagemDraft(dd.crs))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {lroTextCard('Instruções', dd.instrucoes)}
                      {lroTextCard('Frota', formatarFrotaDraft(dd.frota))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {lroTextCard('Ocorrências/BONA', dd.ocorrenciasNA)}
                      {lroTextCard('REA', dd.emergenciaXI)}
                      {lroTextCard('Inspeções', dd.inspecoes)}
                      {lroTextCard('Outras Ocorrências', dd.ocorrenciasXII)}
                      {lroTextCard('Solicitações CCR', dd.solicitacoes)}
                      {lroTextCard('Trocas Manuais', formatarTrocasDraft(dd._trocasManuais))}
                      {lroTextCard('Substituições', formatarSubstituicoesDraft(dd._substituicoesDetectadas))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {dd.tpTemAlteracao && lroTextCard('TP/EPR - Alterações', dd.tpTexto)}
                      {dd.extTemAlteracao && lroTextCard('Agentes Extintores - Alterações', dd.extTexto)}
                      {dd.equipTemAlteracao && lroTextCard('Equipamentos - Alterações', dd.equipTexto)}
                      {dd.edifTemAlteracao && lroTextCard('Edificações - Alterações', dd.edifTexto)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-graphite-200/60 pt-3 dark:border-border-dark">
                      <button onClick={() => handleVerDocumentoLRO(d)}
                        className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                        <Eye className="h-4 w-4" /> Ver documento
                      </button>
                      {canCreate && (
                        <button onClick={() => setCloneOrigem(d)} title="Clonar LRO"
                          className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300">
                          <FileText className="h-4 w-4" /> Clonar
                        </button>
                      )}
                      {podeEditarDraft && (
                        <button onClick={() => abrirDraftParaEdicao(d)}
                          className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                          <FileText className="h-4 w-4" /> {d.status === 'rascunho' ? 'Continuar' : 'Editar'}
                        </button>
                      )}
                      {contexto.isAdministradorSistema && d.status === 'aguardando' && (
                        <button onClick={async () => {
                          try {
                            await finalizarDraftComOcorrencias(d);
                          } catch (err) {
                            setErroValidacao(`Erro ao finalizar LRO: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                          }
                        }} title="Marcar como finalizado"
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl">
                          <Check className="h-4 w-4" /> Finalizar
                        </button>
                      )}
                      {contexto.isAdministradorSistema && d.status !== 'arquivado' && d.status !== 'rascunho' && (
                        <button onClick={async () => {
                          await arquivarDraftComoDocumento(d);
                          const atualizado = await atualizarStatus(d.id, 'arquivado', undefined, username);
                          setDrafts(prev => prev.map(x => x.id === d.id ? atualizado : x));
                        }} title="Arquivar"
                          className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300">
                          <Archive className="h-4 w-4" /> Arquivar
                        </button>
                      )}
                      {contexto.isAdministradorSistema && d.status === 'arquivado' && (
                        <button onClick={async () => {
                          try {
                            await finalizarDraftComOcorrencias(d);
                          } catch (err) {
                            setErroValidacao(`Erro ao desarquivar LRO: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                          }
                        }} title="Desarquivar"
                          className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300">
                          <RefreshCw className="h-4 w-4" /> Desarquivar
                        </button>
                      )}
                      {canDeleteDraft(d) && (d.status === 'rascunho' || contexto.isAdministradorSistema) && (
                        <button onClick={async () => {
                          try {
                            await excluirDraftComOcorrencias(d);
                          } catch (err) {
                            setErroValidacao(`Erro ao excluir LRO: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                          }
                        }}
                          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-alert-red transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                          <Trash2 className="h-4 w-4" /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* Modal de clonagem */}
        {cloneOrigem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-card">
              <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">Clonar LRO</h3>
              <div className="grid gap-3">
                {cloneOrigem.id === 'novo' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Selecione o LRO para clonar</label>
                    <select id="cloneOrigemSelect" className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card">
                      <option value="">Selecione...</option>
                      {drafts.map(d => (
                        <option key={d.id} value={d.id}>Equipe {d.equipe} - {formatarDataBR(d.data_plantao)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {cloneOrigem.id !== 'novo' && (
                  <p className="text-sm text-graphite-500">Clonar LRO da equipe <strong>{cloneOrigem.equipe}</strong> do dia <strong>{formatarDataBR(cloneOrigem.data_plantao)}</strong></p>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Nova equipe</label>
                  <select id="cloneEquipe" defaultValue={canEscolherEquipe ? (cloneOrigem.equipe || equipesFormulario[0] || '') : (equipePadrao || '')} disabled={!canEscolherEquipe} className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card disabled:opacity-60">
                    {equipesFormulario.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Nova data</label>
                  <input id="cloneData" type="date" defaultValue={hojeLocalISO()} className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setCloneOrigem(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={async () => {
                  const selCloneId = cloneOrigem.id === 'novo'
                    ? (document.getElementById('cloneOrigemSelect') as HTMLSelectElement)?.value
                    : cloneOrigem.id;
                  if (!selCloneId) return;
                  const origem = selCloneId === cloneOrigem.id ? cloneOrigem : drafts.find(d => d.id === selCloneId);
                  if (!origem) return;
                  const selEquipe = canEscolherEquipe
                    ? ((document.getElementById('cloneEquipe') as HTMLSelectElement)?.value || origem.equipe)
                    : (equipePadrao || '');
                  if (!canCriarRegistrosDiarios(contexto)) {
                    alert('Você não tem permissão para clonar LRO.');
                    return;
                  }
                  const selData = (document.getElementById('cloneData') as HTMLInputElement)?.value || hojeLocalISO();
                  const dd = (origem.dados || {}) as Record<string, any>;

                  // Frota (III): copia com reset dos campos finais
                  const frota = dd.frota as Array<Record<string, string>> | undefined;
                  const frotaClone = frota?.map(f => ({
                    ...f,
                    combIni: normalizarPercentualCombustivel(f.combFim),
                    kmIni: f.kmFim || '',
                    kmFim: '', combFim: '', situacao: '',
                  })) || [];
                  const fDados: Record<string, any> = {};
                  frotaClone.forEach((f: any, i: number) => {
                    const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
                    const match = f.viaturaId
                      ? frotaLista.find((vv: any) => vv.id === f.viaturaId)
                      : frotaLista.find((vv: any) => (vv.prefixo || vv.nome) === f.viatura);
                    fDados[`row_${i}`] = { viaturaId: match?.id || f.viaturaId || '', prefixo: f.prefixo || '', kmIni: f.kmIni || '', kmFim: f.kmFim || '', combIni: normalizarPercentualCombustivel(f.combIni), combFim: normalizarPercentualCombustivel(f.combFim), situacao: f.situacao || '' };
                  });

                  // IV. Central Faísca
                  setCentralFaisca(dd.centralFaisca || 'SEM ALTERAÇÕES');
                  setRadioComunicacao(dd.radioComunicacao || 'SEM ALTERAÇÕES');

                  // V. TP/EPR, VI. Agentes Extintores, VII. Equipamentos, VIII. Edificações
                  setTpTemAlteracao(!!dd.tpTemAlteracao);
                  setTpTexto(dd.tpTexto || '');
                  setExtTemAlteracao(!!dd.extTemAlteracao);
                  setExtTexto(dd.extTexto || '');
                  setEquipTemAlteracao(!!dd.equipTemAlteracao);
                  setEquipTexto(dd.equipTexto || '');
                  setEdifTemAlteracao(!!dd.edifTemAlteracao);
                  setEdifTexto(dd.edifTexto || '');

                  // Reset dos campos puxados automaticamente (nova data/equipe)
                  limparMarcacoesEquipeEditada();
                  setChefeEquipe('');
                  setComunicacao('');
                  setEquipagemCCI({});
                  setEquipagemCCIRT({});
                  setEquipagemCRS({});
                  setInstrucoes('');
                  setInstrucoesHorarios('');
                  setTrocasManuais([]);
                  setSubstituicoesDetectadas([]);
                  setOcorrenciasNA('');
                  setInspecoes('');
                  setEmergenciaXI('');
                  setOutrasOcorrencias('');
                  setSolicitacoesCCR('');

                  setFrotaDados(fDados);
                  setDraftId(null);
                  setDraftEmEdicaoStatus(null);
                  setEquipe(selEquipe as EquipeOpcao);
                  setDataInicio(selData);
                  setDataFim(dataSaidaPlantao(selEquipe, selData));
                  setView('wizard');
                  setStep('equipe');
                  setCloneOrigem(null);
                }} className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white">Clonar</button>
              </div>
            </div>
          </div>
        )}

        {renderBotaoTutorialFlutuante()}
        <AnimatedLroTour
          open={showTutorial}
          steps={LRO_TOUR_STEPS}
          stepIndex={tutorialStepIndex}
          onBack={voltarTutorialLRO}
          onNext={avancarTutorialLRO}
          onClose={fecharTutorialLRO}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => setView('lista')} className="mb-4 flex items-center gap-1 text-sm text-graphite-500 hover:text-graphite-700 dark:hover:text-graphite-300">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </button>
        <PageTitle icon={FileText} title={`Novo LRO - ${step === 'equipe' ? 'Equipe' : step === 'trocas' ? 'Trocas' : step === 'preencher' ? 'Preencher' : 'Revisar'}`} />
      </div>

      {/* Steps indicator */}
      <div className="mb-6 flex items-center gap-2" data-lro-tour="etapas-fluxo">
        {(['equipe', 'trocas', 'preencher', 'revisar'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step === s ? 'bg-aviation-600 text-white' : 'bg-graphite-100 text-graphite-500 dark:bg-graphite-800'}`}>{i + 1}</div>
            <span className={`text-xs font-medium ${step === s ? 'text-aviation-600 dark:text-aviation-400' : 'text-graphite-400'}`}>
              {s === 'equipe' ? 'Equipe' : s === 'trocas' ? 'Trocas' : s === 'preencher' ? 'Dados' : 'Revisão'}
            </span>
            {i < 3 && <div className="h-px w-8 bg-graphite-300 dark:bg-graphite-600" />}
          </div>
        ))}
      </div>

      {erroValidacao && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-5 py-4 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{erroValidacao}</p>
        </div>
      )}

{step === 'equipe' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 w-fit max-w-full text-lg font-bold text-graphite-900 dark:text-graphite-100" data-lro-tour="equipe-plantao">Selecionar Equipe e Data</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Equipe *</label>
                <select value={equipe} onChange={e => { setEquipe(e.target.value as EquipeOpcao); limparCamposAutomaticosPlantao(); }} disabled={!canEscolherEquipe} className={inputClass}>
                  <option value="">Selecione a equipe</option>
                  {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data Início *</label>
                <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); limparCamposAutomaticosPlantao(); }} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data Fim</label>
                <input type="date" value={dataFim} disabled className={inputClass + ' cursor-not-allowed opacity-60'} />
                <p className="mt-1 text-[11px] text-aviation-500 dark:text-aviation-400">Plantão {horarioPlantao.tipo} — {horarioPlantao.inicio} às {horarioPlantao.fim}{equipe === 'Bravo' || equipe === 'Delta' ? ' — data fim gerada automaticamente' : ''}</p>
              </div>
            </div>
          </div>

          {/* Team members */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">
              Efetivo da Equipe {equipe}
              <span className="ml-2 text-sm font-normal text-graphite-500">({disponiveis.length} disponíveis)</span>
            </h3>
            {emFerias.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-400">
                <span className="font-semibold">Em férias:</span> {emFerias.map(formatarFeriasComCargo).join(', ')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...disponiveis].sort((a, b) => {
                const hierarquia: Record<string, number> = { 'BA-CE': 1, 'BA-LR': 2, 'BA-MC': 3, 'BA-RE': 4, 'BA-2': 5, 'OC': 6, 'GS': 7 };
                const cargoA = substituicoesPorSubstituto[a.id]?.cargoExercido || substituicoesPorSubstituto[a.id]?.cargoSubstituido || a.cargo;
                const cargoB = substituicoesPorSubstituto[b.id]?.cargoExercido || substituicoesPorSubstituto[b.id]?.cargoSubstituido || b.cargo;
                return (hierarquia[cargoA] || 99) - (hierarquia[cargoB] || 99);
              }).map(b => {
                const sub = substituicoesPorSubstituto[b.id];
                const cargoExercido = sub?.cargoExercido || sub?.cargoSubstituido || b.cargo;
                const visual = visualSubstituicaoLRO(sub);
                return (
                  <div key={b.id} className={`group relative rounded-xl border p-2 transition-all ${visual.cardClass}`}>
                    {sub ? (
                      <div className="relative min-h-[52px] flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center transition-all duration-300 group-hover:opacity-0 group-hover:scale-95">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-bold mb-0.5 ${visual.badgeClass}`}>
                            {visual.label}
                          </span>
                          <p className={`text-xs font-bold ${visual.nameClass}`}>{b.nomeGuerra}</p>
                          <p className={`text-[9px] ${visual.detailClass}`}>como {cargoExercido}</p>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 scale-90">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-bold mb-0.5 ${visual.hoverBadgeClass}`}>
                            SUBSTITUI
                          </span>
                          <p className="text-xs font-bold text-graphite-600 dark:text-graphite-400">{getNomeGuerra(sub.substituidoNome)}</p>
                          <p className="text-[9px] text-graphite-500">{sub.cargoSubstituido || cargoExercido}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[52px]">
                        <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{b.nomeGuerra}</p>
                        <p className="text-[10px] text-graphite-500">{b.cargo}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => {
              if (!dataInicio) { setErroValidacao('Selecione a data de início do plantão.'); return; }
              if (!equipe) { setErroValidacao('Selecione a equipe.'); return; }
              if (bloquearEquipeAtual('preencher')) return;
              setErroValidacao('');
              setStep('trocas');
            }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
              Próximo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'trocas' && (
        <div className="space-y-6">
          {/* Férias do plantão (só informativo) */}
          {emFerias.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800/30 dark:bg-blue-900/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
                  <span className="text-sm">🏖</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">Equipe em Férias</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Apenas informativo — não vai para o LRO</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {emFerias.map(f => (
                  <span key={f.funcionarioId} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {formatarFeriasComCargo(f)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SUBSTITUIÇÕES TEMPORÁRIAS (informativo) */}
          {substituicoesDetectadas.filter(s => s.tipo === 'substituicao').length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-800/30 dark:bg-blue-900/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
                  <span className="text-sm">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">Substituições Temporárias</h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Apenas informativo — o substituto já está incluído nos slots da equipe
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {substituicoesDetectadas.filter(s => s.tipo === 'substituicao').map(sub => {
                  const findB = (nome: string) => buscarBombeiroPorNome(nome);
                  const bSubdo = findB(sub.substituido);
                  const bSub = findB(sub.substituto);
                  return (
                    <div key={sub.id} className="rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-700 dark:bg-surface-card">
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          📋 Substituição
                        </span>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-graphite-800 dark:text-graphite-200">{sub.substituido || '—'}</p>
                          {bSubdo && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSubdo)} · EQ {bSubdo.equipe}</p>}
                          {bSubdo?.nomeCompleto !== sub.substituido && <p className="text-xs text-graphite-400 truncate">{bSubdo?.nomeCompleto || ''}</p>}
                        </div>
                        <div className="text-graphite-400 text-sm font-bold shrink-0 pt-1">→</div>
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-base font-bold text-blue-700 dark:text-blue-300">{sub.substituto || '—'}</p>
                          {bSub && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSub)} · EQ {bSub.equipe}</p>}
                          {bSub?.nomeCompleto !== sub.substituto && <p className="text-xs text-graphite-400 truncate">{bSub?.nomeCompleto || ''}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TROCAS DE SERVIÇO (assinadas — confirmar) */}
          {substituicoesDetectadas.filter(s => s.tipo === 'troca').length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800/30 dark:bg-amber-900/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">Trocas de Serviço</h3>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {substituicoesDetectadas.filter(s => s.tipo === 'troca').length} troca(s) encontrada(s). Confirme cada uma:
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {substituicoesDetectadas.filter(s => s.tipo === 'troca').map((sub, idx) => {
                  const findB = (nome: string) => buscarBombeiroPorNome(nome);
                  const bSubdo = findB(sub.substituido);
                  const bSub = findB(sub.substituto);
                  const getTurno = (e: string) => e === 'Alfa' || e === 'Charlie' ? 'DIURNO' : e === 'Bravo' || e === 'Delta' ? 'NOTURNO' : '';
                  const realIdx = substituicoesDetectadas.indexOf(sub);
                  return (
                  <div key={sub.id || idx} className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-900/10">
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        🔄 Troca
                      </span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-graphite-800 dark:text-graphite-200">{sub.substituido || '—'}</p>
                        {bSubdo && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSubdo)} · EQ {bSubdo.equipe}</p>}
                        {bSubdo?.nomeCompleto !== sub.substituido && <p className="text-xs text-graphite-400 truncate">{bSubdo?.nomeCompleto || ''}</p>}
                      </div>
                      <div className="text-graphite-400 text-sm font-bold shrink-0 pt-1">↔</div>
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-base font-bold text-amber-700 dark:text-amber-300">{sub.substituto || '—'}</p>
                        {bSub && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSub)} · EQ {bSub.equipe}</p>}
                        {bSub?.nomeCompleto !== sub.substituto && <p className="text-xs text-graphite-400 truncate">{bSub?.nomeCompleto || ''}</p>}
                      </div>
                    </div>
                    {sub.dataSolicitada && (() => {
                      const dataFmt = formatarDataBR(sub.dataSolicitada);
                      const eSub = bSub?.equipe || '';
                      const eSubdo = bSubdo?.equipe || '';
                      const tSub = getTurno(eSub);
                      const tSubdo = getTurno(eSubdo);
                      return (
                        <div className="mt-2 text-[10px] text-graphite-400 uppercase">
                          {dataFmt} {tSubdo} · EQ {eSubdo} ↔ {dataFmt} {tSub} · EQ {eSub}
                        </div>
                      );
                    })()}
                    <div className="mt-3 flex gap-2">
                      {sub.confirmada === null ? (
                        <>
                          <button onClick={() => { setTrocaConfirmadaIdx(realIdx); setShowConfirmCorreta(true); }}
                            className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 transition-all hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400">
                            <Check className="h-3.5 w-3.5" /> Correta
                          </button>
                          <button onClick={() => { setTrocaRecusadaIdx(realIdx); setShowConfirmTroca(true); }}
                            className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 transition-all hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400">
                            <X className="h-3.5 w-3.5" /> Incorreta
                          </button>
                        </>
                      ) : sub.confirmada === true ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <Check className="h-3.5 w-3.5" /> Confirmada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          <X className="h-3.5 w-3.5" /> Recusada
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TROCAS EMERGENCIAIS (formulário manual) */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <div className="mb-4 flex w-fit max-w-full items-center gap-3" data-lro-tour="trocas-substituicoes">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">🚨 Troca Extra Emergencial</h3>
                <p className="text-sm text-graphite-500">Registre aqui trocas que ocorreram emergencialmente sem documento no sistema</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SearchSelect
                  label="Solicitante (quem pediu a troca)"
                  value={trocaSolicitante}
                  onChange={setTrocaSolicitante}
                  options={efetivoDisponivel
                    .filter(entry => entry.bombeiro.nomeGuerra !== trocaSolicitado && !trocasManuais.some(t => t.solicitante === entry.bombeiro.nomeGuerra || t.solicitado === entry.bombeiro.nomeGuerra))
                    .map(formatarOpcaoEfetivo)}
                  placeholder="Buscar solicitante..."
                />
                <SearchSelect
                  label="Solicitado (quem foi chamado)"
                  value={trocaSolicitado}
                  onChange={setTrocaSolicitado}
                  options={(() => {
                    const inversa = equipeInversa[equipe] || '';
                    const nomesOcupados = new Set(trocasManuais.flatMap(t => [t.solicitante, t.solicitado]));
                    const equipeInversaMembros = bombeiros.filter(b => b.equipe === inversa && !b.dataDesligamento && b.nomeGuerra !== trocaSolicitante && !nomesOcupados.has(b.nomeGuerra));
                    const outrosMembros = bombeiros.filter(b => b.equipe !== equipe && b.equipe !== inversa && !b.dataDesligamento && b.nomeGuerra !== trocaSolicitante && !nomesOcupados.has(b.nomeGuerra));
                    return [
                      ...equipeInversaMembros.map(b => ({ value: b.nomeGuerra, label: `${b.nomeGuerra} - ${b.nomeCompleto} (${labelCargoNoPlantao(b)}) [${b.equipe}]` })),
                      ...outrosMembros.map(b => ({ value: b.nomeGuerra, label: `${b.nomeGuerra} - ${b.nomeCompleto} (${labelCargoNoPlantao(b)}) [${b.equipe}]` })),
                    ];
                  })()}
                  placeholder="Buscar substituto..."
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data da Folga</label>
                  <input type="date" value={trocaDataFolga} onChange={e => setTrocaDataFolga(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Motivo</label>
                  <input type="text" value={trocaMotivo} onChange={e => setTrocaMotivo(e.target.value)} placeholder="Ex: Problema pessoal, emergência médica..." className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowConfirmAdicionar(true)}
                  disabled={!trocaSolicitante || !trocaSolicitado}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-red-400 hover:to-red-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Adicionar Troca Emergencial
                </button>
              </div>
            </div>

            {/* Lista de trocas manuais adicionadas */}
            {trocasManuais.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-graphite-700 dark:text-graphite-300">Trocas adicionadas ({trocasManuais.length})</h4>
                {trocasManuais.map((tm, i) => {
                  const findB = (nome: string) => buscarBombeiroPorNome(nome);
                  const bSol = findB(tm.solicitante);
                  const bSolic = findB(tm.solicitado);
                  return (
                  <div key={i} className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-800/30 dark:bg-red-900/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        🚨 Emergencial
                      </span>
                      <button onClick={() => setTrocasManuais(prev => prev.filter((_, j) => j !== i))}
                        className="rounded-lg p-1 text-alert-red transition-all hover:bg-red-50 dark:hover:bg-red-900/20">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-graphite-800 dark:text-graphite-200">{tm.solicitante}</p>
                        {bSol && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSol)} · EQ {bSol.equipe}</p>}
                        {bSol?.nomeCompleto !== tm.solicitante && <p className="text-xs text-graphite-400 truncate">{bSol?.nomeCompleto || ''}</p>}
                        <p className="text-xs text-graphite-400 mt-1">📅 Plantão: {formatarDataBR(dataInicio)}</p>
                      </div>
                      <div className="text-graphite-400 text-sm font-bold shrink-0 pt-1">↔</div>
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-base font-bold text-red-700 dark:text-red-300">{tm.solicitado}</p>
                        {bSolic && <p className="text-xs text-graphite-500 mt-0.5">{labelCargoNoPlantao(bSolic)} · EQ {bSolic.equipe}</p>}
                        {bSolic?.nomeCompleto !== tm.solicitado && <p className="text-xs text-graphite-400 truncate">{bSolic?.nomeCompleto || ''}</p>}
                        {tm.dataFolga && <p className="text-xs text-graphite-400 mt-1">📅 Folga: {formatarDataBR(tm.dataFolga)}</p>}
                      </div>
                    </div>
                    <div className="mt-1">
                      {tm.motivo && <p className="text-xs text-graphite-500">📝 {tm.motivo}</p>}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('equipe')} className="flex items-center gap-1 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button onClick={async () => {
              const trocasNaoConfirmadas = substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada === null);
              if (trocasNaoConfirmadas.length > 0) { setErroValidacao(`Confirme ou rejeite todas as trocas (${trocasNaoConfirmadas.length} pendente(s)).`); return; }
              setErroValidacao('');
              // Criar documentos para trocas manuais
              if (trocasManuais.length > 0 && trocaDocId) {
                try {
                  const usuarioBombeiro = bombeiros.find((b: any) =>
                    b.id === user?.pessoa?.id ||
                    b.nomeGuerra === user?.pessoa?.nomeGuerra
                  );
                  const criadorNome = usuarioBombeiro?.nomeCompleto || user?.name || user?.pessoa?.nomeGuerra || username || '';
                  const criadorCargo = usuarioBombeiro ? cargoExercidoNoPlantao(usuarioBombeiro) : user?.pessoa?.funcao || '';
                  const criadoPor = criadorCargo ? `${criadorCargo} ${criadorNome}` : criadorNome;
                  const trocasPersistidas = await Promise.all(trocasManuais.map(async tm => {
                    if (tm.documentoFillId) return tm;
                    const bSol = bombeiros.find((b: any) => b.nomeGuerra === tm.solicitante || b.nomeCompleto === tm.solicitante);
                    const bSolic = bombeiros.find((b: any) => b.nomeGuerra === tm.solicitado || b.nomeCompleto === tm.solicitado);
                    const created = await criarPreenchimento({
                      document_id: trocaDocId,
                      filled_by: username,
                      filled_data: {
                        nome_solicitante: tm.solicitante,
                        cpf_solicitante: bSol?.cpf || '',
                        funcao_solicitante: bSol ? cargoExercidoNoPlantao(bSol) : '',
                        nome_solicitado: tm.solicitado,
                        cpf_solicitado: bSolic?.cpf || '',
                        funcao_solicitado: bSolic ? cargoExercidoNoPlantao(bSolic) : '',
                        data_solicitada: dataInicio,
                        data_folga_solicitado: tm.dataFolga || '',
                        motivo_troca: tm.motivo || '',
                        troca_emergencial: 'SIM',
                        justificativa_emergencial: tm.motivo || '',
                        criada_no_lro: 'SIM',
                        check_troca_sim: 'V',
                        check_troca_nao: '',
                        deferido_indeferido: 'DEFERIDO',
                        check_deferido: 'V',
                        check_indeferido: '',
                        criado_por: criadoPor,
                        autorizado_por: 'Embaixador',
                        data_autorizacao: hojeLocalISO(),
                      },
                      status: 'signed',
                      autentique_document_id: null,
                      autentique_link: null,
                    });
                    return { ...tm, documentoFillId: created.id };
                  }));
                  setTrocasManuais(trocasPersistidas);
                } catch (err) {
                  console.error('Erro ao criar documento de troca:', err);
                }
              }
              setStep('preencher');
            }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
              Próximo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'preencher' && (
        <div className="space-y-4">
          {/* I. Equipe */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 w-fit max-w-full font-bold text-graphite-900 dark:text-graphite-100" data-lro-tour="informacoes-dia">I. Equipe de Serviço</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <SearchSelect
                  label="1.1 Chefe de Equipe *"
                  value={chefeEquipe}
                  onChange={value => {
                    marcarCampoEquipeEditado('chefeEquipe');
                    setChefeEquipe(value);
                  }}
                  options={(() => {
                    const opcoes = new Map<string, { value: string; label: string }>();
                    const adicionarOpcao = (entry?: EfetivoDisponivel, forcar = false) => {
                      if (!entry) return;
                      if (!forcar && entry.cargoExercido !== 'BA-CE') return;
                      opcoes.set(entry.bombeiro.nomeGuerra, formatarOpcaoEfetivo(entry));
                    };

                    efetivoDisponivel
                      .filter(entry => entry.cargoExercido === 'BA-CE')
                      .forEach(entry => adicionarOpcao(entry));

                    const chefeAtual = buscarBombeiroPorNome(chefeEquipe);
                    const chefeAtualEntry = chefeAtual
                      ? efetivoDisponivel.find(entry => entry.bombeiro.id === chefeAtual.id)
                      : undefined;
                    if (chefeAtualEntry) adicionarOpcao(chefeAtualEntry);
                    return Array.from(opcoes.values());
                  })()}
                  placeholder="Chefe de equipe"
                />
                {(() => {
                  if (!chefeEquipe) return null;
                  const chefeB = bombeiros.find((b: any) => b.nomeGuerra === chefeEquipe || b.nomeCompleto === chefeEquipe);
                  const aviso = chefeB ? validarCursoParaFuncao(chefeB, 'BA-CE') : null;
                  if (!aviso) return null;
                  return (
                    <div className={`mt-1.5 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-tight ${aviso.nivel === 'bloqueado' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{aviso.mensagem}</span>
                    </div>
                  );
                })()}
              </div>
              <SearchSelect
                label="1.2 Comunicação BA-OC *"
                value={comunicacao}
                onChange={value => {
                  marcarCampoEquipeEditado('comunicacao');
                  setComunicacao(value);
                }}
                options={[
                  ...efetivoDisponivel.filter(podeAtuarComoComunicacao).map(formatarOpcaoEfetivo),
                  ...apocs.map((a: any) => ({ value: a.nomeGuerra, label: `${a.nomeGuerra} - ${a.nomeCompleto} (APOC)` })),
                ]}
                placeholder="Buscar operador de comunicação..."
              />
            </div>
          </div>

          {/* 1.3 Equipagem dos CCI */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 font-bold text-graphite-900 dark:text-graphite-100">1.3 Equipagem dos CCI - EM LINHA, CCI - RT e CRS</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'CCI 2', slots: ['BA-CE', 'BA-MC', 'BA-2'], veiculo: 'cci' as const, state: equipagemCCI, setState: setEquipagemCCI },
                { label: 'CCI 3', slots: ['BA-MC', 'BA-2', 'BA-2'], veiculo: 'cci' as const, state: equipagemCCIRT, setState: setEquipagemCCIRT },
                { label: 'CRS', slots: ['BA-LR', 'BA-MC', 'BA-RE', 'BA-RE'], veiculo: 'crs' as const, state: equipagemCRS, setState: setEquipagemCRS },
              ].map(section => (
                <div key={section.label}>
                  <label className="mb-2 block text-sm font-bold text-graphite-800 dark:text-graphite-200">{section.label}</label>
                  <div className="space-y-2">
                    {section.slots.map((cargo, idx) => {
                      const key = `${cargo}_${idx}`;
                      const selected = section.state[key] || '';
                      const cargoFiltro = cargo === 'BA-RE' ? 'BA-2' : cargo;
                      const selectedInOtherSlots = new Set([
                        ...Object.values(equipagemCCI),
                        ...Object.values(equipagemCCIRT),
                        ...Object.values(equipagemCRS),
                      ].filter(Boolean));
                      const optsMap = new Map<string, { value: string; label: string }>();
                      [...efetivoDisponivel]
                        .filter(entry => entry.cargoExercido === cargoFiltro)
                        .sort((a, b) => a.bombeiro.nomeGuerra.localeCompare(b.bombeiro.nomeGuerra, 'pt-BR'))
                        .filter(entry => !selectedInOtherSlots.has(entry.bombeiro.nomeGuerra) || selected === entry.bombeiro.nomeGuerra)
                        .forEach(entry => optsMap.set(entry.bombeiro.nomeGuerra, formatarOpcaoNomeEfetivo(entry)));
                      const selB = buscarBombeiroPorNome(selected);
                      if (selB && cargoExercidoNoPlantao(selB) === cargoFiltro) {
                        optsMap.set(selB.nomeGuerra, { value: selB.nomeGuerra, label: `${selB.nomeGuerra} - ${selB.nomeCompleto}` });
                      }
                      const opts = Array.from(optsMap.values());
                      const cargoValidacao = ['BA-CE', 'BA-LR', 'BA-MC'].includes(cargo) ? cargo as 'BA-CE' | 'BA-LR' | 'BA-MC' : null;
                      const aviso = selB && cargoValidacao ? validarCursoParaFuncao(selB, cargoValidacao, cargoValidacao === 'BA-MC' ? section.veiculo : undefined) : null;
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-[10px] font-bold uppercase text-graphite-500 dark:text-graphite-400">{cargo}</span>
                            <select
                              value={selected}
                              onChange={e => {
                                const grupo = section.label === 'CCI 2'
                                  ? 'equipagemCCI'
                                  : section.label === 'CCI 3'
                                    ? 'equipagemCCIRT'
                                    : 'equipagemCRS';
                                marcarCampoEquipeEditado(grupo, key);
                                section.setState(prev => ({ ...prev, [key]: e.target.value }));
                              }}
                              className="flex-1 rounded-lg border border-graphite-200 px-2 py-1.5 text-xs dark:border-border-dark dark:bg-surface-card"
                            >
                              <option value="">Selecionar...</option>
                              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          {aviso && (
                            <div className={`ml-16 mt-1 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-tight ${aviso.nivel === 'bloqueado' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{aviso.mensagem}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 1.3 Substituições de BA */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 font-bold text-graphite-900 dark:text-graphite-100">1.3 Substituições de BA</h3>
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 text-sm text-graphite-700 dark:text-graphite-300">
                <input type="checkbox" checked={temSubstituicoesBa} readOnly className="h-4 w-4 rounded border-graphite-300 text-aviation-600" />
                ABAIXO
              </label>
              <label className="flex items-center gap-2 text-sm text-graphite-700 dark:text-graphite-300">
                <input type="checkbox" checked={!temSubstituicoesBa} readOnly className="h-4 w-4 rounded border-graphite-300 text-aviation-600" />
                NÃO HOUVE
              </label>
            </div>
            {substituicoesAtivas.map((sub, idx) => {
              const visual = visualSubstituicaoLRO({ tipo: 'substituicao', origem: (sub.motivo || 'substituicao') as SubstituicaoOrigem });
              return (
                <div key={`ativa-${idx}-${sub.nomeAusente}-${sub.nomePresente}`} className={`mb-2 rounded-lg border p-3 ${visual.cardClass}`}>
                  <div className="mb-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${visual.badgeClass}`}>
                      {visual.label}
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-graphite-800 dark:text-graphite-200">{sub.nomeAusente || '—'}</p>
                      <p className="text-xs text-graphite-500">{sub.cargoAusente || 'BA-2'}</p>
                    </div>
                    <div className="text-graphite-400 text-xs font-bold shrink-0 pt-1">→</div>
                    <div className="text-left min-w-0 flex-1">
                      <p className={`font-bold ${visual.nameClass}`}>{sub.nomePresente || '—'}</p>
                      <p className={`text-xs ${visual.detailClass}`}>como {sub.cargoPresente || 'BA-2'} · Nível {sub.nivel || 1}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada !== false).map(sub => {
              const findB = (nome: string) => buscarBombeiroPorNome(nome);
              const p1 = findB(sub.substituido);
              const p2 = findB(sub.substituto);
              return (
                <div key={sub.id} className="mb-2 rounded-lg border border-graphite-200 bg-graphite-50 p-3 dark:border-border-dark dark:bg-graphite-800">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-graphite-800 dark:text-graphite-200">{p1?.nomeGuerra || sub.substituido}</p>
                      <p className="text-xs text-graphite-500">{p1 ? labelCargoNoPlantao(p1) : 'BA-2'} · EQ {p1?.equipe || '—'}</p>
                      {p1?.nomeCompleto !== p1?.nomeGuerra && <p className="text-xs text-graphite-400 truncate">{p1?.nomeCompleto || ''}</p>}
                    </div>
                    <div className="text-graphite-400 text-xs font-bold shrink-0 pt-1">↔</div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-bold text-graphite-800 dark:text-graphite-200">{p2?.nomeGuerra || sub.substituto}</p>
                      <p className="text-xs text-graphite-500">{p2 ? labelCargoNoPlantao(p2) : 'BA-2'} · EQ {p2?.equipe || '—'}</p>
                      {p2?.nomeCompleto !== p2?.nomeGuerra && <p className="text-xs text-graphite-400 truncate">{p2?.nomeCompleto || ''}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-graphite-400 mt-1">📅 Plantão: {formatarDataBR(dataInicio)}</p>
                </div>
              );
            })}
            {trocasManuais.map((tm, i) => {
              const findB = (nome: string) => buscarBombeiroPorNome(nome);
              const p1 = findB(tm.solicitante);
              const p2 = findB(tm.solicitado);
              return (
              <div key={`manual-${i}`} className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/30 dark:bg-red-900/10">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-graphite-800 dark:text-graphite-200">{tm.solicitante}</p>
                    {p1 && <p className="text-xs text-graphite-500">{labelCargoNoPlantao(p1)} · EQ {p1.equipe}</p>}
                    {p1?.nomeCompleto !== tm.solicitante && <p className="text-xs text-graphite-400 truncate">{p1?.nomeCompleto || ''}</p>}
                    <p className="text-xs text-graphite-400 mt-0.5">📅 Plantão: {formatarDataBR(dataInicio)}</p>
                  </div>
                  <div className="text-graphite-400 text-xs font-bold shrink-0 pt-1">↔</div>
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-bold text-red-700 dark:text-red-300">{tm.solicitado}</p>
                    {p2 && <p className="text-xs text-graphite-500">{labelCargoNoPlantao(p2)} · EQ {p2.equipe}</p>}
                    {p2?.nomeCompleto !== tm.solicitado && <p className="text-xs text-graphite-400 truncate">{p2?.nomeCompleto || ''}</p>}
                    {tm.dataFolga && <p className="text-xs text-graphite-400 mt-0.5">📅 Folga: {formatarDataBR(tm.dataFolga)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    🚨 Emergencial
                  </span>
                  {tm.motivo && <span className="text-xs text-graphite-500">📝 {tm.motivo}</span>}
                </div>
              </div>
              );
            })}
          </div>

          {/* II. Instruções */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-graphite-900 dark:text-graphite-100">II. Instruções</h3>
              <button onClick={async () => {
                const [p, pc] = await Promise.all([listarPTRBs(), listarPTRBACompletos()]);
                setPtrbs(p);
                setPtrbaCompletos(pc);
              }} className="flex items-center gap-1 rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium text-graphite-600 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300">
                🔄 Recarregar
              </button>
            </div>
            <textarea value={instrucoes} readOnly placeholder={"14. PCINC - Verificar conformidade dos extintores e hidrantes\n\n15. EQUIPAMENTOS DE PROTEÇÃO - Manter EPIs atualizados"} rows={4} className={inputClass + ' resize-y cursor-not-allowed opacity-80'} />
            {(ptrbs.filter(p => p.equipe === equipe && p.data?.startsWith(dataInicio)).length > 0 || ptrbaCompletos.filter(p => String(p.equipe) === equipe && p.data?.startsWith(dataInicio)).length > 0) && (
              <p className="mt-2 text-[11px] text-green-600">✓ Instruções carregadas automaticamente do PTR-BA deste plantão.</p>
            )}
          </div>

          {/* III. Frota */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 font-bold text-graphite-900 dark:text-graphite-100">III. Situação Operacional da Frota</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-graphite-200 bg-graphite-50 dark:border-border-dark dark:bg-graphite-900">
                    <th className="p-2 text-left font-semibold text-graphite-600">VIATURA</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">PREFIXO</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">KM INICIAL</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">KM FINAL</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">COMB. INICIAL (%)</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">COMB. FINAL (%)</th>
                    <th className="p-2 text-left font-semibold text-graphite-600">SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: FROTA_ROWS }).map((_, rowIdx) => {
                    const frotaLista = viaturas.length > 0 ? viaturas : DEFAULT_VIATURAS;
                    const frotaOpts = [{ id: '', prefixo: '—' }, ...frotaLista].map((vv: any) => ({ id: vv.id, label: vv.prefixo || vv.nome || '—' }));
                    const selectedId = frotaDados[`row_${rowIdx}`]?.viaturaId || '';
                    const prefixoPadrao = ['F2 X6', 'F3 X6', 'FRT X6'][rowIdx] || '';
                    let d = frotaDados[`row_${rowIdx}`] || { kmIni: '', kmFim: '', combIni: '', combFim: '', situacao: '', viaturaId: '', prefixo: '' };
                    if (!d.prefixo) d = { ...d, prefixo: prefixoPadrao };
                    const linhaPadrao: FrotaLinhaDados = { ...EMPTY_FROTA_LINHA, prefixo: prefixoPadrao };
                    const updateRow = (updates: Partial<FrotaLinhaDados>) => setFrotaDados(prev => ({
                      ...prev,
                      [`row_${rowIdx}`]: {
                        ...linhaPadrao,
                        ...prev[`row_${rowIdx}`],
                        ...updates,
                      },
                    }));
                    return (
                      <tr key={`frota-row-${rowIdx}`} className="border-b border-graphite-100 dark:border-border-dark">
                        <td className="p-2">
                          <select value={selectedId} onChange={e => updateRow({ viaturaId: e.target.value })} className="rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card">
                            <option value="">Selecione</option>
                            {frotaOpts.filter(o => o.id).map(o => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 font-semibold text-graphite-700 dark:text-graphite-300 text-xs">{d.prefixo}</td>
                        <td className="p-2"><input value={d.kmIni || ''} onChange={e => updateRow({ kmIni: e.target.value })} className="w-20 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card" /></td>
                        <td className="p-2"><input value={d.kmFim || ''} onChange={e => updateRow({ kmFim: e.target.value })} className="w-20 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card" /></td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            inputMode="decimal"
                            value={normalizarPercentualCombustivel(d.combIni)}
                            onChange={e => updateRow({ combIni: normalizarPercentualCombustivel(e.target.value) })}
                            placeholder="%"
                            className="w-20 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            inputMode="decimal"
                            value={normalizarPercentualCombustivel(d.combFim)}
                            onChange={e => updateRow({ combFim: normalizarPercentualCombustivel(e.target.value) })}
                            placeholder="%"
                            className="w-20 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card"
                          />
                        </td>
                        <td className="p-2">
                          <select value={d.situacao || ''} onChange={e => updateRow({ situacao: e.target.value })} className="rounded border border-graphite-200 px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-card">
                            <option value="">Selecione</option>
                            <option value="EM LINHA">EM LINHA</option>
                            <option value="RESERVA">RESERVA</option>
                            <option value="MANUTENÇÃO">MANUTENÇÃO</option>
                            <option value="BAIXADO">BAIXADO</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* IV */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">IV. Central Faísca</h3>
            <div className="space-y-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">3.1 CENTRAL FAÍSCA</label>
                <input type="text" value={centralFaisca} onChange={e => setCentralFaisca(e.target.value)} placeholder="SEM ALTERAÇÕES" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">3.2 RÁDIOS, HOTLINE</label>
                <input type="text" value={radioComunicacao} onChange={e => setRadioComunicacao(e.target.value)} placeholder="SEM ALTERAÇÕES" className={inputClass} />
              </div>
            </div>
          </div>

          {/* V a VIII */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { titulo: 'V. TP/EPR', temAlt: tpTemAlteracao, setTemAlt: setTpTemAlteracao, texto: tpTexto, setTexto: setTpTexto, placeholder: 'Alterações nos TP/EPR...' },
              { titulo: 'VI. Agentes Extintores', temAlt: extTemAlteracao, setTemAlt: setExtTemAlteracao, texto: extTexto, setTexto: setExtTexto, placeholder: 'Alterações...' },
              { titulo: 'VII. Equipamentos', temAlt: equipTemAlteracao, setTemAlt: setEquipTemAlteracao, texto: equipTexto, setTexto: setEquipTexto, placeholder: 'Alterações...' },
              { titulo: 'VIII. Edificações', temAlt: edifTemAlteracao, setTemAlt: setEdifTemAlteracao, texto: edifTexto, setTexto: setEdifTexto, placeholder: 'Alterações...' },
            ].map(s => (
              <div key={s.titulo} className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
                <h3 className="mb-3 font-bold text-graphite-900 dark:text-graphite-100">{s.titulo}</h3>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 text-sm text-graphite-700 dark:text-graphite-300 cursor-pointer">
                    <input type="radio" name={s.titulo} checked={s.temAlt} onChange={() => s.setTemAlt(true)} className="h-4 w-4 text-aviation-600" />
                    ABAIXO
                  </label>
                  <label className="flex items-center gap-2 text-sm text-graphite-700 dark:text-graphite-300 cursor-pointer">
                    <input type="radio" name={s.titulo} checked={!s.temAlt} onChange={() => { s.setTemAlt(false); s.setTexto(''); }} className="h-4 w-4 text-aviation-600" />
                    SEM ALTERAÇÕES
                  </label>
                </div>
                {s.temAlt && (
                  <textarea value={s.texto} onChange={e => s.setTexto(e.target.value)} rows={2} placeholder={s.placeholder} className={inputClass + ' resize-y'} />
                )}
              </div>
            ))}
            </div>

          {/* IX */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">IX. Ocorrências Não Aeronáuticas</h3>
            <textarea value={ocorrenciasNA} onChange={e => setOcorrenciasNA(e.target.value)} rows={2} placeholder="Descreva as ocorrências não aeronáuticas..." className={inputClass + ' resize-y'} />
          </div>

          {/* X */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">X. Inspeções Técnicas e Vistorias</h3>
            <textarea value={inspecoes} onChange={e => setInspecoes(e.target.value)} rows={2} placeholder="Descreva as inspeções técnicas e vistorias..." className={inputClass + ' resize-y'} />
          </div>

          {/* XI */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">XI. Emergências Aeronáuticas</h3>
            <textarea value={emergenciaXI} onChange={e => setEmergenciaXI(e.target.value)} rows={2} placeholder="Descreva a emergência..." className={inputClass + ' resize-y'} />
          </div>

          {/* XII */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">XII. Outras Ocorrências</h3>
            <textarea value={outrasOcorrencias} onChange={e => setOutrasOcorrencias(e.target.value)} rows={3} placeholder="Uma ocorrência por linha..." className={inputClass + ' resize-y'} />
          </div>

          {/* XIII */}
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-2 font-bold text-graphite-900 dark:text-graphite-100">XIII. Solicitações à CCR</h3>
            <textarea value={solicitacoesCCR} onChange={e => setSolicitacoesCCR(e.target.value)} rows={2} placeholder="Uma solicitação por linha..." className={inputClass + ' resize-y'} />
          </div>

          <div className="flex justify-between">
            <button onClick={() => draftId ? setView('lista') : setStep('trocas')} className="flex items-center gap-1 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex gap-3">
              <button onClick={handlePreview} data-lro-tour="visualizar-pdf" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-violet-600 disabled:opacity-50">
                <Eye className="h-4 w-4" /> Visualizar
              </button>
              <button onClick={handleSalvarRascunho} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar Rascunho'}
              </button>
              <button onClick={() => {
                if (!chefeEquipe) { setErroValidacao('Selecione o Chefe de Equipe (campo 1.1).'); return; }
                if (!comunicacao) { setErroValidacao('Selecione a Comunicação BA-OC (campo 1.2).'); return; }
                if (!dataInicio) { setErroValidacao('Data de início do plantão é obrigatória.'); return; }
                if (bloquearEquipeAtual('revisar')) return;
                setErroValidacao('');
                setStep('revisar');
              }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
                Revisar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'revisar' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-4 w-fit max-w-full text-lg font-bold text-graphite-900 dark:text-graphite-100" data-lro-tour="revisao-final">Resumo do LRO</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Equipe:</span> {equipe}</p>
              <p><span className="font-semibold">Plantão:</span> {formatarDataBR(dataInicio)} a {formatarDataBR(dataFim)}</p>
              <p><span className="font-semibold">Chefe de Equipe:</span> {chefeEquipe || '-'}</p>
              <p><span className="font-semibold">Comunicação:</span> {comunicacao || '-'}</p>
              <p><span className="font-semibold">Trocas:</span> {substituicoesDetectadas.filter(s => s.tipo === 'troca' && s.confirmada !== false).length} confirmada(s) + {trocasManuais.length} emergencial(is)</p>
              {instrucoes && (Array.isArray(instrucoes) ? instrucoes.length : instrucoes.split('\n').filter(Boolean).length) > 0 && <p><span className="font-semibold">Instruções:</span> {Array.isArray(instrucoes) ? instrucoes.length : instrucoes.split('\n').filter(Boolean).length} registro(s)</p>}
              {emergenciaXI && <p><span className="font-semibold">Emergência Aeronáutica:</span> Sim</p>}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('preencher')} className="flex items-center gap-1 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(true)} data-lro-tour="finalizar-lro" disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-500/20 transition-all hover:from-green-500 hover:to-green-600 active:scale-[0.98] disabled:opacity-50">
                <Check className="h-4 w-4" /> {saving ? 'Finalizando...' : 'Finalizar LRO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <AlertModal
        open={showConfirmTroca}
        title="Atenção - Troca Registrada"
        message={(
          <>
            <p className="mb-3">
              Esta troca consta no sistema como um documento de <strong>Troca de Serviço</strong>.
            </p>
            <p>
              Se ela realmente não ocorreu, ela deverá ser cancelada no formulário de Troca de Serviço para evitar inconsistências. Deseja marcar como incorreta mesmo assim?
            </p>
          </>
        )}
        variant="danger"
        confirmLabel="Sim, marcar como incorreta"
        cancelLabel="Voltar"
        onClose={() => { setShowConfirmTroca(false); setTrocaRecusadaIdx(null); }}
        onConfirm={handleConfirmTrocaRecusada}
      />

      <AlertModal
        open={showConfirmAdicionar}
        title="Adicionar Troca Manual"
        message={(
          <>
            Após adicionar esta troca, ela será incluída no LRO como uma troca confirmada e <strong>não será mais possível removê-la</strong>.
          </>
        )}
        variant="warning"
        confirmLabel="Sim, adicionar"
        cancelLabel="Voltar"
        confirmDisabled={!trocaSolicitante || !trocaSolicitado}
        onClose={() => setShowConfirmAdicionar(false)}
        onConfirm={handleConfirmAdicionarTrocaManual}
      />

      <AlertModal
        open={showConfirmCorreta}
        title="Confirmar Troca"
        message={(
          <>
            Confirma que esta troca está <strong>correta</strong>? Após confirmar, <strong>não será possível alterar</strong>.
          </>
        )}
        variant="success"
        confirmLabel="Sim, confirmar"
        cancelLabel="Voltar"
        onClose={() => { setShowConfirmCorreta(false); setTrocaConfirmadaIdx(null); }}
        onConfirm={handleConfirmTrocaCorreta}
      />

      <AlertModal
        open={showConfirm}
        title="Finalizar LRO"
        message={(
          <>
            Ao finalizar, o LRO ficará <strong>aguardando aprovação</strong>. Depois de aprovado/finalizado, apenas administrador ou desenvolvedor poderá editar; qualquer edição voltará para aprovação.
          </>
        )}
        variant="success"
        confirmLabel="Sim, finalizar"
        loadingLabel="Finalizando..."
        onClose={() => setShowConfirm(false)}
        onConfirm={handleFinalizarLRO}
      />
      {renderBotaoTutorialFlutuante()}
      <AnimatedLroTour
        open={showTutorial}
        steps={LRO_TOUR_STEPS}
        stepIndex={tutorialStepIndex}
        onBack={voltarTutorialLRO}
        onNext={avancarTutorialLRO}
        onClose={fecharTutorialLRO}
      />
    </PageContainer>
  );
}

export default GerarLRO;
