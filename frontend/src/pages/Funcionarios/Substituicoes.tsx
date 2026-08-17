import { useState, useEffect, useMemo } from 'react';
import { ArrowLeftRight, ArrowRight, Plus, Search, Trash2, AlertCircle, AlertTriangle, X, Check, Clock, DollarSign, RefreshCw, ShieldOff } from 'lucide-react';
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
  aprovarSubstituicaoTemporaria,
  rejeitarSubstituicaoTemporaria,
  excluirSubstituicaoTemporaria,
} from '../../services/substituicaoTemporariaService';
import { useDebounce } from '../../hooks/useDebounce';
import { capitalizarNome } from '../../utils/capitalize';
import { validarCursoParaFuncao } from '../../utils/validacaoCursos';
import { getCargosPermitidosSubstituto } from '../../types/ferias';
import { AlertModal } from '../../components/ui/AlertModal';
import { formatarDataBR } from '../../utils/datas';

function capitalize(str: string) { return capitalizarNome(str); }
function formatDate(d: string) { return formatarDataBR(d); }

const INPUT_CLASS = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const TIPO_OPTIONS: TipoSubstituicao[] = ['Substituição', 'Extra', 'Afastamento'];

type Tab = 'lista' | 'aprovacoes';

function nomeOperacional(b: Bombeiro): string {
  return `${ABBR_CARGO[b.cargo] || b.cargo} · ${capitalize(b.nomeGuerra)} · ${b.equipe}`;
}

function isFerista(b?: Bombeiro | null): boolean {
  return b?.equipe === 'Ferista';
}

function cargoPermitido(cargoVacante: Cargo, pessoa: Bombeiro): boolean {
  const permitidos = getCargosPermitidosSubstituto(cargoVacante);
  return permitidos.includes(pessoa.cargo) || (permitidos.includes('Ferista') && pessoa.equipe === 'Ferista');
}

function criarEloVazio(substituindo: Bombeiro): EloCadeiaSubstituicaoTemporaria {
  return {
    pessoaId: '',
    pessoaNome: '',
    pessoaCargo: '',
    pessoaEquipe: '',
    cargoOriginal: '',
    cargoVacante: substituindo.cargo,
    substituindoNome: substituindo.nomeCompleto,
  };
}

