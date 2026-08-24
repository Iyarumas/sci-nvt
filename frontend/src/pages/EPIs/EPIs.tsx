import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HardHat, Plus, Save, Pencil, Trash2, AlertTriangle, Search, X,
  DollarSign, RotateCcw, ChevronDown, ChevronRight,
  User, CheckCircle2, Bell, Package, Eye,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarBombeiros } from '../../services/bombeiroService';
import {
  listarEPIs, criarEPI,
} from '../../services/epiService';
import {
  listarEstoque, criarEstoque, atualizarEstoque, excluirEstoque,
  baixarEstoque, reporEstoque,
} from '../../services/epiEstoqueService';
import {
  CATEGORIAS_EPI, EPI_STATUS_LABELS, EPI_STATUS_COLORS,
  ESTADO_CONSERVACAO_OPTIONS, TAMANHOS_EPI,
  getDiasParaVencer, getPrioridade, getLabelValidade,
  calcularDataValidade, getDiasParaVencerLabel,
} from '../../types/epi';
import type { EPI, EPIEstoque, EstadoConservacao } from '../../types/epi';
import type { Bombeiro } from '../../types/bombeiro';
import {
  canAcessarDadosPessoais,
  podeVerDadosPessoaisBase,
  resolverContextoOperacional,
} from '../../utils/permissoes';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';

type Tab = 'funcionarios' | 'epis';

const DURACAO_PLANTAO_MS = 12 * 60 * 60 * 1000;
const PLANTOES_PARA_NOTIFICAR = 3;
const INTERVALO_NOTIFICACAO_MS = PLANTOES_PARA_NOTIFICAR * DURACAO_PLANTAO_MS;

const EPIS_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Controle de EPIs',
    body: 'Esta tela controla os EPIs em estoque e os EPIs entregues aos funcionários.',
    detail: 'O sistema acompanha CA, validade, estado de conservação, quantidade em estoque, pagamento ao bombeiro e devolução. Também avisa sobre vencidos e itens próximos ao vencimento.',
  },
  {
    selector: 'main div.mb-4.flex.gap-1',
    title: 'Abas Funcionários e EPIs',
    body: 'A aba Funcionários mostra cada pessoa e os EPIs vinculados a ela. A aba EPIs mostra o estoque e a lista geral de itens entregues.',
    detail: 'Use Funcionários para pagar ou devolver EPI por pessoa. Use EPIs para cadastrar estoque, editar quantidade, acompanhar validade e conferir todos os itens entregues.',
  },
  {
    selector: 'main select, main input',
    title: 'Filtros e pesquisa',
    body: 'Na aba Funcionários, filtre por equipe, função e situação da validade. A busca localiza pessoas ou EPIs conforme a aba aberta.',
    detail: 'Os filtros de vencido, crítico e atenção ajudam a encontrar rapidamente quem precisa trocar EPI antes do prazo ficar irregular.',
  },
  {
    selector: 'main .space-y-2, main table',
    title: 'Ficha por funcionário',
    body: 'Na aba Funcionários, cada ficha mostra os EPIs ativos e vencimentos daquele bombeiro.',
    detail: 'Use Pagar EPI para entregar um item do estoque e Devolver EPI para baixar o item da pessoa. Se o EPI estiver em bom estado, ele pode voltar ao estoque conforme a regra da tela.',
  },
  {
    selector: 'main table',
    title: 'Estoque e entregues',
    body: 'Na aba EPIs, a primeira tabela acompanha o estoque e a segunda mostra EPIs entregues.',
    detail: 'No estoque ficam CA, quantidade, tamanho, fabricação, validade e estado. Nos entregues ficam colaborador, responsável pela entrega, data de pagamento, validade, estado e status.',
  },
  {
    selector: 'main button',
    title: 'Cadastrar EPI no estoque',
    body: 'Quando estiver na aba EPIs, o botão Cadastrar EPI no Estoque abre o formulário do item.',
    detail: 'Cadastre nome, descrição, CA, categoria, fornecedor, fabricação, validade ou tempo de validade, quantidade, tamanho, estado e número de série para o pagamento sair correto depois.',
  },
];

function getControleNotificacao(username: string): { ultima: string } | null {
  try {
    const raw = localStorage.getItem('epi-notif-control');
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, { ultima: string }>;
    return data[username] || null;
  } catch { return null; }
}

function setControleNotificacao(username: string) {
  try {
    const raw = localStorage.getItem('epi-notif-control');
    const data: Record<string, { ultima: string }> = raw ? JSON.parse(raw) : {};
    data[username] = { ultima: new Date().toISOString() };
    localStorage.setItem('epi-notif-control', JSON.stringify(data));
  } catch { /* ignore */ }
}

