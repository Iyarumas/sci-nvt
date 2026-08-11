import { useState, useEffect, useMemo } from 'react';

import {
  GraduationCap, Plus, Search, Trash2, Save, Users,
  Target, Timer, X,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { listarBombeiros } from '../../services/bombeiroService';
import type { Bombeiro } from '../../types/bombeiro';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';

interface Treinamento {
  id: string;
  tipo: 'posicionamento' | 'tempo-resposta';
  data: string;
  titulo: string;
  descricao: string;
  cargaHoraria: number;
  instrutor: string;
  participantes: string[];
  createdAt: string;
  createdBy?: string;
}

const STORAGE_KEY = 'sescinc-treinamentos';

const TIPO_LABEL: Record<string, string> = {
  posicionamento: 'POSICIONAMENTO PARA INTERVENÇÃO',
  'tempo-resposta': 'EXERCÍCIO DE TEMPO RESPOSTA',
};

const TIPO_OPTIONS = [
  { value: 'posicionamento', label: 'Posicionamento para Intervenção' },
  { value: 'tempo-resposta', label: 'Exercício de Tempo Resposta' },
];

function carregar(): Treinamento[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function salvar(lista: Treinamento[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400';
const labelCls = 'mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300';

export function Treinamentos({ tipoPadrao }: { tipoPadrao?: string }) {
  const { user, canManageGlobal } = useContextoOperacional();
  const currentUsername = user?.username || user?.name || '';
  const canCreate = canManageGlobal || !!currentUsername;
  const [treinos, setTreinos] = useState<Treinamento[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Treinamento | null>(null);

  const [formTipo, setFormTipo] = useState<string>(tipoPadrao || 'posicionamento');
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0]);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCarga, setFormCarga] = useState(1);
  const [formInstrutor, setFormInstrutor] = useState('');
  const [formParticipantes, setFormParticipantes] = useState<string[]>([]);
  const [searchPart, setSearchPart] = useState('');

  useEffect(() => {
    listarBombeiros().then(setBombeiros).catch(() => {});
    setTreinos(carregar());
  }, []);

  const filtered = useMemo(() => {
    let lista = tipoPadrao ? treinos.filter(tr => tr.tipo === tipoPadrao) : treinos;
    if (!search) return lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const t = search.toLowerCase();
    return lista.filter(tr =>
      TIPO_LABEL[tr.tipo]?.toLowerCase().includes(t) || tr.titulo.toLowerCase().includes(t) || tr.instrutor.toLowerCase().includes(t)
    ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [treinos, search, tipoPadrao]);

  const participantesFiltrados = useMemo(() => {
    if (!searchPart) return [];
    const t = searchPart.toLowerCase();
    return bombeiros.filter(b => b.nomeCompleto.toLowerCase().includes(t) || b.nomeGuerra.toLowerCase().includes(t)).slice(0, 8);
  }, [bombeiros, searchPart]);

  function resetForm() {
    setFormTipo('posicionamento');
    setFormData(new Date().toISOString().split('T')[0]);
    setFormTitulo('');
    setFormDescricao('');
    setFormCarga(1);
    setFormInstrutor('');
    setFormParticipantes([]);
    setSearchPart('');
  }

  function canManageTreino(t: Treinamento): boolean {
    if (canManageGlobal) return true;
    return !!t.createdBy && t.createdBy === currentUsername;
  }

  function handleNovo() {
    if (!canCreate) {
      alert('Você precisa estar autenticado para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    setFormOpen(true);
  }

  function handleEditar(t: Treinamento) {
    if (!canManageTreino(t)) {
      alert('Você só pode editar treinamentos criados por você.');
      return;
    }
    setEditando(t);
    setFormTipo(t.tipo);
    setFormData(t.data);
    setFormTitulo(t.titulo);
    setFormDescricao(t.descricao);
    setFormCarga(t.cargaHoraria);
    setFormInstrutor(t.instrutor);
    setFormParticipantes(t.participantes);
    setFormOpen(true);
  }

  function handleSalvar() {
    if (!formTitulo || !formDescricao) return;
    const lista = carregar();
    if (editando) {
      if (!canManageTreino(editando)) {
        alert('Você só pode editar treinamentos criados por você.');
        return;
      }
      const idx = lista.findIndex(t => t.id === editando.id);
      if (idx >= 0) lista[idx] = { ...lista[idx], tipo: formTipo as any, data: formData, titulo: formTitulo, descricao: formDescricao, cargaHoraria: formCarga, instrutor: formInstrutor, participantes: formParticipantes, createdBy: lista[idx].createdBy || currentUsername };
    } else {
      lista.push({ id: crypto.randomUUID(), tipo: formTipo as any, data: formData, titulo: formTitulo, descricao: formDescricao, cargaHoraria: formCarga, instrutor: formInstrutor, participantes: formParticipantes, createdAt: new Date().toISOString(), createdBy: currentUsername });
    }
    salvar(lista);
    setTreinos(lista);
    setFormOpen(false);
  }

  function handleExcluir(id: string) {
    const treino = treinos.find(t => t.id === id);
    if (treino && !canManageTreino(treino)) {
      alert('Você só pode excluir treinamentos criados por você.');
      return;
    }
    setTreinos(prev => { const n = prev.filter(t => t.id !== id); salvar(n); return n; });
  }

  function adicionarParticipante(b: Bombeiro) {
    if (!formParticipantes.includes(b.id)) setFormParticipantes(prev => [...prev, b.id]);
    setSearchPart('');
  }

  function removerParticipante(id: string) {
    setFormParticipantes(prev => prev.filter(p => p !== id));
  }

  const stats = useMemo(() => ({
    total: tipoPadrao ? treinos.filter(t => t.tipo === tipoPadrao).length : treinos.length,
    posicionamento: treinos.filter(t => t.tipo === 'posicionamento').length,
    tempoResposta: treinos.filter(t => t.tipo === 'tempo-resposta').length,
  }), [treinos, tipoPadrao]);

  const titulo = tipoPadrao === 'tempo-resposta' ? 'Exercício de Tempo Resposta' : tipoPadrao === 'posicionamento' ? 'Exercício de Posicionamento' : 'Treinamentos';
  const Icone = tipoPadrao === 'tempo-resposta' ? Timer : tipoPadrao === 'posicionamento' ? Target : GraduationCap;

  return (
    <PageContainer>
      <PageTitle icon={Icone} title={titulo} />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`rounded-xl border px-4 py-2 text-center dark:bg-opacity-20 ${
              tipoPadrao ? 'border-aviation-200 bg-aviation-50 dark:border-aviation-800 dark:bg-aviation-900/20' : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
            }`}>
              <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.total}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-aviation-500">{tipoPadrao ? (tipoPadrao === 'tempo-resposta' ? 'Tempo Resposta' : 'Posicionamento') : 'Total'}</p>
            </div>
            {!tipoPadrao && (<>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xl font-black text-amber-700 dark:text-amber-300">{stats.posicionamento}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500">Posicionamento</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{stats.tempoResposta}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Tempo Resposta</p>
            </div>
            </>)}
          </div>
          {canCreate && (
            <button onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Novo Treinamento
            </button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar treinamentos..." className={`${inputCls} !pl-10`} />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
            <GraduationCap className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum treinamento</h3>
            <p className="text-sm text-graphite-500">Clique em "Novo Treinamento" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                    t.tipo === 'posicionamento' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                  }`}>
                    {t.tipo === 'posicionamento' ? <Target className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
                  </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{t.titulo}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          t.tipo === 'posicionamento' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        }`}>{TIPO_LABEL[t.tipo]}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-graphite-500 dark:text-graphite-400 truncate">{t.descricao}</p>
                      <p className="text-[10px] text-graphite-400 dark:text-graphite-500">{fmt(t.data)} · {t.cargaHoraria}h · {t.instrutor || 'N/A'} · {t.participantes.length} participante(s)</p>
                  </div>
                  {canManageTreino(t) && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEditar(t)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover" title="Editar">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleExcluir(t.id)} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8">
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
            <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} Treinamento</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Tipo <span className="text-red-500">*</span></label>
                  <select value={formTipo} onChange={e => setFormTipo(e.target.value)} className={inputCls}>
                    {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={formData} onChange={e => setFormData(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Título <span className="text-red-500">*</span></label>
                <input type="text" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} placeholder="Ex: Posicionamento para Intervenção em Aeronaves" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Descrição <span className="text-red-500">*</span></label>
                <textarea value={formDescricao} onChange={e => setFormDescricao(e.target.value)} rows={4} placeholder="Descreva o conteúdo do treinamento..." className={inputCls} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Carga Horária (h)</label>
                  <input type="number" value={formCarga} onChange={e => setFormCarga(Number(e.target.value))} min={0.5} step={0.5} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Instrutor</label>
                  <input type="text" value={formInstrutor} onChange={e => setFormInstrutor(e.target.value)} placeholder="Nome do instrutor" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Participantes ({formParticipantes.length})</label>
                <div className="relative mb-3">
                  <input type="text" value={searchPart} onChange={e => setSearchPart(e.target.value)} placeholder="Buscar bombeiro..." className={inputCls} />
                  {searchPart && participantesFiltrados.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-graphite-200 bg-white shadow-lg dark:border-border-dark dark:bg-surface-card">
                      {participantesFiltrados.map(b => (
                        <button key={b.id} type="button" onClick={() => adicionarParticipante(b)} disabled={formParticipantes.includes(b.id)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-graphite-50 disabled:opacity-30 dark:hover:bg-surface-hover">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xs font-bold text-white">{b.nomeGuerra.charAt(0)}</div>
                          <div><p className="font-medium text-graphite-900">{b.nomeCompleto}</p><p className="text-xs text-graphite-500">{b.nomeGuerra} · {b.cargo}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formParticipantes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formParticipantes.map(id => {
                      const b = bombeiros.find(bb => bb.id === id);
                      if (!b) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-aviation-100 px-2.5 py-1 text-[10px] font-semibold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
                          {b.nomeGuerra}
                          <button onClick={() => removerParticipante(id)} className="ml-0.5 rounded-full p-0.5 hover:bg-aviation-200 dark:hover:bg-aviation-800">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={handleSalvar} disabled={!formTitulo || !formDescricao}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                  <Save className="h-4 w-4" /> Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default Treinamentos;
