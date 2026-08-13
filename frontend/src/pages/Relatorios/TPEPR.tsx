import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  Download,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { resolverEfetivoOperacional } from '../../services/efetivoOperacionalService';
import {
  atualizarTPEPR,
  criarTPEPR,
  excluirTPEPR,
  listarTPEPRs,
  obterProximoNumeroTPEPR,
} from '../../services/tpeprService';
import { baixarTPEPRPdf } from '../../services/tpeprPdfService';
import type { Bombeiro, Cargo } from '../../types/bombeiro';
import {
  calcularQuartaTomada,
  criarParticipantesTPEPRVazios,
  mascararTempoTPEPR,
  normalizarParticipantesTPEPR,
  ordenarParticipantesTPEPR,
  TPEPR_EQUIPES,
  TPEPR_PARTICIPANTE_SLOTS,
} from '../../types/tpepr';
import type { TPEPRInput, TPEPRParticipante, TreinamentoTPEPR } from '../../types/tpepr';
import { TEMPO_CRONOMETRO_ZERO } from '../../utils/tempo';

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function fmtData(data: string) {
  if (!data) return '-';
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
}

function turnoAuto(equipe: string) {
  return equipe === 'Alfa' || equipe === 'Charlie' ? 'Diurno' : equipe === 'Bravo' || equipe === 'Delta' ? 'Noturno' : '';
}

function mensagemErro(err: unknown) {
  return err instanceof Error ? err.message : 'Erro inesperado';
}

function participantePreenchido(p: TPEPRParticipante) {
  return !!(p.pessoaId || p.nomeCompleto || p.nomeGuerra);
}

