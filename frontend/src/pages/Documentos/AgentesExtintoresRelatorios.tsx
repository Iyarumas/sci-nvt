import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft, CheckCircle2, Download, Eye, FileText, FlaskConical,
  Package, Plus, Save, Trash2, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAgentesExtintores } from '../../services/agenteExtintorService';
import {
  atualizarRelatorioAgentesExtintores,
  criarMovimentacaoAgenteExtintor,
  criarRelatorioAgentesExtintores,
  excluirMovimentacaoAgenteExtintor,
  excluirRelatorioAgentesExtintores,
  listarRelatoriosAgentesExtintores,
  obterItensRelatorioAgentesExtintores,
  obterMovimentacoesAgentesExtintores,
} from '../../services/agenteExtintorRelatorioService';
import {
  baixarRelatorioAgentesExtintoresPdf,
  gerarRelatorioAgentesExtintoresPdf,
  nomeArquivoRelatorioAgentesExtintores,
} from '../../services/agenteExtintorRelatorioPdfService';
import type { AgenteExtintor } from '../../types/agenteExtintor';
import {
  TIPOS_MOVIMENTACAO_AGENTE_EXTINTOR,
  type AgenteExtintorMovimentacao,
  type AgenteExtintorRelatorio,
  type AgenteExtintorRelatorioItem,
  type TipoMovimentacaoAgenteExtintor,
} from '../../types/agenteExtintorRelatorio';
import { hojeLocalISO, formatarDataBR } from '../../utils/datas';
import { canGerenciarCadastroModulo } from '../../utils/permissoes';

const INPUT = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';
const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type ResumoForm = Pick<AgenteExtintorRelatorio,
  'dataRelatorio' | 'pqExigido' | 'lgeExigido' | 'aguaExigida' |
  'aguaEmLinha' | 'aguaCciRt' | 'aguaEstoque' | 'reservaTecnicaPercentual' | 'observacoes'>;

const hoje = hojeLocalISO();

function resumoDoRelatorio(relatorio: AgenteExtintorRelatorio): ResumoForm {
  return {
    dataRelatorio: relatorio.dataRelatorio,
    pqExigido: relatorio.pqExigido,
    lgeExigido: relatorio.lgeExigido,
    aguaExigida: relatorio.aguaExigida,
    aguaEmLinha: relatorio.aguaEmLinha,
    aguaCciRt: relatorio.aguaCciRt,
    aguaEstoque: relatorio.aguaEstoque,
    reservaTecnicaPercentual: relatorio.reservaTecnicaPercentual,
    observacoes: relatorio.observacoes,
  };
}

