import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Save, X, Target,
  AlertTriangle, Users, Lock, Download,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { resolverEfetivo } from '../../services/vigenciaSubstituicaoService';
import { listarTAFs, criarTAF, atualizarTAF, excluirTAF, obterProximoNumero } from '../../services/tafService';
import { baixarTAFPdf } from '../../services/tafPdfService';
import type { TreinamentoTAF } from '../../types/taf';
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

function fmt(d: string) { if (!d) return '-'; return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); }

function mensagemErro(err: unknown) {
  return err instanceof Error ? err.message : 'Erro inesperado';
}

type TafPessoaForm = { nome: string; funcao: string; idade: number; tempo: string };
type TafSlot = typeof SLOTS[number];

function criarPessoasTAFVazias(): TafPessoaForm[] {
  return Array.from({ length: 10 }, () => ({ nome: '', funcao: '', idade: 0, tempo: TEMPO_CRONOMETRO_ZERO }));
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
  onSelectPessoa,
  onTempoChange,
}: {
  idx: number;
  slot: TafSlot;
  pessoa: TafPessoaForm;
  selectedIds: Set<string>;
  onSelectPessoa: (idx: number, nomeGuerra: string, funcao: string) => void;
  onTempoChange: (idx: number, tempo: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-graphite-200/60 bg-white/70 px-3 py-2 dark:border-border-dark dark:bg-surface-card/70">
      <span className="w-6 text-center text-xs font-bold text-graphite-400">{idx + 1}</span>
      <div className="flex-1">
        <SearchSelect
          value={pessoa.nome}
          onChange={v => onSelectPessoa(idx, v, slot.cargo)}
          cargo={slot.cargo}
          disabledIds={selectedIds}
          placeholder="Selecione..."
        />
      </div>
      <span className="w-14 text-center text-xs font-medium text-graphite-500">{slot.label}</span>
      <span className="w-10 text-center text-xs text-graphite-400">{pessoa.idade || '-'}</span>
      <input
        type="text"
        value={pessoa.tempo || TEMPO_CRONOMETRO_ZERO}
        onChange={e => onTempoChange(idx, mascararTempoCronometro(e.target.value))}
        onFocus={moverCursorParaFim}
        onClick={moverCursorParaFim}
        inputMode="numeric"
        placeholder="MM:SS"
        className="w-20 rounded-lg border border-graphite-300 bg-white px-2 py-1 text-center text-xs dark:border-border-dark dark:bg-surface-card"
      />
    </div>
  );
}