export function EPIs() {
  const { user } = useAuth();
  const username = user?.username || '';
  const [canDeleteEpis, setCanDeleteEpis] = useState(() => podeVerDadosPessoaisBase(user));
  const canManage = true;

  const [tab, setTab] = useState<Tab>('funcionarios');
  const [epis, setEpis] = useState<EPI[]>([]);
  const [funcionarios, setFuncionarios] = useState<Bombeiro[]>([]);
  const [estoque, setEstoque] = useState<EPIEstoque[]>([]);
  const [termo, setTermo] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroFuncao, setFiltroFuncao] = useState('');
  const [filtroValidade, setFiltroValidade] = useState('');
  const [showNotificacoes, setShowNotificacoes] = useState(false);
  const [formEstoqueOpen, setFormEstoqueOpen] = useState(false);
  const [editandoEstoque, setEditandoEstoque] = useState<EPIEstoque | null>(null);
  const [pagarEpiState, setPagarEpiState] = useState<{ bombeiro: Bombeiro } | null>(null);
  const [devolverEpiState, setDevolverEpiState] = useState<{ bombeiro: Bombeiro } | null>(null);
  const [confirmDeleteEstoque, setConfirmDeleteEstoque] = useState<string | null>(null);
  const [confirmDeleteEpi, setConfirmDeleteEpi] = useState<string | null>(null);
  const [confirmPagar, setConfirmPagar] = useState<{ estoque: EPIEstoque; bombeiro: Bombeiro } | null>(null);
  const [confirmDevolver, setConfirmDevolver] = useState<{ epi: EPI; bombeiro: Bombeiro } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCanDeleteEpis(podeVerDadosPessoaisBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanDeleteEpis(canAcessarDadosPessoais(contexto));
      })
      .catch(() => {
        if (!cancelled) setCanDeleteEpis(podeVerDadosPessoaisBase(user));
      });

    return () => { cancelled = true; };
  }, [user]);

  async function carregar() {
    const [episData, funcsData, estoqueData] = await Promise.all([listarEPIs(), listarBombeiros(), listarEstoque()]);
    setEpis(episData);
    setFuncionarios(funcsData);
    setEstoque(estoqueData);
  }
  useEffect(() => { carregar(); }, []);

  const notificacoes = useMemo(() => {
    const vencidos: { epi: EPI; func: Bombeiro | undefined }[] = [];
    const criticos: { epi: EPI; func: Bombeiro | undefined }[] = [];
    const atencao: { epi: EPI; func: Bombeiro | undefined }[] = [];

    epis.forEach(epi => {
      if (epi.status === 'devolvido' || !epi.dataValidade) return;
      const prioridade = getPrioridade(epi.dataValidade);
      const func = funcionarios.find(f => f.id === epi.colaboradorId || f.nomeGuerra === epi.colaborador);
      if (prioridade === 'vencido') vencidos.push({ epi, func });
      else if (prioridade === 'critico') criticos.push({ epi, func });
      else if (prioridade === 'atencao') atencao.push({ epi, func });
    });

    return { vencidos, criticos, atencao };
  }, [epis, funcionarios]);

  const deveMostrarNotificacao = useMemo(() => {
    if (notificacoes.vencidos.length === 0 && notificacoes.criticos.length === 0 && notificacoes.atencao.length === 0) return false;
    const controle = getControleNotificacao(username);
    if (!controle) return true;
    const tempoDecorrido = Date.now() - new Date(controle.ultima).getTime();
    return tempoDecorrido >= INTERVALO_NOTIFICACAO_MS;
  }, [username, notificacoes]);

  const dismissNotificacao = useCallback(() => {
    setControleNotificacao(username);
    setShowNotificacoes(false);
  }, [username]);

  useEffect(() => {
    if (deveMostrarNotificacao) setShowNotificacoes(true);
  }, [deveMostrarNotificacao]);

  const filtradas = useMemo(() => {
    if (!termo) return epis;
    const t = termo.toLowerCase();
    return epis.filter(e =>
      e.nome.toLowerCase().includes(t) ||
      e.colaborador.toLowerCase().includes(t) ||
      e.descricao.toLowerCase().includes(t) ||
      e.fornecedor.toLowerCase().includes(t)
    );
  }, [epis, termo]);

  const funcionariosFiltrados = useMemo(() => {
    let lista = funcionarios;
    if (filtroEquipe) lista = lista.filter(f => f.equipe === filtroEquipe);
    if (filtroFuncao) lista = lista.filter(f => f.cargo === filtroFuncao);
    if (termo) {
      const t = termo.toLowerCase();
      lista = lista.filter(f =>
        f.nomeGuerra.toLowerCase().includes(t) ||
        f.nomeCompleto.toLowerCase().includes(t)
      );
    }
    if (filtroValidade) {
      lista = lista.filter(f => {
        const episDoFunc = epis.filter(e => (e.colaboradorId === f.id || e.colaborador === f.nomeGuerra) && e.status !== 'devolvido');
        return episDoFunc.some(e => {
          const p = getPrioridade(e.dataValidade);
          return (filtroValidade === 'vencido' && p === 'vencido') ||
                 (filtroValidade === 'critico' && p === 'critico') ||
                 (filtroValidade === 'atencao' && p === 'atencao');
        });
      });
    }
    return lista;
  }, [funcionarios, filtroEquipe, filtroFuncao, termo, filtroValidade, epis]);

  const episEntregues = useMemo(() => {
    return filtradas.filter(e => e.status !== 'devolvido');
  }, [filtradas]);

  const estoqueComValidade = useMemo(() => {
    return estoque.map(e => ({
      ...e,
      dataValidadeFinal: e.dataValidade || calcularDataValidade(e.dataFabricacao, e.tempoValidadeMeses),
    }));
  }, [estoque]);

  async function handlePagarEpiDireto(itemEstoque: EPIEstoque, bombeiro: Bombeiro) {
    const hoje = hojeLocalISO();
    const nomeLogado = user?.pessoa?.nomeGuerra || user?.name || username;
    const dataValidadeFinal = itemEstoque.dataValidade || calcularDataValidade(itemEstoque.dataFabricacao, itemEstoque.tempoValidadeMeses);
    await criarEPI({
      nome: itemEstoque.nome,
      descricao: itemEstoque.descricao,
      colaborador: bombeiro.nomeGuerra,
      colaboradorId: bombeiro.id,
      entreguePor: nomeLogado,
      ca: itemEstoque.ca,
      dataPagamento: hoje,
      dataValidade: dataValidadeFinal,
      fornecedor: itemEstoque.fornecedor,
      notas: itemEstoque.notas,
      dataFabricacao: itemEstoque.dataFabricacao,
      tamanho: itemEstoque.tamanho,
      numeroSerie: itemEstoque.numeroSerie,
      estado: itemEstoque.estado,
      createdBy: username,
    });
    await baixarEstoque(itemEstoque.id);
    await carregar();
  }

  async function handleDevolverEpi(epiId: string) {
    const epi = epis.find(e => e.id === epiId);
    if (!epi) return;
    const estoqueItem = estoque.find(e =>
      e.nome === epi.nome && e.ca === epi.ca && e.fornecedor === epi.fornecedor
    );
    const { devolverEPI } = await import('../../services/epiService');
    await devolverEPI(epiId);
    if (estoqueItem && (epi.estado === 'Novo' || epi.estado === 'Bom' || epi.estado === 'Regular')) {
      await reporEstoque(estoqueItem.id);
    }
    await carregar();
  }

  async function handleExcluirEstoque(id: string) {
    if (!canDeleteEpis) return;
    await excluirEstoque(id);
    setConfirmDeleteEstoque(null);
    await carregar();
  }

  async function handleExcluirEpi(id: string) {
    if (!canDeleteEpis) return;
    const { excluirEPI } = await import('../../services/epiService');
    await excluirEPI(id);
    setConfirmDeleteEpi(null);
    await carregar();
  }

  const equipes = useMemo(() => [...new Set(funcionarios.map(f => f.equipe))].sort(), [funcionarios]);
  const cargos = useMemo(() => [...new Set(funcionarios.map(f => f.cargo))].sort(), [funcionarios]);

  return (
    <PageContainer>
      <PageTitle icon={HardHat} title="EPIs" />

      {deveMostrarNotificacao && showNotificacoes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
                <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Notificações de Vencimento</h3>
              </div>
              <button onClick={dismissNotificacao} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                <X className="h-4 w-4" />
              </button>
            </div>

            {notificacoes.vencidos.length > 0 && (
              <div className="mb-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                  <span className="h-3 w-3 rounded-full bg-red-500" /> Vencidos ({notificacoes.vencidos.length})
                </h4>
                <div className="space-y-1">
                  {notificacoes.vencidos.map(({ epi, func }) => (
                    <div key={epi.id} className="rounded-lg bg-red-50 p-2 text-xs dark:bg-red-900/20">
                      <span className="font-bold text-red-700 dark:text-red-400">{epi.nome}</span>
                      <span className="text-red-600 dark:text-red-400"> — {func?.nomeGuerra || epi.colaborador}</span>
                      <span className="text-red-500 dark:text-red-400 ml-1">{getDiasParaVencerLabel(epi.dataValidade)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notificacoes.criticos.length > 0 && (
              <div className="mb-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 mb-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500" /> Vence em até 40 dias ({notificacoes.criticos.length})
                </h4>
                <div className="space-y-1">
                  {notificacoes.criticos.map(({ epi, func }) => (
                    <div key={epi.id} className="rounded-lg bg-orange-50 p-2 text-xs dark:bg-orange-900/20">
                      <span className="font-bold text-orange-700 dark:text-orange-400">{epi.nome}</span>
                      <span className="text-orange-600 dark:text-orange-400"> — {func?.nomeGuerra || epi.colaborador}</span>
                      <span className="text-orange-500 dark:text-orange-400 ml-1">{getDiasParaVencerLabel(epi.dataValidade)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notificacoes.atencao.length > 0 && (
              <div className="mb-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                  <span className="h-3 w-3 rounded-full bg-yellow-500" /> Vence em até 1 ano ({notificacoes.atencao.length})
                </h4>
                <div className="space-y-1">
                  {notificacoes.atencao.map(({ epi, func }) => (
                    <div key={epi.id} className="rounded-lg bg-yellow-50 p-2 text-xs dark:bg-yellow-900/20">
                      <span className="font-bold text-yellow-700 dark:text-yellow-400">{epi.nome}</span>
                      <span className="text-yellow-600 dark:text-yellow-400"> — {func?.nomeGuerra || epi.colaborador}</span>
                      <span className="text-yellow-500 dark:text-yellow-400 ml-1">{getDiasParaVencerLabel(epi.dataValidade)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={dismissNotificacao}
                className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-xl border border-graphite-200/60 bg-white/60 p-1 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
        <button onClick={() => setTab('funcionarios')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'funcionarios'
              ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400'
              : 'text-graphite-500 hover:bg-graphite-100 hover:text-graphite-700 dark:text-graphite-400 dark:hover:bg-surface-hover'
          }`}>
          <User className="h-4 w-4" /> Funcionários
        </button>
        <button onClick={() => setTab('epis')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'epis'
              ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400'
              : 'text-graphite-500 hover:bg-graphite-100 hover:text-graphite-700 dark:text-graphite-400 dark:hover:bg-surface-hover'
          }`}>
          <HardHat className="h-4 w-4" /> EPIs
        </button>
      </div>

      {tab === 'funcionarios' && (
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
            className="rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark">
            <option value="">Todas as Equipes</option>
            {equipes.map(eq => <option key={eq} value={eq} className="dark:bg-graphite-700 dark:text-graphite-100">{eq}</option>)}
          </select>
          <select value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)}
            className="rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark">
            <option value="">Todas as Funções</option>
            {cargos.map(c => <option key={c} value={c} className="dark:bg-graphite-700 dark:text-graphite-100">{c}</option>)}
          </select>
          <select value={filtroValidade} onChange={e => setFiltroValidade(e.target.value)}
            className="rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark">
            <option value="">Todas as Validades</option>
            <option value="vencido" className="dark:bg-graphite-700 dark:text-graphite-100">Com EPI Vencido</option>
            <option value="critico" className="dark:bg-graphite-700 dark:text-graphite-100">Com EPI a Vencer (até 40 dias)</option>
            <option value="atencao" className="dark:bg-graphite-700 dark:text-graphite-100">Com EPI a Vencer (até 1 ano)</option>
          </select>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input type="text" value={termo} onChange={e => setTermo(e.target.value)}
            placeholder={tab === 'funcionarios' ? 'Pesquisar por nome...' : 'Pesquisar por nome, responsável...'}
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder-graphite-500 dark:hover:border-border-dark dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark" />
        </div>
        {canManage && tab === 'epis' && (
          <button onClick={() => { setEditandoEstoque(null); setFormEstoqueOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Cadastrar EPI no Estoque
          </button>
        )}
      </div>

      {tab === 'funcionarios' && (
        <div className="space-y-2">
          {funcionariosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
              <User className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
              <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum funcionário encontrado</h3>
            </div>
          ) : (
            funcionariosFiltrados.map(func => (
              <FichaFuncionario
                key={func.id}
                funcionario={func}
                epis={epis}
                canManage={canManage}
                onPagar={(b) => setPagarEpiState({ bombeiro: b })}
                onDevolver={(b) => setDevolverEpiState({ bombeiro: b })}
              />
            ))
          )}
        </div>
      )}

      {tab === 'epis' && (
        <div className="space-y-6">
          {estoqueComValidade.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-300">
                <Package className="h-4 w-4" /> Estoque de EPIs
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">EPI</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">CA</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Qtd</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Tamanho</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Estado</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Fabricação</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Validade</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                      {canManage && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueComValidade.map(e => {
                      const validadeLabel = getLabelValidade(e.dataValidadeFinal);
                      const estadoOpt = ESTADO_CONSERVACAO_OPTIONS.find(o => o.value === e.estado);
                      return (
                        <tr key={e.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-bold text-graphite-900 dark:text-graphite-100">{e.nome}</p>
                              {e.descricao && <p className="text-xs text-graphite-500 dark:text-graphite-400">{e.descricao}</p>}
                              {e.numeroSerie && <p className="text-[10px] text-graphite-400">Série: {e.numeroSerie}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-graphite-700 dark:text-graphite-300">{e.ca}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${e.quantidade <= 2 ? 'text-red-500' : 'text-graphite-700 dark:text-graphite-300'}`}>
                              {e.quantidade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-graphite-700 dark:text-graphite-300">{e.tamanho || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoOpt?.color || ''}`}>
                              {estadoOpt?.label || e.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-graphite-700 dark:text-graphite-300">
                            {formatarDataBR(e.dataFabricacao, '—')}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-graphite-700 dark:text-graphite-300">
                            {formatarDataBR(e.dataValidadeFinal, '—')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${validadeLabel.bolinha}`} />
                              <span className={`text-[10px] font-medium ${validadeLabel.cor}`}>{validadeLabel.label}</span>
                            </div>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditandoEstoque(e); setFormEstoqueOpen(true); }} title="Editar"
                                  className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {canDeleteEpis && (
                                  <button onClick={() => setConfirmDeleteEstoque(e.id)} title="Excluir"
                                    className="rounded-lg p-1 text-alert-red hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="flex items-center gap-2 mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-300">
              <Eye className="h-4 w-4" /> EPIs Entregues
            </h3>
            {episEntregues.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
                <HardHat className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
                <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum EPI entregue</h3>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">EPI</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Colaborador</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Pago por</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Data Pgto</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Validade</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Estado</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Status</th>
                      {canDeleteEpis && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {episEntregues.map(e => {
                      const validadeLabel = getLabelValidade(e.dataValidade);
                      const estadoOpt = ESTADO_CONSERVACAO_OPTIONS.find(o => o.value === e.estado);
                      return (
                        <tr key={e.id} className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-bold text-graphite-900 dark:text-graphite-100">{e.nome}</p>
                              {e.descricao && <p className="text-xs text-graphite-500 dark:text-graphite-400">{e.descricao}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{e.colaborador}</td>
                          <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{e.entreguePor}</td>
                          <td className="px-4 py-3 font-mono text-xs text-graphite-700 dark:text-graphite-300">
                            {formatarDataBR(e.dataPagamento, '—')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${validadeLabel.bolinha}`} />
                              <span className={`text-[10px] font-medium ${validadeLabel.cor}`}>{validadeLabel.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoOpt?.color || ''}`}>
                              {estadoOpt?.label || e.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${EPI_STATUS_COLORS[e.status]}`}>
                              {EPI_STATUS_LABELS[e.status]}
                            </span>
                          </td>
                          {canDeleteEpis && (
                            <td className="px-4 py-3">
                              <button onClick={() => setConfirmDeleteEpi(e.id)} title="Excluir"
                                className="rounded-lg p-1 text-alert-red hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {formEstoqueOpen && (
        <FormEstoque
          item={editandoEstoque || undefined}
          onSave={async (data) => {
            if (editandoEstoque) {
              await atualizarEstoque(editandoEstoque.id, data);
            } else {
              await criarEstoque({ ...data, createdBy: username });
            }
            setFormEstoqueOpen(false);
            setEditandoEstoque(null);
            await carregar();
          }}
          onCancel={() => { setFormEstoqueOpen(false); setEditandoEstoque(null); }}
        />
      )}

      {pagarEpiState && (
        <ModalPagarEpi
          bombeiro={pagarEpiState.bombeiro}
          estoque={estoqueComValidade}
          onConfirm={async (item) => {
            if ((item.estado === 'Ruim' || item.estado === 'Sem uso' || getDiasParaVencer(item.dataValidadeFinal) < 0)) {
              setConfirmPagar({ estoque: item, bombeiro: pagarEpiState.bombeiro });
              return;
            }
            await handlePagarEpiDireto(item, pagarEpiState.bombeiro);
            setPagarEpiState(null);
          }}
          onCancel={() => setPagarEpiState(null)}
        />
      )}

      {confirmPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">ATENÇÃO</h3>
            </div>
            <p className="mb-2 text-sm text-graphite-700 dark:text-graphite-300">
              <strong>Art. 166 da CLT e NR-6:</strong> A empresa é obrigada a fornecer EPI adequado ao risco e em <strong>perfeito estado de conservação e funcionamento</strong>.
            </p>
            <p className="mb-4 text-sm text-graphite-700 dark:text-graphite-300">
              O EPI selecionado
              {confirmPagar.estoque.estado === 'Ruim' && ' está em estado <strong>Ruim</strong>'}
              {confirmPagar.estoque.estado === 'Sem uso' && ' está <strong>Sem condição de uso</strong>'}
              {getDiasParaVencer(confirmPagar.estoque.dataValidade || calcularDataValidade(confirmPagar.estoque.dataFabricacao, confirmPagar.estoque.tempoValidadeMeses)) < 0 && ' está <strong>VENCIDO</strong>'}
              . Tem certeza que deseja continuar?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmPagar(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
                Cancelar
              </button>
              <button onClick={async () => {
                await handlePagarEpiDireto(confirmPagar.estoque, confirmPagar.bombeiro);
                setConfirmPagar(null);
                setPagarEpiState(null);
              }}
                className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:from-red-400 hover:to-red-500 active:scale-[0.98]">
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {devolverEpiState && (
        <ModalDevolverEpi
          bombeiro={devolverEpiState.bombeiro}
          epis={epis}
          onConfirm={async (epi) => {
            setConfirmDevolver({ epi, bombeiro: devolverEpiState.bombeiro });
          }}
          onCancel={() => setDevolverEpiState(null)}
        />
      )}

      {confirmDevolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar Devolução</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">
              Devolver o EPI <strong>{confirmDevolver.epi.nome}</strong> de <strong>{confirmDevolver.bombeiro.nomeGuerra}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDevolver(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
                Cancelar
              </button>
              <button onClick={async () => {
                await handleDevolverEpi(confirmDevolver.epi.id);
                setConfirmDevolver(null);
                setDevolverEpiState(null);
              }}
                className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {canDeleteEpis && confirmDeleteEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este item do estoque?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteEstoque(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluirEstoque(confirmDeleteEstoque)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {canDeleteEpis && confirmDeleteEpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este EPI?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteEpi(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluirEpi(confirmDeleteEpi)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={EPIS_TOUR_STEPS}
        targetAttribute="data-epis-tour"
        title="Abrir tutorial de EPIs"
        detailLabel="Controle de validade"
      />
    </PageContainer>
  );
}

/* ───────── Ficha de Funcionário ───────── */

function FichaFuncionario({
  funcionario, epis, canManage, onPagar, onDevolver,
}: {
  funcionario: Bombeiro;
  epis: EPI[];
  canManage: boolean;
  onPagar: (b: Bombeiro) => void;
  onDevolver: (b: Bombeiro) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const episDoFunc = epis.filter(e => e.colaboradorId === funcionario.id || e.colaborador === funcionario.nomeGuerra);
  const ativos = episDoFunc.filter(e => e.status !== 'devolvido');

  const worstPrioridade = useMemo(() => {
    let worst: 'normal' | 'atencao' | 'critico' | 'vencido' = 'normal';
    for (const e of ativos) {
      if (!e.dataValidade) continue;
      const p = getPrioridade(e.dataValidade);
      if (p === 'vencido') return 'vencido' as const;
      if (p === 'critico') worst = 'critico';
      else if (p === 'atencao' && worst !== 'critico') worst = 'atencao';
    }
    return worst;
  }, [ativos]);

  const prioridadeColors = {
    normal: '',
    atencao: 'border-l-4 border-l-yellow-400',
    critico: 'border-l-4 border-l-orange-400',
    vencido: 'border-l-4 border-l-red-500',
  };

  const prioridadeBolinha = {
    normal: '',
    atencao: 'bg-yellow-500',
    critico: 'bg-orange-500',
    vencido: 'bg-red-500',
  };

  return (
    <div className={`rounded-xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card ${prioridadeColors[worstPrioridade]}`}>
      <button onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-graphite-50/80 dark:hover:bg-surface-hover">
        {worstPrioridade !== 'normal' && (
          <span className={`h-3 w-3 shrink-0 rounded-full ${prioridadeBolinha[worstPrioridade]}`} />
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">{funcionario.nomeGuerra}</p>
          <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{funcionario.nomeCompleto} — {funcionario.cargo} — {funcionario.equipe}</p>
        </div>
        <div className="flex items-center gap-2">
          {ativos.length > 0 && (
            <span className="rounded-full bg-aviation-100 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400">
              {ativos.length} EPI{ativos.length > 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-graphite-400" /> : <ChevronRight className="h-4 w-4 text-graphite-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-graphite-100 px-4 py-3 dark:border-border-dark">
          {episDoFunc.length === 0 ? (
            <p className="py-4 text-center text-xs text-graphite-400">Nenhum EPI registrado para este funcionário.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {episDoFunc.map(epi => {
                const validadeLabel = getLabelValidade(epi.dataValidade);
                const estadoOpt = ESTADO_CONSERVACAO_OPTIONS.find(o => o.value === epi.estado);
                return (
                  <div key={epi.id} className="rounded-lg border border-graphite-100 bg-white p-3 dark:border-border-dark dark:bg-surface-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{epi.nome}</span>
                          {epi.descricao && <span className="text-xs text-graphite-500">— {epi.descricao}</span>}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                          <div>
                            <span className="text-graphite-400">CA:</span>
                            <span className="ml-1 font-medium text-graphite-700 dark:text-graphite-300">{epi.ca}</span>
                          </div>
                          {epi.tamanho && (
                            <div>
                              <span className="text-graphite-400">Tamanho:</span>
                              <span className="ml-1 font-medium text-graphite-700 dark:text-graphite-300">{epi.tamanho}</span>
                            </div>
                          )}
                          {epi.dataPagamento && (
                            <div>
                              <span className="text-graphite-400">Recebido em:</span>
                              <span className="ml-1 font-medium text-graphite-700 dark:text-graphite-300">{formatarDataBR(epi.dataPagamento, '—')}</span>
                            </div>
                          )}
                          {epi.entreguePor && (
                            <div>
                              <span className="text-graphite-400">Pago por:</span>
                              <span className="ml-1 font-medium text-graphite-700 dark:text-graphite-300">{epi.entreguePor}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-graphite-400">Validade:</span>
                            <span className={`ml-1 font-medium ${validadeLabel.cor}`}>
                              {formatarDataBR(epi.dataValidade, '—')}
                            </span>
                          </div>
                          {epi.numeroSerie && (
                            <div>
                              <span className="text-graphite-400">Nº Série:</span>
                              <span className="ml-1 font-medium text-graphite-700 dark:text-graphite-300">{epi.numeroSerie}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {estadoOpt && (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium ${estadoOpt.color}`}>
                              {estadoOpt.label}
                            </span>
                          )}
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium ${EPI_STATUS_COLORS[epi.status]}`}>
                            {EPI_STATUS_LABELS[epi.status]}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${validadeLabel.cor.replace('text-', 'bg-').replace('dark:', 'dark:bg-').replace('green', 'green/10').replace('yellow', 'yellow/10').replace('orange', 'orange/10').replace('red', 'red/10')} ${validadeLabel.bolinha ? 'pl-1.5' : ''}`}>
                            {validadeLabel.bolinha && <span className={`h-1.5 w-1.5 rounded-full ${validadeLabel.bolinha}`} />}
                            {validadeLabel.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => onPagar(funcionario)}
                className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 transition-all hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50">
                <DollarSign className="h-3.5 w-3.5" /> Pagar EPI
              </button>
              <button onClick={() => onDevolver(funcionario)}
                className="flex items-center gap-1 rounded-lg bg-graphite-100 px-3 py-1.5 text-xs font-bold text-graphite-600 transition-all hover:bg-graphite-200 dark:bg-graphite-700 dark:text-graphite-300 dark:hover:bg-graphite-600">
                <RotateCcw className="h-3.5 w-3.5" /> Devolver EPI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Formulário de Estoque ───────── */

function FormEstoque({
  item, onSave, onCancel,
}: {
  item?: EPIEstoque;
  onSave: (data: Omit<EPIEstoque, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
}) {
  const hoje = hojeLocalISO();
  const [form, setForm] = useState(item ? {
    nome: item.nome, descricao: item.descricao, ca: item.ca, fornecedor: item.fornecedor,
    quantidade: item.quantidade, dataFabricacao: item.dataFabricacao, tempoValidadeMeses: item.tempoValidadeMeses,
    tamanho: item.tamanho, numeroSerie: item.numeroSerie, estado: item.estado, notas: item.notas,
  } : {
    nome: '', descricao: '', ca: '', fornecedor: '', quantidade: 1,
    dataFabricacao: hoje, tempoValidadeMeses: 12, tamanho: '', numeroSerie: '',
    estado: 'Novo' as EstadoConservacao, notas: '',
  });

  const input = 'w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-all duration-200 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 placeholder-graphite-400 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
  const label = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

  const dataValidadeFinal = calcularDataValidade(form.dataFabricacao, form.tempoValidadeMeses);
  const tamanhosDisponiveis = TAMANHOS_EPI[form.nome] || ['Único'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{item ? 'Editar EPI' : 'Cadastrar EPI no Estoque'}</h3>
          <button onClick={onCancel} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={label}>Categoria *</label>
            <select value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value, tamanho: '' }))} className={input}>
              <option value="">Selecione</option>
              {CATEGORIAS_EPI.map(c => <option key={c} value={c} className="dark:bg-graphite-700 dark:text-graphite-100">{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Descrição</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={input} placeholder="Modelo específico" />
          </div>
          <div>
            <label className={label}>CA *</label>
            <input value={form.ca} onChange={e => setForm(f => ({ ...f, ca: e.target.value }))} className={input} placeholder="Nº do CA" />
          </div>
          <div>
            <label className={label}>Fornecedor</label>
            <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Quantidade *</label>
            <input type="number" min={0} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 0 }))} className={input} />
          </div>
          <div>
            <label className={label}>Data de Fabricação *</label>
            <input type="date" value={form.dataFabricacao} onChange={e => setForm(f => ({ ...f, dataFabricacao: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Validade (meses) *</label>
            <input type="number" min={1} value={form.tempoValidadeMeses} onChange={e => setForm(f => ({ ...f, tempoValidadeMeses: parseInt(e.target.value) || 0 }))} className={input} />
          </div>
          <div>
            <label className={label}>Data Validade (auto)</label>
            <input type="date" value={dataValidadeFinal} readOnly className={input + ' cursor-not-allowed bg-graphite-50/80 font-medium dark:bg-surface-card'} />
          </div>
          <div>
            <label className={label}>Tamanho/Numeração</label>
            <select value={form.tamanho} onChange={e => setForm(f => ({ ...f, tamanho: e.target.value }))} className={input}>
              <option value="">Selecione</option>
              {tamanhosDisponiveis.map(t => <option key={t} value={t} className="dark:bg-graphite-700 dark:text-graphite-100">{t}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Nº Série</label>
            <input value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))} className={input} placeholder="Opcional" />
          </div>
          <div>
            <label className={label}>Estado de Conservação *</label>
            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoConservacao }))} className={input}>
              {ESTADO_CONSERVACAO_OPTIONS.map(o => <option key={o.value} value={o.value} className="dark:bg-graphite-700 dark:text-graphite-100">{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={label}>Notas</label>
            <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className={input} placeholder="Observações" />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
          <button onClick={() => onSave({ ...form, dataValidade: dataValidadeFinal })}
            disabled={!form.nome || !form.ca || form.quantidade <= 0 || !form.dataFabricacao || form.tempoValidadeMeses <= 0}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal Pagar EPI ───────── */

function ModalPagarEpi({
  bombeiro, estoque, onConfirm, onCancel,
}: {
  bombeiro: Bombeiro;
  estoque: (EPIEstoque & { dataValidadeFinal: string })[];
  onConfirm: (item: EPIEstoque & { dataValidadeFinal: string }) => void;
  onCancel: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set(estoque.filter(e => e.quantidade > 0).map(e => e.nome));
    return [...cats].sort();
  }, [estoque]);

  const [catFiltro, setCatFiltro] = useState<string | null>(null);

  const itensFiltrados = useMemo(() => {
    let lista = estoque.filter(e => e.quantidade > 0);
    if (catFiltro) lista = lista.filter(e => e.nome === catFiltro);
    if (busca) {
      const t = busca.toLowerCase();
      lista = lista.filter(e =>
        e.nome.toLowerCase().includes(t) ||
        e.descricao.toLowerCase().includes(t) ||
        e.ca.toLowerCase().includes(t) ||
        e.fornecedor.toLowerCase().includes(t)
      );
    }
    return lista;
  }, [estoque, catFiltro, busca]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
            Pagar EPI para {bombeiro.nomeGuerra}
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setCatFiltro(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${!catFiltro ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400' : 'bg-graphite-100 text-graphite-600 hover:bg-graphite-200 dark:bg-graphite-700 dark:text-graphite-300'}`}>
            Todos
          </button>
          {categoriasDisponiveis.map(cat => (
            <button key={cat} onClick={() => setCatFiltro(cat === catFiltro ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${catFiltro === cat ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-400' : 'bg-graphite-100 text-graphite-600 hover:bg-graphite-200 dark:bg-graphite-700 dark:text-graphite-300'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2 pl-10 pr-4 text-sm placeholder-graphite-400 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder-graphite-500 dark:scheme-dark" />
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {itensFiltrados.length === 0 ? (
            <p className="py-4 text-center text-sm text-graphite-400">Nenhum EPI disponível em estoque</p>
          ) : (
            itensFiltrados.map(item => {
              const validadeLabel = getLabelValidade(item.dataValidadeFinal);
              const estadoOpt = ESTADO_CONSERVACAO_OPTIONS.find(o => o.value === item.estado);
              const isSelected = selecionado === item.id;
              return (
                <div key={item.id}
                  onClick={() => setSelecionado(isSelected ? null : item.id)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-aviation-500 bg-aviation-50/50 dark:border-aviation-400 dark:bg-aviation-900/10' : 'border-graphite-200 hover:border-graphite-300 dark:border-border-dark dark:hover:border-graphite-600'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{item.nome}</p>
                      {item.descricao && <p className="text-xs text-graphite-500 dark:text-graphite-400">{item.descricao}</p>}
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-graphite-500">
                        <span>CA: {item.ca}</span>
                        {item.tamanho && <span>Tam: {item.tamanho}</span>}
                        <span>Qtd: {item.quantidade}</span>
                        <div className="flex items-center gap-1">
                          <span className={`h-2 w-2 rounded-full ${validadeLabel.bolinha}`} />
                          <span className={validadeLabel.cor}>{validadeLabel.label}</span>
                        </div>
                        {estadoOpt && <span className={`rounded-full px-1.5 py-0.5 font-medium ${estadoOpt.color}`}>{estadoOpt.label}</span>}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
          <button onClick={() => {
            const item = itensFiltrados.find(e => e.id === selecionado);
            if (item) onConfirm(item);
          }} disabled={!selecionado}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
            <DollarSign className="h-4 w-4" /> Pagar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal Devolver EPI ───────── */

function ModalDevolverEpi({
  bombeiro, epis, onConfirm, onCancel,
}: {
  bombeiro: Bombeiro;
  epis: EPI[];
  onConfirm: (epi: EPI) => void;
  onCancel: () => void;
}) {
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const episAtivos = useMemo(() => {
    return epis.filter(e =>
      (e.colaboradorId === bombeiro.id || e.colaborador === bombeiro.nomeGuerra) &&
      e.status !== 'devolvido'
    );
  }, [epis, bombeiro]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:bg-surface-elevated/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
            Devolver EPI — {bombeiro.nomeGuerra}
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {episAtivos.length === 0 ? (
            <p className="py-4 text-center text-sm text-graphite-400">Nenhum EPI ativo para devolver</p>
          ) : (
            episAtivos.map(epi => {
              const isSelected = selecionado === epi.id;
              return (
                <div key={epi.id} onClick={() => setSelecionado(isSelected ? null : epi.id)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-aviation-500 bg-aviation-50/50 dark:border-aviation-400 dark:bg-aviation-900/10' : 'border-graphite-200 hover:border-graphite-300 dark:border-border-dark'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{epi.nome}</p>
                      <p className="text-xs text-graphite-500">CA: {epi.ca} | {EPI_STATUS_LABELS[epi.status]}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
          <button onClick={() => {
            const epi = episAtivos.find(e => e.id === selecionado);
            if (epi) onConfirm(epi);
          }} disabled={!selecionado}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-graphite-500 to-graphite-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-graphite-400 hover:to-graphite-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
            <RotateCcw className="h-4 w-4" /> Devolver
          </button>
        </div>
      </div>
    </div>
  );
}

export default EPIs;
