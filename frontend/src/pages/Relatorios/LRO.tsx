import { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Search, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { listarLROs } from '../../services/lroService';
import type { LRO } from '../../types/lro';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { formatarDataBR } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';

const RELATORIO_LRO_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Relatório LRO',
    body: 'Esta página lista os LROs já gerados e salvos no sistema.',
    detail: 'Use para consultar documentos finalizados por equipe, data de entrada, turno e chefe de equipe.',
  },
  {
    selector: 'main .mb-4.grid',
    title: 'Resumo por equipe',
    body: 'Os cards mostram o total geral de LROs e a quantidade por equipe encontrada.',
    detail: 'O resumo ajuda a perceber rapidamente se uma equipe já possui documentos no período carregado.',
  },
  {
    selector: 'main input, main select',
    title: 'Pesquisa e equipe',
    body: 'Pesquise por equipe, chefe ou data e filtre por equipe.',
    detail: 'Use para localizar um LRO específico sem precisar abrir item por item.',
  },
  {
    selector: 'main .space-y-2',
    title: 'Lista de LROs',
    body: 'Cada card representa um LRO salvo. Clique no card para expandir os dados brutos do registro.',
    detail: 'A emissão e edição principal do LRO continuam na tela Gerar LRO; aqui a ideia é conferência e consulta.',
  },
];

function fmt(d: string) {
  return formatarDataBR(d);
}

export function LRO() {
  const { canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const [lros, setLros] = useState<LRO[]>([]);
  const [search, setSearch] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadingContexto) return;
    if (!canVisualizarRelatorios) {
      setLoading(false);
      return;
    }
    listarLROs().then(l => { setLros(l); setLoading(false); }).catch(() => setLoading(false));
  }, [canVisualizarRelatorios, loadingContexto]);

  const filtered = useMemo(() => {
    let lista = lros;
    if (filterEquipe) lista = lista.filter(l => l.equipe === filterEquipe);
    if (search) {
      const t = search.toLowerCase();
      lista = lista.filter(l =>
        l.equipe?.toLowerCase().includes(t) ||
        l.chefeEquipe?.toLowerCase().includes(t) ||
        l.dataEntrada?.includes(t)
      );
    }
    return lista.sort((a, b) => new Date(b.dataEntrada || '').getTime() - new Date(a.dataEntrada || '').getTime());
  }, [lros, search, filterEquipe]);

  const equipes = useMemo(() => [...new Set(lros.map(l => l.equipe).filter(Boolean))], [lros]);
  const stats = useMemo(() => ({
    total: lros.length,
    porEquipe: equipes.map(eq => ({ equipe: eq, total: lros.filter(l => l.equipe === eq).length })),
  }), [lros, equipes]);

  if (loading || loadingContexto) return <PageContainer><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /></div></PageContainer>;

  if (!canVisualizarRelatorios) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">A tela de relatórios está disponível apenas para GS e administradores do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={FileSpreadsheet} title="Relatório LRO" />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
          <p className="text-[10px] font-medium text-graphite-500">Total de LROs</p>
        </div>
        {stats.porEquipe.map(e => (
          <div key={e.equipe} className="rounded-xl border border-aviation-200 bg-aviation-50 p-3 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
            <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{e.total}</p>
            <p className="text-[10px] font-medium text-aviation-500">Equipe {e.equipe}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
        </div>
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)} className="rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
          <option value="">Todas equipes</option>
          {equipes.map(eq => <option key={eq} value={eq}>{eq}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <FileSpreadsheet className="mb-4 h-12 w-12 text-graphite-300" />
          <h3 className="text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum LRO encontrado</h3>
          <p className="text-sm text-graphite-400">Gere LROs pelos Registros Diários.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lro => (
            <div key={lro.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
              <button onClick={() => setExpandedId(expandedId === lro.id ? null : lro.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">LRO - Equipe {lro.equipe}</p>
                  <p className="text-xs text-graphite-500">{fmt(lro.dataEntrada)} - {lro.chefeEquipe || 'N/A'}</p>
                </div>
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{lro.turno}</span>
                {expandedId === lro.id ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
              </button>
              {expandedId === lro.id && (
                <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                  <pre className="whitespace-pre-wrap text-xs text-graphite-600 dark:text-graphite-400">{JSON.stringify(lro, null, 2).slice(0, 2000)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <PageTour
        steps={RELATORIO_LRO_TOUR_STEPS}
        targetAttribute="data-relatorio-lro-tour"
        title="Abrir tutorial do Relatório LRO"
        detailLabel="Consulta"
      />
    </PageContainer>
  );
}

export default LRO;
