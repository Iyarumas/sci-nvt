import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Plus, Search, Save, Trash2, X, CheckCircle, Printer,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';

interface ChecklistItem {
  id: string;
  nome: string;
  concluido: boolean;
  observacao: string;
}

interface Checklist {
  id: string;
  titulo: string;
  data: string;
  equipe: string;
  responsavel: string;
  itens: ChecklistItem[];
  status: 'pendente' | 'concluido';
  createdAt: string;
}

const STORAGE_KEY = 'sescinc-checklists';
const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista'];

function carregar(): Checklist[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function salvar(lista: Checklist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400';
const labelCls = 'mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300';

const ITENS_PADRAO = [
  'Farol rotativo / Giroflex',
  'Sirene',
  'Rádio comunicador',
  'EPIs completos',
  'Extintores de incêndio',
  'Mangueiras',
  'Escadas',
  'Ferramentas de desencarceramento',
  'Iluminação de emergência',
  'Sinalização viária',
];

function ChecklistForm({ onSave, onCancel, editando }: {
  onSave: (data: Omit<Checklist, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  editando: Checklist | null;
}) {
  const [titulo, setTitulo] = useState(editando?.titulo || '');
  const [data, setData] = useState(editando?.data || new Date().toISOString().split('T')[0]);
  const [equipe, setEquipe] = useState(editando?.equipe || '');
  const [responsavel, setResponsavel] = useState(editando?.responsavel || '');
  const [itens, setItens] = useState<{ nome: string; concluido: boolean; observacao: string }[]>(
    editando?.itens.map(i => ({ nome: i.nome, concluido: i.concluido, observacao: i.observacao })) ||
    ITENS_PADRAO.map(nome => ({ nome, concluido: false, observacao: '' }))
  );

  function toggleItem(idx: number) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, concluido: !item.concluido } : item));
  }

  function setObs(idx: number, obs: string) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, observacao: obs } : item));
  }

  function handleSalvar() {
    if (!titulo || !equipe || !responsavel) return;
    onSave({
      titulo, data, equipe, responsavel,
      itens: itens as ChecklistItem[],
      status: itens.every(i => i.concluido) ? 'concluido' : 'pendente',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8">
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} Checklist</h2>
          <button onClick={onCancel} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label className={labelCls}>Título *</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Checklist Diário" className={inputCls} /></div>
            <div><label className={labelCls}>Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Equipe *</label><select value={equipe} onChange={e => setEquipe(e.target.value)} className={inputCls}>{EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}</select></div>
            <div><label className={labelCls}>Responsável *</label><input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" className={inputCls} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Itens do Checklist</label>
              <span className="text-xs text-graphite-500">{itens.filter(i => i.concluido).length}/{itens.length} concluídos</span>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-graphite-200 p-3 dark:border-border-dark dark:bg-surface-hover">
                  <button onClick={() => toggleItem(idx)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${item.concluido ? 'border-green-500 bg-green-500' : 'border-graphite-400 dark:border-graphite-500'}`}>
                    {item.concluido && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.concluido ? 'text-green-700 line-through dark:text-green-400' : 'text-graphite-900 dark:text-graphite-100'}`}>{item.nome}</p>
                    <input value={item.observacao} onChange={e => setObs(idx, e.target.value)} placeholder="Observação..." className="mt-1 w-full rounded-lg border border-graphite-200 bg-white/70 px-2 py-1 text-xs outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
            <button onClick={onCancel} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700">Cancelar</button>
            <button onClick={handleSalvar} disabled={!titulo || !equipe || !responsavel}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg disabled:opacity-50">
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Checklists() {
  const { canManageGlobal } = useContextoOperacional();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { setChecklists(carregar()); }, []);

  const filtered = useMemo(() => {
    let lista = checklists;
    if (filterStatus) lista = lista.filter(c => c.status === filterStatus);
    if (search) {
      const t = search.toLowerCase();
      lista = lista.filter(c => c.titulo.toLowerCase().includes(t) || c.responsavel.toLowerCase().includes(t) || c.equipe.toLowerCase().includes(t));
    }
    return lista.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [checklists, search, filterStatus]);

  const stats = useMemo(() => ({
    total: checklists.length,
    concluidos: checklists.filter(c => c.status === 'concluido').length,
    pendentes: checklists.filter(c => c.status === 'pendente').length,
  }), [checklists]);

  function handleSave(data: Omit<Checklist, 'id' | 'createdAt'>) {
    if (!canManageGlobal) {
      alert('Apenas Administradores e GS podem alterar checklists.');
      return;
    }
    const lista = carregar();
    const now = new Date().toISOString();
    if (editando) {
      const idx = lista.findIndex(c => c.id === editando.id);
      if (idx >= 0) lista[idx] = { ...lista[idx], ...data };
    } else {
      lista.push({ id: crypto.randomUUID(), ...data, createdAt: now } as Checklist);
    }
    salvar(lista);
    setChecklists(lista);
    setFormOpen(false);
  }

  function handleDelete(id: string) {
    if (!canManageGlobal) {
      alert('Apenas Administradores e GS podem excluir checklists.');
      return;
    }
    const lista = carregar().filter(c => c.id !== id);
    salvar(lista);
    setChecklists(lista);
    setConfirmDelete(null);
  }

  return (
    <PageContainer>
      <PageTitle icon={ClipboardCheck} title="Checklists" />
      <div className="mb-4 grid grid-cols-3 gap-3 max-w-sm">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
          <p className="text-[10px] font-medium text-graphite-500">Total</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xl font-black text-green-700 dark:text-green-300">{stats.concluidos}</p>
          <p className="text-[10px] font-medium text-green-500">Concluídos</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xl font-black text-amber-700 dark:text-amber-300">{stats.pendentes}</p>
          <p className="text-[10px] font-medium text-amber-500">Pendentes</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className={`${inputCls} !pl-10`} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${inputCls} !w-auto`}>
          <option value="">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="concluido">Concluídos</option>
        </select>
        {canManageGlobal && (
          <button onClick={() => { setEditando(null); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Novo Checklist
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <ClipboardCheck className="mb-4 h-12 w-12 text-graphite-300" />
          <h3 className="text-lg font-semibold text-graphite-700">Nenhum checklist</h3>
          <p className="text-sm text-graphite-500">{canManageGlobal ? 'Clique em "Novo Checklist" para criar.' : 'Nenhum checklist disponível para visualização.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${c.status === 'concluido' ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-amber-500 to-amber-700'}`}>
                  {c.status === 'concluido' ? <CheckCircle className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{c.titulo}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${c.status === 'concluido' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>{c.status === 'concluido' ? 'Concluído' : 'Pendente'}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-graphite-500">{fmt(c.data)} · {c.equipe} · {c.responsavel} · {c.itens.filter(i => i.concluido).length}/{c.itens.length} itens</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => window.print()} className="rounded-xl p-1.5 text-aviation-500 hover:bg-aviation-50 hover:text-aviation-700 dark:hover:bg-aviation-900/20" title="Imprimir">
                    <Printer className="h-4 w-4" />
                  </button>
                  {canManageGlobal && (
                    <>
                      <button onClick={() => { setEditando(c); setFormOpen(true); }} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover" title="Editar">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(c.id)} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && canManageGlobal && <ChecklistForm onSave={handleSave} onCancel={() => setFormOpen(false)} editando={editando} />}

      {confirmDelete && canManageGlobal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir este checklist?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default Checklists;
