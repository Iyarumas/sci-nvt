import { useState, useEffect } from 'react';
import { Droplets, Search, Plus, Pencil, Trash2, AlertCircle, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarHidrantes, criarHidrante, atualizarHidrante, excluirHidrante } from '../../services/hidranteService';
import type { Hidrante, TipoHidrante, StatusHidrante } from '../../types/hidrante';
import { TIPO_HIDRANTE_OPTIONS, STATUS_HIDRANTE_OPTIONS, INTERVALO_CONFERENCIA_OPTIONS } from '../../types/hidrante';
import { useDebounce } from '../../hooks/useDebounce';
import { canGerenciarCadastroModulo, resolverContextoOperacional } from '../../utils/permissoes';

const INPUT_CLASS = "w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark";
const LABEL_CLASS = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const EMPTY: Omit<Hidrante, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  numero: '',
  tipo: 'Seco',
  localizacao: '',
  pressao: '',
  status: 'Ativo',
  intervaloConferencia: '6',
  observacoes: '',
};

export function Hidrantes() {
  const { user } = useAuth();

  const [lista, setLista] = useState<Hidrante[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Hidrante | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const debouncedTermo = useDebounce(termo, 400);

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    let cancelled = false;
    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManage(canGerenciarCadastroModulo(contexto, 'hidrantes'));
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  async function carregar() {
    setLista(await listarHidrantes());
  }

  const filtrados = lista.filter(h => {
    const matchTermo = !debouncedTermo ||
      h.numero.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      h.localizacao.toLowerCase().includes(debouncedTermo.toLowerCase());
    const matchStatus = !filterStatus || h.status === filterStatus;
    return matchTermo && matchStatus;
  });

  function openNew() {
    if (!canManage) return;
    setEditando(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(h: Hidrante) {
    if (!canManage) return;
    setEditando(h);
    setForm({
      numero: h.numero,
      tipo: h.tipo,
      localizacao: h.localizacao,
      pressao: h.pressao,
      status: h.status,
      intervaloConferencia: h.intervaloConferencia,
      observacoes: h.observacoes,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    try {
      if (editando) {
        await atualizarHidrante(editando.id, form);
      } else {
        await criarHidrante({ ...form, createdBy: user?.username || '' });
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
      await excluirHidrante(id);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const statusColor = (s: StatusHidrante) =>
    STATUS_HIDRANTE_OPTIONS.find(o => o.value === s)?.color || '';

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Droplets} title="Hidrantes" />
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
            <Plus className="h-4 w-4" /> Novo Hidrante
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text" value={termo} onChange={e => setTermo(e.target.value)}
            placeholder="Pesquisar por nº hidrante, localização..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os Status</option>
          {STATUS_HIDRANTE_OPTIONS.map(o => <option key={o.value} value={o.value} className="dark:bg-graphite-700 dark:text-graphite-100">{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-3 mb-4 text-sm text-graphite-500 dark:text-graphite-400">
        <span>Total: <strong className="text-graphite-700 dark:text-graphite-200">{filtrados.length}</strong> hidrantes</span>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Droplets className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum hidrante encontrado</h3>
          <p className="text-sm text-graphite-400">{canManage ? 'Clique em "Novo Hidrante" para cadastrar.' : 'Nenhum hidrante cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nº Hidrante</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Tipo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Localização</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Pressão</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Intervalo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(h => (
                <tr key={h.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{h.numero || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{TIPO_HIDRANTE_OPTIONS.find(t => t.value === h.tipo)?.label || h.tipo}</td>
                <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{h.localizacao || '-'}</td>
                <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{h.pressao || '-'}</td>
                <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{INTERVALO_CONFERENCIA_OPTIONS.find(o => o.value === h.intervaloConferencia)?.label || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(h.status)}`}>{h.status}</span></td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(h)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(h.id)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400">
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10" onClick={() => setFormOpen(false)}>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar Hidrante' : 'Novo Hidrante'}</h3>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Nº Hidrante</label>
                <input type="text" value={form.numero} onChange={e => updateField('numero', e.target.value)} className={INPUT_CLASS} placeholder="Número de identificação" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo</label>
                <select value={form.tipo} onChange={e => updateField('tipo', e.target.value as TipoHidrante)} className={INPUT_CLASS}>
                  {TIPO_HIDRANTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Localização</label>
                <input type="text" value={form.localizacao} onChange={e => updateField('localizacao', e.target.value)} className={INPUT_CLASS} placeholder="Ex: Terminal 1, Pátio" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Pressão</label>
                <input type="text" value={form.pressao} onChange={e => updateField('pressao', e.target.value)} className={INPUT_CLASS} placeholder="Ex: 10 bar" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Intervalo de Conferência</label>
                <select value={form.intervaloConferencia} onChange={e => updateField('intervaloConferencia', e.target.value as any)} className={INPUT_CLASS}>
                  {INTERVALO_CONFERENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select value={form.status} onChange={e => updateField('status', e.target.value as StatusHidrante)} className={INPUT_CLASS}>
                  {STATUS_HIDRANTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Observações</label>
                <textarea value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} className={INPUT_CLASS} rows={2} placeholder="Observações adicionais..." />
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
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-alert-red" />
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar Exclusão</h3>
            </div>
            <p className="text-sm text-graphite-600 dark:text-graphite-400 mb-6">Tem certeza que deseja excluir este hidrante? Esta ação não pode ser desfeita.</p>
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

export default Hidrantes;