function moverCursorParaFim(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => {
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function TempoInput({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</span>
      <input
        type="text"
        value={value || TEMPO_CRONOMETRO_ZERO}
        onChange={event => onChange?.(mascararTempoTPEPR(event.target.value))}
        onFocus={moverCursorParaFim}
        onClick={moverCursorParaFim}
        readOnly={readOnly}
        inputMode="numeric"
        placeholder="MM:SS"
        className={`${inputCls} text-center font-semibold ${readOnly ? 'bg-graphite-50 text-graphite-500 dark:bg-surface-hover' : ''}`}
      />
    </label>
  );
}

export function TPEPR() {
  const { user, contexto, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const isAdminSistema = contexto.isAdministradorSistema;
  const currentUsername = user?.username || user?.name || '';
  const currentName = user?.name || user?.username || '';

  const [registros, setRegistros] = useState<TreinamentoTPEPR[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [opcoesParticipantes, setOpcoesParticipantes] = useState<Bombeiro[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTPEPR | null>(null);
  const [savingAction, setSavingAction] = useState<'draft' | 'approve' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const [fEquipe, setFEquipe] = useState('');
  const [fNumero, setFNumero] = useState(0);
  const [fAno, setFAno] = useState('');
  const [fData, setFData] = useState('');
  const [fHora, setFHora] = useState('');
  const [fTurno, setFTurno] = useState('');
  const [fObs, setFObs] = useState('');
  const [fChefeEquipe, setFChefeEquipe] = useState('');
  const [fParticipantes, setFParticipantes] = useState<TPEPRParticipante[]>(criarParticipantesTPEPRVazios());
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const saving = savingAction !== null;

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...TPEPR_EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => {
    if (isRelatorioRoute && loadingContexto) return;
    if (isRelatorioRoute && !canVisualizarRelatorios) return;

    let active = true;
    async function carregarDados() {
      try {
        setErro('');
        const [ativos, lista] = await Promise.all([
          listarAtivos(),
          listarTPEPRs({ ano: filtroAno }),
        ]);
        if (!active) return;
        setBombeiros(ativos);
        setRegistros(lista);
      } catch (err) {
        if (active) setErro(mensagemErro(err));
      }
    }

    carregarDados();
    return () => { active = false; };
  }, [isRelatorioRoute, canVisualizarRelatorios, loadingContexto, filtroAno]);

  async function carregar() {
    try {
      setErro('');
      setRegistros(await listarTPEPRs({ ano: filtroAno }));
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  async function montarPoolParticipantes(equipe: string, data: string): Promise<Bombeiro[]> {
    if (!equipe || !data) return bombeiros.filter(b => b.equipe === equipe && !b.dataDesligamento);

    const efetivo = await resolverEfetivoOperacional(equipe, data);
    const linhas = efetivo
      .map(item => ({
        ...item.bombeiro,
        cargo: item.cargoExercido as Cargo,
      }));

    return ordenarParticipantesTPEPR(linhas);
  }

  function nomeChefePorEquipe(pool: Bombeiro[]) {
    const chefe = pool.find(b => b.cargo === 'BA-CE');
    return chefe?.nomeCompleto || chefe?.nomeGuerra || '';
  }

  function gerarParticipantesPorPool(pool: Bombeiro[]) {
    const usados = new Set<string>();
    const buscar = (cargo: string) => {
      const encontrado = pool.find(b => b.cargo === cargo && !usados.has(b.id));
      if (encontrado) usados.add(encontrado.id);
      return encontrado;
    };
    const buscarQualquer = () => {
      const encontrado = pool.find(b => !usados.has(b.id) && ['BA-CE', 'BA-LR', 'BA-MC', 'BA-2'].includes(b.cargo));
      if (encontrado) usados.add(encontrado.id);
      return encontrado;
    };

    return TPEPR_PARTICIPANTE_SLOTS.map(slot => {
      const bombeiro = buscar(slot.cargo) || buscarQualquer();
      if (!bombeiro) {
        return {
          pessoaId: '',
          nomeCompleto: '',
          nomeGuerra: '',
          funcao: slot.cargo,
          primeiraTomada: TEMPO_CRONOMETRO_ZERO,
          segundaTomada: TEMPO_CRONOMETRO_ZERO,
          terceiraTomada: TEMPO_CRONOMETRO_ZERO,
          quartaTomada: TEMPO_CRONOMETRO_ZERO,
        };
      }
      return {
        pessoaId: bombeiro.id,
        nomeCompleto: bombeiro.nomeCompleto,
        nomeGuerra: bombeiro.nomeGuerra,
        funcao: slot.cargo,
        primeiraTomada: TEMPO_CRONOMETRO_ZERO,
        segundaTomada: TEMPO_CRONOMETRO_ZERO,
        terceiraTomada: TEMPO_CRONOMETRO_ZERO,
        quartaTomada: TEMPO_CRONOMETRO_ZERO,
      };
    });
  }

  useEffect(() => {
    if (!formOpen || !fEquipe || !fData) return;

    let active = true;
    async function carregarPool() {
      try {
        const pool = await montarPoolParticipantes(fEquipe, fData);
        if (!active) return;
        setOpcoesParticipantes(pool);
        const devePreencher = !editando || fEquipe !== editando.equipe || fData !== editando.data;
        if (devePreencher) {
          setFChefeEquipe(nomeChefePorEquipe(pool));
          setFParticipantes(gerarParticipantesPorPool(pool));
        }
      } catch (err) {
        if (active) setErro(mensagemErro(err));
      }
    }

    carregarPool();
    return () => { active = false; };
  }, [formOpen, fEquipe, fData, editando]);

  const filtered = useMemo(() => {
    let lista = registros;
    if (filtroEquipe) lista = lista.filter(r => r.equipe === filtroEquipe);
    if (search) {
      const termo = search.toLowerCase();
      lista = lista.filter(r => {
        const numero = `${String(r.numero).padStart(3, '0')}/${r.ano}`;
        const participantes = r.participantes.map(p => `${p.funcao} ${p.nomeCompleto} ${p.nomeGuerra}`).join(' ');
        return `${numero} ${r.equipe} ${r.chefeEquipe} ${participantes}`.toLowerCase().includes(termo);
      });
    }
    return lista;
  }, [registros, filtroEquipe, search]);

  const stats = useMemo(() => ({
    total: registros.length,
    participantes: registros.reduce((acc, item) => acc + item.participantes.filter(participantePreenchido).length, 0),
  }), [registros]);

  function registroAprovado(registro?: Pick<TreinamentoTPEPR, 'status'> | null) {
    return registro?.status === 'Aprovado';
  }

  function canAlterarRegistro(registro: TreinamentoTPEPR) {
    return registroAprovado(registro) ? isAdminSistema : canManageEquipe(registro.equipe);
  }

  function mensagemBloqueioRegistro(registro: TreinamentoTPEPR) {
    return registroAprovado(registro)
      ? 'Este TP/EPR ja foi aprovado. Somente administradores e desenvolvedores podem alterar.'
      : 'Voce so pode alterar TP/EPR da sua equipe efetiva.';
  }

  function resetForm() {
    const equipePadrao = canManageGlobal ? '' : equipeEfetiva || '';
    setEditando(null);
    setFEquipe(equipePadrao);
    setFNumero(0);
    setFAno('');
    setFData('');
    setFHora('');
    setFTurno(turnoAuto(equipePadrao));
    setFObs('');
    setFChefeEquipe('');
    setFParticipantes(criarParticipantesTPEPRVazios());
    setOpcoesParticipantes([]);
  }

  async function handleNovo() {
    if (!canCreate) {
      alert('Voce precisa ter uma equipe efetiva para criar TP/EPR.');
      return;
    }

    resetForm();
    const hoje = new Date().toISOString().split('T')[0];
    const ano = new Date().getFullYear().toString();
    const equipePadrao = canManageGlobal ? '' : equipeEfetiva || '';
    setFAno(ano);
    setFData(hoje);
    setFHora(new Date().toTimeString().slice(0, 5));
    setFEquipe(equipePadrao);
    setFTurno(turnoAuto(equipePadrao));
    setFNumero(await obterProximoNumeroTPEPR(ano));
    setFormOpen(true);
  }

  async function preencherPelaEscala() {
    if (!fEquipe || !fData) return;
    try {
      const pool = await montarPoolParticipantes(fEquipe, fData);
      setOpcoesParticipantes(pool);
      setFChefeEquipe(nomeChefePorEquipe(pool));
      setFParticipantes(gerarParticipantesPorPool(pool));
    } catch (err) {
      alert('Erro ao preencher participantes: ' + mensagemErro(err));
    }
  }

  async function handleEditar(registro: TreinamentoTPEPR) {
    if (!canAlterarRegistro(registro)) {
      alert(mensagemBloqueioRegistro(registro));
      return;
    }

    setEditando(registro);
    setFEquipe(registro.equipe);
    setFNumero(registro.numero);
    setFAno(registro.ano);
    setFData(registro.data);
    setFHora(registro.hora);
    setFTurno(registro.turno);
    setFObs(registro.observacoes);
    setFChefeEquipe(registro.chefeEquipe);
    setFParticipantes(normalizarParticipantesTPEPR(registro.participantes));
    setFormOpen(true);
  }

  function atualizarParticipante(index: number, campo: keyof TPEPRParticipante, valor: string) {
    setFParticipantes(prev => {
      const lista = normalizarParticipantesTPEPR(prev);
      const atual = { ...lista[index], [campo]: valor };
      if (campo === 'segundaTomada' || campo === 'terceiraTomada') {
        atual.quartaTomada = calcularQuartaTomada(atual.segundaTomada, atual.terceiraTomada);
      }
      lista[index] = atual;
      return lista;
    });
  }

  function selecionarPessoa(index: number, nomeGuerra: string) {
    const slot = TPEPR_PARTICIPANTE_SLOTS[index];
    const pessoa = opcoesParticipantes.find(b => b.nomeGuerra === nomeGuerra) || bombeiros.find(b => b.nomeGuerra === nomeGuerra);
    if (!pessoa || !slot) return;

    setFParticipantes(prev => {
      const lista = normalizarParticipantesTPEPR(prev);
      lista[index] = {
        ...lista[index],
        pessoaId: pessoa.id,
        nomeCompleto: pessoa.nomeCompleto,
        nomeGuerra: pessoa.nomeGuerra,
        funcao: slot.cargo,
      };
      return lista;
    });
  }

  function limparParticipante(index: number) {
    const slot = TPEPR_PARTICIPANTE_SLOTS[index];
    setFParticipantes(prev => {
      const lista = normalizarParticipantesTPEPR(prev);
      lista[index] = {
        pessoaId: '',
        nomeCompleto: '',
        nomeGuerra: '',
        funcao: slot?.cargo || '',
        primeiraTomada: TEMPO_CRONOMETRO_ZERO,
        segundaTomada: TEMPO_CRONOMETRO_ZERO,
        terceiraTomada: TEMPO_CRONOMETRO_ZERO,
        quartaTomada: TEMPO_CRONOMETRO_ZERO,
      };
      return lista;
    });
  }

  async function handleSalvar(aprovar = false) {
    const equipeAlvo = canManageGlobal ? fEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !fData) return;
    if (editando && !canAlterarRegistro(editando)) {
      alert(mensagemBloqueioRegistro(editando));
      return;
    }
    if (!canManageEquipe(equipeAlvo)) {
      alert('Voce so pode salvar TP/EPR da sua equipe efetiva.');
      return;
    }

    setSavingAction(aprovar ? 'approve' : 'draft');
    try {
      const ano = fAno || fData.slice(0, 4);
      const participantes = normalizarParticipantesTPEPR(fParticipantes).map((participante, index) => {
        const slot = TPEPR_PARTICIPANTE_SLOTS[index];
        return {
          ...participante,
          funcao: slot?.cargo || participante.funcao,
          quartaTomada: calcularQuartaTomada(participante.segundaTomada, participante.terceiraTomada),
        };
      });

      const payload: TPEPRInput = {
        createdBy: editando?.createdBy || currentUsername,
        equipe: equipeAlvo,
        numero: fNumero || await obterProximoNumeroTPEPR(ano),
        ano,
        data: fData,
        hora: fHora,
        turno: turnoAuto(equipeAlvo),
        observacoes: fObs,
        chefeEquipe: fChefeEquipe,
        participantes,
      };
      if (aprovar) {
        payload.status = 'Aprovado';
        payload.aprovadoPor = currentUsername;
        payload.aprovadoPorNome = currentName;
        payload.aprovadoEm = new Date().toISOString();
      }

      if (editando) await atualizarTPEPR(editando.id, payload);
      else await criarTPEPR(payload);

      if (filtroAno !== ano) setFiltroAno(ano);
      setRegistros(await listarTPEPRs({ ano }));
      setFormOpen(false);
    } catch (err) {
      alert('Erro ao salvar TP/EPR: ' + mensagemErro(err));
    } finally {
      setSavingAction(null);
    }
  }

  async function handleExcluir(id: string) {
    const registro = registros.find(r => r.id === id);
    if (registro && !canAlterarRegistro(registro)) {
      alert(mensagemBloqueioRegistro(registro));
      setDeleteConfirm(null);
      return;
    }

    try {
      await excluirTPEPR(id);
      await carregar();
    } catch (err) {
      alert('Erro ao excluir TP/EPR: ' + mensagemErro(err));
    } finally {
      setDeleteConfirm(null);
    }
  }

  async function handleDownload(registro: TreinamentoTPEPR) {
    try {
      setDownloadingId(registro.id);
      await baixarTPEPRPdf(registro);
    } catch (err) {
      alert('Erro ao gerar PDF: ' + mensagemErro(err));
    } finally {
      setDownloadingId(null);
    }
  }

  function renderParticipanteLinha(index: number) {
    const slot = TPEPR_PARTICIPANTE_SLOTS[index];
    const participante = fParticipantes[index] || criarParticipantesTPEPRVazios()[index];
    const selectedIds = new Set(
      fParticipantes
        .filter((p, i) => p.pessoaId && i !== index)
        .map(p => p.pessoaId),
    );

    return (
      <div key={slot.i} className="rounded-xl border border-graphite-200/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-card/80">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aviation-50 text-xs font-black text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">{index + 1}</span>
          <span className="rounded-lg border border-graphite-200 bg-graphite-50 px-2 py-1 text-xs font-bold text-graphite-700 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-200">{slot.label}</span>
          {participante.nomeCompleto && (
            <span className="min-w-0 truncate text-xs text-graphite-500 dark:text-graphite-400">{participante.nomeCompleto}</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(88px,0.5fr))_auto]">
          <div className="min-w-0">
            <label className={labelCls}>Bombeiro</label>
            <SearchSelect
              value={participante.nomeGuerra}
              onChange={valor => selecionarPessoa(index, valor)}
              cargo={slot.cargo}
              options={opcoesParticipantes}
              valueField="nomeGuerra"
              showCargo
              showEquipe
              displayMode="operational"
              disabledIds={selectedIds}
              placeholder="Selecione o bombeiro"
            />
          </div>
          <TempoInput label="1a tomada" value={participante.primeiraTomada} onChange={valor => atualizarParticipante(index, 'primeiraTomada', valor)} />
          <TempoInput label="2a tomada" value={participante.segundaTomada} onChange={valor => atualizarParticipante(index, 'segundaTomada', valor)} />
          <TempoInput label="3a tomada" value={participante.terceiraTomada} onChange={valor => atualizarParticipante(index, 'terceiraTomada', valor)} />
          <TempoInput label="4a tomada" value={participante.quartaTomada} readOnly />
          <button
            type="button"
            onClick={() => limparParticipante(index)}
            className="mt-6 self-start rounded-xl p-2 text-red-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            title="Limpar participante"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isRelatorioRoute && loadingContexto) {
    return <PageContainer><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /></div></PageContainer>;
  }

  if (isRelatorioRoute && !canVisualizarRelatorios) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">A tela de relatorios esta disponivel apenas para GS e administradores do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={ClipboardList} title="TP/EPR" subtitle="Afericao de tempos por equipe e funcao operacional" />

      <div className="space-y-6">
        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {erro}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-2 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
              <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.total}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-aviation-500">TP/EPR {filtroAno}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{stats.participantes}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Participantes</p>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Novo TP/EPR
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className={`${inputCls} !pl-10`} />
          </div>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todas</option>
            {TPEPR_EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(ano => <option key={ano} value={ano.toString()}>{ano}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card/50">
            <ClipboardList className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum TP/EPR registrado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Crie um cadastro para registrar as tomadas por funcao.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(registro => {
              const participantes = ordenarParticipantesTPEPR(registro.participantes.filter(participantePreenchido));
              const expandido = expandidoId === registro.id;
              const aprovado = registroAprovado(registro);
              const podeAlterar = canAlterarRegistro(registro);
              return (
                <div key={registro.id} className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandido ? null : registro.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                        {registro.equipe.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">
                            {String(registro.numero).padStart(3, '0')}/{registro.ano} - {registro.equipe} - TP/EPR
                          </p>
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${aprovado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {aprovado ? 'Aprovado' : 'Rascunho'}
                          </span>
                        </div>
                        <p className="truncate text-xs text-graphite-500 dark:text-graphite-400">
                          {fmtData(registro.data)} {registro.hora && `as ${registro.hora}`} - {registro.turno || '-'} - Chefe: {registro.chefeEquipe || '-'}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleDownload(registro)}
                        disabled={downloadingId === registro.id}
                        className="flex items-center gap-1 rounded-xl border border-aviation-300 bg-white px-3 py-1.5 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                        title="Baixar PDF"
                      >
                        <Download className="h-4 w-4" /> {downloadingId === registro.id ? 'Gerando' : 'PDF'}
                      </button>
                      {podeAlterar && (
                        <>
                        <button onClick={() => handleEditar(registro)} className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(registro.id)} className="rounded-xl p-1.5 text-red-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandidoId(expandido ? null : registro.id)}
                        className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
                        title={expandido ? 'Fechar detalhes' : 'Abrir detalhes'}
                      >
                        {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {expandido && (
                    <div className="mt-4 space-y-2">
                      {participantes.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-graphite-200 bg-graphite-50 px-3 py-2 text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-400">
                          Sem participantes preenchidos.
                        </p>
                      ) : (
                        participantes.map((participante, index) => (
                          <div key={`${participante.pessoaId}-${index}`} className="grid grid-cols-1 gap-2 rounded-xl border border-graphite-200/60 bg-graphite-50/70 px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-hover/60 md:grid-cols-[70px_minmax(0,1fr)_repeat(4,76px)]">
                            <span className="font-black text-aviation-700 dark:text-aviation-300">{participante.funcao}</span>
                            <span className="truncate font-semibold text-graphite-800 dark:text-graphite-100">{participante.nomeCompleto || participante.nomeGuerra}</span>
                            <span><b>1a:</b> {participante.primeiraTomada || '-'}</span>
                            <span><b>2a:</b> {participante.segundaTomada || '-'}</span>
                            <span><b>3a:</b> {participante.terceiraTomada || '-'}</span>
                            <span><b>4a:</b> {participante.quartaTomada || '-'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-5">
          <div className="relative mx-4 w-full max-w-5xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} TP/EPR</h2>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">Participantes em ordem: BA-CE, BA-LR, BA-MC e BA-2.</p>
                {editando && (
                  <p className="mt-1 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                    Status: {registroAprovado(editando) ? 'Aprovado' : 'Rascunho'}
                  </p>
                )}
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 dark:hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={fEquipe} onChange={e => {
                    const equipe = e.target.value;
                    setFEquipe(equipe);
                    setFTurno(turnoAuto(equipe));
                    setFChefeEquipe('');
                    setFParticipantes(criarParticipantesTPEPRVazios());
                  }} disabled={!canManageGlobal} className={inputCls}>
                    <option value="">Selecione</option>
                    {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N.</label>
                  <input value={`${String(fNumero).padStart(3, '0')}/${fAno}`} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={fData} onChange={e => setFData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" value={fHora} onChange={e => setFHora(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Turno</label>
                  <input value={fTurno} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Chefe de equipe</label>
                  <input value={fChefeEquipe} onChange={e => setFChefeEquipe(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-3 text-sm text-aviation-800 dark:border-aviation-800 dark:bg-aviation-900/20 dark:text-aviation-200">
                <div className="flex items-start gap-2">
                  <Calculator className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>O tempo da 4a tomada e calculado automaticamente: (3a tomada - 2a tomada) + 20%.</p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-graphite-700 dark:text-graphite-300">
                    <Users className="h-4 w-4 text-aviation-500" /> Participantes
                  </p>
                  <button
                    type="button"
                    onClick={preencherPelaEscala}
                    disabled={!fEquipe || !fData}
                    className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                  >
                    <Clock className="h-4 w-4" /> Preencher pela equipe
                  </button>
                </div>

                <div className="space-y-2">
                  {TPEPR_PARTICIPANTE_SLOTS.map((_, index) => renderParticipanteLinha(index))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Observacao</label>
                <textarea value={fObs} onChange={e => setFObs(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button
                  onClick={() => handleSalvar(false)}
                  disabled={!fEquipe || !fData || saving}
                  className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-5 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                >
                  <Save className="h-4 w-4" /> {savingAction === 'draft' ? 'Salvando...' : registroAprovado(editando) ? 'Salvar' : 'Salvar rascunho'}
                </button>
                {!registroAprovado(editando) && (
                  <button
                    onClick={() => handleSalvar(true)}
                    disabled={!fEquipe || !fData || saving}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {savingAction === 'approve' ? 'Aprovando...' : 'Aprovar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusao</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir este TP/EPR?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluir(deleteConfirm)} className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default TPEPR;