export default function AgentesExtintoresRelatorios() {
  const navigate = useNavigate();
  const { user, contexto } = useContextoOperacional();
  const canManage = canGerenciarCadastroModulo(contexto, 'agentesExtintores');
  const [relatorios, setRelatorios] = useState<AgenteExtintorRelatorio[]>([]);
  const [agentes, setAgentes] = useState<AgenteExtintor[]>([]);
  const [selecionado, setSelecionado] = useState<AgenteExtintorRelatorio | null>(null);
  const [itens, setItens] = useState<AgenteExtintorRelatorioItem[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<AgenteExtintorMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [showMovimento, setShowMovimento] = useState(false);
  const [previewData, setPreviewData] = useState<ArrayBuffer | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [filtroAno, setFiltroAno] = useState(String(new Date().getFullYear()));
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1);
  const [novoAno, setNovoAno] = useState(new Date().getFullYear());
  const [novoData, setNovoData] = useState(hoje);
  const [resumo, setResumo] = useState<ResumoForm | null>(null);
  const [movAgenteId, setMovAgenteId] = useState('');
  const [movData, setMovData] = useState(hoje);
  const [movTipo, setMovTipo] = useState<TipoMovimentacaoAgenteExtintor>('Inspeção');
  const [movResultado, setMovResultado] = useState('');
  const [movValidade, setMovValidade] = useState('');
  const [movQuantidadeAnterior, setMovQuantidadeAnterior] = useState(0);
  const [movQuantidadeNova, setMovQuantidadeNova] = useState(0);
  const [movUnidade, setMovUnidade] = useState('');
  const [movObservacoes, setMovObservacoes] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [listaRelatorios, listaAgentes] = await Promise.all([
        listarRelatoriosAgentesExtintores(),
        listarAgentesExtintores(),
      ]);
      setRelatorios(listaRelatorios);
      setAgentes(listaAgentes);
    } catch (err) {
      alert('Erro ao carregar relatórios: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  async function abrirRelatorio(relatorio: AgenteExtintorRelatorio) {
    setProcessing(true);
    try {
      const [listaItens, listaMovimentacoes] = await Promise.all([
        obterItensRelatorioAgentesExtintores(relatorio.id),
        obterMovimentacoesAgentesExtintores(relatorio.id),
      ]);
      setSelecionado(relatorio);
      setResumo(resumoDoRelatorio(relatorio));
      setItens(listaItens);
      setMovimentacoes(listaMovimentacoes);
    } catch (err) {
      alert('Erro ao abrir relatório: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessing(false);
    }
  }

  async function criarRelatorio(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setProcessing(true);
    try {
      const competencia = `${novoAno}-${String(novoMes).padStart(2, '0')}`;
      const existente = relatorios.find(item => item.competencia === competencia);
      if (existente) {
        setShowNovo(false);
        await abrirRelatorio(existente);
        return;
      }
      const criado = await criarRelatorioAgentesExtintores({
        competencia,
        dataRelatorio: novoData,
        createdBy: user?.username || user?.name || '',
        agentes,
      });
      setRelatorios(prev => [criado, ...prev]);
      setShowNovo(false);
      await abrirRelatorio(criado);
    } catch (err) {
      alert('Erro ao criar relatório: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessing(false);
    }
  }

  async function salvarResumo() {
    if (!selecionado || !resumo || selecionado.status !== 'Rascunho' || !canManage) return;
    setProcessing(true);
    try {
      const atualizado = await atualizarRelatorioAgentesExtintores(selecionado.id, resumo);
      setSelecionado(atualizado);
      setRelatorios(prev => prev.map(item => item.id === atualizado.id ? atualizado : item));
      setResumo(resumoDoRelatorio(atualizado));
    } catch (err) {
      alert('Erro ao salvar relatório: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessing(false);
    }
  }

  function selecionarAgenteMovimento(id: string) {
    setMovAgenteId(id);
    const agente = agentes.find(item => item.id === id);
    if (agente) {
      setMovQuantidadeAnterior(agente.quantidade);
      setMovQuantidadeNova(agente.quantidade);
      setMovUnidade(agente.unidade);
    }
  }

  function limparMovimento() {
    setMovAgenteId('');
    setMovData(hoje);
    setMovTipo('Inspeção');
    setMovResultado('');
    setMovValidade('');
    setMovQuantidadeAnterior(0);
    setMovQuantidadeNova(0);
    setMovUnidade('');
    setMovObservacoes('');
  }

  async function salvarMovimento(event: FormEvent) {
    event.preventDefault();
    if (!selecionado || !movAgenteId || selecionado.status !== 'Rascunho' || !canManage) return;
    setProcessing(true);
    try {
      const criado = await criarMovimentacaoAgenteExtintor({
        relatorioId: selecionado.id,
        agenteExtintorId: movAgenteId,
        data: movData,
        tipo: movTipo,
        resultado: movResultado,
        validadeResultante: movValidade,
        quantidadeAnterior: movQuantidadeAnterior,
        quantidadeNova: movQuantidadeNova,
        unidade: movUnidade,
        observacoes: movObservacoes,
        createdBy: user?.username || user?.name || '',
      });
      setMovimentacoes(prev => [...prev, criado]);
      setShowMovimento(false);
      limparMovimento();
    } catch (err) {
      alert('Erro ao registrar movimentação: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessing(false);
    }
  }

  async function removerMovimento(id: string) {
    if (!canManage || selecionado?.status !== 'Rascunho') return;
    setProcessing(true);
    try {
      await excluirMovimentacaoAgenteExtintor(id);
      setMovimentacoes(prev => prev.filter(item => item.id !== id));
    } finally {
      setProcessing(false);
    }
  }

  async function finalizar() {
    if (!selecionado || !resumo || !canManage || selecionado.status !== 'Rascunho') return;
    if (!confirm('Finalizar este relatório? Depois disso os dados do mês ficarão bloqueados.')) return;
    setProcessing(true);
    try {
      const atualizado = await atualizarRelatorioAgentesExtintores(selecionado.id, {
        ...resumo,
        status: 'Finalizado',
        finalizadoPor: user?.name || user?.username || '',
        finalizadoEm: new Date().toISOString(),
      });
      setSelecionado(atualizado);
      setRelatorios(prev => prev.map(item => item.id === atualizado.id ? atualizado : item));
    } finally {
      setProcessing(false);
    }
  }

  async function visualizarPdf() {
    if (!selecionado) return;
    setProcessing(true);
    try {
      const blob = await gerarRelatorioAgentesExtintoresPdf({ relatorio: selecionado, itens, movimentacoes });
      setPreviewData(await blob.arrayBuffer());
      setPreviewName(nomeArquivoRelatorioAgentesExtintores(selecionado.competencia));
    } finally {
      setProcessing(false);
    }
  }

  async function baixarPdf() {
    if (!selecionado || selecionado.status === 'Rascunho') return;
    setProcessing(true);
    try {
      await baixarRelatorioAgentesExtintoresPdf({ relatorio: selecionado, itens, movimentacoes });
    } finally {
      setProcessing(false);
    }
  }

  async function excluirRelatorio(id: string) {
    if (!canManage || !confirm('Excluir este relatório em rascunho?')) return;
    setProcessing(true);
    try {
      await excluirRelatorioAgentesExtintores(id);
      setRelatorios(prev => prev.filter(item => item.id !== id));
      if (selecionado?.id === id) setSelecionado(null);
    } finally {
      setProcessing(false);
    }
  }

  const filtrados = useMemo(
    () => relatorios.filter(item => !filtroAno || item.competencia.startsWith(filtroAno)),
    [relatorios, filtroAno],
  );

  if (selecionado && resumo) {
    const bloqueado = selecionado.status !== 'Rascunho';
    return (
      <PageContainer>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setSelecionado(null)} className="flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void visualizarPdf()} disabled={processing} className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-sm font-semibold text-aviation-700 disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              <Eye className="h-4 w-4" /> Visualizar
            </button>
            {!bloqueado && canManage && (
              <button onClick={() => void finalizar()} disabled={processing} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Finalizar
              </button>
            )}
            {bloqueado && (
              <button onClick={() => void baixarPdf()} disabled={processing} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <Download className="h-4 w-4" /> Baixar PDF
              </button>
            )}
          </div>
        </div>

        <PageTitle icon={FileText} title="Relatório de Agentes Extintores" subtitle={`${MESES[Number(selecionado.competencia.slice(5, 7)) - 1]} de ${selecionado.competencia.slice(0, 4)} · ${selecionado.status}`} />

        <section className="mt-6 border-y border-graphite-200 py-5 dark:border-border-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-graphite-900 dark:text-graphite-100">Fotografia do cadastro</h2>
            <span className="text-xs text-graphite-500">{itens.length} item(ns)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-graphite-200 text-left dark:border-border-dark">
                <th className="px-2 py-2">Produto</th><th className="px-2 py-2">Marca</th><th className="px-2 py-2">Lote</th><th className="px-2 py-2">Localização</th><th className="px-2 py-2">Quantidade</th><th className="px-2 py-2">Validade</th>
              </tr></thead>
              <tbody>{itens.map(item => <tr key={item.id} className="border-b border-graphite-100 dark:border-border-dark">
                <td className="px-2 py-2 font-semibold">{item.produto}</td><td className="px-2 py-2">{item.marcaAgente}</td><td className="px-2 py-2">{item.lote}</td><td className="px-2 py-2">{item.localizacao || '-'}</td><td className="px-2 py-2">{item.quantidade} {item.unidade}</td><td className="px-2 py-2">{formatarDataBR(item.validade)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-bold text-graphite-900 dark:text-graphite-100">Movimentações e testes</h2><p className="text-sm text-graphite-500">Registre somente o que aconteceu durante esta competência.</p></div>
            {!bloqueado && canManage && <button onClick={() => setShowMovimento(true)} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Novo registro</button>}
          </div>
          {movimentacoes.length === 0 ? <p className="rounded-lg border border-dashed border-graphite-300 px-4 py-6 text-center text-sm text-graphite-500 dark:border-border-dark">Sem alterações ou testes registrados no período.</p> : (
            <div className="space-y-2">{movimentacoes.map(mov => {
              const item = itens.find(i => i.agenteExtintorId === mov.agenteExtintorId);
              return <div key={mov.id} className="flex items-center justify-between gap-3 border-b border-graphite-200 py-3 dark:border-border-dark">
                <div><p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{mov.tipo} · {item?.produto || 'Agente'} {item?.lote ? `- lote ${item.lote}` : ''}</p><p className="text-xs text-graphite-500">{formatarDataBR(mov.data)} · {mov.resultado || 'Sem resultado informado'}{mov.validadeResultante ? ` · validade ${formatarDataBR(mov.validadeResultante)}` : ''}</p></div>
                {!bloqueado && canManage && <button onClick={() => void removerMovimento(mov.id)} title="Excluir registro" className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>}
              </div>;
            })}</div>
          )}
        </section>

        <section className="border-t border-graphite-200 py-6 dark:border-border-dark">
          <h2 className="mb-4 text-base font-bold text-graphite-900 dark:text-graphite-100">Quantidades exigidas e disponíveis</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['pqExigido', 'PQ exigido (kg)'], ['lgeExigido', 'LGE exigido (L)'], ['aguaExigida', 'Água exigida (L)'],
              ['aguaEmLinha', 'Água em linha (L)'], ['aguaCciRt', 'Água no CCI-RT (L)'], ['aguaEstoque', 'Água no estoque (L)'],
              ['reservaTecnicaPercentual', 'Reserva técnica (%)'],
            ] as const).map(([key, label]) => <div key={key}><label className={LABEL}>{label}</label><input type="number" value={resumo[key]} disabled={bloqueado} onChange={e => setResumo(prev => prev ? { ...prev, [key]: Number(e.target.value || 0) } : prev)} className={INPUT} /></div>)}
            <div><label className={LABEL}>Data do relatório</label><input type="date" value={resumo.dataRelatorio} disabled={bloqueado} onChange={e => setResumo(prev => prev ? { ...prev, dataRelatorio: e.target.value } : prev)} className={INPUT} /></div>
          </div>
          <div className="mt-4"><label className={LABEL}>Observações gerais</label><textarea rows={3} value={resumo.observacoes} disabled={bloqueado} onChange={e => setResumo(prev => prev ? { ...prev, observacoes: e.target.value } : prev)} className={INPUT} /></div>
          {!bloqueado && canManage && <div className="mt-4 flex justify-end"><button onClick={() => void salvarResumo()} disabled={processing} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" /> Salvar informações</button></div>}
        </section>

        {showMovimento && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-surface-elevated">
          <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold">Novo registro do período</h3><button onClick={() => setShowMovimento(false)} title="Fechar"><X className="h-5 w-5" /></button></div>
          <form onSubmit={salvarMovimento} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={LABEL}>Agente extintor</label><select value={movAgenteId} onChange={e => selecionarAgenteMovimento(e.target.value)} className={INPUT} required><option value="">Selecione...</option>{agentes.map(a => <option key={a.id} value={a.id}>{a.produto} · {a.marcaAgente} · lote {a.lote} · {a.localizacao}</option>)}</select></div>
            <div><label className={LABEL}>Data</label><input type="date" value={movData} onChange={e => setMovData(e.target.value)} className={INPUT} required /></div>
            <div><label className={LABEL}>Tipo</label><select value={movTipo} onChange={e => setMovTipo(e.target.value as TipoMovimentacaoAgenteExtintor)} className={INPUT}>{TIPOS_MOVIMENTACAO_AGENTE_EXTINTOR.map(tipo => <option key={tipo}>{tipo}</option>)}</select></div>
            <div><label className={LABEL}>Quantidade anterior</label><input type="number" value={movQuantidadeAnterior} onChange={e => setMovQuantidadeAnterior(Number(e.target.value || 0))} className={INPUT} /></div>
            <div><label className={LABEL}>Quantidade nova</label><input type="number" value={movQuantidadeNova} onChange={e => setMovQuantidadeNova(Number(e.target.value || 0))} className={INPUT} /></div>
            <div><label className={LABEL}>Resultado</label><input value={movResultado} onChange={e => setMovResultado(e.target.value)} className={INPUT} placeholder="Aprovado, reprovado, conforme..." /></div>
            <div><label className={LABEL}>Nova validade</label><input type="date" value={movValidade} onChange={e => setMovValidade(e.target.value)} className={INPUT} /></div>
            <div className="sm:col-span-2"><label className={LABEL}>Observações</label><textarea rows={3} value={movObservacoes} onChange={e => setMovObservacoes(e.target.value)} className={INPUT} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowMovimento(false)} className="rounded-xl px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={processing} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2 text-sm font-semibold text-white"><FlaskConical className="h-4 w-4" /> Registrar</button></div>
          </form>
        </div></div>}

        {previewData && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-surface-elevated"><div className="flex items-center justify-between border-b border-graphite-200 px-5 py-4 dark:border-border-dark"><div><h3 className="font-bold">{previewName}</h3><p className="text-xs text-graphite-500">Prévia do relatório mensal</p></div><button onClick={() => setPreviewData(null)} title="Fechar"><X className="h-5 w-5" /></button></div><div className="min-h-0 flex-1 overflow-auto bg-graphite-100 p-4 dark:bg-surface-card"><PdfPreview pdfData={previewData} fields={[]} /></div></div></div>}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageTitle icon={Package} title="Agentes Extintores" subtitle="Relatórios mensais, alterações e testes" />
        {canManage && <button onClick={() => setShowNovo(true)} className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Novo relatório</button>}
      </div>
      <div className="mb-5 flex items-center gap-3"><label className="text-sm font-semibold text-graphite-600 dark:text-graphite-300">Ano</label><select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={INPUT}>{Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i).map(ano => <option key={ano}>{ano}</option>)}</select></div>
      {loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /></div> : filtrados.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card"><FileText className="mb-3 h-10 w-10 text-graphite-300" /><h3 className="font-semibold">Nenhum relatório neste ano</h3><p className="mt-1 text-sm text-graphite-500">Crie o relatório da competência desejada.</p></div> : <div className="space-y-2">{filtrados.map(relatorio => {
        const mes = MESES[Number(relatorio.competencia.slice(5, 7)) - 1];
        return <div key={relatorio.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-200 bg-white px-4 py-4 dark:border-border-dark dark:bg-surface-card"><div><p className="font-bold text-graphite-900 dark:text-graphite-100">{mes} de {relatorio.competencia.slice(0, 4)}</p><p className="text-xs text-graphite-500">{relatorio.status} · data {formatarDataBR(relatorio.dataRelatorio)}</p></div><div className="flex gap-2"><button onClick={() => void abrirRelatorio(relatorio)} disabled={processing} className="flex items-center gap-2 rounded-xl border border-aviation-300 px-3 py-2 text-sm font-semibold text-aviation-700 dark:border-aviation-700 dark:text-aviation-300"><Eye className="h-4 w-4" /> Abrir</button>{relatorio.status === 'Rascunho' && canManage && <button onClick={() => void excluirRelatorio(relatorio.id)} title="Excluir rascunho" className="rounded-xl p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>}</div></div>;
      })}</div>}

      {showNovo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-surface-elevated"><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold">Novo relatório mensal</h3><button onClick={() => setShowNovo(false)} title="Fechar"><X className="h-5 w-5" /></button></div><form onSubmit={criarRelatorio} className="space-y-4"><div><label className={LABEL}>Mês</label><select value={novoMes} onChange={e => setNovoMes(Number(e.target.value))} className={INPUT}>{MESES.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}</select></div><div><label className={LABEL}>Ano</label><input type="number" value={novoAno} onChange={e => setNovoAno(Number(e.target.value))} className={INPUT} /></div><div><label className={LABEL}>Data do relatório</label><input type="date" value={novoData} onChange={e => setNovoData(e.target.value)} className={INPUT} required /></div><p className="text-sm text-graphite-500">O cadastro atual será copiado para esta competência e ficará preservado no histórico.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowNovo(false)} className="rounded-xl px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={processing || agentes.length === 0} className="rounded-xl bg-aviation-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Criar relatório</button></div></form></div></div>}
      <button onClick={() => navigate('/cadastro/agentes-extintores')} className="mt-6 flex items-center gap-2 text-sm font-medium text-aviation-700 dark:text-aviation-300"><ArrowLeft className="h-4 w-4" /> Abrir cadastro de agentes extintores</button>
    </PageContainer>
  );
}
