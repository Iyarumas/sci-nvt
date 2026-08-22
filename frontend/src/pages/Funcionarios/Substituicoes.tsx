import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Plus, Search, Trash2, AlertCircle, AlertTriangle, X, Check, Clock, DollarSign, RefreshCw, ShieldOff, Pencil, Printer } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarBombeiros } from '../../services/bombeiroService';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { Bombeiro, Cargo } from '../../types/bombeiro';
import { ABBR_CARGO } from '../../types/bombeiro';
import type {
  EloCadeiaSubstituicaoTemporaria,
  MotivoSubstituicao,
  RespostaPlantaoExtra,
  SubstituicaoTemporaria,
  TipoSubstituicao,
} from '../../types/substituicaoTemporaria';
import { MOTIVOS_SUBSTITUICAO, STATUS_SUBSTITUICAO_CORES, MOTIVOS_OBRIGATORIOS_POR_LEI } from '../../types/substituicaoTemporaria';
import {
  listarSubstituicoesTemporarias,
  criarSubstituicaoTemporaria,
  atualizarSubstituicaoTemporaria,
  aprovarSubstituicaoTemporaria,
  rejeitarSubstituicaoTemporaria,
  excluirSubstituicaoTemporaria,
} from '../../services/substituicaoTemporariaService';
import { useDebounce } from '../../hooks/useDebounce';
import { capitalizarNome } from '../../utils/capitalize';
import { validarCursoParaFuncao } from '../../utils/validacaoCursos';
import { AlertModal } from '../../components/ui/AlertModal';
import { estaNoPeriodoISO, formatarDataBR } from '../../utils/datas';
import { equipeEstaNoPlantao } from '../../utils/equipes';
import { listarVigencias, type VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';

function capitalize(str: string) { return capitalizarNome(str); }
function formatDate(d: string) { return formatarDataBR(d); }

const INPUT_CLASS = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const TIPO_OPTIONS: TipoSubstituicao[] = ['Substituição', 'Afastamento'];
const DATA_FIM_INDETERMINADO = '9999-12-31';
const MESES_RELATORIO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ANOS_RELATORIO = Array.from({ length: 6 }, (_, index) => String(new Date().getFullYear() - index));

type Tab = 'lista' | 'aprovacoes';

type ExtraAfastamentoDraft = {
  dataPlantao: string;
  substitutoId: string;
  cargoExercido: string;
  equipePlantao: string;
  cargoAfastado: string;
  substituindoId?: string;
  substituindoNome?: string;
  substituindoCargo?: string;
};

type PlantaoAfastamento = Omit<ExtraAfastamentoDraft, 'substitutoId'>;

function tipoOptionLabel(tipo: TipoSubstituicao): string {
  return tipo === 'Afastamento' ? 'Afastamento/Atestados' : tipo;
}

function isIndeterminado(sub: Pick<SubstituicaoTemporaria, 'motivo' | 'dataFim'>): boolean {
  return sub.motivo === 'INSS Indeterminado' || sub.dataFim === DATA_FIM_INDETERMINADO;
}

function dataLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDataLocal(value: string): Date | null {
  const [ano, mes, dia] = value.split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

function calcularDataFim(dataInicio: string, dias: number): string {
  const data = parseDataLocal(dataInicio);
  if (!data || dias <= 0) return '';
  data.setDate(data.getDate() + dias - 1);
  return dataLocalISO(data);
}

function periodoCruzaMes(dataInicio: string, dataFim: string, mes: number, ano: number): boolean {
  const inicio = parseDataLocal(dataInicio);
  const fim = dataFim === DATA_FIM_INDETERMINADO ? new Date(9999, 11, 31, 12) : parseDataLocal(dataFim);
  if (!inicio || !fim) return false;
  const inicioMes = new Date(ano, mes - 1, 1, 12);
  const fimMes = new Date(ano, mes, 0, 12);
  return inicio <= fimMes && fim >= inicioMes;
}

function contextoPessoaNoPlantao(
  pessoa: Bombeiro,
  dataPlantao: string,
  vigencias: VigenciaSubstituicao[],
  bombeiros: Bombeiro[],
): Omit<PlantaoAfastamento, 'dataPlantao'> {
  const vigencia = vigencias.find(v =>
    v.ativa &&
    v.substitutoId === pessoa.id &&
    v.substitutoId !== v.funcionarioOriginalId &&
    estaNoPeriodoISO(dataPlantao, v.dataInicio, v.dataFim)
  );

  if (!vigencia) {
    return {
      equipePlantao: pessoa.equipe,
      cargoExercido: pessoa.cargo,
      cargoAfastado: pessoa.cargo,
    };
  }

  const original = bombeiros.find(b => b.id === vigencia.funcionarioOriginalId);
  const equipePlantao = original?.equipe || vigencia.equipe || pessoa.equipe;
  const cargoExercido = vigencia.cargoExercido || vigencia.cargoOriginalFuncionario || pessoa.cargo;

  return {
    equipePlantao,
    cargoExercido,
    cargoAfastado: cargoExercido,
    substituindoId: vigencia.funcionarioOriginalId,
    substituindoNome: vigencia.funcionarioOriginalNome,
    substituindoCargo: vigencia.cargoOriginalFuncionario,
  };
}

function listarPlantoesNoPeriodo(
  pessoa: Bombeiro,
  dataInicio: string,
  dataFim: string,
  vigencias: VigenciaSubstituicao[],
  bombeiros: Bombeiro[],
): PlantaoAfastamento[] {
  const inicio = parseDataLocal(dataInicio);
  const fim = parseDataLocal(dataFim);
  if (!pessoa || !inicio || !fim || fim < inicio || dataFim === DATA_FIM_INDETERMINADO) return [];
  const plantoes: PlantaoAfastamento[] = [];
  const atual = new Date(inicio);
  while (atual <= fim) {
    const dataPlantao = dataLocalISO(atual);
    const contexto = contextoPessoaNoPlantao(pessoa, dataPlantao, vigencias, bombeiros);
    if (equipeEstaNoPlantao(contexto.equipePlantao, atual)) {
      plantoes.push({ dataPlantao, ...contexto });
    }
    atual.setDate(atual.getDate() + 1);
  }
  return plantoes;
}

function nomeOperacional(b: Bombeiro): string {
  return `${ABBR_CARGO[b.cargo] || b.cargo} · ${capitalize(b.nomeGuerra)} · ${b.equipe}`;
}

function cargoLabel(cargo?: string): string {
  return (cargo && (ABBR_CARGO[cargo as Cargo] || cargo)) || '-';
}

function motivoLabel(sub: SubstituicaoTemporaria): string {
  if (sub.motivo === 'Outro') return sub.motivoOutro || 'Outro';
  return MOTIVOS_SUBSTITUICAO.find(m => m.value === sub.motivo)?.label || sub.motivo;
}

function periodoLabel(sub: SubstituicaoTemporaria): string {
  if (isIndeterminado(sub)) return `a partir de ${formatDate(sub.dataInicio)} · prazo indeterminado`;
  return `${formatDate(sub.dataInicio)} a ${formatDate(sub.dataFim)} (${sub.dias} dias)`;
}

function TipoBadge({ tipo }: { tipo: TipoSubstituicao }) {
  if (tipo === 'Extra') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
        <DollarSign className="h-3 w-3" /> Extra
      </span>
    );
  }
  if (tipo === 'Afastamento') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
        <ShieldOff className="h-3 w-3" /> Afastamento/Atestados
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
      <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} /> Substituição
    </span>
  );
}

