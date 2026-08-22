import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Save, X, Target,
  AlertTriangle, Users, Lock, Download, ChevronDown, ChevronUp,
  CheckCircle2, Eye,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { resolverEfetivoOperacional } from '../../services/efetivoOperacionalService';
import { listarTAFs, criarTAF, atualizarTAF, excluirTAF, obterProximoNumero } from '../../services/tafService';
import { baixarTAFPdf, gerarTAFPdf, nomeArquivoTAFPdf } from '../../services/tafPdfService';
import type { TAFInput, TreinamentoTAF } from '../../types/taf';
import type { Bombeiro } from '../../types/bombeiro';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { TEMPO_CRONOMETRO_ZERO, mascararTempoCronometro } from '../../utils/tempo';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const TIPO_TAF = ['TAF-1', 'TAF-2'];
const SLOTS = [
  { i: 1, label: 'BA-CE', cargo: 'BA-CE' }, { i: 2, label: 'BA-LR', cargo: 'BA-LR' },
  { i: 3, label: 'BA-MC', cargo: 'BA-MC' }, { i: 4, label: 'BA-MC', cargo: 'BA-MC' }, { i: 5, label: 'BA-MC', cargo: 'BA-MC' },
  { i: 6, label: 'BA-2', cargo: 'BA-2' }, { i: 7, label: 'BA-2', cargo: 'BA-2' }, { i: 8, label: 'BA-2', cargo: 'BA-2' },
  { i: 9, label: 'BA-2', cargo: 'BA-2' }, { i: 10, label: 'BA-2', cargo: 'BA-2' },
] as const;

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function fmt(d: string) { return formatarDataBR(d); }

function mensagemErro(err: unknown) {
  return err instanceof Error ? err.message : 'Erro inesperado';
}

function encontrarBombeiroPorNome(bombeiros: Bombeiro[], nome: string) {
  const normalizado = nome.trim().toLocaleLowerCase('pt-BR');
  return bombeiros.find(b =>
    b.nomeCompleto.toLocaleLowerCase('pt-BR') === normalizado ||
    b.nomeGuerra.toLocaleLowerCase('pt-BR') === normalizado
  );
}

type TafPessoaForm = { pessoaId: string; nome: string; nomeGuerra: string; funcao: string; idade: number; tempo: string };
type TafSlot = typeof SLOTS[number];

function criarPessoasTAFVazias(): TafPessoaForm[] {
  return Array.from({ length: 10 }, () => ({ pessoaId: '', nome: '', nomeGuerra: '', funcao: '', idade: 0, tempo: TEMPO_CRONOMETRO_ZERO }));
}

function pessoasDoRegistro(registro: TreinamentoTAF, bombeiros: Bombeiro[]): TafPessoaForm[] {
  return Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    const data = registro as unknown as Record<string, string | number>;
    const nome = String(data[`p${slot}Nome`] || '');
    const bombeiro = encontrarBombeiroPorNome(bombeiros, nome);
    return {
      pessoaId: bombeiro?.id || '',
      nome: bombeiro?.nomeCompleto || nome,
      nomeGuerra: bombeiro?.nomeGuerra || nome,
      funcao: String(data[`p${slot}Funcao`] || ''),
      idade: Number(data[`p${slot}Idade`] || bombeiro?.idade || 0),
      tempo: String(data[`p${slot}Tempo`] || ''),
    };
  });
}

function pessoaPreenchida(pessoa: TafPessoaForm) {
  return !!(pessoa.pessoaId || pessoa.nome || pessoa.nomeGuerra);
}

