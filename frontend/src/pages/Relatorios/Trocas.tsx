import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  RefreshCw, Plus, ArrowLeft, FileText, Loader2,
  Save, ChevronDown, ChevronUp, Filter, Printer,
  AlertTriangle, AlertCircle, Edit, Trash2, Eye, CheckCircle, X, Archive, Lock, HelpCircle, MousePointer2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { Autocomplete } from '../../components/documentos/Autocomplete';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import {
  listarDocumentos, buscarDocumento, criarDocumento,
  criarCamposEmLote, criarSignatario,
  criarPreenchimento, listarPreenchimentos,
  atualizarPreenchimento, excluirPreenchimento, getPdfBlob,
} from '../../services/documentoService';
import { preencherPdf } from '../../services/pdfService';
import { DOCUMENT_TEMPLATES, findTemplate } from '../../data/documentTemplates';
import type { TemplateFieldDef } from '../../data/documentTemplates';
import {
  gerarRelatorioTrocasMensalPdf,
  nomeArquivoRelatorioTrocasMensal,
} from '../../services/trocasMensalPdfService';
import type { DocumentWithFields, DocumentField, DocumentFill } from '../../types/document';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import { listarVigencias, type VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';
import type { Bombeiro } from '../../types/bombeiro';
import { CARGO_OPTIONS, EQUIPE_OPTIONS } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import { estaNoPeriodoISO, formatarDataBR, formatarDataHoraBR, hojeLocalISO, normalizarDataISO } from '../../utils/datas';
import { nomeArquivoTrocaServicoPdf } from '../../utils/documentFileNames';
type SubView = 'list' | 'form';
type ViewMode = 'list' | 'report';
type PessoaTroca = { id: string; tipo: 'bombeiro' | 'apoc'; cargo: string; nomeGuerra: string; nomeCompleto: string; equipe: string; turno: string };

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MAX_TROCAS_PER_MONTH = 3;
const AUDITORIA_CARGO_PREFIXES = [
  'SUPERVISOR',
  'FERISTA',
  'BA-CE',
  'BA-LR',
  'BA-MC',
  'BA-RE',
  'BA-2',
  'APOC',
  'GS',
  'OC',
];

function getDataPlantaoTrocaData(data: Record<string, unknown>): string {
  return normalizarDataISO(data.data_solicitada) || normalizarDataISO(data.data_folga_solicitado);
}

function getDataPlantaoTroca(fill: DocumentFill): string {
  return getDataPlantaoTrocaData(fill.filled_data || {}) || normalizarDataISO(fill.created_at);
}

function pertenceAoMesAnoTroca(fill: DocumentFill, mes: number, ano: number): boolean {
  const dataPlantao = getDataPlantaoTroca(fill);
  return dataPlantao.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}-`);
}

function compararTrocasPorPlantaoDesc(a: DocumentFill, b: DocumentFill): number {
  const dataA = getDataPlantaoTroca(a);
  const dataB = getDataPlantaoTroca(b);
  const byPlantao = dataB.localeCompare(dataA);
  if (byPlantao !== 0) return byPlantao;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const template = DOCUMENT_TEMPLATES[0];
const TROCA_TEMPLATE_PDF_URL = '/templates/troca.pdf';
const MM_TO_VIEWPORT = 2.8346 * 1.5;

function pdfPosition(xMm: number, yMm: number, widthMm: number, heightMm: number, fontSize = 8, textAlign?: 'left' | 'center' | 'right') {
  return {
    page: 1,
    x: xMm * MM_TO_VIEWPORT,
    y: yMm * MM_TO_VIEWPORT,
    width: widthMm * MM_TO_VIEWPORT,
    height: heightMm * MM_TO_VIEWPORT,
    font_size: fontSize,
    text_align: textAlign,
  };
}

const TROCA_PDF_POSITION_OVERRIDES = new Map<string, ReturnType<typeof pdfPosition>>([
  ['nome_solicitante', pdfPosition(18, 31.4, 101, 7, 11)],
  ['cpf_solicitante', pdfPosition(149, 32.1, 52, 7, 10.5, 'center')],
  ['data_solicitada', pdfPosition(111, 40, 50, 7, 10.5, 'center')],
  ['funcao_solicitante', pdfPosition(111, 48.6, 48, 7, 11, 'center')],
  ['motivo_troca', pdfPosition(10, 57.7, 180, 14.5, 10.5)],
  ['nome_solicitado', pdfPosition(10, 82.5, 93, 7, 11)],
  ['cpf_solicitado', pdfPosition(123, 82.65, 54, 7, 10.5, 'center')],
  ['data_folga_solicitado', pdfPosition(144, 99.8, 49, 7, 10.5, 'center')],
  ['check_troca_sim', pdfPosition(49.1, 225.3, 3.3, 3.3, 16)],
  ['check_troca_nao', pdfPosition(72.8, 225.3, 3.3, 3.3, 16)],
  ['justificativa_emergencial', pdfPosition(74, 232.1, 113, 7, 10.5)],
  ['data_autentique_1', pdfPosition(42, 153.1, 30, 7, 10.5)],
  ['data_autentique_2', pdfPosition(141, 153.1, 30, 7, 10.5)],
  ['data_autentique_3', pdfPosition(76, 240, 30, 7, 10.5)],
  ['check_deferido', pdfPosition(11.9, 255.8, 3.3, 3.3, 16)],
  ['check_indeferido', pdfPosition(11.9, 261.9, 3.3, 3.3, 16)],
  ['assinatura_solicitante', pdfPosition(22, 147, 65, 5)],
  ['assinatura_solicitado', pdfPosition(117, 147, 65, 5)],
  ['assinatura_chefe_solicitante', pdfPosition(22, 188, 65, 5)],
  ['assinatura_chefe_solicitado', pdfPosition(117, 188, 65, 5)],
  ['assinatura_gerente', pdfPosition(72, 280, 65, 5)],
]);

const CHECK_FIELD_OVERRIDES = new Map<string, { font_size: number; width: number; height: number }>(
  template.fields
    .filter(f => f.field_name.startsWith('check_'))
    .map(f => [f.field_name, { font_size: f.font_size, width: f.width, height: f.height }])
);

type TrocaPdfExtraPosition = ReturnType<typeof pdfPosition> & {
  field_name: string;
  field_type?: string;
  image_padding?: number;
  image_border?: boolean;
  checkbox_mode?: 'mark-only' | 'clean-box';
};

const TROCA_PDF_EXTRA_POSITIONS: TrocaPdfExtraPosition[] = [
  {
    ...pdfPosition(6.8, 8.7, 34.2, 17.2),
    field_name: 'logo_med_group',
    field_type: 'image',
    image_padding: 1.3,
    image_border: false,
  },
  {
    ...pdfPosition(152.7, 99.8, 4, 7, 10.5),
    field_name: 'data_folga_prefixo_a',
  },
  {
    ...pdfPosition(114.3, 82.65, 10, 7, 10.5),
    field_name: 'cpf_solicitado_prefixo',
  },
];

function fieldPositionsFromDoc(doc: DocumentWithFields) {
  const fields = doc.document_fields.map(f => {
    const fallback = TROCA_PDF_POSITION_OVERRIDES.get(f.field_name);
    const field = fallback
      ? { ...f, ...fallback }
      : f;
    const override = fallback ? undefined : CHECK_FIELD_OVERRIDES.get(f.field_name);
    return {
      field_name: field.field_name,
      x: field.x,
      y: field.y,
      width: override?.width ?? field.width,
      height: override?.height ?? field.height,
      font_size: override?.font_size ?? field.font_size,
      is_signature: field.is_signature,
      field_type: field.field_type,
      page: field.page,
      text_align: fallback?.text_align,
      checkbox_mode: field.field_name.startsWith('check_') ? 'clean-box' as const : undefined,
    };
  });
  return [...fields, ...TROCA_PDF_EXTRA_POSITIONS];
}

function templateFieldsToDocFields(fields: TemplateFieldDef[]): DocumentField[] {
  return fields.map((tf, i) => ({
    ...fieldInputFromTemplate('', tf, i),
    id: `tpl_${i}`,
    created_at: new Date().toISOString(),
  }));
}

function fieldInputFromTemplate(documentId: string, tf: TemplateFieldDef, orderIndex: number): Omit<DocumentField, 'id' | 'created_at'> {
  const fallback = TROCA_PDF_POSITION_OVERRIDES.get(tf.field_name);
  return {
    document_id: documentId,
    field_name: tf.field_name,
    field_label: tf.field_label,
    field_type: tf.field_type,
    required: tf.required,
    placeholder: tf.placeholder,
    options: tf.options,
    order_index: orderIndex,
    page: fallback?.page ?? 1,
    x: fallback?.x ?? 0,
    y: fallback?.y ?? 0,
    width: fallback?.width ?? tf.width,
    height: fallback?.height ?? tf.height,
    font_size: fallback?.font_size ?? tf.font_size,
    data_source: tf.data_source,
    is_signature: tf.is_signature,
    signer_role: tf.signer_role,
    read_only: tf.read_only,
    conditional_on: tf.conditional_on,
  };
}

function normalizeTrocaDocument(doc: DocumentWithFields | null): DocumentWithFields | null {
  if (!doc) return null;
  return {
    ...doc,
    template_pdf_url: doc.template_pdf_url || TROCA_TEMPLATE_PDF_URL,
    source_module: doc.source_module || 'trocas',
    document_fields: doc.document_fields.length > 0
      ? doc.document_fields
      : templateFieldsToDocFields(template.fields),
  };
}

async function getTrocaPdfBlob(doc: DocumentWithFields): Promise<Blob | null> {
  const primaryPath = doc.template_pdf_url || TROCA_TEMPLATE_PDF_URL;
  if (!primaryPath.startsWith('/')) return getPdfBlob(TROCA_TEMPLATE_PDF_URL);
  const primaryBlob = await getPdfBlob(primaryPath);
  if (primaryBlob || primaryPath === TROCA_TEMPLATE_PDF_URL) return primaryBlob;
  return getPdfBlob(TROCA_TEMPLATE_PDF_URL);
}

const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Excluindo...';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

type TrocasTourStep = {
  target: string;
  subView: SubView;
  viewMode?: ViewMode;
  title: string;
  body: string;
  detail: string;
};

type TourRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;

const TROCAS_TOUR_STEPS: TrocasTourStep[] = [
  {
    target: 'trocas-cabecalho',
    subView: 'list',
    viewMode: 'list',
    title: 'Entenda o topo da tela',
    body: 'A tela começa pela lista de trocas do mês. No topo ficam o nome da página, o Pré Relatório para conferência administrativa e o botão Criar Troca.',
    detail: 'Use Criar Troca quando for registrar uma permuta nova. O Pré Relatório é uma visão de conferência, não o lugar principal para preencher a troca.',
  },
  {
    target: 'trocas-filtros',
    subView: 'list',
    viewMode: 'list',
    title: 'Filtre antes de procurar',
    body: 'Aqui você escolhe mês, ano e equipe. O contador à direita mostra quantas trocas foram encontradas com esses filtros.',
    detail: 'Esses filtros ajudam a conferir limite mensal, localizar rascunhos e revisar trocas aprovadas sem misturar plantões de períodos diferentes.',
  },
  {
    target: 'trocas-lista',
    subView: 'list',
    viewMode: 'list',
    title: 'Leia os cartões da lista',
    body: 'Cada cartão mostra quem pediu a troca, quem foi chamado, status do documento e alertas de limite, emergência, turnos ou funções diferentes.',
    detail: 'Ao abrir um cartão, você vê datas, motivo, autorização e ações como visualizar PDF, editar rascunho, arquivar ou excluir quando tiver permissão.',
  },
  {
    target: 'trocas-criar',
    subView: 'list',
    viewMode: 'list',
    title: 'Comece por Criar Troca',
    body: 'Este botão abre o formulário da permuta. Antes de preencher, o sistema verifica sua permissão e acompanha o limite de trocas por pessoa no mês.',
    detail: 'Quando uma troca for aprovada, ela passa a alimentar automaticamente a escala diária, o LRO e os demais fluxos que dependem do efetivo correto.',
  },
  {
    target: 'trocas-formulario-topo',
    subView: 'form',
    title: 'Você entrou no formulário',
    body: 'O botão Voltar retorna para a lista. O título mostra se você está criando uma nova troca ou editando um rascunho existente.',
    detail: 'Os botões do lado direito só devem ser usados depois de conferir solicitante, solicitado, datas, motivo e necessidade de autorização.',
  },
  {
    target: 'trocas-solicitante',
    subView: 'form',
    title: 'Preencha o solicitante',
    body: 'Solicitante é a pessoa que pediu a troca e quer ser coberta em um plantão. Selecione o nome correto para o sistema completar CPF e função.',
    detail: 'A data solicitada será a folga ou plantão que essa pessoa está entregando para o colega trabalhar no lugar dela.',
  },
  {
    target: 'trocas-solicitado',
    subView: 'form',
    title: 'Informe quem foi chamado',
    body: 'Solicitado é quem aceitou fazer a cobertura. A função precisa estar coerente, porque trocas entre funções diferentes exigem atenção extra.',
    detail: 'Quando os dados das duas pessoas ficam corretos, a escala consegue inverter o efetivo do dia sem bagunçar cargo, turno e equipe.',
  },
  {
    target: 'trocas-dados',
    subView: 'form',
    title: 'Revise as datas e o motivo',
    body: 'Em Dados da Troca ficam a data em que o solicitante será coberto, a data de folga do solicitado, a marcação emergencial e o motivo.',
    detail: 'Se marcar como emergencial, informe uma justificativa clara. Trocas emergenciais e casos fora da regra ficam destacados para revisão.',
  },
  {
    target: 'trocas-assinaturas',
    subView: 'form',
    title: 'Confira as assinaturas',
    body: 'Esta área indica os campos de assinatura do documento: solicitante, solicitado, chefias e gerente quando necessário.',
    detail: 'O PDF final depende dessas posições para sair pronto para assinatura, aprovação, salvamento e impressão.',
  },
  {
    target: 'trocas-acoes-form',
    subView: 'form',
    title: 'Finalize do jeito certo',
    body: 'Visualizar mostra o PDF antes de aprovar. Aprovar gera o documento e confirma a troca. Salvar Rascunho guarda para continuar depois.',
    detail: 'Só aprove quando tudo estiver certo, porque a troca aprovada passa a impactar escala, LRO e relatórios do período.',
  },
];

function getTrocasTourTargetRect(target: string): DOMRect | null {
  const element = document.querySelector(`[data-trocas-tour="${target}"]`) as HTMLElement | null;
  return element ? element.getBoundingClientRect() : null;
}

function fallbackTrocasTourRect(): TourRect {
  const width = Math.min(320, window.innerWidth - 32);
  const height = 112;
  const left = (window.innerWidth - width) / 2;
  const top = Math.max(80, (window.innerHeight - height) / 2);
  return { top, left, right: left + width, bottom: top + height, width, height };
}

function normalizeTrocasTourRect(rect: TourRect): TourRect {
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

function trocasTourPanelStyle(rect: TourRect): CSSProperties {
  const margin = 16;
  const width = Math.min(window.innerWidth < 900 ? 390 : 430, window.innerWidth - margin * 2);
  const estimatedHeight = Math.min(380, window.innerHeight - margin * 2);
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - estimatedHeight - margin;

  if (window.innerWidth < 700) {
    return { left: margin, right: margin, bottom: margin, maxHeight: estimatedHeight };
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
  return { left: best.left, top: best.top, width, maxHeight: estimatedHeight };
}

function AnimatedTrocasTour({
  open,
  steps,
  stepIndex,
  onBack,
  onNext,
  onClose,
}: {
  open: boolean;
  steps: TrocasTourStep[];
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
    const element = document.querySelector(`[data-trocas-tour="${step.target}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    const updateRect = () => setRect(getTrocasTourTargetRect(step.target));
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

  const targetRect = normalizeTrocasTourRect(rect || fallbackTrocasTourRect());
  const panelStyle = trocasTourPanelStyle(targetRect);
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
        className="fixed z-[62] h-9 w-9 -translate-x-1 -translate-y-1 animate-bounce text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] transition-all duration-700 ease-out"
        style={cursorStyle}
        fill="white"
      />

      <div
        className="pointer-events-auto fixed z-[63] overflow-y-auto rounded-2xl border border-graphite-200 bg-white p-5 shadow-2xl shadow-black/25 dark:border-border-dark dark:bg-surface-card"
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
          <span className="font-bold">Como funciona: </span>{step.detail}
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

export function Trocas() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>('list');
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const [viewMode, setViewMode] = useState<ViewMode>(isRelatorioRoute ? 'report' : 'list');
  const canCreateTroca = !isRelatorioRoute && (canManageGlobal || !!equipeEfetiva);

  const [archiveConfirmFill, setArchiveConfirmFill] = useState<DocumentFill | null>(null);
  const [templateDoc, setTemplateDoc] = useState<DocumentWithFields | null>(null);
  const [fills, setFills] = useState<DocumentFill[]>([]);
  const [expandedFill, setExpandedFill] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirmPdf, setShowConfirmPdf] = useState(false);
  const [editingFillId, setEditingFillId] = useState<string | null>(null);
  const [draftCountdowns, setDraftCountdowns] = useState<Record<string, number>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showJustificativaPopup, setShowJustificativaPopup] = useState<string | null>(null);
  const [showValidationPopup, setShowValidationPopup] = useState<string | null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPreviewInfo, setShowPreviewInfo] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfName, setPreviewPdfName] = useState('');
  const [previewAllowDownload, setPreviewAllowDownload] = useState(false);
  const [showRelatorioMensalModal, setShowRelatorioMensalModal] = useState(false);
  const [relatorioMensalObs, setRelatorioMensalObs] = useState('');
  const [gerandoRelatorioMensal, setGerandoRelatorioMensal] = useState(false);
  const [showAutorizacaoAviso, setShowAutorizacaoAviso] = useState(false);
  const [bombeirosList, setBombeirosList] = useState<Bombeiro[]>([]);
  const [apocsList, setApocsList] = useState<APOC[]>([]);
  const [vigenciasList, setVigenciasList] = useState<VigenciaSubstituicao[]>([]);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth());
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [filterEquipe, setFilterEquipe] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const tutorialOrigemRef = useRef<{ subView: SubView; viewMode: ViewMode; scrollX: number; scrollY: number } | null>(null);

  const FIELD_LABEL_OVERRIDES: Record<string, string> = {
    deferido_indeferido: 'Parecer do Embaixador',
  };

  function tutorialIndexInicial(): number {
    const formIndex = TROCAS_TOUR_STEPS.findIndex(step => step.subView === 'form');
    return subView === 'form' && formIndex >= 0 ? formIndex : 0;
  }

  function abrirTutorialTrocas() {
    if (showTutorial || isRelatorioRoute || !canCreateTroca) return;
    tutorialOrigemRef.current = {
      subView,
      viewMode,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    setTutorialStepIndex(tutorialIndexInicial());
    setShowTutorial(true);
  }

  function fecharTutorialTrocas() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    if (origem) {
      setSubView(origem.subView);
      setViewMode(origem.viewMode);
      window.setTimeout(() => {
        window.scrollTo({ left: origem.scrollX, top: origem.scrollY, behavior: 'smooth' });
      }, 80);
    }
    tutorialOrigemRef.current = null;
  }

  function voltarTutorialTrocas() {
    setTutorialStepIndex(index => Math.max(0, index - 1));
  }

  function avancarTutorialTrocas() {
    if (tutorialStepIndex >= TROCAS_TOUR_STEPS.length - 1) {
      fecharTutorialTrocas();
      return;
    }
    setTutorialStepIndex(tutorialStepIndex + 1);
  }

  useEffect(() => {
    if (!showTutorial) return;
    const tourStep = TROCAS_TOUR_STEPS[tutorialStepIndex] || TROCAS_TOUR_STEPS[0];
    if (subView !== tourStep.subView) setSubView(tourStep.subView);
    if (tourStep.viewMode && viewMode !== tourStep.viewMode) setViewMode(tourStep.viewMode);
  }, [showTutorial, tutorialStepIndex, subView, viewMode]);

  function renderBotaoTutorialTrocas() {
    if (showTutorial || isRelatorioRoute || !canCreateTroca) return null;
    return (
      <button
        type="button"
        onClick={abrirTutorialTrocas}
        aria-label="Abrir tutorial animado de Trocas de Servico"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-white shadow-2xl shadow-aviation-500/30 ring-4 ring-white/70 transition-all hover:scale-105 hover:from-aviation-400 hover:to-aviation-600 dark:ring-graphite-900/80"
      >
        <HelpCircle className="h-7 w-7" />
      </button>
    );
  }

  function closePdfPreview() {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setShowPdfPreview(false);
    setPreviewPdfUrl('');
    setPreviewPdfData(null);
    setPreviewPdfName('');
    setPreviewAllowDownload(false);
  }

  function abrirPdfPreview(pdfBlob: Blob, nomeArquivo: string, allowDownload: boolean) {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    const url = URL.createObjectURL(pdfBlob);
    setPreviewPdfUrl(url);
    pdfBlob.arrayBuffer().then(setPreviewPdfData).catch(() => setPreviewPdfData(null));
    setPreviewPdfName(nomeArquivo);
    setPreviewAllowDownload(allowDownload);
    setShowPdfPreview(true);
  }

  async function getDocumentForFill(fill: DocumentFill): Promise<DocumentWithFields | null> {
    if (templateDoc?.id === fill.document_id) return templateDoc;
    try {
      const full = await buscarDocumento(fill.document_id);
      const normalized = normalizeTrocaDocument(full);
      if (normalized) setTemplateDoc(normalized);
      return normalized;
    } catch {
      return templateDoc || null;
    }
  }

  function baixarPreviewPdf() {
    if (!previewPdfUrl || !previewPdfName) return;
    const link = document.createElement('a');
    link.href = previewPdfUrl;
    link.download = previewPdfName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function imprimirPreviewPdf() {
    if (!previewPdfUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = previewPdfUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    };
  }

  function abrirRelatorioMensalModal() {
    setRelatorioMensalObs('');
    setShowRelatorioMensalModal(true);
  }

  async function handleGerarRelatorioMensal() {
    try {
      setGerandoRelatorioMensal(true);
      const rows = trocasMensaisAprovadas.map(fill => {
        const data = fill.filled_data as Record<string, string>;
        return {
          nomeSolicitante: getNomeCompletoRelatorio(data.nome_solicitante || ''),
          dataSolicitada: data.data_solicitada || '',
          dataATrabalhar: data.data_folga_solicitado || '',
          nomeSolicitado: getNomeCompletoRelatorio(data.nome_solicitado || ''),
        };
      });
      const blob = await gerarRelatorioTrocasMensalPdf({
        mes: filterMonth,
        ano: filterYear,
        rows,
        observacao: relatorioMensalObs,
      });
      abrirPdfPreview(blob, nomeArquivoRelatorioTrocasMensal(filterMonth, filterYear), true);
      setShowRelatorioMensalModal(false);
    } catch {
      setShowNotifPopup({ msg: 'Erro ao gerar relatório mensal de trocas.', type: 'error' });
    } finally {
      setGerandoRelatorioMensal(false);
    }
  }

  function renderPdfPreviewModal() {
    if (!showPdfPreview) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-graphite-100 dark:bg-graphite-900">
        <div className="sticky top-0 z-40 border-b border-graphite-200 bg-white/95 backdrop-blur dark:border-border-dark dark:bg-surface-card/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="min-w-0">
              <button onClick={closePdfPreview} className="mb-1 flex items-center gap-1 text-sm text-graphite-500 hover:text-graphite-700 dark:hover:text-graphite-300">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <h2 className="truncate text-lg font-semibold text-graphite-900 dark:text-graphite-100">Visualizar Documento</h2>
              {previewPdfName && (
                <p className="truncate text-xs font-medium text-graphite-500 dark:text-graphite-400">{previewPdfName}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {previewAllowDownload && (
                <>
                  <button
                    type="button"
                    onClick={imprimirPreviewPdf}
                    disabled={!previewPdfUrl}
                    className="flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-4 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={baixarPreviewPdf}
                    disabled={!previewPdfUrl}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" /> Baixar PDF
                  </button>
                </>
              )}
              <button onClick={closePdfPreview}
                className="rounded-xl border border-graphite-200 p-2 text-graphite-600 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-300 dark:hover:bg-graphite-700">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 justify-center overflow-auto bg-graphite-100 px-4 py-8 dark:bg-graphite-900">
          <div className="w-full max-w-[960px]">
            {previewPdfData ? (
              <PdfPreview pdfData={previewPdfData} fields={[]} />
            ) : (
              <div className="flex h-[70vh] items-center justify-center rounded-2xl bg-white text-sm text-graphite-500 shadow-2xl dark:bg-surface-card">
                Carregando documento...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const displayFields = useMemo(() => {
    const base = templateDoc ? templateDoc.document_fields : templateFieldsToDocFields(template.fields);
    return base
      .filter(f => !f.field_name.startsWith('check_'))
      .map(f => {
        let patched = FIELD_LABEL_OVERRIDES[f.field_name] ? { ...f, field_label: FIELD_LABEL_OVERRIDES[f.field_name] } : f;
        if (patched.field_name === 'motivo_troca' || patched.field_name === 'justificativa_emergencial') {
          patched = { ...patched, field_type: 'textarea', is_signature: false, read_only: false, data_source: 'manual' };
        }
        return patched;
      });
  }, [templateDoc]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const filteredFills = useMemo(() => {
    return fills.filter(fill => {
      if (fill.status === 'archived') return false;
      if (filterEquipe) {
        const data = fill.filled_data as Record<string, string>;
        const p1 = getPessoaByNome(data.nome_solicitante || '');
        const p2 = getPessoaByNome(data.nome_solicitado || '');
        const eq1 = p1?.equipe || '';
        const eq2 = p2?.equipe || '';
        if (eq1 !== filterEquipe && eq2 !== filterEquipe) return false;
      }
      return pertenceAoMesAnoTroca(fill, filterMonth, filterYear);
    }).sort(compararTrocasPorPlantaoDesc);
  }, [fills, filterMonth, filterYear, filterEquipe]);

  const violationFillIds = useMemo(() => {
    const ids = new Set<string>();
    filteredFills.forEach(f => {
      const fd = f.filled_data as Record<string, string>;
      const { pessoaSol: p1, pessoaSolic: p2, cargoSolPlantao: cargo1, cargoSolicPlantao: cargo2 } = getFuncoesTroca(fd);
      if (cargo1 && cargo2 && cargo1 !== cargo2) ids.add(f.id);
      if (p1?.turno && p2?.turno && !mesmoTurnoEfetivo(p1, p2)) ids.add(f.id);
      if (fd.troca_emergencial === 'SIM') ids.add(f.id);
    });
    getExcessoLimiteFillIds(filteredFills).forEach(id => ids.add(id));
    return ids;
  }, [filteredFills, bombeirosList, apocsList, vigenciasList]);

  const excessoLimiteIds = useMemo(() => {
    return getExcessoLimiteFillIds(filteredFills);
  }, [filteredFills, bombeirosList, apocsList]);

  useEffect(() => {
    if (isRelatorioRoute && loadingContexto) return;
    if (isRelatorioRoute && !canVisualizarRelatorios) {
      setLoading(false);
      return;
    }
    init();
  }, [isRelatorioRoute, canVisualizarRelatorios, loadingContexto]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const countdowns: Record<string, number> = {};
      const toDelete: string[] = [];
      fills.forEach(fill => {
        if (fill.status !== 'draft') return;
        const created = new Date(fill.created_at).getTime();
        const remaining = created + DRAFT_TTL_MS - nowMs;
        if (remaining <= 0) {
          toDelete.push(fill.id);
        } else {
          countdowns[fill.id] = remaining;
        }
      });
      setDraftCountdowns(countdowns);
      if (toDelete.length > 0) {
        toDelete.forEach(async (id) => {
          try { await excluirPreenchimento(id); } catch { /* ignore */ }
        });
        setFills(prev => prev.filter(f => !toDelete.includes(f.id)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fills]);

  async function init() {
    try {
      setLoading(true);
      const [docs, bombeiros, apocs, vigencias] = await Promise.all([
        listarDocumentos(),
        listarBombeiros().catch(() => { try { return JSON.parse(localStorage.getItem('sescinc-bombeiros') || '[]'); } catch { return []; } }),
        listarAPOCs(),
        listarVigencias({ ativa: true }).catch(() => []),
      ]);
      setBombeirosList(bombeiros);
      setApocsList(apocs);
      setVigenciasList(vigencias);
      const trocaDoc = docs.find(d => d.source_module === 'trocas') || docs.find(d => findTemplate(d.name) !== null);
      if (trocaDoc) {
        const full = await buscarDocumento(trocaDoc.id);
        setTemplateDoc(normalizeTrocaDocument(full));
        const docFills = await listarPreenchimentos(trocaDoc.id);
        setFills(docFills);
      }
    } catch {
      setShowNotifPopup({ msg: 'Erro ao carregar trocas. Contate o administrador.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function ensureDocumentExists(): Promise<DocumentWithFields | null> {
    if (templateDoc) return templateDoc;
    try {
      const doc = await criarDocumento({
        name: 'FORMULARIO DE TROCA DE SERVICOS (PERMUTA)',
        description: 'Formulario de Troca de Servicos - Permuta',
        category: 'administrativo',
        template_pdf_url: TROCA_TEMPLATE_PDF_URL,
        active: true,
        template_pdf_pages: 0, template_pdf_width: 0, template_pdf_height: 0,
        source_module: 'trocas',
        created_by: null,
      });
      await criarCamposEmLote(doc.id, template.fields.map((tf, i) => fieldInputFromTemplate(doc.id, tf, i)));
      for (const ts of template.signers) {
        await criarSignatario({ document_id: doc.id, signer_name: ts.signer_name, signer_role: ts.signer_role, order_index: ts.order_index, required: true });
      }
      const full = await buscarDocumento(doc.id);
      const normalized = normalizeTrocaDocument(full);
      setTemplateDoc(normalized);
      return normalized;
    } catch {
      setShowNotifPopup({ msg: 'Erro ao criar documento. Contate o administrador.', type: 'error' });
      return null;
    }
  }

  function startNewTroca() {
    if (!canCreateTroca) {
      setShowNotifPopup({ msg: 'Você precisa ter uma equipe efetiva para criar trocas.', type: 'error' });
      return;
    }
    const initialData: Record<string, string> = {};
    displayFields.forEach(f => { initialData[f.field_name] = ''; });
    setFormData(initialData);
    setEditingFillId(null);
    setSubView('form');
  }

  function handleFieldChange(fieldName: string, value: string) {
    setMissingFields(prev => prev.filter(f => f !== fieldName));
    if (fieldName === 'nome_solicitante' || fieldName === 'nome_solicitado') {
      handleNameSelect(fieldName, value);
      return;
    }
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }

  const HIDDEN_AUTENTIQUE_FIELDS = ['data_autentique_1', 'data_autentique_2', 'data_autentique_3', 'check_troca_sim', 'check_troca_nao', 'check_deferido', 'check_indeferido', 'deferido_indeferido'];

  function getAllFuncionarios() {
    return [
      ...bombeirosList.map(b => {
        const cargoLabel = CARGO_OPTIONS.find(c => c.value === b.cargo)?.label || b.cargo;
        return { label: b.nomeCompleto, sublabel: `${cargoLabel} - ${b.email}`, _type: 'bombeiro' as const, _raw: b };
      }),
      ...apocsList.map(a => {
        const funcaoLabel = a.funcao === 'SUPERVISOR' ? 'Supervisor' : 'APOC';
        return { label: a.nomeCompleto, sublabel: `${funcaoLabel} - ${a.email}`, _type: 'apoc' as const, _raw: a };
      }),
    ];
  }

  function getCargoLabel(cargo: string): string {
    if (!cargo) return cargo;
    return CARGO_OPTIONS.find(c => c.value === cargo)?.label || cargo;
  }

  function pessoaTrocaFromBombeiro(bombeiro: Bombeiro): PessoaTroca {
    return {
      id: bombeiro.id || '',
      tipo: 'bombeiro',
      cargo: bombeiro.cargo || '',
      nomeGuerra: bombeiro.nomeGuerra || '',
      nomeCompleto: bombeiro.nomeCompleto || '',
      equipe: bombeiro.equipe || '',
      turno: bombeiro.turno || '',
    };
  }

  function pessoaTrocaFromApoc(apoc: APOC): PessoaTroca {
    return {
      id: apoc.id || '',
      tipo: 'apoc',
      cargo: apoc.funcao || 'APOC',
      nomeGuerra: apoc.nomeGuerra || apoc.nomeCompleto || '',
      nomeCompleto: apoc.nomeCompleto || apoc.nomeGuerra || '',
      equipe: apoc.equipe || '',
      turno: apoc.turno || '',
    };
  }

  function extrairCargoAuditoria(value: string): string {
    const raw = String(value || '').trim();
    const upper = raw.toUpperCase();
    return AUDITORIA_CARGO_PREFIXES.find(cargo =>
      upper === cargo || upper.startsWith(`${cargo} `) || upper.startsWith(`${cargo} -`)
    ) || '';
  }

  function removerCargoAuditoria(value: string): string {
    const raw = String(value || '').trim();
    const cargo = extrairCargoAuditoria(raw);
    if (!cargo) return raw;
    return raw.slice(cargo.length).replace(/^(\s*-\s*|\s+)/, '').trim();
  }

  function getPessoaByNome(nome: string): PessoaTroca | null {
    if (!nome) return null;
    const all = getAllFuncionarios();
    const lower = nome.toLowerCase().trim();
    const primeiroNome = lower.split(' ')[0];
    const match = all.find(f => {
      if (f.label.toLowerCase() === lower) return true;
      if (f._raw.nomeGuerra?.toLowerCase() === lower) return true;
      if (f._raw.nomeGuerra?.toLowerCase() === primeiroNome) return true;
      if (lower.startsWith(f._raw.nomeGuerra?.toLowerCase() || '')) return true;
      const completo = (f._raw.nomeCompleto || f.label || '').toLowerCase();
      const partes = lower.split(' ');
      return partes.every((p: string) => completo.includes(p));
    });
    if (!match) return null;
    if (match._type === 'bombeiro') {
      return pessoaTrocaFromBombeiro(match._raw);
    }
    return pessoaTrocaFromApoc(match._raw);
  }

  function getCargoBaseTroca(pessoa: PessoaTroca | null, funcaoFallback = ''): string {
    return pessoa?.cargo || String(funcaoFallback || '').split(' - ')[0] || '';
  }

  function getCargoEfetivoNaData(pessoa: PessoaTroca | null, data: string, funcaoFallback = ''): string {
    const cargoBase = getCargoBaseTroca(pessoa, funcaoFallback);
    if (!pessoa?.id || pessoa.tipo !== 'bombeiro' || !data) return cargoBase;

    const vigencia = vigenciasList
      .filter(v =>
        v.substitutoId === pessoa.id &&
        v.substitutoId !== v.funcionarioOriginalId &&
        estaNoPeriodoISO(data, v.dataInicio, v.dataFim)
      )
      .sort((a, b) => a.nivelCascata - b.nivelCascata)[0];

    return vigencia?.cargoExercido || cargoBase;
  }

  function getPessoaByAuditoria(value: string): PessoaTroca | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const nomeSemCargo = removerCargoAuditoria(raw);
    const porNome = getPessoaByNome(nomeSemCargo) || getPessoaByNome(raw);
    if (porNome) return porNome;

    const chave = normalizarChavePessoaTroca(nomeSemCargo || raw);
    if (!chave) return null;

    const bombeiro = bombeirosList.find(b =>
      [b.id, b.matricula, b.email, b.nomeGuerra, b.nomeCompleto]
        .some(campo => normalizarChavePessoaTroca(campo || '') === chave)
    );
    if (bombeiro) return pessoaTrocaFromBombeiro(bombeiro);

    const apoc = apocsList.find(a =>
      [a.id, a.email, a.nomeGuerra, a.nomeCompleto]
        .some(campo => normalizarChavePessoaTroca(campo || '') === chave)
    );
    return apoc ? pessoaTrocaFromApoc(apoc) : null;
  }

  function getPessoaUsuarioAtualTroca(): PessoaTroca | null {
    const pessoaId = user?.pessoa?.id || '';
    if (pessoaId) {
      const bombeiro = bombeirosList.find(b => b.id === pessoaId);
      if (bombeiro) return pessoaTrocaFromBombeiro(bombeiro);

      const apoc = apocsList.find(a => a.id === pessoaId);
      if (apoc) return pessoaTrocaFromApoc(apoc);
    }

    return getPessoaByAuditoria(user?.pessoa?.nomeGuerra || user?.name || user?.username || '');
  }

  function formatarPessoaAuditoriaNaData(value: string, dataReferencia: string, fallback = 'Desconhecido'): string {
    const raw = String(value || fallback || '').trim();
    if (!raw) return 'Desconhecido';

    const pessoa = getPessoaByAuditoria(raw);
    if (!pessoa) return raw;

    const cargoFallback = extrairCargoAuditoria(raw) || pessoa.cargo;
    const cargo = getCargoEfetivoNaData(pessoa, dataReferencia, cargoFallback);
    const nome = pessoa.nomeGuerra || removerCargoAuditoria(raw) || pessoa.nomeCompleto;
    return [cargo, nome].filter(Boolean).join(' ');
  }

  function formatarUsuarioAtualComCargoEfetivo(data: Record<string, string>): string {
    const dataReferencia = getDataPlantaoTrocaData(data) || hojeLocalISO();
    const pessoa = getPessoaUsuarioAtualTroca();
    const nome = pessoa?.nomeGuerra || user?.pessoa?.nomeGuerra || user?.name || user?.username || '';
    const cargoFallback = pessoa?.cargo || user?.pessoa?.funcao || '';
    const cargo = pessoa ? getCargoEfetivoNaData(pessoa, dataReferencia, cargoFallback) : cargoFallback;
    return [cargo, nome].filter(Boolean).join(' ');
  }

  function formatarCriadoPorTroca(fill: DocumentFill): string {
    const data = fill.filled_data as Record<string, string>;
    const raw = data.criado_por || fill.filled_by || '';
    return formatarPessoaAuditoriaNaData(raw, getDataPlantaoTroca(fill), raw || 'Desconhecido');
  }

  function formatarAutorizadoPorTroca(data: Record<string, string>, dataReferencia?: string): string {
    const raw = data.autorizado_por || '';
    if (!raw) return '';
    return formatarPessoaAuditoriaNaData(raw, dataReferencia || getDataPlantaoTrocaData(data) || hojeLocalISO(), raw);
  }

  function getFuncoesTroca(data: Record<string, string>) {
    const pessoaSol = getPessoaByNome(data.nome_solicitante || '');
    const pessoaSolic = getPessoaByNome(data.nome_solicitado || '');
    return {
      pessoaSol,
      pessoaSolic,
      cargoSolPlantao: getCargoEfetivoNaData(pessoaSol, data.data_solicitada || '', data.funcao_solicitante || ''),
      cargoSolicPlantao: getCargoEfetivoNaData(pessoaSolic, data.data_folga_solicitado || '', data.funcao_solicitado || ''),
    };
  }

  function normalizarChavePessoaTroca(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getPessoaTrocaInfo(nome: string, funcaoFallback = ''): { key: string; label: string } | null {
    if (!nome) return null;
    const pessoa = getPessoaByNome(nome);
    const cargo = pessoa?.cargo || String(funcaoFallback || '').split(' - ')[0] || '';
    const nomeCompleto = pessoa?.nomeCompleto || nome;
    const nomeGuerra = pessoa?.nomeGuerra || nomeCompleto;
    const keyBase = pessoa
      ? `${pessoa.cargo}|${pessoa.nomeCompleto || nomeGuerra}|${nomeGuerra}`
      : `${cargo}|${nomeCompleto}`;
    const key = normalizarChavePessoaTroca(keyBase);
    if (!key) return null;
    return {
      key,
      label: [cargo, nomeGuerra].filter(Boolean).join(' '),
    };
  }

  function getPessoasTrocaDoFill(fill: DocumentFill): { key: string; label: string; dataPlantao: string; created_at: string; id: string }[] {
    const data = fill.filled_data as Record<string, string>;
    const dataPlantao = getDataPlantaoTroca(fill);
    const pessoas = [
      getPessoaTrocaInfo(data.nome_solicitante || '', data.funcao_solicitante || ''),
      getPessoaTrocaInfo(data.nome_solicitado || '', data.funcao_solicitado || ''),
    ].filter((p): p is { key: string; label: string } => !!p);
    const vistos = new Set<string>();
    return pessoas
      .filter(pessoa => {
        if (vistos.has(pessoa.key)) return false;
        vistos.add(pessoa.key);
        return true;
      })
      .map(pessoa => ({ ...pessoa, dataPlantao, created_at: fill.created_at, id: fill.id }));
  }

  function getExcessoLimiteFillIds(sourceFills: DocumentFill[]): Set<string> {
    const pessoaFills: Record<string, { id: string; dataPlantao: string; created_at: string }[]> = {};
    const ids = new Set<string>();
    sourceFills.forEach(fill => {
      getPessoasTrocaDoFill(fill).forEach(pessoa => {
        if (!pessoaFills[pessoa.key]) pessoaFills[pessoa.key] = [];
        pessoaFills[pessoa.key].push({ id: pessoa.id, dataPlantao: pessoa.dataPlantao, created_at: pessoa.created_at });
      });
    });
    Object.values(pessoaFills).forEach(arr => arr.sort((a, b) => {
      const byPlantao = a.dataPlantao.localeCompare(b.dataPlantao);
      if (byPlantao !== 0) return byPlantao;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }));
    Object.values(pessoaFills).forEach(arr => {
      arr.forEach((fill, index) => {
        if (index >= MAX_TROCAS_PER_MONTH) ids.add(fill.id);
      });
    });
    return ids;
  }

  function getNomeCompletoRelatorio(nome: string): string {
    if (!nome) return '-';
    return getPessoaByNome(nome)?.nomeCompleto || nome;
  }

  function ordenarTrocasMensais(a: DocumentFill, b: DocumentFill): number {
    const dataA = a.filled_data as Record<string, string>;
    const dataB = b.filled_data as Record<string, string>;
    const nomeA = getNomeCompletoRelatorio(dataA.nome_solicitante || '').toLocaleLowerCase('pt-BR');
    const nomeB = getNomeCompletoRelatorio(dataB.nome_solicitante || '').toLocaleLowerCase('pt-BR');
    const byName = nomeA.localeCompare(nomeB, 'pt-BR');
    if (byName !== 0) return byName;

    const dateA = normalizarDataISO(dataA.data_solicitada) || normalizarDataISO(dataA.data_folga_solicitado) || '';
    const dateB = normalizarDataISO(dataB.data_solicitada) || normalizarDataISO(dataB.data_folga_solicitado) || '';
    const byDate = dateA.localeCompare(dateB);
    if (byDate !== 0) return byDate;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  const trocasMensaisAprovadas = useMemo(() => {
    return filteredFills
      .filter(fill => fill.status === 'signed')
      .sort(ordenarTrocasMensais);
  }, [filteredFills, bombeirosList, apocsList]);

  function getFillEquipes(fill: DocumentFill): string[] {
    const data = fill.filled_data as Record<string, string>;
    return Array.from(new Set([
      data.equipe || '',
      getPessoaByNome(data.nome_solicitante || '')?.equipe || '',
      getPessoaByNome(data.nome_solicitado || '')?.equipe || '',
    ].filter(Boolean)));
  }

  function canManageFill(fill: DocumentFill): boolean {
    if (canManageGlobal) return true;
    return getFillEquipes(fill).some(eq => canManageEquipe(eq));
  }

  function canManageFormData(data: Record<string, string>): boolean {
    if (canManageGlobal) return true;
    const equipes = [
      data.equipe || '',
      getPessoaByNome(data.nome_solicitante || '')?.equipe || '',
      getPessoaByNome(data.nome_solicitado || '')?.equipe || '',
    ].filter(Boolean);
    return equipes.some(eq => canManageEquipe(eq));
  }

  function displayNomeTroca(nome: string): string {
    const p = getPessoaByNome(nome);
    return p?.nomeCompleto || nome || 'Sem nome';
  }

  function nomeArquivoTroca(data: Record<string, string>): string {
    return nomeArquivoTrocaServicoPdf({
      ...data,
      nome_solicitante: getPessoaByNome(data.nome_solicitante || '')?.nomeGuerra || data.nome_solicitante || '',
      nome_solicitado: getPessoaByNome(data.nome_solicitado || '')?.nomeGuerra || data.nome_solicitado || '',
    });
  }

  function mesmoTurnoEfetivo(p1: { turno: string; equipe: string }, p2: { turno: string; equipe: string }): boolean {
    if (p1.turno === p2.turno) return true;
    if (p1.equipe === 'Ferista' || p2.equipe === 'Ferista') return true;
    return false;
  }

  function precisaAutorizacaoGerente(data: Record<string, string>, existingFills?: DocumentFill[]): boolean {
    const nomeSol = data.nome_solicitante || '';
    const nomeSolic = data.nome_solicitado || '';
    const pSol = getPessoaByNome(nomeSol);
    const pSolic = getPessoaByNome(nomeSolic);
    if (!pSol || !pSolic) return false;

    const dataPlantao = getDataPlantaoTrocaData(data);
    const sourceFills = existingFills || fills;

    const pessoaKeys = new Set([
      getPessoaTrocaInfo(nomeSol)?.key || '',
      getPessoaTrocaInfo(nomeSolic)?.key || '',
    ].filter(Boolean));
    for (const key of pessoaKeys) {
      const count = sourceFills.filter(f => {
        if (editingFillId && f.id === editingFillId) return false;
        return getDataPlantaoTroca(f).slice(0, 7) === dataPlantao.slice(0, 7) &&
          getPessoasTrocaDoFill(f).some(pessoa => pessoa.key === key);
      }).length;
      if (count >= MAX_TROCAS_PER_MONTH) return true;
    }

    if (pSol.turno && pSolic.turno && !mesmoTurnoEfetivo(pSol, pSolic)) return true;

    const { cargoSolPlantao, cargoSolicPlantao } = getFuncoesTroca(data);
    if (cargoSolPlantao && cargoSolicPlantao && cargoSolPlantao !== cargoSolicPlantao) return true;

    return false;
  }

  const personExcessList = useMemo(() => {
    const countMap: Record<string, { label: string; count: number }> = {};
    filteredFills.forEach(fill => {
      getPessoasTrocaDoFill(fill).forEach(pessoa => {
        if (!countMap[pessoa.key]) countMap[pessoa.key] = { label: pessoa.label, count: 0 };
        countMap[pessoa.key].count += 1;
      });
    });
    return Object.entries(countMap)
      .filter(([, pessoa]) => pessoa.count > MAX_TROCAS_PER_MONTH)
      .map(([key, pessoa]) => ({
        key,
        label: pessoa.label,
        excesso: pessoa.count - MAX_TROCAS_PER_MONTH,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [filteredFills, bombeirosList, apocsList]);

  function handleNameSelect(fieldName: string, value: string) {
    const all = getAllFuncionarios();
    const match = all.find(f => f.label === value);
    setFormData(prev => {
      const next = { ...prev, [fieldName]: value };
      if (match?._type === 'bombeiro') {
        const b = match._raw;
        if (fieldName === 'nome_solicitante') {
          next.cpf_solicitante = formatCpf(b.cpf || '');
          next.funcao_solicitante = b.cargo || '';
        } else if (fieldName === 'nome_solicitado') {
          next.cpf_solicitado = formatCpf(b.cpf || '');
          next.funcao_solicitado = b.cargo || '';
        }
      } else if (match?._type === 'apoc') {
        const a = match._raw;
        if (fieldName === 'nome_solicitante') {
          next.cpf_solicitante = '';
          next.funcao_solicitante = a.funcao || 'APOC';
        } else if (fieldName === 'nome_solicitado') {
          next.cpf_solicitado = '';
          next.funcao_solicitado = a.funcao || 'APOC';
        }
      }
      return next;
    });
  }

  function handleCpfChange(fieldName: string, raw: string) {
    setFormData(prev => ({ ...prev, [fieldName]: formatCpf(raw) }));
  }

  function validateForm(): boolean {
    const missing: string[] = [];
    for (const field of displayFields.filter(f => !f.is_signature && !HIDDEN_AUTENTIQUE_FIELDS.includes(f.field_name))) {
      if (field.conditional_on) {
        const [depFieldName, depValue] = field.conditional_on.split('=');
        if ((formData[depFieldName] || '') !== depValue) continue;
      }
      if (field.required && !formData[field.field_name]) {
        missing.push(field.field_name);
      }
    }
    setMissingFields(missing);
    if (missing.length > 0) {
      setShowValidationPopup('Preencha todos os campos obrigatorios. Os campos em vermelho precisam ser preenchidos.');
      return false;
    }
    return true;
  }

  function prepareFormDataWithAuth(data: Record<string, string>): Record<string, string> {
    const result = { ...data };
    const { cargoSolPlantao, cargoSolicPlantao } = getFuncoesTroca(result);
    if (cargoSolPlantao) result.funcao_solicitante = cargoSolPlantao;
    if (cargoSolicPlantao) result.funcao_solicitado = cargoSolicPlantao;
    result.criado_por = formatarUsuarioAtualComCargoEfetivo(result) || result.criado_por || '';
    if (result.deferido_indeferido === 'DEFERIDO' || result.deferido_indeferido === 'INDEFERIDO') {
      result.autorizado_por = formatarUsuarioAtualComCargoEfetivo(result) || result.autorizado_por || '';
      result.data_autorizacao = hojeLocalISO();
    }
    return result;
  }

  function buildPdfData(data: Record<string, string>): Record<string, string> {
    const dadosStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'deferido_indeferido' || k.startsWith('check_')) continue;
      dadosStr[k] = String(v || '');
    }

    if (dadosStr.data_folga_solicitado) {
      const dateValue = dadosStr.data_folga_solicitado;
      dadosStr.data_folga_solicitado = formatarDataBR(dateValue, dateValue);
    }
    dadosStr.cpf_solicitado_prefixo = dadosStr.cpf_solicitado ? 'nº:' : '';
    dadosStr.data_folga_prefixo_a = dadosStr.data_folga_solicitado ? 'a' : '';

    dadosStr.check_troca_sim = data.troca_emergencial === 'SIM' ? 'V' : '';
    dadosStr.check_troca_nao = data.troca_emergencial === 'NAO' ? 'V' : '';
    dadosStr.justificativa_emergencial = data.troca_emergencial === 'SIM'
      ? String(data.justificativa_emergencial || '')
      : '';
    dadosStr.check_deferido = 'V';
    dadosStr.check_indeferido = '';
    dadosStr.logo_med_group = '/assets/med-group-logo.png';
    const dataReferenciaAuditoria = getDataPlantaoTrocaData(data) || hojeLocalISO();
    if (dadosStr.criado_por) {
      dadosStr.criado_por = formatarPessoaAuditoriaNaData(dadosStr.criado_por, dataReferenciaAuditoria, dadosStr.criado_por);
    }
    if (dadosStr.autorizado_por) {
      dadosStr.autorizado_por = formatarPessoaAuditoriaNaData(dadosStr.autorizado_por, dataReferenciaAuditoria, dadosStr.autorizado_por);
    }
    const { cargoSolPlantao, cargoSolicPlantao } = getFuncoesTroca(data);
    if (cargoSolPlantao) dadosStr.funcao_solicitante = cargoSolPlantao;
    if (cargoSolicPlantao) dadosStr.funcao_solicitado = cargoSolicPlantao;

    return dadosStr;
  }

  async function handleConfirmGerarPdf() {
    setShowConfirmPdf(false);
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode aprovar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (editingFillId) {
      const existingFill = fills.find(fill => fill.id === editingFillId);
      if (existingFill && !canManageFill(existingFill)) {
        setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
        return;
      }
    }
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;

      const dadosAprovados: Record<string, string> = {
        ...formData,
        deferido_indeferido: 'DEFERIDO',
        data_autorizacao: hojeLocalISO(),
      };
      const formDataToSave = prepareFormDataWithAuth(dadosAprovados);

      const blob = await getTrocaPdfBlob(doc);
      if (!blob) { setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr = buildPdfData(formDataToSave);
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(doc));

      if (editingFillId) {
        await atualizarPreenchimento(editingFillId, {
          filled_data: formDataToSave,
          status: 'signed',
          autentique_document_id: null,
          autentique_link: null,
        });
      } else {
        await criarPreenchimento({
          document_id: doc.id, filled_by: user?.username || null,
          filled_data: formDataToSave, status: 'signed',
          autentique_document_id: null, autentique_link: null,
        });
      }

      abrirPdfPreview(pdfBlob, nomeArquivoTroca(formDataToSave), true);

      const docFills = await listarPreenchimentos(doc.id);
      setFills(docFills);
      setEditingFillId(null);
      setSubView('list');
      setShowNotifPopup({ msg: 'Troca aprovada e documento gerado com sucesso!', type: 'success' });
    } catch {
      setShowNotifPopup({ msg: 'Erro ao aprovar a troca e gerar o documento. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAutorizacaoAviso() {
    setShowAutorizacaoAviso(false);
    await handleConfirmGerarPdf();
  }

  function handleVisualizar() {
    if (!validateForm()) return;
    setShowPreviewInfo(true);
  }

  async function handleConfirmPreview() {
    setShowPreviewInfo(false);
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;
      const blob = await getTrocaPdfBlob(doc);
      if (!blob) { setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr = buildPdfData(prepareFormDataWithAuth(formData));
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(doc));
      abrirPdfPreview(pdfBlob, 'PRE-VISUALIZACAO TROCA DE SERVICO.pdf', false);
    } catch (err) {
      console.error('Erro ao gerar visualizacao:', err);
      setShowNotifPopup({ msg: 'Erro ao gerar visualizacao. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handleGerarPdf() {
    if (!validateForm()) return;
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode aprovar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (precisaAutorizacaoGerente(formData)) {
      setShowAutorizacaoAviso(true);
    } else {
      setShowConfirmPdf(true);
    }
  }

  async function handleVisualizarPdf(fill: DocumentFill) {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl('');
    setPreviewPdfData(null);
    setPreviewPdfName('Gerando documento...');
    setPreviewAllowDownload(false);
    setShowPdfPreview(true);
    try {
      setSaving(true);
      const doc = await getDocumentForFill(fill);
      if (!doc) {
        closePdfPreview();
        setShowNotifPopup({ msg: 'Documento da troca não encontrado.', type: 'error' });
        return;
      }
      const blob = await getTrocaPdfBlob(doc);
      if (!blob) {
        closePdfPreview();
        setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' });
        return;
      }
      const pdfBytes = await blob.arrayBuffer();
      const data = fill.filled_data as Record<string, string>;
      const dadosComAuditoria = {
        ...data,
        criado_por: formatarCriadoPorTroca(fill),
        autorizado_por: formatarAutorizadoPorTroca(data, getDataPlantaoTroca(fill)) || data.autorizado_por || '',
      };
      const dadosStr = buildPdfData(dadosComAuditoria);
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(doc));
      abrirPdfPreview(pdfBlob, nomeArquivoTroca(dadosComAuditoria), fill.status === 'signed');
    } catch (err) {
      closePdfPreview();
      console.error('Erro ao visualizar PDF:', err);
      setShowNotifPopup({ msg: 'Erro ao visualizar PDF.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handleEditFill(fill: DocumentFill) {
    if (!canManageFill(fill)) {
      setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    closePdfPreview();
    const data = fill.filled_data as Record<string, string>;
    const initialData: Record<string, string> = {};
    displayFields.forEach(f => { initialData[f.field_name] = data[f.field_name] || ''; });
    setFormData(initialData);
    setEditingFillId(fill.id);
    setSubView('form');
  }

  async function handleArchiveFill(fill: DocumentFill) {
    if (!canManageFill(fill)) {
      setArchiveConfirmFill(null);
      setShowNotifPopup({ msg: 'Você só pode arquivar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    try {
      await atualizarPreenchimento(fill.id, { status: 'archived' as any });
      setFills(prev => prev.filter(f => f.id !== fill.id));
      setArchiveConfirmFill(null);
      setShowNotifPopup({ msg: 'Documento arquivado com sucesso!', type: 'success' });
    } catch {
      setShowNotifPopup({ msg: 'Erro ao arquivar documento.', type: 'error' });
    }
  }

  function handleDeleteFill(fillId: string) {
    const fill = fills.find(item => item.id === fillId);
    if (fill && !canManageFill(fill)) {
      setShowNotifPopup({ msg: 'Você só pode excluir trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    setDeleteTargetId(fillId);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteFill() {
    if (!deleteTargetId) return;
    const fill = fills.find(item => item.id === deleteTargetId);
    if (fill && !canManageFill(fill)) {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      setShowNotifPopup({ msg: 'Você só pode excluir trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    try {
      await excluirPreenchimento(deleteTargetId);
      setFills(prev => prev.filter(f => f.id !== deleteTargetId));
    } catch {
      setShowNotifPopup({ msg: 'Erro ao excluir. Contate o administrador.', type: 'error' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  }

  async function handleSaveDraft() {
    if (!validateForm()) return;
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode salvar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (editingFillId) {
      const existingFill = fills.find(fill => fill.id === editingFillId);
      if (existingFill && !canManageFill(existingFill)) {
        setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
        return;
      }
    }
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;
      const formDataToSave = prepareFormDataWithAuth(formData);
      if (editingFillId) {
        await atualizarPreenchimento(editingFillId, { filled_data: formDataToSave, status: 'draft' });
      } else {
        await criarPreenchimento({
          document_id: doc.id, filled_by: user?.username || null,
          filled_data: formDataToSave, status: 'draft',
          autentique_document_id: null, autentique_link: null,
        });
      }
      const docFills = await listarPreenchimentos(doc.id);
      setFills(docFills);
      setEditingFillId(null);
      setSubView('list');
    } catch {
      setShowNotifPopup({ msg: 'Erro ao salvar. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const inputBase = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-graphite-900 placeholder-graphite-400 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-100 dark:placeholder-graphite-400';
  const inputNormal = `${inputBase} border-graphite-400`;
  const inputError = `${inputBase} border-red-500 ring-1 ring-red-300 dark:border-red-500 dark:ring-red-600`;
  const readonlyBase = 'w-full rounded-lg border border-graphite-400 bg-graphite-100 px-3 py-2 text-sm text-graphite-600 dark:border-graphite-500 dark:bg-graphite-800 dark:text-graphite-300 cursor-not-allowed';

  function renderField(field: TemplateFieldDef | DocumentField, customClass?: string) {
    const value = formData[field.field_name] || '';
    const cls = customClass || '';
    const funcionarios = getAllFuncionarios();
    const isError = missingFields.includes(field.field_name);
    const base = isError ? inputError : inputNormal;

    if (field.field_name === 'motivo_troca') {
      return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || 'Descreva o motivo da troca...'} rows={5} className={`${base} ${cls}`} />;
    }
    if (field.field_name === 'justificativa_emergencial') {
      return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || 'Informe a justificativa emergencial...'} rows={5} className={`${base} ${cls}`} />;
    }

    if (field.is_signature) return null;

    if (field.conditional_on) {
      const [depFieldName, depValue] = field.conditional_on.split('=');
      if ((formData[depFieldName] || '') !== depValue) return null;
    }

    if (field.field_name === 'funcao_solicitante' || field.field_name === 'funcao_solicitado') {
      const { cargoSolPlantao, cargoSolicPlantao } = getFuncoesTroca(formData);
      const displayValue = field.field_name === 'funcao_solicitante'
        ? cargoSolPlantao || value
        : cargoSolicPlantao || value;
      const fullLabel = CARGO_OPTIONS.find(c => c.value === displayValue)?.label || displayValue;
      return <input type="text" value={fullLabel} readOnly className={`${readonlyBase} ${cls}`} />;
    }

    if (field.read_only) {
      return <input type="text" value={value} readOnly className={`${readonlyBase} ${cls}`} />;
    }

    switch (field.field_type) {
      case 'checkbox':
        return (
          <div className="flex gap-2">
            {field.options?.map(opt => (
              <label key={opt} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                value === opt ? 'border-aviation-500 bg-aviation-50 dark:border-aviation-400 dark:bg-aviation-900/40' : isError ? 'border-red-400 ring-1 ring-red-300 dark:border-red-500 dark:ring-red-600' : 'border-graphite-200 dark:border-graphite-600'
              }`}>
                <input type="radio" name={field.field_name} value={opt} checked={value === opt}
                  onChange={e => handleFieldChange(field.field_name, e.target.value)} className="sr-only" />
                <span className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center ${
                  value === opt ? 'border-aviation-500 bg-aviation-500' : 'border-graphite-400 dark:border-graphite-500'
                }`}>
                  {value === opt && <span className="text-[10px] font-bold text-white">X</span>}
                </span>
                <span className="text-graphite-700 dark:text-graphite-200">{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={`${base} ${cls}`}>
            <option value="">{field.placeholder || 'Selecione...'}</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'textarea':
        return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} rows={2} className={`${base} ${cls}`} />;
      case 'date':
        return <input type="date" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={`${base} ${cls}`} />;
      case 'number':
        return <input type="number" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={`${base} ${cls}`} />;
      default:
        if (field.field_name === 'nome_solicitante' || field.field_name === 'nome_solicitado') {
          return <Autocomplete value={value} onChange={val => handleFieldChange(field.field_name, val)} options={funcionarios} placeholder={field.placeholder || 'Digite o nome...'} className={`${base} ${cls}`} />;
        }
        if (field.field_name === 'cpf_solicitante' || field.field_name === 'cpf_solicitado') {
          return <input type="text" value={value} onChange={e => handleCpfChange(field.field_name, e.target.value)} placeholder="000.000.000-00" maxLength={14} className={`${base} ${cls}`} />;
        }
        if (field.data_source && field.data_source !== 'manual') {
          return <Autocomplete value={value} onChange={val => handleFieldChange(field.field_name, val)} options={funcionarios} placeholder={field.placeholder || 'Digite o nome...'} className={`${base} ${cls}`} />;
        }
        return <input type="text" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={`${base} ${cls}`} />;
    }
  }

  function Label({ field }: { field: TemplateFieldDef | DocumentField }) {
    const isMissing = missingFields.includes(field.field_name);
    return (
      <label className={`mb-1 block text-xs font-medium ${isMissing ? 'text-red-600 dark:text-red-400' : 'text-graphite-600 dark:text-graphite-300'}`}>
        {field.field_label}{field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
    );
  }

  function getF(name: string): TemplateFieldDef | DocumentField | undefined {
    return displayFields.find(f => f.field_name === name);
  }

  if (loading || (isRelatorioRoute && loadingContexto)) {
    return <PageContainer><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-aviation-500" /></div></PageContainer>;
  }

  if (isRelatorioRoute && !canVisualizarRelatorios) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">A tela de relatórios está disponível apenas para GS e administradores do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  if (subView === 'form') {
    const sortedFields = [...displayFields].sort((a, b) => a.order_index - b.order_index);
    const signatureFields = sortedFields.filter(f => f.is_signature);

    const fNomeSol = getF('nome_solicitante');
    const fCpfSol = getF('cpf_solicitante');
    const fFuncaoSol = getF('funcao_solicitante');
    const fNomeSolic = getF('nome_solicitado');
    const fCpfSolic = getF('cpf_solicitado');
    const fFuncaoSolic = getF('funcao_solicitado');
    const fDataSol = getF('data_solicitada');
    const fDataFolga = getF('data_folga_solicitado');
    const fTrocaEmerg = getF('troca_emergencial');
    const fJustEmerg = getF('justificativa_emergencial');
    const fMotivo = getF('motivo_troca');

    return (
      <PageContainer>
        {renderBotaoTutorialTrocas()}
        <div className="mb-4 flex flex-wrap items-center gap-3" data-trocas-tour="trocas-formulario-topo">
          <button onClick={() => setSubView('list')} className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
            <ArrowLeft className="inline h-4 w-4 mr-1" />Voltar
          </button>
          <PageTitle icon={RefreshCw} title={editingFillId ? 'Editar Troca de Servico' : 'Nova Troca de Servico'} />
          <div className="ml-auto flex flex-wrap justify-end gap-3" data-trocas-tour="trocas-acoes-form">
            <button onClick={handleVisualizar} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Visualizar
            </button>
            <button onClick={handleGerarPdf} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Aprovar
            </button>
            <button onClick={handleSaveDraft} disabled={saving} className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              <Save className="h-4 w-4" /> Salvar Rascunho
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {!templateDoc && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-sm text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Documento sera criado automaticamente ao salvar.
            </div>
          )}
          {fNomeSol && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800" data-trocas-tour="trocas-solicitante">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Solicitante</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="min-w-0 md:col-span-5"><Label field={fNomeSol} />{renderField(fNomeSol)}</div>
                {fCpfSol && <div className="min-w-0 md:col-span-3"><Label field={fCpfSol} />{renderField(fCpfSol)}</div>}
                {fFuncaoSol && <div className="min-w-0 md:col-span-4"><Label field={fFuncaoSol} />{renderField(fFuncaoSol)}</div>}
              </div>
            </div>
          )}

          {fNomeSolic && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800" data-trocas-tour="trocas-solicitado">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Solicitado</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="min-w-0 md:col-span-5"><Label field={fNomeSolic} />{renderField(fNomeSolic)}</div>
                {fCpfSolic && <div className="min-w-0 md:col-span-3"><Label field={fCpfSolic} />{renderField(fCpfSolic)}</div>}
                {fFuncaoSolic && <div className="min-w-0 md:col-span-4"><Label field={fFuncaoSolic} />{renderField(fFuncaoSolic)}</div>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800" data-trocas-tour="trocas-dados">
            <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Dados da Troca</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {fDataSol && <div><Label field={fDataSol} />{renderField(fDataSol)}</div>}
              {fDataFolga && <div><Label field={fDataFolga} />{renderField(fDataFolga)}</div>}
              {fTrocaEmerg && <div><Label field={fTrocaEmerg} />{renderField(fTrocaEmerg)}</div>}
            </div>
            {fMotivo && (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div><Label field={fMotivo} />{renderField(fMotivo)}</div>
                {formData.troca_emergencial === 'SIM' && fJustEmerg && (
                  <div>
                    <Label field={fJustEmerg} />
                    {renderField(fJustEmerg)}
                  </div>
                )}
              </div>
            )}
          </div>

          {signatureFields.length > 0 && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800" data-trocas-tour="trocas-assinaturas">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Assinaturas</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {signatureFields.map(f => (
                  <div key={f.field_name} className="flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-purple-300 bg-purple-100 px-2 py-2 text-center dark:border-purple-600 dark:bg-purple-900/40">
                    <span className="text-xs text-purple-700 dark:text-purple-300 leading-tight">{f.field_label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showConfirmPdf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Confirmar Aprovação da Troca</h3>
              </div>
              <p className="mb-2 text-sm text-graphite-600 dark:text-graphite-300">
                Você tem certeza que deseja <strong>aprovar</strong> esta troca e gerar o documento?
              </p>
              <p className="mb-4 text-sm font-semibold text-red-600 dark:text-red-400">
                A troca aprovada alimentará automaticamente a escala diária, o LRO e o PTR-BA do dia.
              </p>
              <p className="mb-6 text-sm font-medium text-graphite-700 dark:text-graphite-200">
                Os dados estão todos corretos?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowConfirmPdf(false); setSubView('list'); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleConfirmGerarPdf} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Aprovar e Gerar Documento
                </button>
              </div>
            </div>
          </div>
        )}

        {showAutorizacaoAviso && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Atenção - Autorização do Gerente</h3>
              </div>
              <p className="mb-4 text-sm text-graphite-600 dark:text-graphite-300">
                Este tipo de troca somente pode ser realizada com autorização do <strong>Gerente</strong>.
              </p>
              <p className="mb-6 text-sm font-medium text-graphite-700 dark:text-graphite-200">
                Deseja continuar?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowAutorizacaoAviso(false); setSubView('list'); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleConfirmAutorizacaoAviso} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Sim, Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {showPreviewInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPreviewInfo(false)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Pré-visualização</h3>
              </div>
              <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
                Esta pré-visualização mostra como o documento aprovado será gerado.
              </p>
              <div className="flex justify-end">
                <button onClick={handleConfirmPreview} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} OK
                </button>
              </div>
            </div>
          </div>
        )}

        {renderPdfPreviewModal()}

        {showValidationPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowValidationPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Campos Obrigatorios</h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{showValidationPopup}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowValidationPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      {archiveConfirmFill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Arquivar Troca</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
              Tem certeza que deseja arquivar esta troca? Ela <strong>desaparecerá da lista de Trocas</strong> e ficará disponível apenas no <strong>Arquivo</strong>.
              {(() => {
                const fd = archiveConfirmFill.filled_data as Record<string, string>;
                const sol = fd.nome_solicitante || '';
                const solic = fd.nome_solicitado || '';
                return sol || solic ? ` (${sol} → ${solic})` : '';
              })()}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setArchiveConfirmFill(null)} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                Cancelar
              </button>
              <button onClick={() => handleArchiveFill(archiveConfirmFill)} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                <Archive className="h-4 w-4" /> Arquivar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNotifPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  showNotifPopup.type === 'success' ? 'bg-green-100 dark:bg-green-900/40' :
                  showNotifPopup.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                  'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {showNotifPopup.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /> :
                   showNotifPopup.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> :
                   <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                  {showNotifPopup.type === 'success' ? 'Sucesso' : showNotifPopup.type === 'error' ? 'Erro' : 'Aviso'}
                </h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{showNotifPopup.msg}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowNotifPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
        <AnimatedTrocasTour
          open={showTutorial}
          steps={TROCAS_TOUR_STEPS}
          stepIndex={tutorialStepIndex}
          onBack={voltarTutorialTrocas}
          onNext={avancarTutorialTrocas}
          onClose={fecharTutorialTrocas}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {renderBotaoTutorialTrocas()}
      <div className="flex flex-wrap items-center justify-between gap-3" data-trocas-tour="trocas-cabecalho">
        <PageTitle icon={RefreshCw} title="Trocas de Servico" />
        <div className="flex items-center gap-2">
          {!isRelatorioRoute && canManageGlobal && (
          <button onClick={() => setViewMode(viewMode === 'list' ? 'report' : 'list')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
              viewMode === 'report'
                ? 'bg-aviation-600 text-white border-aviation-600'
                : 'border-graphite-300 text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200'
            }`}>
            <FileText className="h-4 w-4" /> {viewMode === 'report' ? 'Voltar à Lista' : 'Pré Relatório'}
          </button>
          )}
          {canCreateTroca && (
          <button onClick={startNewTroca} data-trocas-tour="trocas-criar" className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
            <Plus className="h-4 w-4" /> Criar Troca
          </button>
          )}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-graphite-400 bg-white p-3 dark:border-graphite-500 dark:bg-graphite-800" data-trocas-tour="trocas-filtros">
        <Filter className="h-4 w-4 text-graphite-400 dark:text-graphite-500" />
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="rounded-lg border border-graphite-400 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-500 dark:bg-graphite-700 dark:text-graphite-200">
          {MONTH_NAMES.map((name, i) => (<option key={i} value={i}>{name}</option>))}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
          {years.map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)} className="rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
          <option value="">Todas as Equipes</option>
          {EQUIPE_OPTIONS.map(eq => (<option key={eq} value={eq}>{eq}</option>))}
        </select>
        {viewMode === 'report' && (
          <button
            type="button"
            onClick={abrirRelatorioMensalModal}
            disabled={gerandoRelatorioMensal}
            className="flex items-center gap-1 rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            {gerandoRelatorioMensal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Gerar Relatório Mensal
          </button>
        )}
        <span className="ml-auto text-xs text-graphite-500 dark:text-graphite-400">{filteredFills.length} troca(s) encontrada(s)</span>
      </div>

      {!isRelatorioRoute && personExcessList.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-400 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50">
              <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">Limite de Trocas Excedido</p>
              <p className="text-xs text-red-600 dark:text-red-400">Limite máximo de {MAX_TROCAS_PER_MONTH} trocas por mês por pessoa.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {personExcessList.map(pessoa => (
              <span key={pessoa.key} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {pessoa.label} ({pessoa.excesso} excedente)
              </span>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const turnWarnings: string[] = [];
        const funcWarnings: string[] = [];
        filteredFills.forEach(fill => {
          const fd = fill.filled_data as Record<string, string>;
          const { pessoaSol: p1, pessoaSolic: p2, cargoSolPlantao: cargo1, cargoSolicPlantao: cargo2 } = getFuncoesTroca(fd);
          const label1 = [cargo1, p1?.nomeGuerra || fd.nome_solicitante].filter(Boolean).join(' ');
          const label2 = [cargo2, p2?.nomeGuerra || fd.nome_solicitado].filter(Boolean).join(' ');
          if (p1?.turno && p2?.turno && !mesmoTurnoEfetivo(p1, p2)) {
            const label = `${label1} x ${label2} (${p1.turno} x ${p2.turno})`;
            if (!turnWarnings.includes(label)) turnWarnings.push(label);
          }
          if (cargo1 && cargo2 && cargo1 !== cargo2) {
            const label = `${label1} x ${label2}`;
            if (!funcWarnings.includes(label)) funcWarnings.push(label);
          }
        });
        if (isRelatorioRoute || (turnWarnings.length === 0 && funcWarnings.length === 0)) return null;
        return (
          <div className="space-y-3 mb-4">
            {turnWarnings.length > 0 && (
              <div className="rounded-xl border border-orange-400 bg-orange-50 px-5 py-4 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/50">
                    <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                  </div>
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wider">Trocas entre Turnos Diferentes</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {turnWarnings.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {funcWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-400 bg-amber-50 px-5 py-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  </div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">Trocas entre Funções Diferentes</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {funcWarnings.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {viewMode === 'report' ? (
        (() => {
          const baseList = isRelatorioRoute
            ? filteredFills.filter(f => f.status === 'signed')
            : filteredFills;
          const alfabetico = [...baseList].sort(ordenarTrocasMensais);
          const assinados = alfabetico.filter(f => f.status === 'signed');
          const naoAssinados = alfabetico.filter(f => f.status !== 'signed');
          return (
            <div className="space-y-6">
              <div className="rounded-2xl border border-graphite-200 bg-white overflow-hidden dark:border-border-dark dark:bg-surface-card">
                {!isRelatorioRoute && (
                <div className="border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
                  <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">
                    Trocas de {MONTH_NAMES[filterMonth]} de {filterYear}
                    <span className="ml-2 text-xs font-normal text-graphite-400">({naoAssinados.length} pendentes · {assinados.length} aprovadas)</span>
                  </h3>
                </div>
                )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-graphite-200 bg-graphite-50 dark:border-border-dark dark:bg-surface-hover">
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Solicitante</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data Solicitada</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data a Trabalhar</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Solicitado</th>
                          {!isRelatorioRoute && (
                            <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Status</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(isRelatorioRoute ? alfabetico : naoAssinados).map((fill, idx, arr) => {
                        const da = fill.filled_data as Record<string, string>;
                        return (
                          <tr key={fill.id} className={`border-b border-graphite-100 dark:border-border-dark ${idx === arr.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 py-3 text-graphite-900 dark:text-graphite-100">{getNomeCompletoRelatorio(da.nome_solicitante || '')}</td>
                            <td className="px-4 py-3 text-xs text-graphite-500 dark:text-graphite-400">{formatarDataBR(da.data_solicitada)}</td>
                            <td className="px-4 py-3 text-xs text-graphite-500 dark:text-graphite-400">{formatarDataBR(da.data_folga_solicitado)}</td>
                            <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{getNomeCompletoRelatorio(da.nome_solicitado || '')}</td>
                            {!isRelatorioRoute && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : fill.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                              </span>
                              <a href={fill.autentique_link || '#'} target={fill.autentique_link ? '_blank' : '_self'} rel="noopener noreferrer"
                                onClick={!fill.autentique_link ? (e => e.preventDefault()) : undefined}
                                className="rounded-lg p-1 text-graphite-400 hover:bg-aviation-50 hover:text-aviation-600 dark:hover:bg-aviation-900/20"
                                title={fill.autentique_link ? "Ver documento" : "Sem documento"}>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              </a>
                              </div>
                            </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {!isRelatorioRoute && assinados.length > 0 && (
                <div className="rounded-2xl border border-green-200 bg-green-50/50 overflow-hidden dark:border-green-800/30 dark:bg-green-900/10">
                  <div className="border-b border-green-200 px-5 py-4 dark:border-green-800/30">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-green-800 dark:text-green-300">
                      <CheckCircle className="h-4 w-4" /> Trocas Aprovadas ({assinados.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-green-200 bg-green-100/50 dark:border-green-800/30 dark:bg-green-900/20">
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Solicitante</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Solicitado</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Data Solicitada</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Data a Trabalhar</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assinados.map((fill, idx, arr) => {
                          const da = fill.filled_data as Record<string, string>;
                          return (
                            <tr key={fill.id} className={`border-b border-green-100 dark:border-green-800/20 ${idx === arr.length - 1 ? 'border-b-0' : ''}`}>
                              <td className="px-4 py-3 text-green-900 dark:text-green-100">{getNomeCompletoRelatorio(da.nome_solicitante || '')}</td>
                              <td className="px-4 py-3 text-green-800 dark:text-green-300">{getNomeCompletoRelatorio(da.nome_solicitado || '')}</td>
                              <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400">{formatarDataBR(da.data_solicitada)}</td>
                              <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400">{formatarDataBR(da.data_folga_solicitado)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-800/40 dark:text-green-300">
                                  <CheckCircle className="h-3 w-3" /> Aprovada
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {alfabetico.length === 0 && (
                <div className="rounded-xl border border-dashed border-graphite-400 bg-graphite-50 py-12 text-center">
                  <p className="text-graphite-500">Nenhuma troca em {MONTH_NAMES[filterMonth]} de {filterYear}</p>
                </div>
              )}
            </div>
          );
        })()
      ) : filteredFills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-400 bg-graphite-50 py-12 text-center dark:border-graphite-500 dark:bg-graphite-800/50" data-trocas-tour="trocas-lista">
          <FileText className="mx-auto mb-3 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <p className="text-graphite-500 dark:text-graphite-400">Nenhuma troca em {MONTH_NAMES[filterMonth]} de {filterYear}</p>
          <p className="mt-1 text-sm text-graphite-400 dark:text-graphite-500">Clique em "Criar Troca" para registrar uma nova.</p>
        </div>
      ) : (
        <div className="space-y-3" data-trocas-tour="trocas-lista">
          {filteredFills.map(fill => {
            const isExpanded = expandedFill === fill.id;
            const data = fill.filled_data as Record<string, string>;
            const dataPlantaoTroca = getDataPlantaoTroca(fill);
            const nomeSol = data.nome_solicitante || '';
            const nomeSolic = data.nome_solicitado || '';
            const { pessoaSol, pessoaSolic, cargoSolPlantao, cargoSolicPlantao } = getFuncoesTroca(data);
            const isExcessoLimite = excessoLimiteIds.has(fill.id);

            let dotColor = 'bg-yellow-500 dark:bg-yellow-400';
            let dotLabel = 'Rascunho';
            if (fill.status === 'signed') {
              dotColor = 'bg-green-500 dark:bg-green-400';
              dotLabel = 'Aprovada';
            } else if (fill.status === 'pending') {
              dotColor = 'bg-blue-500 dark:bg-blue-400';
              dotLabel = 'Aguardando';
            } else if (fill.status === 'cancelled') {
              dotColor = 'bg-red-500 dark:bg-red-400';
              dotLabel = 'Cancelado';
            }

            const displaySol = displayNomeTroca(nomeSol);
            const displaySolic = displayNomeTroca(nomeSolic);
            const criadoPorLabel = formatarCriadoPorTroca(fill);
            const autorizadoPorLabel = formatarAutorizadoPorTroca(data, dataPlantaoTroca);
            const cargoSolAbr = cargoSolPlantao;
            const cargoSolicAbr = cargoSolicPlantao;
            const turnoSol = pessoaSol?.turno || bombeirosList.find((b: any) => nomeSol.includes(b.nomeGuerra))?.turno || '';
            const turnoSolic = pessoaSolic?.turno || bombeirosList.find((b: any) => nomeSolic.includes(b.nomeGuerra))?.turno || '';
            const isFerista = pessoaSol?.equipe === 'Ferista' || pessoaSolic?.equipe === 'Ferista' || bombeirosList.some((b: any) => (nomeSol.includes(b.nomeGuerra) || nomeSolic.includes(b.nomeGuerra)) && b.equipe === 'Ferista');
            const turnosDiferentes = !isFerista && turnoSol && turnoSolic && turnoSol !== turnoSolic;
            const funcoesDiferentes = cargoSolAbr && cargoSolicAbr && cargoSolAbr !== cargoSolicAbr;

            const cardClass = isExcessoLimite || data.troca_emergencial === 'SIM'
              ? 'rounded-xl border border-red-500 bg-white ring-1 ring-red-300 dark:border-red-500 dark:bg-graphite-800 dark:ring-red-600'
              : turnosDiferentes
                ? 'rounded-xl border border-orange-400 bg-white ring-1 ring-orange-200 dark:border-orange-500 dark:bg-graphite-800 dark:ring-orange-800/40'
                : funcoesDiferentes
                  ? 'rounded-xl border border-amber-400 bg-white ring-1 ring-amber-200 dark:border-amber-500 dark:bg-graphite-800 dark:ring-amber-800/40'
                  : 'rounded-xl border border-graphite-200 bg-white dark:border-graphite-600 dark:bg-graphite-800';

            return (
              <div key={fill.id} className={cardClass}>
                <div className="flex items-center justify-between p-4">
                  <button onClick={() => setExpandedFill(isExpanded ? null : fill.id)} className="flex flex-1 items-center gap-3 text-left">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor}`} title={dotLabel} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-graphite-900 dark:text-graphite-100 flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-md bg-aviation-100 px-1.5 py-0.5 text-[9px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolAbr || '—'}</span>
                        <span>{displaySol}</span>
                        <span className="text-graphite-400 text-xs">{'\u2192'}</span>
                        <span className="rounded-md bg-aviation-100 px-1.5 py-0.5 text-[9px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolicAbr || '—'}</span>
                        <span>{displaySolic}</span>
                        {isExcessoLimite && <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-2.5 w-2.5" /> LIMITE</span>}
                        {data.troca_emergencial === 'SIM' && <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-2.5 w-2.5" /> EMERG.</span>}
                        {turnosDiferentes && <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="h-2.5 w-2.5" /> TURNOS</span>}
                        {funcoesDiferentes && <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" /> FUNÇÕES</span>}
                      </div>
                      <div className="text-xs text-graphite-500 dark:text-graphite-400 mt-0.5">
                        Plantão: {formatarDataBR(dataPlantaoTroca)}
                        {' '}&bull;{' '}
                        Criado por: {criadoPorLabel} em {formatarDataBR(fill.created_at)}
                        {!pessoaSol?.cargo && data.funcao_solicitante && <span className="ml-2 text-graphite-400">({getCargoLabel(data.funcao_solicitante)})</span>}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      fill.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300'
                    }`}>
                      {fill.status === 'draft' ? 'Rascunho' : fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : fill.status === 'cancelled' ? 'Cancelado' : fill.status}
                    </span>
                    {fill.status === 'draft' && draftCountdowns[fill.id] != null && (
                      <span className="text-[10px] text-yellow-600 dark:text-yellow-400" title="Tempo ate exclusao automatica">
                        Exclui em: {formatCountdown(draftCountdowns[fill.id])}
                      </span>
                    )}
                    <button onClick={(event) => { event.stopPropagation(); setExpandedFill(isExpanded ? null : fill.id); }} className="rounded p-1 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-graphite-700">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {canManageFill(fill) && fill.status === 'draft' && (
                      <button onClick={(event) => { event.stopPropagation(); handleEditFill(fill); }} title="Editar" className="rounded p-1 text-graphite-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(event) => { event.stopPropagation(); handleVisualizarPdf(fill); }}
                      disabled={saving}
                      title="Visualizar PDF"
                      className="rounded p-1 text-graphite-400 hover:bg-graphite-100 hover:text-aviation-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-graphite-700 dark:hover:text-aviation-400"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {canManageFill(fill) && (
                      <button onClick={(event) => { event.stopPropagation(); setArchiveConfirmFill(fill); }} title="Arquivar" className="rounded p-1 text-graphite-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400">
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    {canManageFill(fill) && (
                      <button onClick={(event) => { event.stopPropagation(); handleDeleteFill(fill.id); }} title="Excluir" className="rounded p-1 text-graphite-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-graphite-100 px-4 py-4 dark:border-graphite-600">
                    {/* Warning banners */}
                    {isExcessoLimite && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-400 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50">
                          <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">Limite Excedido</p>
                          <p className="text-xs text-red-700 dark:text-red-300">Esta pessoa excedeu o limite de {MAX_TROCAS_PER_MONTH} trocas no mês.</p>
                        </div>
                      </div>
                    )}
                    {turnosDiferentes && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-400 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/50">
                          <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wider">Turnos Diferentes</p>
                          <p className="text-xs text-orange-700 dark:text-orange-300">Troca entre turnos diferentes ({pessoaSol?.turno} x {pessoaSolic?.turno}). Necessita autorização do gerente.</p>
                        </div>
                      </div>
                    )}
                    {funcoesDiferentes && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50">
                          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">Funções Diferentes</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">Troca entre funções diferentes ({cargoSolAbr} x {cargoSolicAbr}). Necessita autorização do gerente.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Solicitante</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-aviation-100 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolAbr || '—'}</span>
                          <span className="text-sm font-bold uppercase text-graphite-900 dark:text-graphite-100">{displaySol || '—'}</span>
                        </div>
                        <p className="mt-1 text-xs text-graphite-500">{pessoaSol?.equipe ? `Equipe ${pessoaSol.equipe}` : (() => { const b = bombeirosList.find((x: any) => nomeSol.includes(x.nomeGuerra)); return b?.equipe ? `Equipe ${b.equipe}` : ''; })()}</p>
                        <p className="mt-1.5 text-[10px] text-graphite-400">Vai tirar o plantão como: <span className="font-semibold text-graphite-700 dark:text-graphite-300">{cargoSolicAbr || '—'}</span></p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Solicitado</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-aviation-100 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolicAbr || '—'}</span>
                          <span className="text-sm font-bold uppercase text-graphite-900 dark:text-graphite-100">{displaySolic || '—'}</span>
                        </div>
                        <p className="mt-1 text-xs text-graphite-500">{pessoaSolic?.equipe ? `Equipe ${pessoaSolic.equipe}` : (() => { const b = bombeirosList.find((x: any) => nomeSolic.includes(x.nomeGuerra)); return b?.equipe ? `Equipe ${b.equipe}` : ''; })()}</p>
                        <p className="mt-1.5 text-[10px] text-graphite-400">Vai tirar o plantão como: <span className="font-semibold text-graphite-700 dark:text-graphite-300">{cargoSolAbr || '—'}</span></p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Datas</span>
                        {data.data_solicitada && <p className="mt-1 text-graphite-900 dark:text-graphite-100">Folga do Solicitante: {formatarDataBR(data.data_solicitada)}</p>}
                        {data.data_folga_solicitado && <p className="text-graphite-900 dark:text-graphite-100">Folga do Solicitado: {formatarDataBR(data.data_folga_solicitado)}</p>}
                        <p className="mt-1 text-xs text-graphite-500">Documento criado por {criadoPorLabel} em {formatarDataHoraBR(fill.created_at)}</p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Status</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {fill.status === 'signed' && <CheckCircle className="h-3.5 w-3.5" />}
                            {fill.status === 'draft' ? 'Rascunho' : fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : 'Cancelado'}
                          </span>
                          {data.troca_emergencial === 'SIM' && (
                            <button onClick={() => setShowJustificativaPopup(fill.id)} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400">
                              <AlertTriangle className="h-3 w-3" /> Emergencial
                            </button>
                          )}
                        </div>
                        {violationFillIds.has(fill.id) && (
                          <div className="mt-2 rounded-lg border border-green-200 bg-green-50/80 p-2.5 text-center dark:border-green-800/40 dark:bg-green-900/20">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-300">
                              <CheckCircle className="h-4 w-4" /> AUTORIZADO PELO EMBAIXADOR
                            </div>
                            {data.criada_no_lro === 'SIM' ? (
                              <>
                                <p className="text-[10px] text-green-600 dark:text-green-400">
                                  {data.data_autorizacao ? formatarDataBR(data.data_autorizacao) : formatarDataBR(fill.created_at)}
                                </p>
                                {(data.criado_por || fill.filled_by) && (
                                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-300">
                                    Criado por {criadoPorLabel}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-[10px] text-green-600 dark:text-green-400">
                                {data.data_autorizacao ? formatarDataBR(data.data_autorizacao) : formatarDataBR(fill.created_at)}
                                {autorizadoPorLabel ? ` · ${autorizadoPorLabel}` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {data.motivo_troca && (
                      <div className="mt-3 rounded-lg border border-graphite-200 bg-graphite-50 p-3 dark:border-graphite-600 dark:bg-graphite-700/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Motivo da Troca</span>
                        <p className="mt-1 text-sm text-graphite-900 dark:text-graphite-100">{data.motivo_troca}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {renderPdfPreviewModal()}

      {showRelatorioMensalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !gerandoRelatorioMensal && setShowRelatorioMensalModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-surface-elevated" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-aviation-600 dark:text-aviation-300">Relatório mensal</p>
                <h3 className="mt-1 text-lg font-bold text-graphite-900 dark:text-graphite-100">
                  Trocas de {MONTH_NAMES[filterMonth]} de {filterYear}
                </h3>
                <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">
                  {trocasMensaisAprovadas.length} permuta(s) aprovada(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRelatorioMensalModal(false)}
                disabled={gerandoRelatorioMensal}
                className="rounded-xl border border-graphite-200 p-2 text-graphite-500 transition-all hover:bg-graphite-50 disabled:opacity-50 dark:border-border-dark dark:text-graphite-300 dark:hover:bg-surface-hover"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Obs.</span>
              <textarea
                value={relatorioMensalObs}
                onChange={e => setRelatorioMensalObs(e.target.value)}
                rows={4}
                placeholder="Digite a observação que deve aparecer no rodapé do relatório."
                className="w-full resize-none rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:ring-aviation-400/10"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRelatorioMensalModal(false)}
                disabled={gerandoRelatorioMensal}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGerarRelatorioMensal}
                disabled={gerandoRelatorioMensal}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60"
              >
                {gerandoRelatorioMensal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showJustificativaPopup && (() => {
        const fill = filteredFills.find(f => f.id === showJustificativaPopup);
        const data = fill?.filled_data as Record<string, string> | undefined;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJustificativaPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Justificativa da Troca Emergencial</h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{data?.justificativa_emergencial || 'Nenhuma justificativa informada.'}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowJustificativaPopup(null)} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showValidationPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowValidationPopup(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Campos Obrigatorios</h3>
            </div>
            <p className="text-sm text-graphite-600 dark:text-graphite-300">{showValidationPopup}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowValidationPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Excluir Troca</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
              Tem certeza que deseja excluir esta troca? Esta acao nao pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                Cancelar
              </button>
              <button onClick={confirmDeleteFill} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" /> Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNotifPopup(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                showNotifPopup.type === 'success' ? 'bg-green-100 dark:bg-green-900/40' :
                showNotifPopup.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                'bg-blue-100 dark:bg-blue-900/40'
              }`}>
                {showNotifPopup.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /> :
                 showNotifPopup.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> :
                 <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                {showNotifPopup.type === 'success' ? 'Sucesso' : showNotifPopup.type === 'error' ? 'Erro' : 'Aviso'}
              </h3>
            </div>
            <p className="text-sm text-graphite-600 dark:text-graphite-300">{showNotifPopup.msg}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowNotifPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                Entendido
              </button>
            </div>
            </div>
          </div>
        )}
      <AnimatedTrocasTour
        open={showTutorial}
        steps={TROCAS_TOUR_STEPS}
        stepIndex={tutorialStepIndex}
        onBack={voltarTutorialTrocas}
        onNext={avancarTutorialTrocas}
        onClose={fecharTutorialTrocas}
      />
      </PageContainer>
    );
  }

export default Trocas;
