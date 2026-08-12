import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Save, X, Timer, Clock,
  AlertTriangle, Shield, CheckCircle, XCircle, Users,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { resolverEfetivo } from '../../services/vigenciaSubstituicaoService';
import {
  listarTreinos, criarTreino, atualizarTreino,
  excluirTreino, obterProximoNumero,
} from '../../services/tempoRespostaService';
import type { TreinamentoTempoResposta } from '../../types/tempoResposta';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const CCI_OPTIONS = ['319', '320', '333'];
const CONCEITO_OPTIONS = ['A', 'R'];
const PERFORMANCE_OPTIONS = ['Satisfatório', 'Insatisfatório'];

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function TempoResposta() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const [treinos, setTreinos] = useState<TreinamentoTempoResposta[]>([]);
  const [bombeiros, setBombeiros] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTempoResposta | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formEquipe, setFormEquipe] = useState('');
  const [formNumero, setFormNumero] = useState(0);
  const [formAno, setFormAno] = useState('');
  const [formData, setFormData] = useState('');
  const [formHora, setFormHora] = useState('');
  const [formLocal, setFormLocal] = useState('');
  const [formChefeEquipe, setFormChefeEquipe] = useState('');

  // F2
  const [f2Cci, setF2Cci] = useState('');
  const [f2BaMc, setF2BaMc] = useState('');
  const [f2BaCe, setF2BaCe] = useState('');
  const [f2Ba2, setF2Ba2] = useState('');
  const [f2T1, setF2T1] = useState('');
  const [f2T2, setF2T2] = useState('');
  const [f2T3, setF2T3] = useState('');
  const [f2Conceito, setF2Conceito] = useState('');
  const [f2Performance, setF2Performance] = useState('');

  // F3
  const [f3Cci, setF3Cci] = useState('');
  const [f3BaMc, setF3BaMc] = useState('');
  const [f3Ba21, setF3Ba21] = useState('');
  const [f3Ba22, setF3Ba22] = useState('');
  const [f3T1, setF3T1] = useState('');
  const [f3T2, setF3T2] = useState('');
  const [f3T3, setF3T3] = useState('');
  const [f3Conceito, setF3Conceito] = useState('');
  const [f3Performance, setF3Performance] = useState('');

  // Textareas
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formResumo, setFormResumo] = useState('');
  const [formConsideracoes, setFormConsideracoes] = useState('');
  const [formCoordenacao, setFormCoordenacao] = useState('');
  const [formAcionamento, setFormAcionamento] = useState('');
  const [formSistemaAlarmes, setFormSistemaAlarmes] = useState('');
  const [formComunicacao, setFormComunicacao] = useState('');
  const [formDeslocamento, setFormDeslocamento] = useState('');
  const [formVisibilidade, setFormVisibilidade] = useState('');
  const [formProcedimentos, setFormProcedimentos] = useState('');
  const [formTempoResposta, setFormTempoResposta] = useState('');
  const [formFeedbackSpe, setFormFeedbackSpe] = useState('');
  const [formFeedbackTwr, setFormFeedbackTwr] = useState('');
  const [formFeedbackSci, setFormFeedbackSci] = useState('');
  const [formGerente, setFormGerente] = useState('');

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => {
    listarAtivos().then(setBombeiros);
    carregar();
  }, []);

  useEffect(() => { carregar(); }, [filtroAno]);

  async function carregar() {
    const lista = await listarTreinos({ ano: filtroAno });
    setTreinos(lista);
  }

  const filtered = useMemo(() => {
    let lista = treinos;
    if (filtroEquipe) lista = lista.filter(t => t.equipe === filtroEquipe);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(t =>
        `${String(t.numero).padStart(3, '0')}/${t.ano}`.includes(s) ||
        t.equipe.toLowerCase().includes(s) ||
        t.local.toLowerCase().includes(s)
      );
    }
    return lista;
  }, [treinos, search, filtroEquipe]);

  const stats = useMemo(() => ({
    total: treinos.length,
  }), [treinos]);

  function resetForm() {
    setFormEquipe(canManageGlobal ? '' : equipeEfetiva || ''); setFormNumero(0); setFormAno(''); setFormData(''); setFormHora(''); setFormLocal('');
    setF2Cci(''); setF2BaMc(''); setF2BaCe(''); setF2Ba2(''); setF2T1(''); setF2T2(''); setF2T3(''); setF2Conceito(''); setF2Performance('');
    setF3Cci(''); setF3BaMc(''); setF3Ba21(''); setF3Ba22(''); setF3T1(''); setF3T2(''); setF3T3(''); setF3Conceito(''); setF3Performance('');
    setFormObservacoes(''); setFormResumo(''); setFormConsideracoes(''); setFormCoordenacao('');
    setFormAcionamento(''); setFormSistemaAlarmes(''); setFormComunicacao(''); setFormDeslocamento('');
    setFormVisibilidade(''); setFormProcedimentos(''); setFormTempoResposta(''); setFormFeedbackSpe(''); setFormFeedbackTwr(''); setFormFeedbackSci('');
    setFormGerente('');
    setFormChefeEquipe('');
  }

  async function handleNovo() {
    if (!canCreate) {
      alert('Você precisa ter uma equipe efetiva para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    const anoAtual = new Date().getFullYear().toString();
    setFormAno(anoAtual);
    setFormData(new Date().toISOString().split('T')[0]);
    setFormHora(new Date().toTimeString().slice(0, 5));
    const prox = await obterProximoNumero(anoAtual);
    setFormNumero(prox);
    setFormOpen(true);
  }

  useEffect(() => {
    if (!formOpen || editando || !formEquipe || !formData) return;
    let active = true;
    (async () => {
      try {
        const efetivo = await resolverEfetivo(formEquipe, formData);
        if (!active) return;
        const chefe = [...efetivo.efetivos, ...efetivo.substitutosExternos]
          .find(item => !item.emFerias && item.cargoExercido === 'BA-CE');
        if (chefe) setFormChefeEquipe(chefe.bombeiro.nomeGuerra || chefe.bombeiro.nomeCompleto || '');
      } catch { /* mantem vazio, fallback no salvar */ }
    })();
    return () => { active = false; };
  }, [formOpen, editando, formEquipe, formData]);

  function handleEditar(t: TreinamentoTempoResposta) {
    if (!canManageEquipe(t.equipe)) {
      alert('Você só pode editar treinamentos da sua equipe efetiva.');
      return;
    }
    setEditando(t);
    setFormEquipe(t.equipe); setFormNumero(t.numero); setFormAno(t.ano);
    setFormData(t.data); setFormHora(t.hora); setFormLocal(t.local);
    setF2Cci(t.f2Cci); setF2BaMc(t.f2BaMc); setF2BaCe(t.f2BaCe); setF2Ba2(t.f2Ba2);
    setF2T1(t.f2T1); setF2T2(t.f2T2); setF2T3(t.f2T3); setF2Conceito(t.f2Conceito); setF2Performance(t.f2Performance);
    setF3Cci(t.f3Cci); setF3BaMc(t.f3BaMc); setF3Ba21(t.f3Ba21); setF3Ba22(t.f3Ba22);
    setF3T1(t.f3T1); setF3T2(t.f3T2); setF3T3(t.f3T3); setF3Conceito(t.f3Conceito); setF3Performance(t.f3Performance);
    setFormObservacoes(t.observacoes); setFormResumo(t.resumoExercicio); setFormConsideracoes(t.consideracoesFinais);
    setFormCoordenacao(t.coordenacaoTwrSpeSci); setFormAcionamento(t.acionamento); setFormSistemaAlarmes(t.sistemaAlarmes);
    setFormComunicacao(t.comunicacaoFraseologia); setFormDeslocamento(t.deslocamentoVtrs); setFormVisibilidade(t.visibilidadeSuperficie);
    setFormProcedimentos(t.procedimentoPcinc); setFormTempoResposta(t.tempoResposta); setFormFeedbackSpe(t.feedbackSpe);
    setFormFeedbackTwr(t.feedbackTwr); setFormFeedbackSci(t.feedbackSci); setFormGerente(t.gerente);
    setFormChefeEquipe(t.chefeEquipe || '');
    setFormOpen(true);
  }

  async function handleSalvar() {
    const equipeAlvo = canManageGlobal ? formEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !formData) return;
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
      const data: Omit<TreinamentoTempoResposta, 'id' | 'createdAt' | 'updatedAt'> = {
        equipe: equipeAlvo, numero: formNumero, ano: formAno,
        data: formData, hora: formHora, local: formLocal,
        f2Cci, f2BaMc, f2BaCe, f2Ba2, f2T1, f2T2, f2T3, f2Conceito, f2Performance,
        f3Cci, f3BaMc, f3Ba21, f3Ba22, f3T1, f3T2, f3T3, f3Conceito, f3Performance,
        observacoes: formObservacoes, resumoExercicio: formResumo, consideracoesFinais: formConsideracoes,
        coordenacaoTwrSpeSci: formCoordenacao, acionamento: formAcionamento, sistemaAlarmes: formSistemaAlarmes,
        comunicacaoFraseologia: formComunicacao, deslocamentoVtrs: formDeslocamento,
        visibilidadeSuperficie: formVisibilidade, procedimentoPcinc: formProcedimentos,
        tempoResposta: formTempoResposta, feedbackSpe: formFeedbackSpe,
        feedbackTwr: formFeedbackTwr, feedbackSci: formFeedbackSci,
        chefeEquipe: formChefeEquipe || user?.name || '', gerente: formGerente,
      };
      if (editando) {
        await atualizarTreino(editando.id, data);
      } else {
        await criarTreino(data);
      }
      await carregar();
      setFormOpen(false);
    } catch (err) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally { setSaving(false); }
  }

  async function handleExcluir(id: string) {
    const treino = treinos.find(t => t.id === id);
    if (treino && !canManageEquipe(treino.equipe)) {
      alert('Você só pode excluir treinamentos da sua equipe efetiva.');
      setDeleteConfirm(null);
      return;
    }
    await excluirTreino(id);
    await carregar();
    setDeleteConfirm(null);
  }

  function VeiculoCard({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
    return (
      <div className={`rounded-xl border-2 ${cor} p-4`}>
        <h4 className="text-sm font-bold mb-3">{titulo}</h4>
        {children}
      </div>
    );
  }

  function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">Selecione</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Timer} title="Treinamento de Tempo Resposta" />

      <div className="space-y-6">
        {/* Header */}
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
              <Plus className="h-4 w-4" /> Novo Treino
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..." className={`${inputCls} !pl-10`} />
          </div>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todas equipas</option>
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a =>
              <option key={a} value={a.toString()}>{a}</option>
            )}
          </select>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card/50">
            <Timer className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum treino registado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo Treino" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                    {t.equipe.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">
                      {String(t.numero).padStart(3, '0')}/{t.ano} · {t.equipe}
                    </p>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">
                      {fmt(t.data)} {t.hora && `às ${t.hora}`} · {t.local || 'Sem local'}
                    </p>
                  </div>
                </div>
                {canManageEquipe(t.equipe) && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleEditar(t)}
                      className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => setDeleteConfirm(t.id)}
                      className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-5">
          <div className="relative w-full max-w-4xl mx-4 rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
                {editando ? 'Editar' : 'Novo'} Treino de Tempo Resposta
              </h2>
              <button onClick={() => setFormOpen(false)}
                className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Cabeçalho */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={formEquipe} onChange={e => setFormEquipe(e.target.value)} disabled={!canManageGlobal} className={inputCls}>
                    <option value="">Selecione</option>
                    {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nº do Treino</label>
                  <input value={`${String(formNumero).padStart(3, '0')}/${formAno}`} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={formData} onChange={e => setFormData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" value={formHora} onChange={e => setFormHora(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Local</label>
                <input type="text" value={formLocal} onChange={e => setFormLocal(e.target.value)} placeholder="Local..." className={inputCls} />
              </div>

              {/* F2 */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> FAISCA 2
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <SelectField label="CCI" value={f2Cci} onChange={setF2Cci}
                      options={CCI_OPTIONS.map(v => ({ value: v, label: `CCI ${v}` }))} />
                    <SlotField label="BA-MC" value={f2BaMc} onChange={setF2BaMc} cargo="BA-MC" />
                    <SlotField label="BA-CE" value={f2BaCe} onChange={setF2BaCe} cargo="BA-CE" />
                    <SlotField label="BA-2" value={f2Ba2} onChange={setF2Ba2} cargo="BA-2" />
                  </div>
                  <div className="space-y-3">
                    <SelectField label="Conceito" value={f2Conceito} onChange={setF2Conceito}
                      options={CONCEITO_OPTIONS.map(v => ({ value: v, label: v === 'A' ? 'Aprovado' : 'Reprovado' }))} />
                    <SelectField label="Performance" value={f2Performance} onChange={setF2Performance}
                      options={PERFORMANCE_OPTIONS.map(v => ({ value: v, label: v }))} />
                    <div>
                      <label className={labelCls}>T1 (HH:MM:SS)</label>
                      <input type="text" value={f2T1} onChange={e => setF2T1(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T2 (HH:MM:SS)</label>
                      <input type="text" value={f2T2} onChange={e => setF2T2(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T3 (HH:MM:SS)</label>
                      <input type="text" value={f2T3} onChange={e => setF2T3(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* F3 */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> FAISCA 3
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <SelectField label="CCI" value={f3Cci} onChange={setF3Cci}
                      options={CCI_OPTIONS.map(v => ({ value: v, label: `CCI ${v}` }))} />
                    <SlotField label="BA-MC" value={f3BaMc} onChange={setF3BaMc} cargo="BA-MC" />
                    <SlotField label="BA-2" value={f3Ba21} onChange={setF3Ba21} cargo="BA-2" />
                    <SlotField label="BA-2" value={f3Ba22} onChange={setF3Ba22} cargo="BA-2" />
                  </div>
                  <div className="space-y-3">
                    <SelectField label="Conceito" value={f3Conceito} onChange={setF3Conceito}
                      options={CONCEITO_OPTIONS.map(v => ({ value: v, label: v === 'A' ? 'Aprovado' : 'Reprovado' }))} />
                    <SelectField label="Performance" value={f3Performance} onChange={setF3Performance}
                      options={PERFORMANCE_OPTIONS.map(v => ({ value: v, label: v }))} />
                    <div>
                      <label className={labelCls}>T1 (HH:MM:SS)</label>
                      <input type="text" value={f3T1} onChange={e => setF3T1(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T2 (HH:MM:SS)</label>
                      <input type="text" value={f3T2} onChange={e => setF3T2(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T3 (HH:MM:SS)</label>
                      <input type="text" value={f3T3} onChange={e => setF3T3(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Textareas */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextareaField label="Observações" value={formObservacoes} onChange={setFormObservacoes} />
                <TextareaField label="Resumo do Exercício" value={formResumo} onChange={setFormResumo} />
                <TextareaField label="Considerações Finais" value={formConsideracoes} onChange={setFormConsideracoes} />
                <TextareaField label="Coordenação TWR/SPE/SCI" value={formCoordenacao} onChange={setFormCoordenacao} />
                <TextareaField label="Acionamento" value={formAcionamento} onChange={setFormAcionamento} />
                <TextareaField label="Sistema de Alarmes" value={formSistemaAlarmes} onChange={setFormSistemaAlarmes} />
                <TextareaField label="Comunicação / Fraseologia" value={formComunicacao} onChange={setFormComunicacao} />
                <TextareaField label="Deslocamento VTR's" value={formDeslocamento} onChange={setFormDeslocamento} />
                <TextareaField label="Visibilidade e Superfície" value={formVisibilidade} onChange={setFormVisibilidade} />
                <TextareaField label="Procedimento PCINC" value={formProcedimentos} onChange={setFormProcedimentos} />
                <TextareaField label="Tempo Resposta" value={formTempoResposta} onChange={setFormTempoResposta} />
                <TextareaField label="Feedback SPE" value={formFeedbackSpe} onChange={setFormFeedbackSpe} />
                <TextareaField label="Feedback TWR" value={formFeedbackTwr} onChange={setFormFeedbackTwr} />
                <TextareaField label="Feedback SCI" value={formFeedbackSci} onChange={setFormFeedbackSci} />
              </div>

              {/* Chefe + Gerente */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/80">
                  <label className={labelCls}>Chefe de Equipe</label>
                  <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{formChefeEquipe || user?.name || '-'}</p>
                </div>
                <div>
                  <label className={labelCls}>GS / Embaixador (Gerente)</label>
                  <input type="text" value={formGerente} onChange={e => setFormGerente(e.target.value)}
                    placeholder="Nome do gerente..." className={inputCls} />
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  Cancelar
                </button>
                <button onClick={handleSalvar} disabled={!formEquipe || !formData || saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este treino?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluir(deleteConfirm)}
                className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function SlotField({ label, value, onChange, cargo }: { label: string; value: string; onChange: (v: string) => void; cargo?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</label>
      <SearchSelect value={value} onChange={onChange} cargo={cargo} placeholder={`Selecione ${label}`} />
    </div>
  );
}