export function TAF() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const [registros, setRegistros] = useState<TreinamentoTAF[]>([]);
  const [bombeiros, setBombeiros] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTAF | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  function setP(idx: number, field: 'nome' | 'funcao' | 'idade' | 'tempo', val: any) {
    setFPessoas(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
  }

  function onSelectPessoa(idx: number, nomeGuerra: string, funcao: string) {
    const b = bombeiros.find((bb: any) => bb.nomeGuerra === nomeGuerra);
    setP(idx, 'nome', nomeGuerra);
    setP(idx, 'funcao', funcao);
    setP(idx, 'idade', b?.idade || 0);
  }

  function resetForm() {
    const equipePadrao = canManageGlobal ? '' : equipeEfetiva || '';
    setFEquipe(equipePadrao); setFNumero(0); setFAno(''); setFData(''); setFHora(''); setFTurno(turnoAuto(equipePadrao)); setFTipo('');
    setFPessoas(criarPessoasTAFVazias());
    setFObs('');
    setFChefeEquipe('');
  }

  function turnoAuto(equipe: string) { return equipe === 'Alfa' || equipe === 'Charlie' ? 'Diurno' : equipe === 'Bravo' || equipe === 'Delta' ? 'Noturno' : ''; }

  async function autoPreencherParticipantes() {
    if (!fEquipe || !fData) return;
    try {
      const { efetivos, substitutosExternos } = await resolverEfetivo(fEquipe, fData);
      const pool: any[] = [...efetivos, ...substitutosExternos]
        .filter(item => !item.emFerias)
        .map(item => ({ id: item.bombeiro.id, nomeGuerra: item.bombeiro.nomeGuerra, idade: item.bombeiro.idade, cargo: item.cargoExercido }));

      const baCe = pool.find((b: any) => b.cargo === 'BA-CE');
      if (baCe) setFChefeEquipe(baCe.nomeGuerra || '');

      const usado = new Set<string>();
      const buscar = (cargo: string) => {
        const idx = pool.findIndex((b: any) => b.cargo === cargo && !usado.has(b.id));
        if (idx === -1) return null;
        usado.add(pool[idx].id);
        return pool[idx];
      };

      function setSlot(idx: number, b: any, cargo: string) {
        setP(idx, 'nome', b?.nomeGuerra || '');
        setP(idx, 'funcao', cargo);
        setP(idx, 'idade', b?.idade || 0);
      }

      // 1 BA-CE
      const ce = buscar('BA-CE');
      if (ce) { setSlot(0, ce, 'BA-CE'); } else { const q = pool.find((b: any) => !usado.has(b.id)); if (q) { setSlot(0, q, 'BA-CE'); usado.add(q.id); } }

      // 2 BA-LR
      const lr = buscar('BA-LR');
      if (lr) { setSlot(1, lr, 'BA-LR'); } else { const q = pool.find((b: any) => !usado.has(b.id)); if (q) { setSlot(1, q, 'BA-LR'); usado.add(q.id); } }

      // 3 BA-MC
      for (let i = 0; i < 3; i++) {
        const mc = buscar('BA-MC');
        if (mc) { setSlot(2 + i, mc, 'BA-MC'); } else { const q = pool.find((b: any) => !usado.has(b.id)); if (q) { setSlot(2 + i, q, 'BA-MC'); usado.add(q.id); } }
      }

      // 5 BA-2
      for (let i = 0; i < 5; i++) {
        const b2 = buscar('BA-2');
        if (b2) { setSlot(5 + i, b2, 'BA-2'); } else { const q = pool.find((b: any) => !usado.has(b.id)); if (q) { setSlot(5 + i, q, 'BA-2'); usado.add(q.id); } }
      }
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (formOpen && fEquipe && fData && !editando) {
      autoPreencherParticipantes();
    }
  }, [fEquipe, fData, formOpen]);

  async function handleNovo() {
    if (!canCreate) {
      alert('Você precisa ter uma equipe efetiva para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    const a = new Date().getFullYear().toString();
    setFAno(a); setFData(new Date().toISOString().split('T')[0]); setFHora(new Date().toTimeString().slice(0, 5));
    setFormOpen(true);
    setFNumero(await obterProximoNumero(a));
  }

  function handleEditar(r: TreinamentoTAF) {
    if (!canManageEquipe(r.equipe)) {
      alert('Você só pode editar treinamentos da sua equipe efetiva.');
      return;
    }
    setEditando(r);
    setFEquipe(r.equipe); setFNumero(r.numero); setFAno(r.ano); setFData(r.data); setFHora(r.hora); setFTurno(r.turno); setFTipo(r.tipoTaf);
    setFPessoas(Array.from({ length: 10 }, (_, i) => ({ nome: (r as any)[`p${i+1}Nome`] || '', funcao: (r as any)[`p${i+1}Funcao`] || '', idade: (r as any)[`p${i+1}Idade`] || 0, tempo: mascararTempoCronometro((r as any)[`p${i+1}Tempo`] || '') })));
    setFObs(r.observacoes);
    setFChefeEquipe(r.chefeEquipe || '');
    setFormOpen(true);
  }

  async function handleSalvar() {
    const equipeAlvo = canManageGlobal ? fEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !fData || !fTipo) return;
    if (editando && !canManageEquipe(editando.equipe)) {
      alert('Você só pode editar treinamentos da sua equipe efetiva.');
      return;
    }
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar treinamentos da sua equipe efetiva.');
      return;
    }
    setSaving(true);
    try {
      const data: any = { equipe: equipeAlvo, numero: fNumero, ano: fAno, data: fData, hora: fHora, turno: turnoAuto(equipeAlvo), tipoTaf: fTipo, observacoes: fObs, chefeEquipe: fChefeEquipe || user?.name || '' };
      for (let i = 0; i < 10; i++) {
        data[`p${i+1}Nome`] = fPessoas[i].nome; data[`p${i+1}Funcao`] = fPessoas[i].funcao; data[`p${i+1}Idade`] = fPessoas[i].idade; data[`p${i+1}Tempo`] = mascararTempoCronometro(fPessoas[i].tempo);
      }
      if (editando) { await atualizarTAF(editando.id, data); } else { await criarTAF(data); }
      await carregar(); setFormOpen(false);
    } catch (err) { alert('Erro: ' + (err instanceof Error ? err.message : 'Erro')); } finally { setSaving(false); }
  }

  async function handleExcluir(id: string) {
    const registro = registros.find(r => r.id === id);
    if (registro && !canManageEquipe(registro.equipe)) {
      alert('Você só pode excluir treinamentos da sua equipe efetiva.');
      setDeleteConfirm(null);
      return;
    }
    await excluirTAF(id);
    await carregar();
    setDeleteConfirm(null);
  }

  async function handleDownload(registro: TreinamentoTAF) {
    try {
      setDownloadingId(registro.id);
      await baixarTAFPdf(registro);
    } catch (err) {
      alert('Erro ao gerar PDF do TAF: ' + mensagemErro(err));
    } finally {
      setDownloadingId(null);
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
            {filtered.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">{r.equipe.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">{String(r.numero).padStart(3,'0')}/{r.ano} · {r.equipe} · {r.tipoTaf}</p>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{fmt(r.data)} {r.hora && `às ${r.hora}`} · {r.turno}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(r)}
                    disabled={downloadingId === r.id}
                    className="flex items-center gap-1 rounded-xl border border-aviation-300 bg-white px-3 py-1.5 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                    title="Baixar PDF"
                  >
                    <Download className="h-4 w-4" /> {downloadingId === r.id ? 'Gerando' : 'PDF'}
                  </button>
                  {canManageEquipe(r.equipe) && (
                    <>
                    <button onClick={() => handleEditar(r)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => setDeleteConfirm(r.id)} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-5">
          <div className="relative w-full max-w-3xl mx-4 rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} TAF</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
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
              </div>
              <div>
                <label className={labelCls}>Turno</label>
                <input value={fTurno} disabled className={`${inputCls} opacity-60`} />
              </div>

              {/* Participantes */}
              <div>
                <p className="text-sm font-bold text-graphite-700 dark:text-graphite-300 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-aviation-500" /> Participantes
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-graphite-400">
                    <span className="w-6 text-center">#</span>
                    <span className="flex-1">Nome Completo</span>
                    <span className="w-14 text-center">Função</span>
                    <span className="w-10 text-center">Idade</span>
                    <span className="w-20 text-center">Tempo</span>
                  </div>
                  {SLOTS.map(slot => {
                    const idx = slot.i - 1;
                    const selectedIds = new Set(fPessoas
                      .filter((pp, ii) => pp.nome && ii !== idx)
                      .map(pp => {
                        const b = bombeiros.find((bb: any) => bb.nomeGuerra === pp.nome);
                        return b?.id || '';
                      })
                      .filter(Boolean));

                    return (
                      <SlotLinha
                        key={slot.i}
                        idx={idx}
                        slot={slot}
                        pessoa={fPessoas[idx]}
                        selectedIds={selectedIds}
                        onSelectPessoa={onSelectPessoa}
                        onTempoChange={(slotIdx, tempo) => setP(slotIdx, 'tempo', tempo)}
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

              <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={handleSalvar} disabled={!fEquipe || !fData || !fTipo || saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
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