function moverCursorParaFim(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => {
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function SlotLinha({
  idx,
  slot,
  pessoa,
  selectedIds,
  options,
  onSelectPessoa,
  onTempoChange,
  onClearPessoa,
}: {
  idx: number;
  slot: TafSlot;
  pessoa: TafPessoaForm;
  selectedIds: Set<string>;
  options: AtivoItem[];
  onSelectPessoa: (idx: number, nomeSelecionado: string, funcao: string) => void;
  onTempoChange: (idx: number, tempo: string) => void;
  onClearPessoa: (idx: number) => void;
}) {
  return (
    <div className="rounded-xl border border-graphite-200/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-card/80">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aviation-50 text-xs font-black text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">{idx + 1}</span>
        <span className="rounded-lg border border-graphite-200 bg-graphite-50 px-2 py-1 text-xs font-bold text-graphite-700 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-200">{slot.label}</span>
        {pessoa.nome && (
          <span className="min-w-0 truncate text-xs text-graphite-500 dark:text-graphite-400">{pessoa.nome}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(72px,0.35fr)_minmax(96px,0.45fr)_auto]">
        <div className="min-w-0">
          <label className={labelCls}>Bombeiro</label>
          <SearchSelect
            value={pessoa.nomeGuerra || pessoa.nome}
            onChange={v => onSelectPessoa(idx, v, slot.cargo)}
            cargo={slot.cargo}
            options={options}
            valueField="nomeGuerra"
            showCargo
            showEquipe
            displayMode="operational"
            disabledIds={selectedIds}
            placeholder="Selecione o bombeiro"
          />
        </div>
        <div>
          <label className={labelCls}>Idade</label>
          <input value={pessoa.idade || ''} disabled className={`${inputCls} opacity-60`} />
        </div>
        <div>
          <label className={labelCls}>Tempo</label>
          <input
            type="text"
            value={pessoa.tempo || TEMPO_CRONOMETRO_ZERO}
            onChange={e => onTempoChange(idx, mascararTempoCronometro(e.target.value))}
            onFocus={moverCursorParaFim}
            onClick={moverCursorParaFim}
            inputMode="numeric"
            placeholder="MM:SS"
            className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-center text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
          />
        </div>
        <button
          type="button"
          onClick={() => onClearPessoa(idx)}
          className="mt-6 self-start rounded-xl p-2 text-red-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          title="Limpar participante"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TAF() {
  const { user, contexto, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const isAdminSistema = contexto.isAdministradorSistema;
  const currentUsername = user?.username || user?.name || '';
  const currentName = user?.name || user?.username || '';
  const [registros, setRegistros] = useState<TreinamentoTAF[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTAF | null>(null);
  const [savingAction, setSavingAction] = useState<'draft' | 'approve' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [opcoesParticipantes, setOpcoesParticipantes] = useState<AtivoItem[]>([]);

  const [fEquipe, setFEquipe] = useState('');
  const [fNumero, setFNumero] = useState(0);
  const [fAno, setFAno] = useState('');
  const [fData, setFData] = useState('');
  const [fHora, setFHora] = useState('');
  const [fTurno, setFTurno] = useState('');
  const [fTipo, setFTipo] = useState('');

  const [fPessoas, setFPessoas] = useState<TafPessoaForm[]>(
    criarPessoasTAFVazias()
  );
  const [fObs, setFObs] = useState('');
  const [fChefeEquipe, setFChefeEquipe] = useState('');
  const saving = savingAction !== null;

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => {
    if (isRelatorioRoute && loadingContexto) return;
    if (isRelatorioRoute && !canVisualizarRelatorios) return;
    listarAtivos().then(setBombeiros);
    carregar();
  }, [isRelatorioRoute, canVisualizarRelatorios, loadingContexto]);

  useEffect(() => { carregar(); }, [filtroAno]);

  async function carregar() { setRegistros(await listarTAFs({ ano: filtroAno })); }

  const filtered = useMemo(() => {
    let l = registros;
    if (filtroEquipe) l = l.filter(r => r.equipe === filtroEquipe);
    if (search) { const s = search.toLowerCase(); l = l.filter(r => `${String(r.numero).padStart(3,'0')}/${r.ano}`.includes(s) || r.equipe.toLowerCase().includes(s) || r.tipoTaf.toLowerCase().includes(s)); }
    return l;
  }, [registros, search, filtroEquipe]);

  const stats = useMemo(() => ({ total: registros.length }), [registros]);

  function registroAprovado(registro?: Pick<TreinamentoTAF, 'status'> | null) {
    return registro?.status === 'Aprovado';
  }

  function canAlterarRegistro(registro: TreinamentoTAF) {
    return registroAprovado(registro) ? isAdminSistema : canManageEquipe(registro.equipe);
  }

  function mensagemBloqueioRegistro(registro: TreinamentoTAF) {
    return registroAprovado(registro)
      ? 'Este TAF ja foi aprovado. Somente administradores e desenvolvedores podem alterar.'
      : 'Voce so pode alterar treinamentos da sua equipe efetiva.';
  }

  function canGerarPdf(registro: TreinamentoTAF) {
    return registroAprovado(registro);
  }

  function setP(idx: number, field: keyof TafPessoaForm, val: any) {
    setFPessoas(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
  }

  function onSelectPessoa(idx: number, nomeSelecionado: string, funcao: string) {
    const opcao = opcoesParticipantes.find(item => item.nomeGuerra === nomeSelecionado || item.nomeCompleto === nomeSelecionado);
    const b = (opcao ? bombeiros.find(item => item.id === opcao.id) : undefined) || encontrarBombeiroPorNome(bombeiros, nomeSelecionado);
    setP(idx, 'pessoaId', b?.id || opcao?.id || '');
    setP(idx, 'nome', b?.nomeCompleto || opcao?.nomeCompleto || nomeSelecionado);
    setP(idx, 'nomeGuerra', b?.nomeGuerra || opcao?.nomeGuerra || nomeSelecionado);
    setP(idx, 'funcao', funcao);
    setP(idx, 'idade', b?.idade || 0);
  }

  function limparPessoa(idx: number) {
    setFPessoas(prev => {
      const next = [...prev];
      next[idx] = { pessoaId: '', nome: '', nomeGuerra: '', funcao: '', idade: 0, tempo: TEMPO_CRONOMETRO_ZERO };
      return next;
    });
  }

  function resetForm() {
    const equipePadrao = canManageGlobal ? '' : equipeEfetiva || '';
    setFEquipe(equipePadrao); setFNumero(0); setFAno(''); setFData(''); setFHora(''); setFTurno(turnoAuto(equipePadrao)); setFTipo('');
    setFPessoas(criarPessoasTAFVazias());
    setOpcoesParticipantes([]);
    setFObs('');
    setFChefeEquipe('');
  }

  function turnoAuto(equipe: string) { return equipe === 'Alfa' || equipe === 'Charlie' ? 'Diurno' : equipe === 'Bravo' || equipe === 'Delta' ? 'Noturno' : ''; }

  async function autoPreencherParticipantes(preencherMembros = true) {
    if (!fEquipe || !fData) return;
    try {
      const efetivo = await resolverEfetivoOperacional(fEquipe, fData);
      const pool = efetivo
        .map(item => ({
          id: item.bombeiro.id,
          nomeCompleto: item.bombeiro.nomeCompleto || item.bombeiro.nome || item.bombeiro.nomeGuerra,
          nomeGuerra: item.bombeiro.nomeGuerra,
          idade: item.bombeiro.idade,
          cargo: item.cargoExercido,
        }));

      setOpcoesParticipantes(pool.map(b => ({
        id: b.id,
        nomeGuerra: b.nomeGuerra,
        nomeCompleto: b.nomeCompleto,
        cargo: b.cargo,
        equipe: fEquipe,
      })));
      const baCe = pool.find(b => b.cargo === 'BA-CE');
      if (preencherMembros) setFChefeEquipe(baCe ? baCe.nomeCompleto || baCe.nomeGuerra || '' : '');
      if (!preencherMembros) return;

      const usado = new Set<string>();
      const buscar = (cargo: string) => {
        const idx = pool.findIndex(b => b.cargo === cargo && !usado.has(b.id));
        if (idx === -1) return null;
        usado.add(pool[idx].id);
        return pool[idx];
      };

      function setSlot(idx: number, b: typeof pool[number], cargo: string) {
        setP(idx, 'pessoaId', b?.id || '');
        setP(idx, 'nome', b?.nomeCompleto || b?.nomeGuerra || '');
        setP(idx, 'nomeGuerra', b?.nomeGuerra || '');
        setP(idx, 'funcao', cargo);
        setP(idx, 'idade', b?.idade || 0);
      }

      // 1 BA-CE
      const ce = buscar('BA-CE');
      if (ce) { setSlot(0, ce, 'BA-CE'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(0, q, 'BA-CE'); usado.add(q.id); } }

      // 2 BA-LR
      const lr = buscar('BA-LR');
      if (lr) { setSlot(1, lr, 'BA-LR'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(1, q, 'BA-LR'); usado.add(q.id); } }

      // 3 BA-MC
      for (let i = 0; i < 3; i++) {
        const mc = buscar('BA-MC');
        if (mc) { setSlot(2 + i, mc, 'BA-MC'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(2 + i, q, 'BA-MC'); usado.add(q.id); } }
      }

      // 5 BA-2
      for (let i = 0; i < 5; i++) {
        const b2 = buscar('BA-2');
        if (b2) { setSlot(5 + i, b2, 'BA-2'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(5 + i, q, 'BA-2'); usado.add(q.id); } }
      }
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (formOpen && fEquipe && fData) {
      const devePreencher = !editando || fEquipe !== editando.equipe || fData !== editando.data;
      autoPreencherParticipantes(devePreencher);
    }
  }, [fEquipe, fData, formOpen, editando]);

  async function handleNovo() {
    if (!canCreate) {
      alert('Você precisa ter uma equipe efetiva para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    const a = new Date().getFullYear().toString();
    setFAno(a); setFData(hojeLocalISO()); setFHora(new Date().toTimeString().slice(0, 5));
    setFormOpen(true);
    setFNumero(await obterProximoNumero(a));
  }

  function handleEditar(r: TreinamentoTAF) {
    if (!canAlterarRegistro(r)) {
      alert(mensagemBloqueioRegistro(r));
      return;
    }
    setEditando(r);
    setFEquipe(r.equipe); setFNumero(r.numero); setFAno(r.ano); setFData(r.data); setFHora(r.hora); setFTurno(r.turno); setFTipo(r.tipoTaf);
    setFPessoas(pessoasDoRegistro(r, bombeiros).map(pessoa => ({
      ...pessoa,
      tempo: mascararTempoCronometro(pessoa.tempo),
    })));
    setFObs(r.observacoes);
    setFChefeEquipe(r.chefeEquipe || '');
    setFormOpen(true);
  }

  async function handleSalvar(aprovar = false) {
    const equipeAlvo = canManageGlobal ? fEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !fData || !fTipo) return;
    if (editando && !canAlterarRegistro(editando)) {
      alert(mensagemBloqueioRegistro(editando));
      return;
    }
    if (!canManageEquipe(equipeAlvo)) {
      alert('Voce so pode salvar treinamentos da sua equipe efetiva.');
      return;
    }
    setSavingAction(aprovar ? 'approve' : 'draft');
    try {
      const data = { equipe: equipeAlvo, numero: fNumero, ano: fAno, data: fData, hora: fHora, turno: turnoAuto(equipeAlvo), tipoTaf: fTipo, observacoes: fObs, chefeEquipe: fChefeEquipe || user?.name || '' } as TAFInput;
      if (aprovar) {
        data.status = 'Aprovado';
        data.aprovadoPor = currentUsername;
        data.aprovadoPorNome = currentName;
        data.aprovadoEm = new Date().toISOString();
      }
      for (let i = 0; i < 10; i++) {
        (data as any)[`p${i+1}Nome`] = fPessoas[i].nome; (data as any)[`p${i+1}Funcao`] = fPessoas[i].funcao; (data as any)[`p${i+1}Idade`] = fPessoas[i].idade; (data as any)[`p${i+1}Tempo`] = mascararTempoCronometro(fPessoas[i].tempo);
      }
      if (editando) { await atualizarTAF(editando.id, data); } else { await criarTAF(data); }
      await carregar(); setFormOpen(false);
    } catch (err) { alert('Erro: ' + (err instanceof Error ? err.message : 'Erro')); } finally { setSavingAction(null); }
  }

  async function handleExcluir(id: string) {
    const registro = registros.find(r => r.id === id);
    if (registro && !canAlterarRegistro(registro)) {
      alert(mensagemBloqueioRegistro(registro));
      setDeleteConfirm(null);
      return;
    }
    await excluirTAF(id);
    await carregar();
    setDeleteConfirm(null);
  }

  async function handleDownload(registro: TreinamentoTAF) {
    if (!canGerarPdf(registro)) {
      alert('Aprove este TAF antes de gerar o PDF.');
      return;
    }

    try {
      setDownloadingId(registro.id);
      await baixarTAFPdf(prepararRegistroPdf(registro));
    } catch (err) {
      alert('Erro ao gerar PDF do TAF: ' + mensagemErro(err));
    } finally {
      setDownloadingId(null);
    }
  }

  function prepararRegistroPdf(registro: TreinamentoTAF) {
    const registroComNomesCompletos = { ...registro } as TreinamentoTAF;
    pessoasDoRegistro(registro, bombeiros).forEach((pessoa, index) => {
      (registroComNomesCompletos as any)[`p${index + 1}Nome`] = pessoa.nome;
      (registroComNomesCompletos as any)[`p${index + 1}Idade`] = pessoa.idade;
    });
    return registroComNomesCompletos;
  }

  async function handlePreviewPdf(registro: TreinamentoTAF) {
    if (!canGerarPdf(registro)) {
      alert('Aprove este TAF antes de visualizar o PDF.');
      return;
    }

    try {
      setPreviewingId(registro.id);
      const registroPdf = prepararRegistroPdf(registro);
      const pdf = await gerarTAFPdf(registroPdf);
      setPreviewPdfData(await pdf.arrayBuffer());
      setPreviewPdfTitle(nomeArquivoTAFPdf(registroPdf).replace(/\.pdf$/i, ''));
    } catch (err) {
      alert('Erro ao visualizar PDF do TAF: ' + mensagemErro(err));
    } finally {
      setPreviewingId(null);
    }
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
          <p className="text-sm text-graphite-400 dark:text-graphite-500">A tela de relatórios está disponível apenas para GS e administradores do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Target} title="TAF - Teste de Aptidão Física" />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-2 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
              <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.total}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-aviation-500">{filtroAno}</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Novo TAF
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
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a.toString()}>{a}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card/50">
            <Target className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum TAF registado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo TAF" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const participantes = pessoasDoRegistro(r, bombeiros).filter(pessoaPreenchida);
              const expandido = expandidoId === r.id;
              const aprovado = registroAprovado(r);
              const podeAlterar = canAlterarRegistro(r);
              const podeGerarPdf = canGerarPdf(r);
              return (
                <div key={r.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandido ? null : r.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">{r.equipe.charAt(0)}</div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">{String(r.numero).padStart(3,'0')}/{r.ano} · {r.equipe} · {r.tipoTaf}</p>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${aprovado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                        {aprovado ? 'Aprovado' : 'Rascunho'}
                      </span>
                    </div>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{fmt(r.data)} {r.hora && `às ${r.hora}`} · {r.turno}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {podeGerarPdf && (
                    <>
                      <button
                        onClick={() => void handlePreviewPdf(r)}
                        disabled={previewingId === r.id}
                        className="flex items-center gap-1 rounded-xl border border-aviation-300 bg-white px-3 py-1.5 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                        title="Ver documento"
                      >
                        <Eye className="h-4 w-4" /> {previewingId === r.id ? 'Gerando' : 'Ver documento'}
                      </button>
                      <button
                        onClick={() => handleDownload(r)}
                        disabled={downloadingId === r.id}
                        className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                        title="Baixar PDF"
                      >
                        <Download className="h-4 w-4" /> {downloadingId === r.id ? 'Gerando' : 'PDF'}
                      </button>
                    </>
                  )}
                  {podeAlterar && (
                    <>
                    <button onClick={() => handleEditar(r)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => setDeleteConfirm(r.id)} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandidoId(expandido ? null : r.id)}
                    className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
                    title={expandido ? 'Fechar detalhes' : 'Abrir detalhes'}
                  >
                    {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {expandido && (
                <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-card">
                  {participantes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-graphite-200 bg-graphite-50 px-3 py-2 text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-400">
                      Sem participantes preenchidos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participantes.map((pessoa, index) => (
                        <div key={`${r.id}-${index}`} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-graphite-200/60 bg-graphite-50/70 px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-hover/70 md:grid-cols-[36px_90px_minmax(0,1fr)_70px_80px]">
                          <span className="font-black text-aviation-700 dark:text-aviation-300">{index + 1}</span>
                          <span className="font-bold text-graphite-700 dark:text-graphite-200">{pessoa.funcao || '-'}</span>
                          <span className="min-w-0 truncate font-semibold text-graphite-900 dark:text-graphite-100">{pessoa.nome || '-'}</span>
                          <span className="text-graphite-500 dark:text-graphite-400">Idade: {pessoa.idade || '-'}</span>
                          <span className="font-semibold text-aviation-700 dark:text-aviation-300">{pessoa.tempo || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-5">
          <div className="relative mx-4 w-full max-w-5xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} TAF</h2>
                {editando && (
                  <p className="mt-1 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                    Status: {registroAprovado(editando) ? 'Aprovado' : 'Rascunho'}
                  </p>
                )}
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={fEquipe} onChange={e => { setFEquipe(e.target.value); setFTurno(turnoAuto(e.target.value)); }} disabled={!canManageGlobal} className={inputCls}>
                    <option value="">Selecione</option>
                    {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nº</label>
                  <input value={`${String(fNumero).padStart(3,'0')}/${fAno}`} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inputCls}>
                    <option value="">Selecione</option>
                    {TIPO_TAF.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
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
              </div>

              {/* Participantes */}
              <div>
                <p className="text-sm font-bold text-graphite-700 dark:text-graphite-300 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-aviation-500" /> Participantes
                </p>
                <div className="space-y-3">
                  <div className="hidden">
                    <span className="w-6 text-center">#</span>
                    <span className="flex-1">Nome Completo</span>
                    <span className="w-14 text-center">Função</span>
                    <span className="w-10 text-center">Idade</span>
                    <span className="w-20 text-center">Tempo</span>
                  </div>
                  {SLOTS.map(slot => {
                    const idx = slot.i - 1;
                    const selectedIds = new Set(fPessoas
                      .filter((pp, ii) => pp.pessoaId && ii !== idx)
                      .map(pp => pp.pessoaId)
                      .filter(Boolean));

                    return (
                      <SlotLinha
                        key={slot.i}
                        idx={idx}
                        slot={slot}
                        pessoa={fPessoas[idx]}
                        selectedIds={selectedIds}
                        options={opcoesParticipantes}
                        onSelectPessoa={onSelectPessoa}
                        onTempoChange={(slotIdx, tempo) => setP(slotIdx, 'tempo', tempo)}
                        onClearPessoa={limparPessoa}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={fObs} onChange={e => setFObs(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/80">
                <label className={labelCls}>Chefe de Equipe</label>
                <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{fChefeEquipe || user?.name || '-'}</p>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={() => handleSalvar(false)} disabled={!fEquipe || !fData || !fTipo || saving}
                  className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-5 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                  <Save className="h-4 w-4" /> {savingAction === 'draft' ? 'Salvando...' : registroAprovado(editando) ? 'Salvar' : 'Salvar rascunho'}
                </button>
                {!registroAprovado(editando) && (
                  <button onClick={() => handleSalvar(true)} disabled={!fEquipe || !fData || !fTipo || saving}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> {savingAction === 'approve' ? 'Aprovando...' : 'Aprovar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewPdfData && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{previewPdfTitle || 'TAF'}</h3>
              <p className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Visualização do documento</p>
            </div>
            <button
              type="button"
              onClick={() => { setPreviewPdfData(null); setPreviewPdfTitle(''); }}
              className="rounded-xl p-2 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-graphite-100 p-4 dark:bg-graphite-950">
            <PdfPreview pdfData={previewPdfData} fields={[]} />
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"><AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza?</p>
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

export default TAF;
