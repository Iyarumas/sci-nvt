import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Plus, Search, Trash2, Save, Printer, CheckCircle2, Link2,
  X, ImagePlus,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { isAdministradorSistema } from '../../utils/permissoes';
import { formatarDataBR, formatarDataHoraBR, hojeLocalISO } from '../../utils/datas';
import {
  listarOrdensServico,
  criarOrdemServico,
  atualizarOrdemServico,
  excluirOrdemServico,
} from '../../services/ordemServicoService';
import type { OrdemServico } from '../../types/ordemServico';
import { parseOrdemServicoImagens, serializeOrdemServicoImagens } from '../../utils/ordemServicoImagens';

const PRIORIDADE_CORES: Record<string, string> = {
  'Baixa': 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  'Média': 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  'Alta': 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  'Urgente': 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

const STATUS_CORES: Record<string, string> = {
  'Aberta': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Manutenção': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Concluída': 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  'Cancelada': 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

function fmt(d: string) {
  return formatarDataBR(d);
}

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista'];
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const STATUS_LIST = ['Aberta', 'Manutenção', 'Concluída', 'Cancelada'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400';
const labelCls = 'mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300';

export function OrdemServico() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const isAdminOnly = isAdministradorSistema(user);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<OrdemServico | null>(null);
  const [visualizando, setVisualizando] = useState<OrdemServico | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState<OrdemServico | null>(null);
  const [formFinalizadoPor, setFormFinalizadoPor] = useState('');
  const [formEmpresaFinalizacao, setFormEmpresaFinalizacao] = useState('');
  const [formFinalizacaoDescricao, setFormFinalizacaoDescricao] = useState('');
  const [formStatusFinalizacao, setFormStatusFinalizacao] = useState<OrdemServico['status']>('Manutenção');
  const [formMotivoManutencao, setFormMotivoManutencao] = useState('');
  const [formManutencaoPor, setFormManutencaoPor] = useState('');
  const [formEmpresaManutencao, setFormEmpresaManutencao] = useState('');
  const [formManutencaoEmpresaPessoa, setFormManutencaoEmpresaPessoa] = useState('');
  const [formMotivoCancelamento, setFormMotivoCancelamento] = useState('');
  const [formCanceladoPor, setFormCanceladoPor] = useState('');
  const [formFinalizacaoEmpresaPessoa, setFormFinalizacaoEmpresaPessoa] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Form fields
  const [formNumero, setFormNumero] = useState('');
  const [formData, setFormData] = useState(hojeLocalISO());
  const [formSolicitante, setFormSolicitante] = useState('');
  const [formSolicitanteNome, setFormSolicitanteNome] = useState('');
  const [formSolicitanteCargo, setFormSolicitanteCargo] = useState('');
  const [formEquipe, setFormEquipe] = useState('');
  const [formLocal, setFormLocal] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formImagens, setFormImagens] = useState<string[]>([]);
  const [formPrioridade, setFormPrioridade] = useState('Média');
  const [formStatus, setFormStatus] = useState('Aberta');
  const [formConclusao, setFormConclusao] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [searchSol, setSearchSol] = useState('');

  useEffect(() => {
    listarOrdensServico()
      .then(setOrdens)
      .catch(err => alert(err instanceof Error ? err.message : 'Erro ao carregar ordens de serviço.'));
  }, []);

  async function recarregar() {
    const lista = await listarOrdensServico();
    setOrdens(lista);
    return lista;
  }

  const filtered = useMemo(() => {
    let lista = ordens;
    if (filtroStatus) lista = lista.filter(o => o.status === filtroStatus);
    if (filtroPrioridade) lista = lista.filter(o => o.prioridade === filtroPrioridade);
    if (filtroAno) {
      lista = lista.filter(o => {
        const y = o.dataEmissao ? new Date(o.dataEmissao + 'T12:00:00').getFullYear() : new Date(o.createdAt).getFullYear();
        return String(y) === filtroAno;
      });
    }
    if (filtroMes) {
      lista = lista.filter(o => {
        const m = o.dataEmissao ? new Date(o.dataEmissao + 'T12:00:00').getMonth() + 1 : new Date(o.createdAt).getMonth() + 1;
        return String(m) === filtroMes;
      });
    }
    if (search) {
      const t = search.toLowerCase();
      lista = lista.filter(o => o.numero.toLowerCase().includes(t) || o.solicitanteNome.toLowerCase().includes(t) || o.descricao.toLowerCase().includes(t));
    }
    return lista.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ordens, search, filtroStatus, filtroPrioridade, filtroMes, filtroAno]);

  function proximoNumero(): string {
    const ano = new Date().getFullYear();
    const doAno = ordens.filter(o => {
      const y = o.dataEmissao ? new Date(o.dataEmissao + 'T12:00:00').getFullYear() : new Date(o.createdAt).getFullYear();
      return y === ano;
    });
    const maxSeq = doAno.reduce((max, o) => {
      const m = o.numero?.match(/(?:OS\/SCI|OS SCI|OS-SCI)-(\d+)\//);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const seq = String(maxSeq + 1).padStart(3, '0');
    return `OS SCI-${seq}/${ano}`;
  }

  function resetForm() {
    setFormNumero(proximoNumero());
    setFormData(hojeLocalISO());
    setFormSolicitante('');
    setFormSolicitanteNome('');
    setFormSolicitanteCargo('');
    setFormEquipe(canManageGlobal ? '' : equipeEfetiva || '');
    setFormLocal('');
    setFormDescricao('');
    setFormImagens([]);
    setFormPrioridade('Média');
    setFormStatus('Aberta');
    setFormConclusao('');
    setFormObservacoes('');
    setSearchSol('');
  }

  function handleNovo() {
    if (!canManageGlobal && !equipeEfetiva) {
      alert('Seu usuário não possui equipe efetiva para criar ordem de serviço.');
      return;
    }
    resetForm();
    const usuarioNome = user?.name || user?.pessoa?.nomeGuerra || '';
    const usuarioCargo = user?.pessoa?.funcao || user?.role || '';
    if (usuarioNome) {
      setFormSolicitante(user?.pessoa?.id || '');
      setFormSolicitanteNome(usuarioNome);
      setFormSolicitanteCargo(usuarioCargo);
      setSearchSol(usuarioNome);
    }
    setEditando(null);
    setFormOpen(true);
  }

  function handleEditar(os: OrdemServico) {
    if (os.status === 'Concluída' && !isAdminOnly) {
      alert('Somente administradores e desenvolvedores podem editar ordens de serviço finalizadas.');
      return;
    }
    if (!canManageEquipe(os.equipe)) {
      alert('Você só pode editar ordens de serviço da sua equipe efetiva.');
      return;
    }
    setEditando(os);
    setFormNumero(os.numero);
    setFormData(os.dataEmissao);
    setFormSolicitante(os.solicitanteId);
    setFormSolicitanteNome(os.solicitanteNome);
    setFormSolicitanteCargo(os.solicitanteCargo || '');
    setFormEquipe(os.equipe);
    setFormLocal(os.local || '');
    setFormDescricao(os.descricao);
    setFormImagens(parseOrdemServicoImagens(os.imagem));
    setFormPrioridade(os.prioridade);
    setFormStatus(os.status);
    setFormConclusao(os.dataConclusao);
    setFormObservacoes(os.observacoes);
    setSearchSol(os.solicitanteNome);
    setFormOpen(true);
  }

  async function handleSalvar() {
    if (!formNumero || !formSolicitante || !formDescricao) return;
    const equipeAlvo = canManageGlobal ? formEquipe : equipeEfetiva || formEquipe;
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar ordens de serviço da sua equipe efetiva.');
      return;
    }
    try {
      if (editando) {
        if (!canManageEquipe(editando.equipe) && !(editando.status === 'Concluída' && isAdminOnly)) {
          alert('Você só pode editar ordens de serviço da sua equipe efetiva.');
          return;
        }
        await atualizarOrdemServico(editando.id, {
          numero: formNumero, dataEmissao: formData, dataConclusao: formConclusao,
          solicitanteId: formSolicitante, solicitanteNome: formSolicitanteNome, solicitanteCargo: formSolicitanteCargo, equipe: equipeAlvo, local: formLocal,
          descricao: formDescricao, imagem: serializeOrdemServicoImagens(formImagens), prioridade: formPrioridade as any, status: formStatus as any, observacoes: formObservacoes,
        });
      } else {
        await criarOrdemServico({
          numero: formNumero, dataEmissao: formData, dataConclusao: formConclusao,
          solicitanteId: formSolicitante, solicitanteNome: formSolicitanteNome, solicitanteCargo: formSolicitanteCargo, equipe: equipeAlvo, local: formLocal,
          descricao: formDescricao, imagem: serializeOrdemServicoImagens(formImagens), prioridade: formPrioridade as any, status: 'Aberta',
          motivoManutencao: '', manutencaoPor: '', manutencaoPorCargo: '', manutencaoEmpresa: '', manutencaoEmpresaPessoa: '',
          dataManutencao: '', motivoCancelamento: '', canceladoPor: '', canceladoPorCargo: '', dataCancelamento: '',
          finalizadoPor: '', finalizadoPorCargo: '', empresaFinalizacao: '', finalizacaoEmpresaPessoa: '', finalizacaoDescricao: '',
          dataFinalizacao: '', observacoes: formObservacoes, createdBy: user?.username || '',
        });
      }
      await recarregar();
      setFormOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar ordem de serviço.');
    }
  }

  function handleImagem(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imagem = String(reader.result || '');
      if (imagem) setFormImagens(prev => [...prev, imagem]);
    };
    reader.readAsDataURL(file);
  }

  function removerImagem(index: number) {
    setFormImagens(prev => prev.filter((_, i) => i !== index));
  }

  async function handleDelete(id: string) {
    if (!isAdminOnly) {
      alert('Somente administradores e desenvolvedores podem excluir ordens de serviço.');
      setConfirmDelete(null);
      return;
    }
    try {
      await excluirOrdemServico(id);
      await recarregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir ordem de serviço.');
    }
    setConfirmDelete(null);
  }

  async function handleFinalizar() {
    if (!finalizando) return;
    const now = new Date().toISOString();
    const concluida = formStatusFinalizacao === 'Concluída';
    const manutencao = formStatusFinalizacao === 'Manutenção';
    const cancelada = formStatusFinalizacao === 'Cancelada';
    const usuarioCargo = user?.pessoa?.funcao || user?.role || '';
    const nomeUsuario = user?.name || user?.pessoa?.nomeGuerra || '';
    const payload: Partial<OrdemServico> = {
      status: formStatusFinalizacao,
      motivoManutencao: manutencao ? formMotivoManutencao.trim() : (finalizando.motivoManutencao || ''),
      manutencaoPor: manutencao ? (formManutencaoPor.trim() || nomeUsuario) : (finalizando.manutencaoPor || ''),
      manutencaoPorCargo: manutencao ? usuarioCargo : (finalizando.manutencaoPorCargo || ''),
      manutencaoEmpresa: manutencao ? formEmpresaManutencao.trim() : (finalizando.manutencaoEmpresa || ''),
      manutencaoEmpresaPessoa: manutencao ? formManutencaoEmpresaPessoa.trim() : (finalizando.manutencaoEmpresaPessoa || ''),
      dataManutencao: manutencao ? now : (finalizando.dataManutencao || ''),
      motivoCancelamento: cancelada ? formMotivoCancelamento.trim() : (finalizando.motivoCancelamento || ''),
      canceladoPor: cancelada ? (formCanceladoPor.trim() || nomeUsuario) : (finalizando.canceladoPor || ''),
      canceladoPorCargo: cancelada ? usuarioCargo : (finalizando.canceladoPorCargo || ''),
      dataCancelamento: cancelada ? now : (finalizando.dataCancelamento || ''),
      finalizadoPor: concluida ? (formFinalizadoPor.trim() || nomeUsuario) : (finalizando.finalizadoPor || ''),
      finalizadoPorCargo: concluida ? usuarioCargo : (finalizando.finalizadoPorCargo || ''),
      empresaFinalizacao: concluida ? formEmpresaFinalizacao.trim() : (finalizando.empresaFinalizacao || ''),
      finalizacaoEmpresaPessoa: concluida ? formFinalizacaoEmpresaPessoa.trim() : (finalizando.finalizacaoEmpresaPessoa || ''),
      finalizacaoDescricao: concluida ? formFinalizacaoDescricao.trim() : (finalizando.finalizacaoDescricao || ''),
      dataFinalizacao: concluida ? now : (finalizando.dataFinalizacao || ''),
      dataConclusao: concluida ? now : (finalizando.dataConclusao || ''),
    };
    try {
      await atualizarOrdemServico(finalizando.id, payload);
      await recarregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar ordem de serviço.');
    }
    setFinalizando(null);
  }

  function handleGerar(os: OrdemServico) {
    setVisualizando(os);
    document.title = `ORDEM DE SERVIÇO Nº ${os.numero} - ${os.solicitanteNome} - ${fmt(os.dataEmissao)}`;
    setTimeout(() => window.print(), 200);
  }

  function handleVisualizar(os: OrdemServico) {
    setVisualizando(os);
    document.title = `ORDEM DE SERVIÇO Nº ${os.numero} - ${os.solicitanteNome} - ${fmt(os.dataEmissao)}`;
  }

  async function handleCopiarLinkPublico() {
    const url = `${window.location.origin}/os/publica`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      alert(`Link público: ${url}`);
    }
  }

  const stats = useMemo(() => ({
    total: ordens.length, abertas: ordens.filter(o => o.status === 'Aberta').length,
    andamento: ordens.filter(o => o.status === 'Manutenção').length,
    concluidas: ordens.filter(o => o.status === 'Concluída').length,
    urgentes: ordens.filter(o => o.prioridade === 'Urgente').length,
  }), [ordens]);
  const imagensVisualizando = useMemo(() => visualizando ? parseOrdemServicoImagens(visualizando.imagem) : [], [visualizando]);

  return (
    <PageContainer>
      <PageTitle icon={ClipboardList} title="Ordens de Serviço" />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
            <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
            <p className="text-[10px] font-medium text-graphite-500">Total</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-xl font-black text-blue-700 dark:text-blue-300">{stats.abertas}</p>
            <p className="text-[10px] font-medium text-blue-500">Abertas</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">{stats.andamento}</p>
            <p className="text-[10px] font-medium text-amber-500">Em Andamento</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-900/20">
            <p className="text-xl font-black text-green-700 dark:text-green-300">{stats.concluidas}</p>
            <p className="text-[10px] font-medium text-green-500">Concluídas</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xl font-black text-red-700 dark:text-red-300">{stats.urgentes}</p>
            <p className="text-[10px] font-medium text-red-500">Urgentes</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OS..." className={`${inputCls} !pl-10`} />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todos Status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todas Prioridades</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todos os Anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={`${inputCls} !w-auto`} disabled={!filtroAno}>
            <option value="">Todos os Meses</option>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          {(canManageGlobal || equipeEfetiva) && (
            <button onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Nova OS
            </button>
          )}
          {isAdminOnly && (
            <button onClick={handleCopiarLinkPublico}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${linkCopiado ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300' : 'border-aviation-300 bg-white text-aviation-700 hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300'}`}>
              <Link2 className="h-4 w-4" /> {linkCopiado ? 'Link copiado!' : 'Link público'}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
            <ClipboardList className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma OS encontrada</h3>
            <p className="text-sm text-graphite-500">Clique em "Nova OS" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(os => (
              <div key={os.id} onClick={() => handleVisualizar(os)}
                className="cursor-pointer rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                    os.prioridade === 'Urgente' ? 'bg-gradient-to-br from-red-500 to-red-700' :
                    os.prioridade === 'Alta' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                    'bg-gradient-to-br from-aviation-500 to-aviation-700'
                  }`}>{os.numero.slice(-2)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{os.numero}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${PRIORIDADE_CORES[os.prioridade]}`}>{os.prioridade}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_CORES[os.status]}`}>{os.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-graphite-500 truncate">{os.descricao}</p>
                    <p className="text-[10px] text-graphite-400">{os.solicitanteNome}{os.solicitanteCargo ? ` · ${os.solicitanteCargo}` : ''} · {fmt(os.dataEmissao)} · {os.equipe}{os.local ? ` · Local: ${os.local}` : ''}</p>
                    {os.finalizadoPor && (
                      <p className="mt-0.5 text-[10px] text-green-600 dark:text-green-400">Finalizado por {os.finalizadoPor}{os.finalizadoPorCargo ? ` (${os.finalizadoPorCargo})` : ''}{os.finalizacaoEmpresaPessoa ? ` · ${os.finalizacaoEmpresaPessoa}` : ''}{os.empresaFinalizacao ? ` · ${os.empresaFinalizacao}` : ''}{os.dataFinalizacao ? ` · ${fmt(os.dataFinalizacao)}` : ''}</p>
                    )}
                    {os.manutencaoPor && (
                      <p className="mt-0.5 text-[10px] text-yellow-600 dark:text-yellow-400">Em manutenção por {os.manutencaoPor}{os.manutencaoPorCargo ? ` (${os.manutencaoPorCargo})` : ''}{os.manutencaoEmpresaPessoa ? ` · ${os.manutencaoEmpresaPessoa}` : ''}{os.manutencaoEmpresa ? ` · ${os.manutencaoEmpresa}` : ''}{os.dataManutencao ? ` · ${fmt(os.dataManutencao)}` : ''}</p>
                    )}
                    {os.canceladoPor && (
                      <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">Cancelado por {os.canceladoPor}{os.canceladoPorCargo ? ` (${os.canceladoPorCargo})` : ''}{os.dataCancelamento ? ` · ${fmt(os.dataCancelamento)}` : ''}{os.motivoCancelamento ? ` · ${os.motivoCancelamento}` : ''}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); handleGerar(os); }} className="rounded-xl p-1.5 text-aviation-500 hover:bg-aviation-50 hover:text-aviation-700 dark:text-aviation-300 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-200" title="Gerar"><Printer className="h-4 w-4" /></button>
                    {os.status !== 'Concluída' && (
                      <button onClick={e => { e.stopPropagation(); setFinalizando(os); setFormStatusFinalizacao(os.status === 'Manutenção' ? 'Manutenção' : os.status === 'Cancelada' ? 'Cancelada' : 'Aberta'); setFormMotivoManutencao(os.motivoManutencao || ''); setFormManutencaoPor(os.manutencaoPor || user?.name || user?.pessoa?.nomeGuerra || ''); setFormEmpresaManutencao(os.manutencaoEmpresa || ''); setFormManutencaoEmpresaPessoa(os.manutencaoEmpresaPessoa || ''); setFormMotivoCancelamento(os.motivoCancelamento || ''); setFormCanceladoPor(os.canceladoPor || user?.name || user?.pessoa?.nomeGuerra || ''); setFormFinalizadoPor(os.finalizadoPor || user?.name || user?.pessoa?.nomeGuerra || ''); setFormEmpresaFinalizacao(os.empresaFinalizacao || ''); setFormFinalizacaoEmpresaPessoa(os.finalizacaoEmpresaPessoa || ''); setFormFinalizacaoDescricao(os.finalizacaoDescricao || ''); }}
                        className="rounded-xl p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20" title="Atualizar status / Finalizar"><CheckCircle2 className="h-4 w-4" /></button>
                    )}
                    {canManageEquipe(os.equipe) && (
                      <>
                        <button onClick={e => { e.stopPropagation(); handleEditar(os); }} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover" title="Editar">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {isAdminOnly && (
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(os.id); }} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </>
                    )}
                  </div>
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
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Nova'} Ordem de Serviço</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Número <span className="text-red-500">*</span></label>
                  <input type="text" value={formNumero} readOnly disabled className={inputCls + ' opacity-70'} />
                  <p className="mt-1 text-[11px] text-graphite-400">Numeração automática por ano</p>
                </div>
                <div>
                  <label className={labelCls}>Data de Emissão</label>
                  <input type="date" value={formData} onChange={e => setFormData(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Solicitante <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formSolicitanteNome ? `${formSolicitanteNome}${formSolicitanteCargo ? ` - ${formSolicitanteCargo}` : ''}` : searchSol}
                  readOnly
                  disabled
                  className={inputCls + ' opacity-80'}
                />
                {formSolicitanteNome && <p className="mt-1 text-xs text-emerald-600 font-medium">{formSolicitanteNome}{formSolicitanteCargo ? ` · ${formSolicitanteCargo}` : ''}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={formEquipe} onChange={e => setFormEquipe(e.target.value)} className={inputCls} disabled={!canManageGlobal}>
                    <option value="">Selecione</option>
                    {EQUIPES.filter(eq => canManageGlobal || eq === equipeEfetiva).map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prioridade</label>
                  <select value={formPrioridade} onChange={e => setFormPrioridade(e.target.value)} className={inputCls}>
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Local do Problema</label>
                <input type="text" value={formLocal} onChange={e => setFormLocal(e.target.value)} placeholder="Ex: Hangar, Terminal de Passageiros, Pátio de Manobras, Seção Administrativa..." className={inputCls} />
              </div>

              {editando && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={inputCls}>
                      {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Data de Conclusão</label>
                    <input type="date" value={formConclusao} onChange={e => setFormConclusao(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Descrição do Serviço <span className="text-red-500">*</span></label>
                <textarea value={formDescricao} onChange={e => setFormDescricao(e.target.value)} rows={4} placeholder="Descreva o serviço..." className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Imagens do Problema</label>
                <div className="space-y-3">
                  {formImagens.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {formImagens.map((imagem, index) => (
                        <div key={`${imagem.slice(0, 32)}-${index}`} className="relative rounded-xl border border-graphite-200 bg-graphite-50/60 p-2 dark:border-border-dark dark:bg-surface-card">
                          <img src={imagem} alt={`Imagem da OS ${index + 1}`} className="h-40 w-full rounded-lg object-contain" />
                          <button type="button" onClick={() => removerImagem(index)} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-700 dark:bg-surface-elevated dark:hover:bg-red-900/20" title="Remover imagem">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-graphite-300 bg-graphite-50/60 px-6 py-5 text-center text-sm text-graphite-500 transition-colors hover:border-aviation-400 hover:text-aviation-600 dark:border-border-dark dark:bg-surface-card dark:text-graphite-400">
                    <ImagePlus className="mb-2 h-7 w-7 text-graphite-300 dark:text-graphite-500" />
                    Adicionar imagem
                    <input type="file" accept="image/*" className="hidden" onChange={e => { handleImagem(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
                  </label>
                </div>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={formObservacoes} onChange={e => setFormObservacoes(e.target.value)} rows={3} placeholder="Observações..." className={inputCls} />
              </div>

              <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={handleSalvar} disabled={!formNumero || !formSolicitante || !formDescricao || !formEquipe}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                  <Save className="h-4 w-4" /> Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate View (print) */}
      {visualizando && (
        <div className="os-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setVisualizando(null)}>
          <div className="os-print-card relative max-h-[90vh] w-full max-w-3xl mx-4 overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl dark:bg-surface-elevated" onClick={e => e.stopPropagation()}>
            <style>{`
              @media print {
                @page { size: A4; margin: 7mm 10mm; }
                html, body { height: auto !important; }
                body * { visibility: hidden; }
                #print-area, #print-area * { visibility: visible; }
                #print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  box-shadow: none !important;
                }
                .os-print-overlay {
                  position: static !important;
                  background: white !important;
                  display: block !important;
                  overflow: visible !important;
                }
                .os-print-card {
                  position: static !important;
                  max-height: none !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  overflow: visible !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  padding: 0 !important;
                }
                .no-print { display: none !important; }
                #print-area { font-size: 10pt; }
                #print-area .space-y-4 > * { margin-top: 0 !important; }
                #print-area .space-y-4 > * + * { margin-top: 5pt !important; }
                #print-area h1 { font-size: 13pt !important; }
                #print-area p { font-size: 9pt !important; margin: 1.5pt 0 !important; }
                #print-area .grid { gap: 2pt 10pt !important; }
                #print-area .grid > * { font-size: 9pt !important; }
                #print-area .rounded-lg { padding: 4pt 6pt !important; }
                #print-area img { max-height: 60mm !important; }
                #print-area .border-b-2 { padding-bottom: 4pt !important; margin-bottom: 5pt !important; }
              }
            `}</style>
            <div className="no-print mb-4 flex justify-end gap-2">
              <button onClick={() => { document.title = `ORDEM DE SERVIÇO Nº ${visualizando.numero}`; window.print(); }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg dark:from-aviation-500 dark:to-aviation-600 dark:text-white"><Printer className="h-4 w-4" /> Imprimir</button>
              <button onClick={() => setVisualizando(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Fechar</button>
            </div>
            <div id="print-area" className="space-y-4">
              <div className="border-b-2 border-graphite-800 pb-3 text-center dark:border-graphite-200">
                <h1 className="text-xl font-black text-graphite-900 uppercase dark:text-graphite-100">ORDEM DE SERVIÇO</h1>
                <p className="text-sm text-graphite-500 dark:text-graphite-400">{visualizando.numero}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm dark:text-graphite-200">
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Número:</span> {visualizando.numero}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Solicitante:</span> {visualizando.solicitanteNome}{visualizando.solicitanteCargo ? ` (${visualizando.solicitanteCargo})` : ''}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Equipe:</span> {visualizando.equipe || 'N/A'}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Emissão:</span> {fmt(visualizando.dataEmissao)}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Conclusão:</span> {fmt(visualizando.dataConclusao) || '-'}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Prioridade:</span> {visualizando.prioridade}</div>
                <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Status:</span> {visualizando.status}</div>
                {visualizando.local && <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Local:</span> {visualizando.local}</div>}
                {visualizando.finalizadoPor && (
                  <>
                    <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Finalizado por:</span> {visualizando.finalizadoPor}{visualizando.finalizadoPorCargo ? ` (${visualizando.finalizadoPorCargo})` : ''}</div>
                    <div><span className="font-bold text-graphite-600 dark:text-graphite-300">Empresa:</span> {visualizando.empresaFinalizacao || '-'}</div>
                  </>
                )}
              </div>
              {visualizando.motivoManutencao && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
                  <p className="mb-1 font-bold">Manutenção não concluída</p>
                  <p className="whitespace-pre-wrap">{visualizando.motivoManutencao}</p>
                  {visualizando.manutencaoPor && <p className="mt-2 text-xs opacity-80">Em manutenção por: {visualizando.manutencaoPor}{visualizando.manutencaoPorCargo ? ` (${visualizando.manutencaoPorCargo})` : ''}{visualizando.manutencaoEmpresaPessoa ? ` · ${visualizando.manutencaoEmpresaPessoa}` : ''}{visualizando.manutencaoEmpresa ? ` · ${visualizando.manutencaoEmpresa}` : ''}{visualizando.dataManutencao ? ` · ${fmt(visualizando.dataManutencao)}` : ''}</p>}
                </div>
              )}
              {visualizando.finalizacaoDescricao && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
                  <p className="mb-1 font-bold">Descrição da finalização</p>
                  <p className="whitespace-pre-wrap">{visualizando.finalizacaoDescricao}</p>
                  {visualizando.finalizadoPor && <p className="mt-2 text-xs opacity-80">Finalizado por: {visualizando.finalizadoPor}{visualizando.finalizadoPorCargo ? ` (${visualizando.finalizadoPorCargo})` : ''}{visualizando.finalizacaoEmpresaPessoa ? ` · ${visualizando.finalizacaoEmpresaPessoa}` : ''}{visualizando.empresaFinalizacao ? ` · ${visualizando.empresaFinalizacao}` : ''}{visualizando.dataFinalizacao ? ` · ${fmt(visualizando.dataFinalizacao)}` : ''}</p>}
                </div>
              )}
              {visualizando.motivoCancelamento && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <p className="mb-1 font-bold">Motivo do cancelamento</p>
                  <p className="whitespace-pre-wrap">{visualizando.motivoCancelamento}</p>
                  {visualizando.canceladoPor && <p className="mt-2 text-xs opacity-80">Cancelado por: {visualizando.canceladoPor}{visualizando.canceladoPorCargo ? ` (${visualizando.canceladoPorCargo})` : ''}{visualizando.dataCancelamento ? ` · ${fmt(visualizando.dataCancelamento)}` : ''}</p>}
                </div>
              )}
              <div>
                <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Descrição</h2>
                <div className="rounded-lg border border-graphite-300 bg-graphite-50 p-4 text-sm text-graphite-900 whitespace-pre-wrap dark:border-border-dark dark:bg-surface-hover dark:text-graphite-100">{visualizando.descricao}</div>
              </div>
              {imagensVisualizando.length > 0 && (
                <div>
                  <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Imagens do Problema</h2>
                  <div className={imagensVisualizando.length === 1 ? '' : 'grid grid-cols-2 gap-3'}>
                    {imagensVisualizando.map((imagem, index) => (
                      <img key={`${imagem.slice(0, 32)}-${index}`} src={imagem} alt={`Imagem da OS ${index + 1}`} className="max-h-72 w-full rounded-lg border border-graphite-300 object-contain dark:border-border-dark" />
                    ))}
                  </div>
                </div>
              )}
              {visualizando.observacoes && (
                <div>
                  <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Observações</h2>
                  <div className="rounded-lg border border-graphite-300 bg-graphite-50 p-4 text-sm text-graphite-900 whitespace-pre-wrap dark:border-border-dark dark:bg-surface-hover dark:text-graphite-100">{visualizando.observacoes}</div>
                </div>
              )}
              <div className="pt-4 text-center text-xs text-graphite-400 border-t border-graphite-200 dark:border-border-dark dark:text-graphite-500">
                Documento gerado em {formatarDataHoraBR(new Date())}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finalizar Modal */}
      {finalizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-1 text-lg font-bold text-graphite-900 dark:text-graphite-100">Atualizar Ordem de Serviço</h3>
            <p className="mb-5 text-sm text-graphite-500">{finalizando.numero} — a manutenção pode levar mais de um dia. Informe o status e, se concluída, quem finalizou.</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Status <span className="text-red-500">*</span></label>
                <select value={formStatusFinalizacao} onChange={e => setFormStatusFinalizacao(e.target.value as OrdemServico['status'])} className={inputCls}>
                  {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {formStatusFinalizacao === 'Manutenção' && (
                <>
                  <div>
                    <label className={labelCls}>Quem deixou em manutenção</label>
                    <input type="text" value={formManutencaoPor} readOnly disabled className={inputCls + ' opacity-70'} />
                    {user?.pessoa?.funcao && <p className="mt-1 text-[11px] text-graphite-400">{user.pessoa.funcao}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Pessoa da empresa responsável <span className="text-red-500">*</span></label>
                    <input type="text" value={formManutencaoEmpresaPessoa} onChange={e => setFormManutencaoEmpresaPessoa(e.target.value)} placeholder="Nome da pessoa da empresa responsável" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Empresa responsável <span className="text-red-500">*</span></label>
                    <input type="text" value={formEmpresaManutencao} onChange={e => setFormEmpresaManutencao(e.target.value)} placeholder="Ex: Terceirizada XYZ, Equipe Interna..." className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Descrição / Motivo da manutenção não concluída <span className="text-red-500">*</span></label>
                    <textarea value={formMotivoManutencao} onChange={e => setFormMotivoManutencao(e.target.value)} rows={3}
                      placeholder="Descreva por que não foi finalizado..." className={inputCls} />
                  </div>
                </>
              )}
              {formStatusFinalizacao === 'Concluída' && (
                <>
                  <div>
                    <label className={labelCls}>Quem finalizou</label>
                    <input type="text" value={formFinalizadoPor} readOnly disabled className={inputCls + ' opacity-70'} />
                    {user?.pessoa?.funcao && <p className="mt-1 text-[11px] text-graphite-400">{user.pessoa.funcao}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Pessoa da empresa que finalizou <span className="text-red-500">*</span></label>
                    <input type="text" value={formFinalizacaoEmpresaPessoa} onChange={e => setFormFinalizacaoEmpresaPessoa(e.target.value)} placeholder="Nome da pessoa da empresa que finalizou" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Empresa que finalizou <span className="text-red-500">*</span></label>
                    <input type="text" value={formEmpresaFinalizacao} onChange={e => setFormEmpresaFinalizacao(e.target.value)} placeholder="Ex: Terceirizada XYZ, Equipe Interna..." className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Descrição da finalização <span className="text-red-500">*</span></label>
                    <textarea value={formFinalizacaoDescricao} onChange={e => setFormFinalizacaoDescricao(e.target.value)} rows={3}
                      placeholder="Descreva o que foi feito para concluir a ordem de serviço..." className={inputCls} />
                  </div>
                </>
              )}
              {formStatusFinalizacao === 'Cancelada' && (
                <>
                  <div>
                    <label className={labelCls}>Quem cancelou</label>
                    <input type="text" value={formCanceladoPor} readOnly disabled className={inputCls + ' opacity-70'} />
                    {user?.pessoa?.funcao && <p className="mt-1 text-[11px] text-graphite-400">{user.pessoa.funcao}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Motivo do cancelamento <span className="text-red-500">*</span></label>
                    <textarea value={formMotivoCancelamento} onChange={e => setFormMotivoCancelamento(e.target.value)} rows={3}
                      placeholder="Descreva por que a ordem de serviço foi cancelada..." className={inputCls} />
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFinalizando(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={handleFinalizar} disabled={(formStatusFinalizacao === 'Concluída' && (!formFinalizacaoEmpresaPessoa.trim() || !formEmpresaFinalizacao.trim() || !formFinalizacaoDescricao.trim())) || (formStatusFinalizacao === 'Manutenção' && (!formManutencaoEmpresaPessoa.trim() || !formEmpresaManutencao.trim() || !formMotivoManutencao.trim())) || (formStatusFinalizacao === 'Cancelada' && !formMotivoCancelamento.trim())}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir esta OS?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default OrdemServico;
