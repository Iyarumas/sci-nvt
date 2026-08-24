import { useState, useEffect } from 'react';
import { Flame, Search, Plus, Pencil, Trash2, AlertCircle, X, Check } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageTour } from '../../components/ui/PageTour';
import { useAuth } from '../../context/AuthContext';
import { listarExtintores, criarExtintor, atualizarExtintor, excluirExtintor } from '../../services/extintorService';
import type { Extintor, TipoExtintor, SeloInmetro, StatusExtintor } from '../../types/extintor';
import { TIPO_EXTINTOR_OPTIONS, CAPACIDADE_OPTIONS, STATUS_EXTINTOR_OPTIONS, INTERVALO_CONFERENCIA_OPTIONS } from '../../types/extintor';
import { useDebounce } from '../../hooks/useDebounce';
import { canGerenciarCadastroModulo, resolverContextoOperacional } from '../../utils/permissoes';
import { formatarDataBR } from '../../utils/datas';

const INPUT_CLASS = "w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark";
const LABEL_CLASS = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const EMPTY: Omit<Extintor, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  numeroSerie: '',
  tipo: 'ABC',
  capacidade: '',
  dataFabricacao: '',
  seloInmetro: 'Nao',
  numeroExtintor: '',
  localizacao: '',
  status: 'Ativo',
  intervaloConferencia: '6',
  observacoes: '',
};

const EXTINTORES_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Cadastro de Extintores',
    body: 'Esta tela controla os extintores instalados ou disponíveis, com número, tipo, capacidade, fabricação, selo INMETRO, localização e status.',
    detail: 'O objetivo é manter o inventário confiável para inspeções, conferências e segurança operacional.',
  },
  {
    selector: 'main button',
    title: 'Novo Extintor',
    body: 'Este botão abre o cadastro de um extintor novo.',
    detail: 'Preencha número de série, número do extintor, tipo, capacidade, fabricação, INMETRO e localização para evitar duplicidade ou item sem rastreio.',
  },
  {
    selector: 'main input, main select',
    title: 'Busca e status',
    body: 'A busca encontra extintores por número de série, número do extintor ou localização. O filtro de status separa ativos, manutenção, inativos e outras situações.',
    detail: 'Use antes de cadastrar para confirmar se o extintor já existe no sistema.',
  },
  {
    selector: 'main table',
    title: 'Tabela de extintores',
    body: 'A tabela apresenta identificação, tipo, capacidade, data de fabricação, selo INMETRO, localização e status.',
    detail: 'Esses dados permitem saber onde o extintor está, se está em condição de uso e se precisa de conferência.',
  },
  {
    selector: 'main table button',
    title: 'Ações do registro',
    body: 'Os ícones permitem editar informações ou excluir um extintor, quando o usuário tem permissão.',
    detail: 'Prefira editar o status quando o extintor existir fisicamente; exclua apenas cadastro realmente incorreto.',
  },
];