export function Substituicoes() {
  const { user, effectiveRole } = useAuth();
  const location = useLocation();
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const canApprove = effectiveRole === 'desenvolvedor' || effectiveRole === 'admin' || effectiveRole === 'gerente';

  const [tab, setTab] = useState<Tab>('lista');
  const [allBombeiros, setAllBombeiros] = useState<Bombeiro[]>([]);
  const [vigencias, setVigencias] = useState<VigenciaSubstituicao[]>([]);
  const [subs, setSubs] = useState<SubstituicaoTemporaria[]>([]);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubstituicaoTemporaria | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [relatorioMes, setRelatorioMes] = useState(String(new Date().getMonth() + 1));
  const [relatorioAno, setRelatorioAno] = useState(String(new Date().getFullYear()));
  const [printingMonthly, setPrintingMonthly] = useState(false);
  const [printingSub, setPrintingSub] = useState<SubstituicaoTemporaria | null>(null);

  const [formTipo, setFormTipo] = useState<TipoSubstituicao>('Substituição');
  const [formSubstituido, setFormSubstituido] = useState<Bombeiro | null>(null);
  const [formSubstituto, setFormSubstituto] = useState<Bombeiro | null>(null);
  const [formMotivo, setFormMotivo] = useState<MotivoSubstituicao | '__placeholder__'>('Outro');
  const [formMotivoOutro, setFormMotivoOutro] = useState('');
  const [formCidAtestado, setFormCidAtestado] = useState('');
  const [formPlantaoExtra, setFormPlantaoExtra] = useState<RespostaPlantaoExtra>('');
  const [formDias, setFormDias] = useState(15);
  const [formDataInicio, setFormDataInicio] = useState('');
  const [extrasAfastamento, setExtrasAfastamento] = useState<ExtraAfastamentoDraft[]>([]);
  const preserveExtrasOnNextSync = useRef(false);

  const debouncedTermo = useDebounce(termo, 400);
  const activeBombeiros = useMemo(() => allBombeiros.filter(b => !b.dataDesligamento), [allBombeiros]);
  const canPrintRelatorios = effectiveRole === 'desenvolvedor' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'gerente' ||
    user?.pessoa?.equipe === 'Embaixador';

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const limparImpressao = () => {
      setPrintingMonthly(false);
      setPrintingSub(null);
    };
    window.addEventListener('afterprint', limparImpressao);
    return () => window.removeEventListener('afterprint', limparImpressao);
  }, []);

  async function carregar() {
    const [b, s, v] = await Promise.all([
      listarBombeiros(),
      listarSubstituicoesTemporarias(),
      listarVigencias({ ativa: true }).catch(() => []),
    ]);
    setAllBombeiros(b);
    setSubs(s);
    setVigencias(v);
  }

  useEffect(() => {
    if (formTipo === 'Substituição') return;
    const found = MOTIVOS_SUBSTITUICAO.find(m => m.value === formMotivo);
    if (found && found.dias > 0) setFormDias(found.dias);
    if (formMotivo === 'INSS Indeterminado') setFormDias(15);
  }, [formMotivo, formTipo]);

  const afastamentoIndeterminado = formTipo === 'Afastamento' && formMotivo === 'INSS Indeterminado';
  const atestadoMedico = formTipo === 'Afastamento' && formMotivo === 'Atestado Medico';
  const motivoSelecionado = MOTIVOS_SUBSTITUICAO.find(m => m.value === formMotivo);
  const afastamentoTemPrazoFixo = formTipo === 'Afastamento' &&
    !afastamentoIndeterminado &&
    !atestadoMedico &&
    !!motivoSelecionado &&
    motivoSelecionado.dias > 0;
  const isMotivoObrigatorio = formTipo !== 'Substituição' && MOTIVOS_OBRIGATORIOS_POR_LEI.includes(formMotivo as MotivoSubstituicao);

  useEffect(() => {
    if (!atestadoMedico && formCidAtestado) setFormCidAtestado('');
  }, [atestadoMedico, formCidAtestado]);

  const dataFimCalculada = useMemo(() => {
    if (afastamentoIndeterminado) return formDataInicio ? DATA_FIM_INDETERMINADO : '';
    if (!formDataInicio || formDias <= 0) return '';
    return calcularDataFim(formDataInicio, formDias);
  }, [afastamentoIndeterminado, formDataInicio, formDias]);

  const diasParaSalvar = formDias;

  const dataFimExtrasCalculada = useMemo(() => {
    if (formTipo !== 'Afastamento' || !formDataInicio || formDias <= 0) return '';
    return calcularDataFim(formDataInicio, formDias);
  }, [formDataInicio, formDias, formTipo]);

  const plantoesAfastamento = useMemo(() => {
    if (formTipo !== 'Afastamento' || !formSubstituido || !formDataInicio || !dataFimExtrasCalculada) return [];
    return listarPlantoesNoPeriodo(formSubstituido, formDataInicio, dataFimExtrasCalculada, vigencias, activeBombeiros);
  }, [activeBombeiros, dataFimExtrasCalculada, formDataInicio, formSubstituido, formTipo, vigencias]);

  useEffect(() => {
    if (formTipo !== 'Afastamento' || plantoesAfastamento.length === 0) {
      setExtrasAfastamento([]);
      return;
    }
    setExtrasAfastamento(prev => {
      const contextoPorData = new Map(plantoesAfastamento.map(plantao => [plantao.dataPlantao, plantao]));
      if (preserveExtrasOnNextSync.current) {
        preserveExtrasOnNextSync.current = false;
        return prev
          .filter(extra => contextoPorData.has(extra.dataPlantao))
          .map(extra => {
            const contexto = contextoPorData.get(extra.dataPlantao);
            return contexto ? {
              ...extra,
              equipePlantao: extra.equipePlantao || contexto.equipePlantao,
              cargoAfastado: extra.cargoAfastado || contexto.cargoAfastado,
              cargoExercido: extra.cargoExercido || contexto.cargoExercido,
              substituindoId: extra.substituindoId || contexto.substituindoId,
              substituindoNome: extra.substituindoNome || contexto.substituindoNome,
              substituindoCargo: extra.substituindoCargo || contexto.substituindoCargo,
            } : extra;
          });
      }
      const mantidos = prev
        .filter(extra => contextoPorData.has(extra.dataPlantao))
        .map(extra => {
          const contexto = contextoPorData.get(extra.dataPlantao);
          return contexto ? {
            ...extra,
            equipePlantao: contexto.equipePlantao,
            cargoAfastado: contexto.cargoAfastado,
            cargoExercido: extra.cargoExercido || contexto.cargoExercido,
            substituindoId: contexto.substituindoId,
            substituindoNome: contexto.substituindoNome,
            substituindoCargo: contexto.substituindoCargo,
          } : extra;
        });
      const novos = plantoesAfastamento
        .filter(plantao => !mantidos.some(extra => extra.dataPlantao === plantao.dataPlantao))
        .map(plantao => ({
          ...plantao,
          substitutoId: '',
        }));
      return [...mantidos, ...novos];
    });
  }, [formTipo, plantoesAfastamento]);

  const substituicaoFuncao = formSubstituido?.cargo || '';

  const bloqueadoPorCurso = !!(formSubstituido && formSubstituto && formSubstituido.id !== formSubstituto.id && (() => {
    const aviso = validarCursoParaFuncao(formSubstituto, formSubstituido.cargo as Cargo);
    return aviso && aviso.nivel === 'bloqueado';
  })());

  const bloqueadoPorHierarquia = false;

  const substitutosBloqueados = useMemo(() => {
    if (!formSubstituido) return new Set<string>();
    const blocked = new Set<string>();
    for (const b of activeBombeiros) {
      if (b.id === formSubstituido.id) {
        blocked.add(b.id);
        continue;
      }
      const aviso = validarCursoParaFuncao(b, formSubstituido.cargo as Cargo);
      if (aviso && aviso.nivel === 'bloqueado') blocked.add(b.id);
    }
    return blocked;
  }, [activeBombeiros, formSubstituido]);

  const cadeiaCompleta = true;

  const afastamentoExigeDescricao = formTipo === 'Afastamento' &&
    ['Atestado Medico', 'INSS', 'INSS Indeterminado', 'Outro'].includes(String(formMotivo));
  const motivoValido = formTipo === 'Substituição'
    ? !!formMotivoOutro.trim()
    : !!formMotivo &&
      formMotivo !== '__placeholder__' &&
      (!afastamentoExigeDescricao || !!formMotivoOutro.trim());

  const extrasCompletos = formTipo !== 'Afastamento' ||
    (extrasAfastamento.length > 0 && extrasAfastamento.every(extra => extra.substitutoId && extra.cargoExercido));
  const formValid = formTipo === 'Afastamento'
    ? !!(
        formSubstituido &&
        motivoValido &&
        formDataInicio &&
        diasParaSalvar > 0 &&
        dataFimCalculada &&
        extrasCompletos
      )
    : !!(
        formSubstituido && formSubstituto &&
        formSubstituido.id !== formSubstituto.id &&
        motivoValido &&
        formDataInicio && diasParaSalvar > 0 &&
        dataFimCalculada &&
        cadeiaCompleta &&
        !bloqueadoPorCurso &&
        !bloqueadoPorHierarquia
      );

  const filteredOperacional = subs.filter(s => {
    const matchTermo = !debouncedTermo ||
      s.funcionarioNome.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      s.substitutoNome.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      s.tipo.toLowerCase().includes(debouncedTermo.toLowerCase());
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchTermo && matchStatus;
  });

  const pendentes = subs.filter(s => s.status === 'Pendente');

  const relatorioMensal = useMemo(() => {
    const mes = Number(relatorioMes);
    const ano = Number(relatorioAno);
    return subs
      .filter(sub =>
        sub.tipo === 'Afastamento' &&
        sub.status === 'Aprovada' &&
        periodoCruzaMes(sub.dataInicio, sub.dataFim, mes, ano)
      )
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.funcionarioNome.localeCompare(b.funcionarioNome));
  }, [relatorioAno, relatorioMes, subs]);

  const filtered = isRelatorioRoute ? relatorioMensal : filteredOperacional;

  function extrasDaSub(sub: SubstituicaoTemporaria): EloCadeiaSubstituicaoTemporaria[] {
    return (sub.cadeiaSubstituicao || []).filter(elo => elo.tipo === 'extra');
  }

  function extraEstaNoMes(extra: EloCadeiaSubstituicaoTemporaria, mes: number, ano: number): boolean {
    const data = parseDataLocal(extra.dataPlantao || '');
    return !!data && data.getMonth() + 1 === mes && data.getFullYear() === ano;
  }

  function extrasRelatorio(sub: SubstituicaoTemporaria): EloCadeiaSubstituicaoTemporaria[] {
    if (printingSub) return extrasDaSub(sub);
    const mes = Number(relatorioMes);
    const ano = Number(relatorioAno);
    return extrasDaSub(sub).filter(extra => extraEstaNoMes(extra, mes, ano));
  }

  function iniciarImpressaoMensal() {
    if (!canPrintRelatorios) return;
    setPrintingSub(null);
    setPrintingMonthly(true);
    window.setTimeout(() => window.print(), 80);
  }

  function iniciarImpressaoIndividual(sub: SubstituicaoTemporaria) {
    if (!canPrintRelatorios) return;
    setPrintingMonthly(false);
    setPrintingSub(sub);
    window.setTimeout(() => window.print(), 80);
  }

  function renderRelatorioSubstituicao(sub: SubstituicaoTemporaria) {
    const { descricao, cid } = separarDescricaoMotivo(sub);
    const extras = extrasRelatorio(sub);
    return (
      <section key={sub.id} className="substituicoes-print-card rounded-xl border border-slate-300 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Afastado/Atestado</p>
            <h3 className="text-base font-bold text-slate-950">{sub.funcionarioNome}</h3>
            <p className="text-xs text-slate-600">{cargoLabel(sub.funcionarioCargo)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Período</p>
            <p className="text-xs font-semibold text-slate-950">{periodoLabel(sub)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{sub.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold uppercase text-slate-500">Motivo</p>
            <p className="mt-1 font-semibold text-slate-950">{motivoLabel(sub)}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-slate-500">Tempo</p>
            <p className="mt-1 font-semibold text-slate-950">{isIndeterminado(sub) ? 'Prazo indeterminado' : `${sub.dias} dias`}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-slate-500">Criado por</p>
            <p className="mt-1 font-semibold text-slate-950">{sub.criadoPorNome || sub.criadoPor || '-'}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-slate-500">Aprovado por</p>
            <p className="mt-1 font-semibold text-slate-950">{sub.aprovadoPorNome || sub.aprovadoPor || '-'}</p>
          </div>
          {cid && (
            <div>
              <p className="font-bold uppercase text-slate-500">CID</p>
              <p className="mt-1 font-semibold text-slate-950">{cid}</p>
            </div>
          )}
          {descricao && (
            <div className={cid ? '' : 'col-span-2'}>
              <p className="font-bold uppercase text-slate-500">Descrição</p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{descricao}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Plantões extras</p>
          {extras.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">Nenhum plantão extra registrado no período selecionado.</p>
          ) : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="border border-slate-300 px-2 py-1">Data</th>
                  <th className="border border-slate-300 px-2 py-1">Equipe</th>
                  <th className="border border-slate-300 px-2 py-1">Quem fez no lugar</th>
                  <th className="border border-slate-300 px-2 py-1">Função original</th>
                  <th className="border border-slate-300 px-2 py-1">Função exercida</th>
                  <th className="border border-slate-300 px-2 py-1">Pessoa afastada</th>
                </tr>
              </thead>
              <tbody>
                {extras.map((extra, index) => (
                  <tr key={`${extra.dataPlantao}-${extra.pessoaId}-${index}`}>
                    <td className="border border-slate-300 px-2 py-1 font-semibold">{extra.dataPlantao ? formatDate(extra.dataPlantao) : '-'}</td>
                    <td className="border border-slate-300 px-2 py-1">{extra.equipePlantao || extra.funcionarioEquipe || '-'}</td>
                    <td className="border border-slate-300 px-2 py-1 font-semibold">{extra.substitutoNome || extra.pessoaNome || '-'}</td>
                    <td className="border border-slate-300 px-2 py-1">{cargoLabel(extra.substitutoCargo || extra.pessoaCargo || extra.cargoOriginal)}</td>
                    <td className="border border-slate-300 px-2 py-1">{cargoLabel(extra.cargoExercido || extra.cargoVacante || sub.funcionarioCargo)}</td>
                    <td className="border border-slate-300 px-2 py-1">{extra.funcionarioNome || sub.funcionarioNome} ({cargoLabel(extra.funcionarioCargo || sub.funcionarioCargo)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );
  }

  function resetForm() {
    setEditingSub(null);
    setFormTipo('Substituição');
    setFormSubstituido(null);
    setFormSubstituto(null);
    setFormMotivo('Outro');
    setFormMotivoOutro('');
    setFormCidAtestado('');
    setFormPlantaoExtra('');
    setFormDias(15);
    setFormDataInicio('');
    setExtrasAfastamento([]);
  }

  function abrirNovaMovimentacao() {
    resetForm();
    setFormOpen(true);
  }

  function fecharFormulario() {
    setFormOpen(false);
    resetForm();
  }

  function abrirEdicao(sub: SubstituicaoTemporaria) {
    const { descricao, cid } = separarDescricaoMotivo(sub);
    preserveExtrasOnNextSync.current = true;
    setEditingSub(sub);
    setFormTipo(sub.tipo);
    setFormSubstituido(activeBombeiros.find(b => b.id === sub.funcionarioId) || null);
    setFormSubstituto(activeBombeiros.find(b => b.id === sub.substitutoId) || null);
    setFormMotivo(sub.tipo === 'Substituição' ? 'Outro' : sub.motivo);
    setFormMotivoOutro(descricao);
    setFormCidAtestado(cid);
    setFormPlantaoExtra(sub.plantaoExtra || '');
    setFormDias(Math.max(1, Number(sub.dias) || 1));
    setFormDataInicio(sub.dataInicio || '');
    setExtrasAfastamento(extrasDraftFromSub(sub));
    setFormOpen(true);
  }

  function handleTipoChange(tipo: TipoSubstituicao) {
    setFormTipo(tipo);
    setFormSubstituido(null);
    setFormSubstituto(null);
    setFormMotivo(tipo === 'Substituição' ? 'Outro' : '__placeholder__');
    setFormMotivoOutro('');
    setFormCidAtestado('');
    setFormPlantaoExtra('');
    setFormDias(15);
    setExtrasAfastamento([]);
  }

  function handleSubstituidoChange(id: string) {
    setFormSubstituido(activeBombeiros.find(b => b.id === id) || null);
    setFormSubstituto(null);
    setExtrasAfastamento([]);
  }

  function handleSubstitutoChange(id: string) {
    const selected = activeBombeiros.find(b => b.id === id) || null;
    setFormSubstituto(selected);
    setExtrasAfastamento([]);
  }

  function atualizarExtraAfastamento(dataPlantao: string, patch: Partial<ExtraAfastamentoDraft>) {
    setExtrasAfastamento(prev => prev.map(extra => (
      extra.dataPlantao === dataPlantao ? { ...extra, ...patch } : extra
    )));
  }

  function removerExtraAfastamento(dataPlantao: string) {
    setExtrasAfastamento(prev => prev.filter(extra => extra.dataPlantao !== dataPlantao));
  }

  function pessoaPorId(id: string): Bombeiro | undefined {
    return activeBombeiros.find(b => b.id === id);
  }

  function montarExtrasCadeia(): EloCadeiaSubstituicaoTemporaria[] {
    if (formTipo !== 'Afastamento' || !formSubstituido) return [];
    const resultado: EloCadeiaSubstituicaoTemporaria[] = [];
    for (const extra of extrasAfastamento) {
      const substituto = pessoaPorId(extra.substitutoId);
      if (!substituto) continue;
      const cargoExercido = extra.cargoExercido || formSubstituido.cargo;
      resultado.push({
        tipo: 'extra',
        pessoaId: substituto.id,
        pessoaNome: substituto.nomeCompleto,
        pessoaCargo: substituto.cargo,
        pessoaEquipe: substituto.equipe,
        cargoOriginal: substituto.cargo,
        cargoVacante: cargoExercido,
        substituindoNome: formSubstituido.nomeCompleto,
        dataPlantao: extra.dataPlantao,
        funcionarioId: formSubstituido.id,
        funcionarioNome: formSubstituido.nomeCompleto,
        funcionarioCargo: extra.cargoAfastado || cargoExercido,
        funcionarioEquipe: extra.equipePlantao,
        equipePlantao: extra.equipePlantao,
        substituindoId: extra.substituindoId,
        substituindoCargo: extra.substituindoCargo,
        substituindoCoberturaNome: extra.substituindoNome,
        substitutoId: substituto.id,
        substitutoNome: substituto.nomeCompleto,
        substitutoCargo: substituto.cargo,
        cargoExercido,
        plantaoExtra: true,
      });
    }
    return resultado;
  }

  function montarDescricaoMotivo(): string {
    const descricao = formMotivoOutro.trim();
    if (formTipo !== 'Afastamento') return descricao;

    const linhas = [descricao];
    if (atestadoMedico && formCidAtestado.trim()) linhas.push(`CID: ${formCidAtestado.trim()}.`);
    if (afastamentoIndeterminado) linhas.push('Prazo: indeterminado.');
    if (extrasAfastamento.length > 0) {
      const resumoExtras = extrasAfastamento.map(extra => {
        const substituto = pessoaPorId(extra.substitutoId);
        const funcao = extra.cargoExercido || formSubstituido?.cargo || '';
        const equipeInfo = extra.equipePlantao ? `Equipe ${extra.equipePlantao} - ` : '';
        return `${formatDate(extra.dataPlantao)} - ${equipeInfo}${substituto?.nomeCompleto || 'substituto nao informado'} (${cargoLabel(funcao)})`;
      });
      linhas.push(`Extras: ${resumoExtras.join('; ')}.`);
    }
    return linhas.filter(Boolean).join('\n');
  }

  function separarDescricaoMotivo(sub: SubstituicaoTemporaria): { descricao: string; cid: string } {
    const linhasDescricao: string[] = [];
    let cid = '';
    for (const linha of (sub.motivoOutro || '').split(/\r?\n/)) {
      const texto = linha.trim();
      if (!texto) continue;
      if (/^Extras:/i.test(texto) || /^Prazo:/i.test(texto)) continue;
      const cidMatch = texto.match(/^CID:\s*(.+?)\.?$/i);
      if (cidMatch) {
        cid = cidMatch[1].trim().toUpperCase();
        continue;
      }
      linhasDescricao.push(linha);
    }
    return { descricao: linhasDescricao.join('\n').trim(), cid };
  }

  function extrasDraftFromSub(sub: SubstituicaoTemporaria): ExtraAfastamentoDraft[] {
    return (sub.cadeiaSubstituicao || [])
      .filter(elo => elo.tipo === 'extra')
      .map(elo => ({
        dataPlantao: elo.dataPlantao || '',
        substitutoId: elo.substitutoId || elo.pessoaId || '',
        cargoExercido: elo.cargoExercido || elo.cargoVacante || sub.funcionarioCargo,
        equipePlantao: elo.equipePlantao || elo.funcionarioEquipe || '',
        cargoAfastado: elo.funcionarioCargo || sub.funcionarioCargo,
        substituindoId: elo.substituindoId,
        substituindoNome: elo.substituindoCoberturaNome,
        substituindoCargo: elo.substituindoCargo,
      }))
      .filter(extra => extra.dataPlantao);
  }

  async function handleSubmit() {
    if (saving || !formValid || !formSubstituido) return;
    setSaving(true);
    try {
      const motivo = formTipo === 'Substituição' ? 'Outro' : formMotivo as MotivoSubstituicao;
      const descricaoMotivo = montarDescricaoMotivo();
      const extrasCadeia = montarExtrasCadeia();
      if (formTipo === 'Afastamento') {
        if (extrasAfastamento.length === 0) {
          throw new Error('Informe ao menos um plantao extra para o afastamento/atestado.');
        }
        const extraSemSubstituto = extrasAfastamento.find(extra => !extra.substitutoId);
        if (extraSemSubstituto) {
          throw new Error(`Selecione quem fara o extra em ${formatDate(extraSemSubstituto.dataPlantao)}.`);
        }
        if (extrasCadeia.length !== extrasAfastamento.length) {
          throw new Error('Revise os extras do afastamento/atestado antes de salvar.');
        }
      }
      const substitutoPrincipal = formTipo === 'Afastamento'
        ? pessoaPorId(extrasAfastamento[0]?.substitutoId || '')
        : formSubstituto;
      if (!substitutoPrincipal) throw new Error('Informe quem fara os extras.');
      const payload: Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'> = {
        funcionarioId: formSubstituido.id,
        funcionarioNome: formSubstituido.nomeCompleto,
        funcionarioCargo: formSubstituido.cargo,
        substitutoId: substitutoPrincipal.id,
        substitutoNome: substitutoPrincipal.nomeCompleto,
        substitutoCargo: formTipo === 'Afastamento'
          ? substitutoPrincipal.cargo
          : substituicaoFuncao,
        tipo: formTipo,
        motivo,
        motivoOutro: descricaoMotivo,
        plantaoExtra: formTipo === 'Afastamento' ? 'Sim' : formPlantaoExtra,
        dataInicio: formDataInicio,
        dataFim: dataFimCalculada,
        dias: diasParaSalvar,
        status: 'Pendente',
        observacoesRejeicao: editingSub?.observacoesRejeicao || '',
        criadoPor: editingSub?.criadoPor || user?.username || '',
        criadoPorNome: editingSub?.criadoPorNome || user?.name || '',
        aprovadoPor: '',
        aprovadoPorNome: '',
        aprovadoEm: '',
        cadeiaSubstituicao: formTipo === 'Afastamento' ? extrasCadeia : [],
      };
      if (editingSub?.id) {
        await atualizarSubstituicaoTemporaria(editingSub.id, payload);
      } else {
        await criarSubstituicaoTemporaria(payload);
      }
      resetForm();
      setFormOpen(false);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar substituição');
    } finally {
      setSaving(false);
    }
  }

  async function handleAprovar(id: string) {
    if (approvingId) return;
    setApprovingId(id);
    try {
      await aprovarSubstituicaoTemporaria(id, user?.username || '', user?.name || '');
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao aprovar');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleConfirmRejeitar() {
    if (!rejectId || !rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await rejeitarSubstituicaoTemporaria(rejectId, user?.username || '', user?.name || '', rejectReason);
      setRejectId(null);
      setRejectReason('');
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao rejeitar');
    } finally {
      setRejectSaving(false);
    }
  }

  async function handleExcluir(id: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      await excluirSubstituicaoTemporaria(id);
      setConfirmDeleteId(null);
      setDeleteError('');
      await carregar();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setDeleting(false);
    }
  }

  function StatusIcon({ status }: { status: string }) {
    if (status === 'Aprovada') return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (status === 'Rejeitada') return <X className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={ArrowLeftRight} title={isRelatorioRoute ? 'Relatório de Substituições' : 'Substituições Temporárias'} />
        {!isRelatorioRoute && (
          <button onClick={abrirNovaMovimentacao}
            className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
            <Plus className="h-4 w-4" /> Nova Movimentação
          </button>
        )}
      </div>

      {!isRelatorioRoute && canApprove && (
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-1 dark:border-border-dark dark:bg-surface-card/50">
          {([
            { key: 'lista' as Tab, label: 'Todas', count: subs.length },
            { key: 'aprovacoes' as Tab, label: 'Pendentes', count: pendentes.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-white text-aviation-700 shadow-sm dark:bg-graphite-900 dark:text-aviation-300'
                  : 'text-graphite-500 hover:text-graphite-700 dark:text-graphite-400 dark:hover:text-graphite-200'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  t.key === 'aprovacoes' && t.count > 0
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-graphite-200/60 text-graphite-500 dark:bg-surface-hover/40 dark:text-graphite-400'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isRelatorioRoute && (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={termo} onChange={e => setTermo(e.target.value)}
              placeholder="Buscar por nome ou tipo..."
              className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
            <option value="">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Aprovada">Aprovada</option>
            <option value="Rejeitada">Rejeitada</option>
          </select>
        </div>
      )}

      {isRelatorioRoute && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-graphite-200/60 bg-white/70 p-3 dark:border-border-dark dark:bg-surface-card">
          <div className="flex items-center gap-2">
            <select value={relatorioMes} onChange={e => setRelatorioMes(e.target.value)}
              className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
              {MESES_RELATORIO.map((mes, index) => (
                <option key={mes} value={String(index + 1)}>{mes}</option>
              ))}
            </select>
            <select value={relatorioAno} onChange={e => setRelatorioAno(e.target.value)}
              className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
              {ANOS_RELATORIO.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={iniciarImpressaoMensal} disabled={!canPrintRelatorios}
            className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
            <Printer className="h-4 w-4" /> Imprimir relatório mensal
          </button>
          <span className="rounded-full bg-graphite-100 px-2.5 py-1 text-xs font-semibold text-graphite-600 dark:bg-surface-hover dark:text-graphite-300">
            {relatorioMensal.length} registro(s)
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <ArrowLeftRight className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma movimentação encontrada</h3>
          <p className="text-sm text-graphite-400">
            {isRelatorioRoute
              ? 'Nenhum afastamento/atestado aprovado para o período selecionado.'
              : 'Clique em "Nova Movimentação" para criar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => {
            const expanded = expandedId === sub.id;
            const extras = sub.cadeiaSubstituicao.filter(elo => elo.tipo === 'extra');
            const { descricao, cid } = separarDescricaoMotivo(sub);
            return (
              <div key={sub.id}
                onClick={() => setExpandedId(expanded ? null : sub.id)}
                className="cursor-pointer rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0">
                      <StatusIcon status={sub.status} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <TipoBadge tipo={sub.tipo} />
                        <span className="truncate font-semibold text-graphite-900 dark:text-graphite-100">
                          {capitalize(sub.funcionarioNome)}
                        </span>
                        <span className="hidden text-xs text-graphite-400 sm:inline">[{ABBR_CARGO[sub.funcionarioCargo as Cargo] || sub.funcionarioCargo}]</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-graphite-400" />
                        <span className="truncate font-semibold text-graphite-900 dark:text-graphite-100">
                          {capitalize(sub.substitutoNome)}
                        </span>
                        <span className="hidden text-xs text-graphite-400 sm:inline">[{ABBR_CARGO[sub.substitutoCargo as Cargo] || sub.substitutoCargo}]</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                        <span>{motivoLabel(sub)}</span>
                        <span>· {periodoLabel(sub)}</span>
                        {sub.tipo === 'Afastamento' && sub.plantaoExtra === 'Sim' && (
                          <span>· Extras: {extras.length}</span>
                        )}
                      </div>
                      {sub.tipo === 'Afastamento' && sub.motivoOutro && sub.motivo !== 'Outro' && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-graphite-500 dark:text-graphite-400">{sub.motivoOutro}</p>
                      )}
                      {sub.status === 'Rejeitada' && sub.observacoesRejeicao && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">Motivo rejeição: {sub.observacoesRejeicao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_SUBSTITUICAO_CORES[sub.status] || ''}`}>
                      {sub.status}
                    </span>
                    {isRelatorioRoute && canPrintRelatorios && sub.tipo === 'Afastamento' && (
                      <button onClick={event => { event.stopPropagation(); iniciarImpressaoIndividual(sub); }}
                        className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-aviation-50 hover:text-aviation-600 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-300"
                        title="Imprimir relatório individual">
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    {!isRelatorioRoute && sub.status === 'Pendente' && canApprove && (
                      <>
                        <button onClick={event => { event.stopPropagation(); handleAprovar(sub.id); }} disabled={!!approvingId}
                          className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-900/20 dark:text-green-400">
                          {approvingId === sub.id ? 'Aprovando...' : 'Aprovar'}
                        </button>
                        <button onClick={event => { event.stopPropagation(); setRejectId(sub.id); }}
                          className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                          Rejeitar
                        </button>
                      </>
                    )}
                    {!isRelatorioRoute && canApprove && (
                      <>
                        <button onClick={event => { event.stopPropagation(); abrirEdicao(sub); }}
                          className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-aviation-50 hover:text-aviation-600 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-300"
                          title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={event => { event.stopPropagation(); setConfirmDeleteId(sub.id); setDeleteError(''); }}
                          className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 border-t border-graphite-200/60 pt-4 text-sm dark:border-border-dark">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-graphite-400">Criado por</p>
                        <p className="mt-1 font-medium text-graphite-900 dark:text-graphite-100">{sub.criadoPorNome || sub.criadoPor || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-graphite-400">Aprovado por</p>
                        <p className="mt-1 font-medium text-graphite-900 dark:text-graphite-100">{sub.aprovadoPorNome || sub.aprovadoPor || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-graphite-400">Plantão extra</p>
                        <p className="mt-1 font-medium text-graphite-900 dark:text-graphite-100">{sub.plantaoExtra || '-'}</p>
                      </div>
                    </div>
                    {cid && (
                      <p className="mt-3 text-xs text-graphite-500 dark:text-graphite-400">CID: <span className="font-semibold">{cid}</span></p>
                    )}
                    {descricao && (
                      <div className="mt-3 rounded-xl border border-graphite-200 bg-graphite-50/80 p-3 dark:border-border-dark dark:bg-surface-hover/50">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-400">Descrição</p>
                        <p className="whitespace-pre-line text-graphite-700 dark:text-graphite-200">{descricao}</p>
                      </div>
                    )}
                    {extras.length > 0 && (
                      <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-800/40 dark:bg-purple-900/10">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">Extras</p>
                        <div className="space-y-1.5">
                          {extras.map((extra, index) => (
                            <p key={`${extra.dataPlantao}-${extra.pessoaId}-${index}`} className="text-xs text-purple-800 dark:text-purple-200">
                              {extra.dataPlantao ? formatDate(extra.dataPlantao) : '-'} - {extra.substitutoNome || extra.pessoaNome || '-'} ({cargoLabel(extra.cargoExercido || extra.cargoVacante || extra.pessoaCargo)})
                              {extra.equipePlantao ? ` · Equipe ${extra.equipePlantao}` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isRelatorioRoute && canPrintRelatorios && (
        <div className="substituicoes-print-area">
          {(printingMonthly || printingSub) && (
            <div className="space-y-3">
              <header className="rounded-xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">SESCINC</p>
                <div className="mt-1 flex items-end justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold">Relatório de Extras e Afastamentos</h1>
                    <p className="mt-1 text-xs text-slate-300">
                      {printingSub
                        ? `Relatório individual · ${printingSub.funcionarioNome}`
                        : `${MESES_RELATORIO[Number(relatorioMes) - 1]} de ${relatorioAno}`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-300">Total</p>
                    <p className="text-lg font-bold">{printingSub ? 1 : relatorioMensal.length}</p>
                  </div>
                </div>
              </header>
              {printingSub
                ? renderRelatorioSubstituicao(printingSub)
                : relatorioMensal.length > 0
                  ? relatorioMensal.map(renderRelatorioSubstituicao)
                  : (
                    <div className="rounded-xl border border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                      Nenhum afastamento/atestado aprovado para o período selecionado.
                    </div>
                  )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .substituicoes-print-area {
          display: none;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          .substituicoes-print-area,
          .substituicoes-print-area * {
            visibility: visible !important;
          }
          .substituicoes-print-area {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: Arial, sans-serif !important;
          }
          .substituicoes-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 10px;
          }
        }
      `}</style>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pb-5 pt-5" onClick={fecharFormulario}>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editingSub ? 'Editar Movimentação' : 'Nova Movimentação'}</h3>
              <button onClick={fecharFormulario} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Tipo</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TIPO_OPTIONS.map(t => (
                    <button key={t} onClick={() => handleTipoChange(t)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                        formTipo === t
                          ? 'border-aviation-500 bg-aviation-50 text-aviation-700 dark:border-aviation-400 dark:bg-aviation-900/30 dark:text-aviation-300'
                          : 'border-graphite-300/60 bg-white/70 text-graphite-600 hover:border-graphite-300/70 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-300'
                      }`}>
                      {tipoOptionLabel(t)}
                    </button>
                  ))}
                </div>
              </div>

              {formTipo === 'Afastamento' ? (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Pessoa afastada/atestada</label>
                    <SearchSelect
                      value={formSubstituido?.id || ''}
                      onChange={handleSubstituidoChange}
                      placeholder="Função, nome de guerra, equipe..."
                      valueField="id"
                      options={activeBombeiros}
                      displayMode="operational"
                    />
                    {formSubstituido && (
                      <p className="mt-1 text-xs text-graphite-500">{nomeOperacional(formSubstituido)}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Função da pessoa</label>
                    <input type="text" readOnly value={cargoLabel(formSubstituido?.cargo)}
                      className={`${INPUT_CLASS} cursor-default opacity-70`} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Substituído</label>
                    <SearchSelect
                      value={formSubstituido?.id || ''}
                      onChange={handleSubstituidoChange}
                      placeholder="Função, nome de guerra, equipe..."
                      valueField="id"
                      options={activeBombeiros}
                      displayMode="operational"
                    />
                    {formSubstituido && (
                      <p className="mt-1 text-xs text-graphite-500">{nomeOperacional(formSubstituido)}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Substituto</label>
                    <SearchSelect
                      value={formSubstituto?.id || ''}
                      onChange={handleSubstitutoChange}
                      placeholder="Função, nome de guerra, equipe..."
                      valueField="id"
                      options={activeBombeiros}
                      disabledIds={substitutosBloqueados}
                      disabledTooltip="Pessoa não pode assumir esta função"
                      displayMode="operational"
                    />
                    {formSubstituto && (
                      <p className="mt-1 text-xs text-graphite-500">{nomeOperacional(formSubstituto)}</p>
                    )}
                    {formSubstituido && formSubstituto && formSubstituido.id === formSubstituto.id && (
                      <p className="mt-1 text-xs text-red-500">O substituto não pode ser a mesma pessoa.</p>
                    )}
                    {formSubstituido && formSubstituto && formSubstituido.id !== formSubstituto.id && (() => {
                      const aviso = validarCursoParaFuncao(formSubstituto, formSubstituido.cargo as Cargo);
                      if (bloqueadoPorHierarquia) {
                        return (
                          <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] leading-tight text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{nomeOperacional(formSubstituto)} não pode assumir a vaga de {ABBR_CARGO[formSubstituido.cargo] || formSubstituido.cargo}.</span>
                          </div>
                        );
                      }
                      return aviso ? (
                        <div className={`mt-1.5 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-tight ${
                          aviso.nivel === 'bloqueado'
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        }`}>
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{aviso.mensagem}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Função de Substituição</label>
                    <input type="text" readOnly value={substituicaoFuncao ? (ABBR_CARGO[substituicaoFuncao as Cargo] || substituicaoFuncao) : 'Selecione o substituído primeiro'}
                      className={`${INPUT_CLASS} cursor-default opacity-70`} />
                  </div>
                </>
              )}

              {formTipo === 'Substituição' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Dias que ficará fora</label>
                    <input type="number" min={1} value={formDias} onChange={e => setFormDias(Math.max(1, Number(e.target.value)))} className={INPUT_CLASS} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Descrição do Motivo</label>
                    <textarea value={formMotivoOutro} onChange={e => setFormMotivoOutro(e.target.value)}
                      placeholder="Descreva o motivo da substituição..." className={INPUT_CLASS} rows={3} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Motivo do Afastamento/Atestado</label>
                    <select value={formMotivo} onChange={e => setFormMotivo(e.target.value as MotivoSubstituicao | '__placeholder__')} className={INPUT_CLASS}>
                      <option value="__placeholder__" disabled>Escolha um motivo...</option>
                      {MOTIVOS_SUBSTITUICAO.map(m => (
                        <option key={m.value} value={m.value} className="dark:bg-graphite-700">
                          {m.label}{m.dias > 0 && m.value !== 'Atestado Medico' ? ` (${m.dias} dias)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!afastamentoIndeterminado && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Dias de afastamento</label>
                      <input
                        type="number"
                        min={1}
                        value={formDias}
                        onChange={e => setFormDias(Math.max(1, Number(e.target.value)))}
                        disabled={afastamentoTemPrazoFixo}
                        className={`${INPUT_CLASS} ${afastamentoTemPrazoFixo ? 'cursor-not-allowed opacity-70' : ''}`}
                      />
                      {afastamentoTemPrazoFixo && (
                        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
                          Prazo padrão do motivo selecionado.
                        </p>
                      )}
                    </div>
                  )}
                  {afastamentoIndeterminado && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Dias iniciais para extras</label>
                      <input type="number" min={1} value={formDias} onChange={e => setFormDias(Math.max(1, Number(e.target.value)))}
                        className={INPUT_CLASS} />
                      <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                        O afastamento fica com prazo indeterminado; estes dias definem apenas os plantões extras iniciais.
                      </p>
                    </div>
                  )}
                  {atestadoMedico && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">CID (opcional)</label>
                      <input
                        type="text"
                        value={formCidAtestado}
                        onChange={e => setFormCidAtestado(e.target.value.toUpperCase())}
                        placeholder="Ex: A09"
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Descrição do afastamento/atestado</label>
                    <textarea value={formMotivoOutro} onChange={e => setFormMotivoOutro(e.target.value)}
                      placeholder="Descreva o motivo do afastamento, informações do INSS ou observações do atestado..." className={INPUT_CLASS} rows={3} />
                  </div>
                </>
              )}

              {isMotivoObrigatorio && (
                <div className="md:col-span-2">
                  <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-800/40 dark:bg-orange-900/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Atenção</p>
                        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                          Este motivo é obrigatório por lei. A movimentação passará por aprovação do gerente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formTipo === 'Afastamento' && (
                <div className="md:col-span-2">
                  <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-800/40 dark:bg-orange-900/20">
                    <div className="flex items-start gap-3">
                      <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Afastamento/Atestados</p>
                        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                          Ao aprovar, o funcionário ficará com status Afastado e os plantões selecionados serão puxados como extras na Escala Diária.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data de Saída</label>
                <input type="date" value={formDataInicio} onChange={e => setFormDataInicio(e.target.value)} className={INPUT_CLASS} />
              </div>

              {!afastamentoIndeterminado && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data de Retorno</label>
                  <input type="text" readOnly value={dataFimCalculada ? formatDate(dataFimCalculada) : 'Preencha a data de saída'}
                    className={`${INPUT_CLASS} cursor-default opacity-70`} />
                </div>
              )}

              {formTipo === 'Afastamento' && plantoesAfastamento.length > 0 && (
                <div className="md:col-span-2">
                  <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-800/40 dark:bg-purple-900/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">Extras</h4>
                        <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                          {afastamentoIndeterminado
                            ? 'Selecione quem ficará no lugar nos plantões iniciais informados. Remova na lixeira o dia que não será extra.'
                            : 'Selecione quem ficará no lugar nos plantões dentro do período. Remova na lixeira o dia que não será extra.'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:bg-surface-card dark:text-purple-300">
                        {extrasAfastamento.length} extra(s)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {extrasAfastamento.map(extra => (
                        <div key={extra.dataPlantao} className="grid gap-3 rounded-xl border border-purple-100 bg-white px-3 py-3 dark:border-purple-900/40 dark:bg-surface-card md:grid-cols-[110px_minmax(220px,1fr)_150px_auto] md:items-end">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data</p>
                            <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{formatDate(extra.dataPlantao)}</p>
                            {extra.equipePlantao && (
                              <p className="mt-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-300">
                                Equipe {extra.equipePlantao}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Quem fará o extra</label>
                            <SearchSelect
                              value={extra.substitutoId}
                              onChange={value => atualizarExtraAfastamento(extra.dataPlantao, { substitutoId: value })}
                              placeholder="Função, nome de guerra, equipe..."
                              valueField="id"
                              options={activeBombeiros}
                              disabledIds={formSubstituido ? new Set([formSubstituido.id]) : undefined}
                              disabledTooltip="A pessoa afastada não pode fazer o próprio extra"
                              displayMode="operational"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Função exercida</label>
                            <select
                              value={extra.cargoExercido}
                              onChange={event => atualizarExtraAfastamento(extra.dataPlantao, { cargoExercido: event.target.value })}
                              className={INPUT_CLASS}
                            >
                              {(['BA-CE', 'BA-LR', 'BA-MC', 'BA-2', 'BA-RE', 'GS', 'OC'] as Cargo[]).map(cargo => (
                                <option key={cargo} value={cargo} className="dark:bg-graphite-700">{cargoLabel(cargo)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex md:justify-end">
                            <button type="button" onClick={() => removerExtraAfastamento(extra.dataPlantao)}
                              className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                              title="Remover este dia dos extras">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {formTipo === 'Afastamento' && formSubstituido && formDataInicio && dataFimExtrasCalculada && plantoesAfastamento.length === 0 && (
                <div className="md:col-span-2">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                    Não encontrei plantões para essa pessoa no período. Se for ferista, confira se há férias aprovadas/vigência ativa colocando ele em uma equipe nesses dias.
                  </div>
                </div>
              )}
            </div>

            {formSubstituido && formDataInicio && dataFimCalculada && (formTipo === 'Afastamento' || formSubstituto) && (
              <div className="mt-4 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/50">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Resumo</h4>
                {formTipo === 'Afastamento' ? (
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-graphite-900 dark:text-graphite-100">{nomeOperacional(formSubstituido)}</p>
                    {extrasAfastamento.length > 0 ? extrasAfastamento.map(extra => {
                      const substituto = pessoaPorId(extra.substitutoId);
                      const funcaoLabel = substituto && substituto.cargo !== extra.cargoExercido
                        ? `${cargoLabel(substituto.cargo)} -> ${cargoLabel(extra.cargoExercido)}`
                        : cargoLabel(extra.cargoExercido);
                      return (
                        <div key={extra.dataPlantao} className="flex flex-wrap items-center gap-2 rounded-lg border border-graphite-200 bg-white px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-hover">
                          <span className="font-semibold text-graphite-900 dark:text-graphite-100">{formatDate(extra.dataPlantao)}</span>
                          <span className="text-graphite-400">·</span>
                          {extra.equipePlantao && (
                            <>
                              <span className="font-medium text-purple-600 dark:text-purple-300">Equipe {extra.equipePlantao}</span>
                              <span className="text-graphite-400">·</span>
                            </>
                          )}
                          <span>{cargoLabel(extra.cargoAfastado || formSubstituido.cargo)} {capitalize(formSubstituido.nomeCompleto)}</span>
                          <ArrowRight className="h-3 w-3 text-aviation-500" />
                          <span className="font-semibold text-graphite-900 dark:text-graphite-100">
                            {substituto ? `${funcaoLabel} ${capitalize(substituto.nomeCompleto)}` : 'Selecione quem fará o extra'}
                          </span>
                        </div>
                      );
                    }) : (
                      <p className="text-xs text-graphite-500">Nenhum plantão extra selecionado.</p>
                    )}
                  </div>
                ) : formSubstituto ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-graphite-900 dark:text-graphite-100">{nomeOperacional(formSubstituido)}</span>
                    <ArrowRight className="h-4 w-4 text-aviation-500" />
                    <span className="font-semibold text-graphite-900 dark:text-graphite-100">{nomeOperacional(formSubstituto)}</span>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-graphite-500">
                  <span>Tipo: <strong>{tipoOptionLabel(formTipo)}</strong></span>
                  {afastamentoIndeterminado ? (
                    <span>· a partir de {formatDate(formDataInicio)} · prazo indeterminado</span>
                  ) : (
                    <span>· {formatDate(formDataInicio)} a {formatDate(dataFimCalculada)} ({diasParaSalvar} dias)</span>
                  )}
                  {formTipo === 'Afastamento' && extrasAfastamento.length > 0 && (
                    <span>· {extrasAfastamento.length} plantão(ões) extra</span>
                  )}
                  <span>· Status: <strong className="text-yellow-600">Pendente</strong></span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={fecharFormulario}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-graphite-600 transition-colors hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={!formValid || saving}
                className="rounded-xl bg-aviation-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 disabled:opacity-50 dark:bg-aviation-500 dark:hover:bg-aviation-600">
                {saving ? 'Salvando...' : editingSub ? 'Salvar Alterações' : 'Enviar para Aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setRejectId(null); setRejectReason(''); }}>
          <div className="w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Rejeitar Movimentação</h3>
            </div>
            <label className="mb-1.5 block text-xs font-semibold text-graphite-600 dark:text-graphite-400">Motivo da rejeição (obrigatório)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da rejeição..."
              className={`${INPUT_CLASS} w-full`} rows={3} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">
                Cancelar
              </button>
              <button onClick={handleConfirmRejeitar} disabled={!rejectReason.trim() || rejectSaving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {rejectSaving ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        open={!!confirmDeleteId}
        title="Excluir movimentação"
        message="Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita."
        variant="danger"
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        loading={deleting}
        error={deleteError}
        onClose={() => { if (!deleting) { setConfirmDeleteId(null); setDeleteError(''); } }}
        onConfirm={() => confirmDeleteId ? handleExcluir(confirmDeleteId) : undefined}
      />
    </PageContainer>
  );
}

export default Substituicoes;
