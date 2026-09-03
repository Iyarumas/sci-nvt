import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageTour } from '../../components/ui/PageTour';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  atualizarAgenteExtintor,
  criarAgenteExtintor,
  excluirAgenteExtintor,
  listarAgentesExtintores,
} from '../../services/agenteExtintorService';
import {
  CLASSE_AGENTE_EXTINTOR_OPTIONS,
  COMPOSICAO_AGENTE_EXTINTOR_OPTIONS,
  DOSAGEM_AGENTE_EXTINTOR_OPTIONS,
  PRODUTO_AGENTE_EXTINTOR_OPTIONS,
  STATUS_AGENTE_EXTINTOR_OPTIONS,
  UNIDADE_AGENTE_EXTINTOR_OPTIONS,
  tipoPorProduto,
  unidadePadraoPorProduto,
} from '../../types/agenteExtintor';
import type {
  AgenteExtintor,
  ClasseAgenteExtintor,
  ComposicaoAgenteExtintor,
  DosagemAgenteExtintor,
  ProdutoAgenteExtintor,
  StatusAgenteExtintor,
  UnidadeAgenteExtintor,
} from '../../types/agenteExtintor';
import { canGerenciarCadastroModulo, resolverContextoOperacional } from '../../utils/permissoes';
import { formatarDataBR } from '../../utils/datas';

type AgenteExtintorForm = Omit<AgenteExtintor, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

const INPUT_CLASS = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const LABEL_CLASS = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const UNIDADES_POR_PRODUTO: Record<ProdutoAgenteExtintor, UnidadeAgenteExtintor[]> = {
  LGE: ['L'],
  'Pó Químico Seco': ['kg'],
  Nitrogênio: ['BAR'],
};

const EMPTY: AgenteExtintorForm = {
  marcaAgente: '',
  produto: 'LGE',
  tipo: tipoPorProduto('LGE'),
  dosagem: '',
  classe: '',
  quantidade: 0,
  unidade: unidadePadraoPorProduto('LGE'),
  lote: '',
  validade: '',
  validadeEnsaioLaboratorial: '',
  validadeEnsaioFogo: '',
  fabricacao: '',
  composicao: '',
  testeHidrostatico: '',
  validadeTesteHidrostatico: '',
  validadeCilindro: '',
  localizacao: '',
  status: 'Disponível',
  observacoes: '',
};

const AGENTES_EXTINTORES_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Agentes Extintores',
    body: 'Esta tela controla LGE, Pó Químico Seco e Nitrogênio usados no combate a incêndio.',
    detail: 'As informações daqui ajudam a acompanhar marca, produto, quantidade, lote, validades e disponibilidade operacional.',
  },
  {
    selector: 'main button',
    title: 'Novo Agente',
    body: 'Este botão cadastra um novo agente extintor no estoque.',
    detail: 'Ao escolher o produto, o tipo é preenchido automaticamente conforme a classificação operacional.',
  },
  {
    selector: 'main input, main select',
    title: 'Pesquisa e filtros',
    body: 'A busca localiza agentes por marca, produto, tipo, lote, composição ou observações.',
    detail: 'Use os filtros para conferir rapidamente o que está disponível, vencido, em uso ou em manutenção.',
  },
  {
    selector: 'main table',
    title: 'Tabela de agentes',
    body: 'A tabela mostra cada agente cadastrado, quantidade, unidade, lote, validades e situação atual.',
    detail: 'Confira principalmente quantidade e validade, porque esses dados indicam se o material pode ser usado com segurança.',
  },
  {
    selector: 'main table button',
    title: 'Editar ou excluir',
    body: 'Os ícones da tabela permitem editar informações do agente ou excluir o registro, quando seu perfil tem permissão.',
    detail: 'Antes de excluir, confirme se o agente não deve permanecer no histórico ou no controle de estoque.',
  },
];

function formatDate(value: string): string {
  return formatarDataBR(value);
}

