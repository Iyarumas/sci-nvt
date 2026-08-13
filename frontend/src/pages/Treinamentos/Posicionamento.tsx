import { useState, useEffect, useMemo } from 'react';
import {
  Download, Plus, Search, Trash2, Save, X, Target,
  AlertTriangle, Shield,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { resolverEfetivo } from '../../services/vigenciaSubstituicaoService';
import {
  listarExercicios, criarExercicio, atualizarExercicio,
  excluirExercicio, obterProximoNumero,
} from '../../services/exercicioPosicionamentoService';
import { baixarExercicioPosicionamentoPdf } from '../../services/exercicioPosicionamentoPdfService';
import type { ExercicioPosicionamento } from '../../types/exercicioPosicionamento';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function Posicionamento() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const [exercicios, setExercicios] = useState<ExercicioPosicionamento[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<ExercicioPosicionamento | null>(null);
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
  const [formFaisca2BaMc, setFormFaisca2BaMc] = useState('');
  const [formFaisca2BaCe, setFormFaisca2BaCe] = useState('');
  const [formFaisca2Ba2, setFormFaisca2Ba2] = useState('');
  const [formFaisca2Tempo, setFormFaisca2Tempo] = useState('');
  const [formFaisca3BaMc, setFormFaisca3BaMc] = useState('');
  const [formFaisca3Ba21, setFormFaisca3Ba21] = useState('');
  const [formFaisca3Ba22, setFormFaisca3Ba22] = useState('');
  const [formFaisca3Tempo, setFormFaisca3Tempo] = useState('');
  const [formCrsBaMc, setFormCrsBaMc] = useState('');
  const [formCrsBaLr, setFormCrsBaLr] = useState('');
  const [formCrsBaRe1, setFormCrsBaRe1] = useState('');
  const [formCrsBaRe2, setFormCrsBaRe2] = useState('');
  const [formCrsTempo, setFormCrsTempo] = useState('');
  const [formOperador, setFormOperador] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formCoordenacao, setFormCoordenacao] = useState('');
  const [formComunicacao, setFormComunicacao] = useState('');
  const [formProcedimentos, setFormProcedimentos] = useState('');
  const [formFeedbackTwr, setFormFeedbackTwr] = useState('');
  const [formResumo, setFormResumo] = useState('');
  const [formAcionamento, setFormAcionamento] = useState('');
  const [formDeslocamento, setFormDeslocamento] = useState('');
  const [formTempoResposta, setFormTempoResposta] = useState('');
  const [formFeedbackSci, setFormFeedbackSci] = useState('');
  const [formConsideracoes, setFormConsideracoes] = useState('');
  const [formSistemaAlarmes, setFormSistemaAlarmes] = useState('');
  const [formVisibilidade, setFormVisibilidade] = useState('');
  const [formFeedbackCoe, setFormFeedbackCoe] = useState('');

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => { carregar(); }, [filtroAno]);

  async function carregar() {
    const lista = await listarExercicios({ ano: filtroAno });
    setExercicios(lista);
  }

  const filtered = useMemo(() => {
    let lista = exercicios;
    if (filtroEquipe) lista = lista.filter(e => e.equipe === filtroEquipe);
    if (search) {
      const t = search.toLowerCase();
      lista = lista.filter(e =>
        `${String(e.numero).padStart(3, '0')}/${e.ano}`.includes(t) ||
        e.equipe.toLowerCase().includes(t) ||
        e.local.toLowerCase().includes(t)
      );
    }
    return lista;
  }, [exercicios, search, filtroEquipe]);

  const stats = useMemo(() => ({
    total: exercicios.length,
    porEquipe: EQUIPES.map(eq => ({
      equipe: eq,
      count: exercicios.filter(ex => ex.equipe === eq).length,
    })),
  }), [exercicios]);

  function resetForm() {
    setFormEquipe(canManageGlobal ? '' : equipeEfetiva || '');
    setFormNumero(0);
    setFormAno('');
    setFormData('');
    setFormHora('');
    setFormLocal('');
    setFormFaisca2BaMc('');
    setFormFaisca2BaCe('');
    setFormFaisca2Ba2('');
    setFormFaisca2Tempo('');
    setFormFaisca3BaMc('');
    setFormFaisca3Ba21('');
    setFormFaisca3Ba22('');
    setFormFaisca3Tempo('');
    setFormCrsBaMc('');
    setFormCrsBaLr('');
    setFormCrsBaRe1('');
    setFormCrsBaRe2('');
    setFormCrsTempo('');
    setFormOperador('');
    setFormObservacoes('');
    setFormCoordenacao('');
    setFormComunicacao('');
    setFormProcedimentos('');
    setFormFeedbackTwr('');
    setFormResumo('');
    setFormAcionamento('');
    setFormDeslocamento('');
    setFormTempoResposta('');
    setFormFeedbackSci('');
    setFormConsideracoes('');
    setFormSistemaAlarmes('');
    setFormVisibilidade('');
    setFormFeedbackCoe('');
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

  function handleEditar(e: ExercicioPosicionamento) {
    if (!canManageEquipe(e.equipe)) {
      alert('Você só pode editar treinamentos da sua equipe efetiva.');
      return;
    }
    setEditando(e);
    setFormEquipe(e.equipe);
    setFormNumero(e.numero);
    setFormAno(e.ano);
    setFormData(e.data);
    setFormHora(e.hora);
    setFormLocal(e.local);
    setFormFaisca2BaMc(e.faisca2BaMc);
    setFormFaisca2BaCe(e.faisca2BaCe);
    setFormFaisca2Ba2(e.faisca2Ba2);
    setFormFaisca2Tempo(e.faisca2Tempo);
    setFormFaisca3BaMc(e.faisca3BaMc);
    setFormFaisca3Ba21(e.faisca3Ba21);
    setFormFaisca3Ba22(e.faisca3Ba22);
    setFormFaisca3Tempo(e.faisca3Tempo);
    setFormCrsBaMc(e.crsBaMc);
    setFormCrsBaLr(e.crsBaLr);
    setFormCrsBaRe1(e.crsBaRe1);
    setFormCrsBaRe2(e.crsBaRe2);
    setFormCrsTempo(e.crsTempo);
    setFormOperador(e.operadorComunicacoes);
    setFormObservacoes(e.observacoes);
    setFormCoordenacao(e.coordenacaoTwrCoeSci);
    setFormComunicacao(e.comunicacaoFraseologia);
    setFormProcedimentos(e.procedimentosPcinc);
    setFormFeedbackTwr(e.feedbackTwr);
    setFormResumo(e.resumoExercicio);
    setFormAcionamento(e.acionamento);
    setFormDeslocamento(e.deslocamentoVtrs);
    setFormTempoResposta(e.tempoResposta);
    setFormFeedbackSci(e.feedbackSci);
    setFormConsideracoes(e.consideracoesFinais);
    setFormSistemaAlarmes(e.sistemaAlarmes);
    setFormVisibilidade(e.visibilidadeSuperficie);
    setFormFeedbackCoe(e.feedbackCoe);
    setFormChefeEquipe(e.chefeEquipe || '');
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
      const data: Omit<ExercicioPosicionamento, 'id' | 'createdAt' | 'updatedAt'> = {
        equipe: equipeAlvo, numero: formNumero, ano: formAno,
        data: formData, hora: formHora, local: formLocal,
        faisca2BaMc: formFaisca2BaMc, faisca2BaCe: formFaisca2BaCe, faisca2Ba2: formFaisca2Ba2,
        faisca2Tempo: formFaisca2Tempo,
        faisca3BaMc: formFaisca3BaMc, faisca3Ba21: formFaisca3Ba21, faisca3Ba22: formFaisca3Ba22,
        faisca3Tempo: formFaisca3Tempo,
        crsBaMc: formCrsBaMc, crsBaLr: formCrsBaLr, crsBaRe1: formCrsBaRe1, crsBaRe2: formCrsBaRe2,
        crsTempo: formCrsTempo,
        operadorComunicacoes: formOperador,
        observacoes: formObservacoes, coordenacaoTwrCoeSci: formCoordenacao,
        comunicacaoFraseologia: formComunicacao, procedimentosPcinc: formProcedimentos,
        feedbackTwr: formFeedbackTwr, resumoExercicio: formResumo,
        acionamento: formAcionamento, deslocamentoVtrs: formDeslocamento,
        tempoResposta: formTempoResposta, feedbackSci: formFeedbackSci,
        consideracoesFinais: formConsideracoes, sistemaAlarmes: formSistemaAlarmes,
        visibilidadeSuperficie: formVisibilidade, feedbackCoe: formFeedbackCoe,
        chefeEquipe: formChefeEquipe || user?.name || '',
      };
      if (editando) {
        await atualizarExercicio(editando.id, data);
      } else {
        await criarExercicio(data);
      }
      await carregar();
      setFormOpen(false);
    } catch (err) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(id: string) {
    const exercicio = exercicios.find(ex => ex.id === id);
    if (exercicio && !canManageEquipe(exercicio.equipe)) {
      alert('Você só pode excluir treinamentos da sua equipe efetiva.');
      setDeleteConfirm(null);
      return;
    }
    await excluirExercicio(id);
    await carregar();
    setDeleteConfirm(null);
  }

  async function handleBaixarPdf(exercicio: ExercicioPosicionamento) {
    try {
      await baixarExercicioPosicionamentoPdf(exercicio);
    } catch (err) {
      alert('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  function SlotField({ label, value, onChange, cargo }: { label: string; value: string; onChange: (v: string) => void; cargo?: string }) {
    return (
      <div>
        <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400 mb-0.5">{label}</p>
        <SearchSelect value={value} onChange={onChange} cargo={cargo} placeholder={`Selecione ${label}`} />
      </div>
    );
  }

  function TextareaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
          className={`${inputCls} resize-none`} />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Target} title="Exercício de Posicionamento" />

      <div className="space-y-6">
        {/* Stats + Novo */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-2 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
              <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.total}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-aviation-500">{filtroAno}</p>
            </div>
            {stats.porEquipe.map(s => s.count > 0 && (
              <div key={s.equipe} className="rounded-xl border border-graphite-200 bg-white px-3 py-2 text-center dark:border-border-dark dark:bg-surface-card">
                <p className="text-sm font-bold text-graphite-700 dark:text-graphite-300">{s.count}</p>
                <p className="text-[8px] font-bold uppercase tracking-wider text-graphite-400">{s.equipe}</p>
              </div>
            ))}
          </div>
          {canCreate && (
            <button onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Novo Exercício
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nº, equipa, local..." className={`${inputCls} !pl-10`} />
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
            <Target className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum exercício</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo Exercício" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(ex => (
              <div key={ex.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                    {ex.equipe.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">
                      {String(ex.numero).padStart(3, '0')}/{ex.ano} · {ex.equipe}
                    </p>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">
                      {formatDate(ex.data)} {ex.hora && `às ${ex.hora}`} · {ex.local || 'Sem local'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => void handleBaixarPdf(ex)}
                    title="Baixar PDF"
                    aria-label="Baixar PDF"
                    className="rounded-xl p-1.5 text-aviation-500 hover:bg-aviation-50 dark:hover:bg-aviation-900/20">
                    <Download className="h-4 w-4" />
                  </button>
                  {canManageEquipe(ex.equipe) && (
                    <>
                      <button onClick={() => handleEditar(ex)}
                        className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(ex.id)}
                        className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
          <div className="relative w-full max-w-4xl mx-4 rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
                {editando ? 'Editar' : 'Novo'} Exercício de Posicionamento
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
                  <label className={labelCls}>Nº do Exercício</label>
                  <input value={`${String(formNumero).padStart(3, '0')}/${formAno}`} disabled
                    className={`${inputCls} opacity-60`} />
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
                <input type="text" value={formLocal} onChange={e => setFormLocal(e.target.value)}
                  placeholder="Local do exercício..." className={inputCls} />
              </div>

              {/* Equipagem */}
              <div>
                <p className="text-sm font-bold text-graphite-700 dark:text-graphite-300 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-aviation-500" /> Equipagem
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* FAISCA 2 */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                    <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">FAISCA 2</h4>
                    <div className="space-y-2">
                      <SlotField label="BA-MC" value={formFaisca2BaMc} onChange={setFormFaisca2BaMc} cargo="BA-MC" />
                      <SlotField label="BA-CE" value={formFaisca2BaCe} onChange={setFormFaisca2BaCe} cargo="BA-CE" />
                      <SlotField label="BA-2" value={formFaisca2Ba2} onChange={setFormFaisca2Ba2} cargo="BA-2" />
                      <div>
                        <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400 mb-0.5">Tempo</p>
                        <input type="text" value={formFaisca2Tempo} onChange={e => setFormFaisca2Tempo(e.target.value)}
                          placeholder="mm:ss" className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* FAISCA 3 */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">FAISCA 3</h4>
                    <div className="space-y-2">
                      <SlotField label="BA-MC" value={formFaisca3BaMc} onChange={setFormFaisca3BaMc} cargo="BA-MC" />
                      <SlotField label="BA-2" value={formFaisca3Ba21} onChange={setFormFaisca3Ba21} cargo="BA-2" />
                      <SlotField label="BA-2" value={formFaisca3Ba22} onChange={setFormFaisca3Ba22} cargo="BA-2" />
                      <div>
                        <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400 mb-0.5">Tempo</p>
                        <input type="text" value={formFaisca3Tempo} onChange={e => setFormFaisca3Tempo(e.target.value)}
                          placeholder="mm:ss" className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* CRS */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800 dark:bg-blue-900/10">
                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">CRS</h4>
                    <div className="space-y-2">
                      <SlotField label="BA-MC" value={formCrsBaMc} onChange={setFormCrsBaMc} cargo="BA-MC" />
                      <SlotField label="BA-LR" value={formCrsBaLr} onChange={setFormCrsBaLr} cargo="BA-LR" />
                      <SlotField label="BA-RE" value={formCrsBaRe1} onChange={setFormCrsBaRe1} cargo="BA-RE" />
                      <SlotField label="BA-RE" value={formCrsBaRe2} onChange={setFormCrsBaRe2} cargo="BA-RE" />
                      <div>
                        <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400 mb-0.5">Tempo</p>
                        <input type="text" value={formCrsTempo} onChange={e => setFormCrsTempo(e.target.value)}
                          placeholder="mm:ss" className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operador de Comunicações */}
              <div>
                <label className={labelCls}>Operador de Comunicações</label>
                <SearchSelect value={formOperador} onChange={setFormOperador} cargo="APOC" placeholder="Selecione o APOC..." />
              </div>

              {/* Textareas */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextareaField label="Observações" value={formObservacoes} onChange={setFormObservacoes} rows={4} />
                <TextareaField label="Coordenação com TWR/COE/SCI" value={formCoordenacao} onChange={setFormCoordenacao} rows={4} />
                <TextareaField label="Comunicação / Fraseologia" value={formComunicacao} onChange={setFormComunicacao} rows={4} />
                <TextareaField label="Procedimentos PCINC" value={formProcedimentos} onChange={setFormProcedimentos} rows={4} />
                <TextareaField label="Feedback TWR" value={formFeedbackTwr} onChange={setFormFeedbackTwr} rows={4} />
                <TextareaField label="Resumo do Exercício" value={formResumo} onChange={setFormResumo} rows={4} />
                <TextareaField label="Acionamento" value={formAcionamento} onChange={setFormAcionamento} rows={4} />
                <TextareaField label="Deslocamento VTR's" value={formDeslocamento} onChange={setFormDeslocamento} rows={4} />
                <TextareaField label="Tempo Resposta" value={formTempoResposta} onChange={setFormTempoResposta} rows={4} />
                <TextareaField label="Feedback SCI" value={formFeedbackSci} onChange={setFormFeedbackSci} rows={4} />
                <TextareaField label="Considerações Finais" value={formConsideracoes} onChange={setFormConsideracoes} rows={4} />
                <TextareaField label="Sistema de Alarmes" value={formSistemaAlarmes} onChange={setFormSistemaAlarmes} rows={4} />
                <TextareaField label="Visibilidade e Superfície" value={formVisibilidade} onChange={setFormVisibilidade} rows={4} />
                <TextareaField label="Feedback COE" value={formFeedbackCoe} onChange={setFormFeedbackCoe} rows={4} />
              </div>

              {/* Chefe de Equipe (readonly) */}
              <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/80">
                <label className={labelCls}>Chefe de Equipe</label>
                <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{formChefeEquipe || user?.name || '-'}</p>
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

      {/* Confirm Delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este exercício?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                Cancelar
              </button>
              <button onClick={() => handleExcluir(deleteConfirm)}
                className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