export function Extintores() {
  const { user } = useAuth();

  const [lista, setLista] = useState<Extintor[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Extintor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const debouncedTermo = useDebounce(termo, 400);

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    let cancelled = false;
    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManage(canGerenciarCadastroModulo(contexto, 'extintores'));
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  async function carregar() {
    setLista(await listarExtintores());
  }

  const filtrados = lista.filter(e => {
    const matchTermo = !debouncedTermo ||
      e.numeroSerie.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      e.numeroExtintor.toLowerCase().includes(debouncedTermo.toLowerCase()) ||
      e.localizacao.toLowerCase().includes(debouncedTermo.toLowerCase());
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchTermo && matchStatus;
  });

  function openNew() {
    if (!canManage) return;
    setEditando(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(e: Extintor) {
    if (!canManage) return;
    setEditando(e);
    setForm({
      numeroSerie: e.numeroSerie,
      tipo: e.tipo,
      capacidade: e.capacidade,
      dataFabricacao: e.dataFabricacao,
      seloInmetro: e.seloInmetro,
      numeroExtintor: e.numeroExtintor,
      localizacao: e.localizacao,
      status: e.status,
      intervaloConferencia: e.intervaloConferencia,
      observacoes: e.observacoes,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    try {
      if (editando) {
        await atualizarExtintor(editando.id, form);
      } else {
        await criarExtintor({ ...form, createdBy: user?.username || '' });
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
      await excluirExtintor(id);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const statusColor = (s: StatusExtintor) =>
    STATUS_EXTINTOR_OPTIONS.find(o => o.value === s)?.color || '';

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Flame} title="Extintores" />
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
            <Plus className="h-4 w-4" /> Novo Extintor
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text" value={termo} onChange={e => setTermo(e.target.value)}
            placeholder="Pesquisar por nº série, nº extintor, localização..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os Status</option>
          {STATUS_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value} className="dark:bg-graphite-700 dark:text-graphite-100">{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-3 mb-4 text-sm text-graphite-500 dark:text-graphite-400">
        <span>Total: <strong className="text-graphite-700 dark:text-graphite-200">{filtrados.length}</strong> extintores</span>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Flame className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum extintor encontrado</h3>
          <p className="text-sm text-graphite-400">{canManage ? 'Clique em "Novo Extintor" para cadastrar.' : 'Nenhum extintor cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nº Extintor</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nº Série</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Tipo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Capacidade</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Fabricação</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">INMETRO</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Localização</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(e => (
                <tr key={e.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{e.numeroExtintor || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{e.numeroSerie || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{TIPO_EXTINTOR_OPTIONS.find(t => t.value === e.tipo)?.label || e.tipo}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{e.capacidade || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{formatarDataBR(e.dataFabricacao)}</td>
                  <td className="px-4 py-3">
                    {e.seloInmetro === 'Sim' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        <Check className="h-3 w-3" /> Sim
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-graphite-100 px-2 py-0.5 text-xs font-medium text-graphite-500 dark:bg-graphite-700 dark:text-graphite-400">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{e.localizacao || '-'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(e.status)}`}>{e.status}</span></td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(e.id)} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400">
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
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar Extintor' : 'Novo Extintor'}</h3>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Nº Série</label>
                <input type="text" value={form.numeroSerie} onChange={e => updateField('numeroSerie', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo</label>
                <select value={form.tipo} onChange={e => updateField('tipo', e.target.value as TipoExtintor)} className={INPUT_CLASS}>
                  {TIPO_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Capacidade</label>
                <select value={form.capacidade} onChange={e => updateField('capacidade', e.target.value)} className={INPUT_CLASS}>
                  <option value="">Selecione...</option>
                  {CAPACIDADE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Data de Fabricação</label>
                <input type="date" value={form.dataFabricacao} onChange={e => updateField('dataFabricacao', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Selo INMETRO</label>
                <select value={form.seloInmetro} onChange={e => updateField('seloInmetro', e.target.value as SeloInmetro)} className={INPUT_CLASS}>
                  <option value="Sim">Sim</option>
                  <option value="Nao">Não</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Nº do Extintor</label>
                <input type="text" value={form.numeroExtintor} onChange={e => updateField('numeroExtintor', e.target.value)} className={INPUT_CLASS} placeholder="Número de identificação no local" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Localização</label>
                <input type="text" value={form.localizacao} onChange={e => updateField('localizacao', e.target.value)} className={INPUT_CLASS} placeholder="Ex: Terminal 1, Bloco B" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select value={form.status} onChange={e => updateField('status', e.target.value as StatusExtintor)} className={INPUT_CLASS}>
                  {STATUS_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Intervalo de Conferência</label>
                <select value={form.intervaloConferencia} onChange={e => updateField('intervaloConferencia', e.target.value as any)} className={INPUT_CLASS}>
                  {INTERVALO_CONFERENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <p className="text-sm text-graphite-600 dark:text-graphite-400 mb-6">Tem certeza que deseja excluir este extintor? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-alert-red px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={EXTINTORES_TOUR_STEPS}
        targetAttribute="data-extintores-tour"
        title="Abrir tutorial de Extintores"
      />
    </PageContainer>
  );
}

export default Extintores;