function motivoLabel(sub: SubstituicaoTemporaria): string {
  if (sub.motivo === 'Outro') return sub.motivoOutro || 'Outro';
  return MOTIVOS_SUBSTITUICAO.find(m => m.value === sub.motivo)?.label || sub.motivo;
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
        <ShieldOff className="h-3 w-3" /> Afastamento
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
  const canApprove = effectiveRole === 'desenvolvedor' || effectiveRole === 'admin' || effectiveRole === 'gerente';

  const [tab, setTab] = useState<Tab>('lista');
  const [allBombeiros, setAllBombeiros] = useState<Bombeiro[]>([]);
  const [subs, setSubs] = useState<SubstituicaoTemporaria[]>([]);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [formTipo, setFormTipo] = useState<TipoSubstituicao>('Substituição');
  const [formSubstituido, setFormSubstituido] = useState<Bombeiro | null>(null);
  const [formSubstituto, setFormSubstituto] = useState<Bombeiro | null>(null);
  const [formMotivo, setFormMotivo] = useState<MotivoSubstituicao | '__placeholder__'>('Outro');
  const [formMotivoOutro, setFormMotivoOutro] = useState('');
  const [formPlantaoExtra, setFormPlantaoExtra] = useState<RespostaPlantaoExtra>('');
  const [formDias, setFormDias] = useState(15);
  const [formDataInicio, setFormDataInicio] = useState('');
  const [cadeiaSubstituicao, setCadeiaSubstituicao] = useState<EloCadeiaSubstituicaoTemporaria[]>([]);

  const debouncedTermo = useDebounce(termo, 400);
  const activeBombeiros = useMemo(() => allBombeiros.filter(b => !b.dataDesligamento), [allBombeiros]);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const [b, s] = await Promise.all([listarBombeiros(), listarSubstituicoesTemporarias()]);
    setAllBombeiros(b);
    setSubs(s);
  }

  useEffect(() => {
    if (formTipo === 'Substituição') return;
    const found = MOTIVOS_SUBSTITUICAO.find(m => m.value === formMotivo);
    if (found && found.dias > 0) setFormDias(found.dias);
  }, [formMotivo, formTipo]);

  const isMotivoObrigatorio = formTipo !== 'Substituição' && MOTIVOS_OBRIGATORIOS_POR_LEI.includes(formMotivo as MotivoSubstituicao);

  const dataFimCalculada = useMemo(() => {
    if (!formDataInicio || formDias <= 0) return '';
    const parts = formDataInicio.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + formDias - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [formDataInicio, formDias]);

  const substituicaoFuncao = formSubstituido?.cargo || '';

  const bloqueadoPorCurso = !!(formSubstituido && formSubstituto && formSubstituido.id !== formSubstituto.id && (() => {
    const aviso = validarCursoParaFuncao(formSubstituto, formSubstituido.cargo as Cargo);
    return aviso && aviso.nivel === 'bloqueado';
  })());

  const bloqueadoPorHierarquia = !!(
    formTipo === 'Afastamento' &&
    formSubstituido &&
    formSubstituto &&
    formSubstituido.id !== formSubstituto.id &&
    !cargoPermitido(formSubstituido.cargo as Cargo, formSubstituto)
  );

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
      if (formTipo === 'Afastamento' && !cargoPermitido(formSubstituido.cargo as Cargo, b)) blocked.add(b.id);
    }
    return blocked;
  }, [activeBombeiros, formSubstituido, formTipo]);

  const cadeiaCompleta = useMemo(() => {
    if (formTipo !== 'Afastamento') return true;
    if (!formSubstituto) return false;
    if (isFerista(formSubstituto)) return true;
    if (cadeiaSubstituicao.length === 0) return false;
    return cadeiaSubstituicao.every(elo => !!elo.pessoaId) && cadeiaSubstituicao[cadeiaSubstituicao.length - 1]?.pessoaEquipe === 'Ferista';
  }, [cadeiaSubstituicao, formSubstituto, formTipo]);

  const motivoValido = formTipo === 'Substituição'
    ? !!formMotivoOutro.trim()
    : !!formMotivo && formMotivo !== '__placeholder__' && (formMotivo !== 'Outro' || !!formMotivoOutro.trim());

  const formValid = !!(
    formSubstituido && formSubstituto &&
    formSubstituido.id !== formSubstituto.id &&
    motivoValido &&
    formDataInicio && formDias > 0 &&
    dataFimCalculada &&
    (formTipo !== 'Extra' || !!formPlantaoExtra) &&
    cadeiaCompleta &&
    !bloqueadoPorCurso &&
    !bloqueadoPorHierarquia
  );

  const filtered = subs.filter(s => {
    const matchTermo = !debouncedTermo ||
      s.funcionarioNome.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      s.substitutoNome.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      s.tipo.toLowerCase().includes(debouncedTermo.toLowerCase());
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchTermo && matchStatus;
  });

  const pendentes = subs.filter(s => s.status === 'Pendente');

  function resetForm() {
    setFormTipo('Substituição');
    setFormSubstituido(null);
    setFormSubstituto(null);
    setFormMotivo('Outro');
    setFormMotivoOutro('');
    setFormPlantaoExtra('');
    setFormDias(15);
    setFormDataInicio('');
    setCadeiaSubstituicao([]);
  }

  function handleTipoChange(tipo: TipoSubstituicao) {
    setFormTipo(tipo);
    setFormSubstituido(null);
    setFormSubstituto(null);
    setFormMotivo(tipo === 'Substituição' ? 'Outro' : '__placeholder__');
    setFormMotivoOutro('');
    setFormPlantaoExtra('');
    setFormDias(15);
    setCadeiaSubstituicao([]);
  }

  function handleSubstituidoChange(id: string) {
    setFormSubstituido(activeBombeiros.find(b => b.id === id) || null);
    setFormSubstituto(null);
    setCadeiaSubstituicao([]);
  }

  function handleSubstitutoChange(id: string) {
    const selected = activeBombeiros.find(b => b.id === id) || null;
    setFormSubstituto(selected);
    setCadeiaSubstituicao(formTipo === 'Afastamento' && selected && !isFerista(selected) ? [criarEloVazio(selected)] : []);
  }

  function opcoesParaElo(index: number): Bombeiro[] {
    const elo = cadeiaSubstituicao[index];
    if (!elo?.cargoVacante) return [];
    const idsUsados = new Set<string>();
    if (formSubstituido) idsUsados.add(formSubstituido.id);
    if (formSubstituto) idsUsados.add(formSubstituto.id);
    cadeiaSubstituicao.forEach((item, itemIndex) => {
      if (itemIndex !== index && item.pessoaId) idsUsados.add(item.pessoaId);
    });

    return activeBombeiros.filter(b => {
      if (idsUsados.has(b.id)) return false;
      if (!cargoPermitido(elo.cargoVacante as Cargo, b)) return false;
      const aviso = validarCursoParaFuncao(b, elo.cargoVacante as Cargo);
      return !(aviso && aviso.nivel === 'bloqueado');
    });
  }

  function handleCadeiaChange(index: number, pessoaId: string) {
    const pessoa = activeBombeiros.find(b => b.id === pessoaId);
    if (!pessoa) return;
    const base = cadeiaSubstituicao.slice(0, index + 1);
    base[index] = {
      ...base[index],
      pessoaId: pessoa.id,
      pessoaNome: pessoa.nomeCompleto,
      pessoaCargo: pessoa.cargo,
      pessoaEquipe: pessoa.equipe,
      cargoOriginal: pessoa.cargo,
    };
    if (!isFerista(pessoa)) base.push(criarEloVazio(pessoa));
    setCadeiaSubstituicao(base);
  }

  async function handleSubmit() {
    if (saving || !formValid || !formSubstituido || !formSubstituto) return;
    setSaving(true);
    try {
      const motivo = formTipo === 'Substituição' ? 'Outro' : formMotivo as MotivoSubstituicao;
      await criarSubstituicaoTemporaria({
        funcionarioId: formSubstituido.id,
        funcionarioNome: formSubstituido.nomeCompleto,
        funcionarioCargo: formSubstituido.cargo,
        substitutoId: formSubstituto.id,
        substitutoNome: formSubstituto.nomeCompleto,
        substitutoCargo: substituicaoFuncao,
        tipo: formTipo,
        motivo,
        motivoOutro: motivo === 'Outro' ? formMotivoOutro.trim() : '',
        plantaoExtra: formTipo === 'Extra' ? formPlantaoExtra : '',
        dataInicio: formDataInicio,
        dataFim: dataFimCalculada,
        dias: formDias,
        status: 'Pendente',
        observacoesRejeicao: '',
        criadoPor: user?.username || '',
        criadoPorNome: user?.name || '',
        aprovadoPor: '',
        aprovadoPorNome: '',
        aprovadoEm: '',
        cadeiaSubstituicao: formTipo === 'Afastamento' ? cadeiaSubstituicao.filter(elo => elo.pessoaId) : [],
      });
      setFormOpen(false);
      resetForm();
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar substituição');
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
        <PageTitle icon={ArrowLeftRight} title="Substituições Temporárias" />
        <button onClick={() => { resetForm(); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
          <Plus className="h-4 w-4" /> Nova Movimentação
        </button>
      </div>

      {canApprove && (
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <ArrowLeftRight className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma movimentação encontrada</h3>
          <p className="text-sm text-graphite-400">Clique em "Nova Movimentação" para criar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => (
            <div key={sub.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
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
                    <span>· {formatDate(sub.dataInicio)} a {formatDate(sub.dataFim)} ({sub.dias} dias)</span>
                    {sub.tipo === 'Afastamento' && sub.cadeiaSubstituicao.length > 0 && (
                      <span>· Corrente: {sub.cadeiaSubstituicao.map(elo => elo.pessoaNome).join(' → ')}</span>
                    )}
                  </div>
                  {sub.status === 'Rejeitada' && sub.observacoesRejeicao && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">Motivo rejeição: {sub.observacoesRejeicao}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_SUBSTITUICAO_CORES[sub.status] || ''}`}>
                  {sub.status}
                </span>
                {sub.status === 'Pendente' && canApprove && (
                  <>
                    <button onClick={() => handleAprovar(sub.id)} disabled={!!approvingId}
                      className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-900/20 dark:text-green-400">
                      {approvingId === sub.id ? 'Aprovando...' : 'Aprovar'}
                    </button>
                    <button onClick={() => setRejectId(sub.id)}
                      className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                      Rejeitar
                    </button>
                  </>
                )}
                {canApprove && (
                  <button onClick={() => { setConfirmDeleteId(sub.id); setDeleteError(''); }}
                    className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pb-5 pt-5" onClick={() => setFormOpen(false)}>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Nova Movimentação</h3>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPO_OPTIONS.map(t => (
                    <button key={t} onClick={() => handleTipoChange(t)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                        formTipo === t
                          ? 'border-aviation-500 bg-aviation-50 text-aviation-700 dark:border-aviation-400 dark:bg-aviation-900/30 dark:text-aviation-300'
                          : 'border-graphite-300/60 bg-white/70 text-graphite-600 hover:border-graphite-300/70 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-300'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Motivo</label>
                  <select value={formMotivo} onChange={e => setFormMotivo(e.target.value as MotivoSubstituicao | '__placeholder__')} className={INPUT_CLASS}>
                    <option value="__placeholder__" disabled>Escolha um motivo...</option>
                    {MOTIVOS_SUBSTITUICAO.map(m => (
                      <option key={m.value} value={m.value} className="dark:bg-graphite-700">
                        {m.label}{m.dias > 0 ? ` (${m.dias} dias)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
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

              {formTipo === 'Extra' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Haverá plantão extra?</label>
                    <select value={formPlantaoExtra} onChange={e => setFormPlantaoExtra(e.target.value as RespostaPlantaoExtra)} className={INPUT_CLASS}>
                      <option value="">Escolha...</option>
                      <option value="Sim">Sim</option>
                      <option value="Nao">Não</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-4 dark:border-purple-800/40 dark:bg-purple-900/20">
                      <div className="flex items-start gap-3">
                        <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Extra</p>
                          <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                            Esta movimentação será registrada como Extra e passará por aprovação do gerente antes de ser validada.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {formTipo === 'Afastamento' && (
                <div className="md:col-span-2">
                  <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-800/40 dark:bg-orange-900/20">
                    <div className="flex items-start gap-3">
                      <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Afastamento</p>
                        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                          Ao aprovar, o funcionário ficará com status Afastado durante o período e a corrente seguirá até uma pessoa da equipe Ferista.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formTipo !== 'Substituição' && formMotivo === 'Outro' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Dias que ficará fora</label>
                    <input type="number" min={1} value={formDias} onChange={e => setFormDias(Math.max(1, Number(e.target.value)))} className={INPUT_CLASS} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Descrição do Motivo</label>
                    <textarea value={formMotivoOutro} onChange={e => setFormMotivoOutro(e.target.value)}
                      placeholder="Descreva o motivo..." className={INPUT_CLASS} rows={3} />
                  </div>
                </>
              )}

              {formTipo === 'Afastamento' && cadeiaSubstituicao.length > 0 && (
                <div className="md:col-span-2">
                  <div className="space-y-3 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/50">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Corrente de Substituição</h4>
                    {cadeiaSubstituicao.map((elo, index) => {
                      const options = opcoesParaElo(index);
                      return (
                        <div key={`${elo.cargoVacante}-${index}`} className="rounded-xl border border-graphite-200 bg-white p-3 dark:border-border-dark dark:bg-surface-hover">
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                            <span>Vaga de {ABBR_CARGO[elo.cargoVacante as Cargo] || elo.cargoVacante}</span>
                            <span>Substituindo {capitalize(elo.substituindoNome)}</span>
                          </div>
                          <SearchSelect
                            value={elo.pessoaId}
                            onChange={value => handleCadeiaChange(index, value)}
                            placeholder="Função, nome de guerra, equipe..."
                            valueField="id"
                            options={options}
                            displayMode="operational"
                          />
                        </div>
                      );
                    })}
                    {cadeiaCompleta ? (
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Corrente completa até Ferista.</p>
                    ) : (
                      <p className="text-xs text-orange-700 dark:text-orange-400">Selecione os próximos substitutos até terminar em uma pessoa da equipe Ferista.</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data de Saída</label>
                <input type="date" value={formDataInicio} onChange={e => setFormDataInicio(e.target.value)} className={INPUT_CLASS} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data de Retorno</label>
                <input type="text" readOnly value={dataFimCalculada ? formatDate(dataFimCalculada) : 'Preencha a data de saída'}
                  className={`${INPUT_CLASS} cursor-default opacity-70`} />
              </div>
            </div>

            {formSubstituido && formSubstituto && formDataInicio && dataFimCalculada && (
              <div className="mt-4 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/50">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Resumo</h4>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-graphite-900 dark:text-graphite-100">{nomeOperacional(formSubstituido)}</span>
                  <ArrowRight className="h-4 w-4 text-aviation-500" />
                  <span className="font-semibold text-graphite-900 dark:text-graphite-100">{nomeOperacional(formSubstituto)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-graphite-500">
                  <span>Tipo: <strong>{formTipo}</strong></span>
                  <span>· {formatDate(formDataInicio)} a {formatDate(dataFimCalculada)} ({formDias} dias)</span>
                  <span>· Status: <strong className="text-yellow-600">Pendente</strong></span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFormOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-graphite-600 transition-colors hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={!formValid || saving}
                className="rounded-xl bg-aviation-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 disabled:opacity-50 dark:bg-aviation-500 dark:hover:bg-aviation-600">
                {saving ? 'Criando...' : 'Enviar para Aprovação'}
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