function normalizarBusca(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function unidadeOptions(produto: ProdutoAgenteExtintor) {
  const permitidas = new Set(UNIDADES_POR_PRODUTO[produto]);
  return UNIDADE_AGENTE_EXTINTOR_OPTIONS.filter(option => permitidas.has(option.value));
}

function limparCamposNaoUsados(produto: ProdutoAgenteExtintor, form: AgenteExtintorForm): AgenteExtintorForm {
  return {
    ...form,
    produto,
    tipo: tipoPorProduto(produto),
    unidade: unidadePadraoPorProduto(produto),
    dosagem: produto === 'LGE' ? form.dosagem : '',
    classe: produto === 'LGE' ? form.classe : '',
    validadeEnsaioLaboratorial: produto === 'LGE' ? form.validadeEnsaioLaboratorial : '',
    validadeEnsaioFogo: produto === 'LGE' ? form.validadeEnsaioFogo : '',
    validade: produto === 'Pó Químico Seco' ? form.validade : '',
    composicao: produto === 'Pó Químico Seco' ? form.composicao : '',
    testeHidrostatico: produto === 'Nitrogênio' ? form.testeHidrostatico : '',
    validadeTesteHidrostatico: produto === 'Nitrogênio' ? form.validadeTesteHidrostatico : '',
    validadeCilindro: produto === 'Nitrogênio' ? form.validadeCilindro : '',
  };
}

function resumoValidade(item: AgenteExtintor): string {
  if (item.produto === 'LGE') {
    const partes = [
      item.validadeEnsaioLaboratorial ? `Laboratorial: ${formatDate(item.validadeEnsaioLaboratorial)}` : '',
      item.validadeEnsaioFogo ? `Fogo: ${formatDate(item.validadeEnsaioFogo)}` : '',
    ].filter(Boolean);
    return partes.join(' · ') || '-';
  }

  if (item.produto === 'Nitrogênio') {
    const partes = [
      item.validadeTesteHidrostatico ? `Teste hidrostático: ${formatDate(item.validadeTesteHidrostatico)}` : '',
      item.validadeCilindro ? `Cilindro: ${formatDate(item.validadeCilindro)}` : '',
    ].filter(Boolean);
    return partes.join(' · ') || '-';
  }

  return formatDate(item.validade);
}

export function AgentesExtintores() {
  const { user } = useAuth();
  const [lista, setLista] = useState<AgenteExtintor[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [termo, setTermo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProduto, setFilterProduto] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<AgenteExtintor | null>(null);
  const [form, setForm] = useState<AgenteExtintorForm>(EMPTY);
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

  const filtrados = useMemo(() => {
    const termoLower = normalizarBusca(debouncedTermo);
    return lista.filter(item => {
      const matchTermo = !termoLower || [
        item.marcaAgente,
        item.produto,
        item.tipo,
        item.lote,
        item.composicao,
        item.observacoes,
      ].some(value => normalizarBusca(value).includes(termoLower));
      const matchStatus = !filterStatus || item.status === filterStatus;
      const matchProduto = !filterProduto || item.produto === filterProduto;
      return matchTermo && matchStatus && matchProduto;
    });
  }, [lista, debouncedTermo, filterStatus, filterProduto]);

  function openNew() {
    if (!canManage) return;
    setEditando(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(item: AgenteExtintor) {
    if (!canManage) return;
    setEditando(item);
    setForm(limparCamposNaoUsados(item.produto, {
      marcaAgente: item.marcaAgente,
      produto: item.produto,
      tipo: item.tipo,
      dosagem: item.dosagem,
      classe: item.classe,
      quantidade: item.quantidade,
      unidade: item.unidade,
      lote: item.lote,
      validade: item.validade,
      validadeEnsaioLaboratorial: item.validadeEnsaioLaboratorial,
      validadeEnsaioFogo: item.validadeEnsaioFogo,
      fabricacao: item.fabricacao,
      composicao: item.composicao,
      testeHidrostatico: item.testeHidrostatico,
      validadeTesteHidrostatico: item.validadeTesteHidrostatico,
      validadeCilindro: item.validadeCilindro,
      localizacao: item.localizacao,
      status: item.status,
      observacoes: item.observacoes,
    }));
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    const payload = limparCamposNaoUsados(form.produto, form);
    try {
      if (editando) {
        await atualizarAgenteExtintor(editando.id, payload);
      } else {
        await criarAgenteExtintor({ ...payload, createdBy: user?.username || '' });
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

  function updateField<K extends keyof AgenteExtintorForm>(key: K, value: AgenteExtintorForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function updateProduto(produto: ProdutoAgenteExtintor) {
    setForm(prev => limparCamposNaoUsados(produto, prev));
  }

  const statusColor = (status: StatusAgenteExtintor) =>
    STATUS_AGENTE_EXTINTOR_OPTIONS.find(o => o.value === status)?.color || '';

  const inputReadOnlyClass = `${INPUT_CLASS} cursor-not-allowed bg-graphite-50 text-graphite-600 dark:bg-surface-card dark:text-graphite-300`;

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
            placeholder="Pesquisar por marca, produto, lote ou observações..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
          />
        </div>
        <select value={filterProduto} onChange={e => setFilterProduto(e.target.value)}
          className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os produtos</option>
          {PRODUTO_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Marca do Agente</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Produto</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Tipo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Quantidade</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Lote</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Validade</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(item => (
                <tr key={item.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{item.marcaAgente || '-'}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.produto}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.tipo}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.quantidade} {item.unidade}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{item.lote || '-'}</td>
                  <td className="px-4 py-3 text-xs text-graphite-700 dark:text-graphite-300">{resumoValidade(item)}</td>
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
          <div className="relative w-full max-w-3xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar Agente Extintor' : 'Novo Agente Extintor'}</h3>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Produto</label>
                <select value={form.produto} onChange={e => updateProduto(e.target.value as ProdutoAgenteExtintor)} className={INPUT_CLASS}>
                  {PRODUTO_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo</label>
                <input value={form.tipo} readOnly className={inputReadOnlyClass} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Marca do Agente</label>
                <input value={form.marcaAgente} onChange={e => updateField('marcaAgente', e.target.value)} className={INPUT_CLASS} placeholder="Ex: Buckeye, Amerex, Kidde..." />
              </div>
              <div>
                <label className={LABEL_CLASS}>Lote</label>
                <input value={form.lote} onChange={e => updateField('lote', e.target.value)} className={INPUT_CLASS} />
              </div>

              {form.produto === 'LGE' && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Dosagem</label>
                    <select value={form.dosagem} onChange={e => updateField('dosagem', e.target.value as DosagemAgenteExtintor)} className={INPUT_CLASS}>
                      {DOSAGEM_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value || 'empty'} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Classe</label>
                    <select value={form.classe} onChange={e => updateField('classe', e.target.value as ClasseAgenteExtintor)} className={INPUT_CLASS}>
                      {CLASSE_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value || 'empty'} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Validade do Ensaio Laboratorial</label>
                    <input type="date" value={form.validadeEnsaioLaboratorial} onChange={e => updateField('validadeEnsaioLaboratorial', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Validade do Ensaio de Fogo</label>
                    <input type="date" value={form.validadeEnsaioFogo} onChange={e => updateField('validadeEnsaioFogo', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Fabricação</label>
                    <input type="date" value={form.fabricacao} onChange={e => updateField('fabricacao', e.target.value)} className={INPUT_CLASS} />
                  </div>
                </>
              )}

              {form.produto === 'Pó Químico Seco' && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Composição</label>
                    <select value={form.composicao} onChange={e => updateField('composicao', e.target.value as ComposicaoAgenteExtintor)} className={INPUT_CLASS}>
                      {COMPOSICAO_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value || 'empty'} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Fabricação</label>
                    <input type="date" value={form.fabricacao} onChange={e => updateField('fabricacao', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Validade</label>
                    <input type="date" value={form.validade} onChange={e => updateField('validade', e.target.value)} className={INPUT_CLASS} />
                  </div>
                </>
              )}

              {form.produto === 'Nitrogênio' && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Fabricação</label>
                    <input type="date" value={form.fabricacao} onChange={e => updateField('fabricacao', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Teste Hidrostático</label>
                    <input type="date" value={form.testeHidrostatico} onChange={e => updateField('testeHidrostatico', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Validade do Teste Hidrostático</label>
                    <input type="date" value={form.validadeTesteHidrostatico} onChange={e => updateField('validadeTesteHidrostatico', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Validade Cilindro</label>
                    <input type="date" value={form.validadeCilindro} onChange={e => updateField('validadeCilindro', e.target.value)} className={INPUT_CLASS} />
                  </div>
                </>
              )}

              <div>
                <label className={LABEL_CLASS}>Quantidade</label>
                <input type="number" min="0" step="0.01" value={form.quantidade} onChange={e => updateField('quantidade', Number(e.target.value || 0))} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Unidade</label>
                <select value={form.unidade} onChange={e => updateField('unidade', e.target.value as UnidadeAgenteExtintor)} className={INPUT_CLASS}>
                  {unidadeOptions(form.produto).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select value={form.status} onChange={e => updateField('status', e.target.value as StatusAgenteExtintor)} className={INPUT_CLASS}>
                  {STATUS_AGENTE_EXTINTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Observações</label>
                <textarea value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} className={INPUT_CLASS} rows={3} />
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
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar Exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-400">Tem certeza que deseja excluir este agente extintor? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-alert-red px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={AGENTES_EXTINTORES_TOUR_STEPS}
        targetAttribute="data-agentes-extintores-tour"
        title="Abrir tutorial de Agentes Extintores"
      />
    </PageContainer>
  );
}

export default AgentesExtintores;
