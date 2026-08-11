import { useEffect, useState } from 'react';
import { AlertCircle, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  atualizarAgenteExtintor,
  criarAgenteExtintor,
  excluirAgenteExtintor,
  listarAgentesExtintores,
} from '../../services/agenteExtintorService';
import {
  STATUS_AGENTE_EXTINTOR_OPTIONS,
  TIPO_AGENTE_EXTINTOR_OPTIONS,
  UNIDADE_AGENTE_EXTINTOR_OPTIONS,
} from '../../types/agenteExtintor';
import type {
  AgenteExtintor,
  StatusAgenteExtintor,
  TipoAgenteExtintor,
  UnidadeAgenteExtintor,
} from '../../types/agenteExtintor';
import { canGerenciarCadastroModulo, resolverContextoOperacional } from '../../utils/permissoes';

const INPUT_CLASS = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const LABEL_CLASS = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const EMPTY: Omit<AgenteExtintor, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  nome: '',
  tipo: 'LGE',
  quantidade: 0,
  unidade: 'L',
  lote: '',
  validade: '',
  localizacao: '',
  status: 'Disponivel',
  observacoes: '',
};

function formatDate(value: string): string {
  if (!value) return '-';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

export function AgentesExtintores() {
  const { user } = useAuth();
  const [lista, setLista] = useState<AgenteExtintor[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<AgenteExtintor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const debouncedTermo = useDebounce(termo, 400);

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    let cancelled = false;
    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManage(canGerenciarCadastroModulo(contexto, 'agentesExtintores'));
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  async function carregar() {
    setLista(await listarAgentesExtintores());
  }

  const filtrados = lista.filter(item => {
    const termoLower = debouncedTermo.toLowerCase();
    const matchTermo = !debouncedTermo ||
      item.nome.toLowerCase().includes(termoLower) ||
      item.lote.toLowerCase().includes(termoLower) ||
      item.localizacao.toLowerCase().includes(termoLower);
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchTipo = !filterTipo || item.tipo === filterTipo;
    return matchTermo && matchStatus && matchTipo;
  });

  function openNew() {
    if (!canManage) return;
    setEditando(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(item: AgenteExtintor) {
    if (!canManage) return;
    setEditando(item);
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      quantidade: item.quantidade,
      unidade: item.unidade,
      lote: item.lote,
      validade: item.validade,
      localizacao: item.localizacao,
      status: item.status,
      observacoes: item.observacoes,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    try {
      if (editando) {
        await atualizarAgenteExtintor(editando.id, form);
      } else {
        await criarAgenteExtintor({ ...form, createdBy: user?.username || '' });
      }
      setFormOpen(false);
      carregar();
    } catch (err) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    try {
      await excluirAgenteExtintor(id);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const statusColor = (status: StatusAgenteExtintor) =>
    STATUS_AGENTE_EXTINTOR_OPTIONS.find(o => o.value === status)?.color || '';

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Package} title="Agentes Extintores" />
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
            <Plus className="h-4 w-4" /> Novo Agente
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Pesquisar por agente, lote ou localizacao..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
          />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os tipos</option>
          {TIPO_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os status</option>
          {STATUS_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="mb-4 flex items-center gap-3 text-sm text-graphite-500 dark:text-graphite-400">
        <span>Total: <strong className="text-graphite-700 dark:text-graphite-200">{filtrados.length}</strong> agentes</span>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Package className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum agente extintor encontrado</h3>
          <p className="text-sm text-graphite-400">{canManage ? 'Clique em "Novo Agente" para cadastrar.' : 'Nenhum agente cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Agente</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Tipo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Quantidade</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Lote</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Validade</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Localizacao</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(item => (
                <tr key={item.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{item.nome || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{TIPO_AGENTE_EXTINTOR_OPTIONS.find(t => t.value === item.tipo)?.label || item.tipo}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.quantidade} {item.unidade}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.lote || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{formatDate(item.validade)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.localizacao || '-'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>{item.status}</span></td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(item.id)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pb-10 pt-10" onClick={() => setFormOpen(false)}>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar Agente Extintor' : 'Novo Agente Extintor'}</h3>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Nome do Agente</label>
                <input value={form.nome} onChange={e => updateField('nome', e.target.value)} className={INPUT_CLASS} placeholder="Ex: LGE 3%, PQS ABC" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo</label>
                <select value={form.tipo} onChange={e => updateField('tipo', e.target.value as TipoAgenteExtintor)} className={INPUT_CLASS}>
                  {TIPO_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Quantidade</label>
                <input type="number" min="0" step="0.01" value={form.quantidade} onChange={e => updateField('quantidade', Number(e.target.value || 0))} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Unidade</label>
                <select value={form.unidade} onChange={e => updateField('unidade', e.target.value as UnidadeAgenteExtintor)} className={INPUT_CLASS}>
                  {UNIDADE_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Lote</label>
                <input value={form.lote} onChange={e => updateField('lote', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Validade</label>
                <input type="date" value={form.validade} onChange={e => updateField('validade', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Localizacao</label>
                <input value={form.localizacao} onChange={e => updateField('localizacao', e.target.value)} className={INPUT_CLASS} placeholder="Ex: CCI, almoxarifado, viatura..." />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select value={form.status} onChange={e => updateField('status', e.target.value as StatusAgenteExtintor)} className={INPUT_CLASS}>
                  {STATUS_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Observacoes</label>
                <textarea value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} className={INPUT_CLASS} rows={2} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-graphite-600 transition-colors hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">Cancelar</button>
              <button onClick={handleSave} className="rounded-xl bg-aviation-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
                {editando ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-alert-red" />
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar Exclusao</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-400">Tem certeza que deseja excluir este agente extintor? Esta acao nao pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-alert-red px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default AgentesExtintores;
