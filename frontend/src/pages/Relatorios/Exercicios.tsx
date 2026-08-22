import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Target, Award, Search, ChevronDown, ChevronUp, Timer, Lock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { formatarDataBR } from '../../utils/datas';

interface Treinamento {
  id: string; tipo: string; data: string; titulo: string;
  descricao: string; cargaHoraria: number; instrutor: string;
  participantes: string[]; createdAt: string;
}

const STORAGE_KEY = 'sescinc-treinamentos';

function carregar(): Treinamento[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function fmt(d: string) {
  return formatarDataBR(d);
}

export function Exercicios() {
  const { canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const navigate = useNavigate();
  const [treinos, setTreinos] = useState<Treinamento[]>([]);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingContexto && canVisualizarRelatorios) setTreinos(carregar());
  }, [canVisualizarRelatorios, loadingContexto]);

  const filtered = useMemo(() => {
    let lista = treinos;
    if (filterTipo) lista = lista.filter(t => t.tipo === filterTipo);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(t => t.titulo.toLowerCase().includes(s) || t.instrutor.toLowerCase().includes(s));
    }
    return lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [treinos, search, filterTipo]);

  const stats = useMemo(() => ({
    total: treinos.length,
    tipos: new Set(treinos.map(t => t.tipo)).size,
  }), [treinos]);

  if (loadingContexto) {
    return <PageContainer><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /></div></PageContainer>;
  }

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
      <PageTitle icon={Activity} title="Exercícios" />
      <div className="mb-4 grid grid-cols-2 gap-3 max-w-sm">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
          <p className="text-[10px] font-medium text-graphite-500">Total</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center dark:border-rose-800 dark:bg-rose-900/20">
          <p className="text-xl font-black text-rose-700 dark:text-rose-300">{stats.tipos}</p>
          <p className="text-[10px] font-medium text-rose-500">Tipos</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button onClick={() => navigate('/treinamentos')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
          <Activity className="h-4 w-4" /> Gerenciar Treinamentos
        </button>
        <button onClick={() => navigate('/relatorios/exercicios/taf')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
          <Target className="h-4 w-4" /> TAF
        </button>
        <button onClick={() => navigate('/relatorios/exercicios/tp-epr')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
          <Award className="h-4 w-4" /> TP/EPR
        </button>
        <button onClick={() => navigate('/relatorios/exercicios/posicionamento')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
          <Target className="h-4 w-4" /> Posicionamento
        </button>
        <button onClick={() => navigate('/relatorios/exercicios/tempo-resposta')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
          <Timer className="h-4 w-4" /> Tempo Resposta
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
          <option value="">Todos tipos</option>
          <option value="posicionamento">Posicionamento para Intervenção</option>
          <option value="tempo-resposta">Exercício de Tempo Resposta</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Activity className="mb-4 h-12 w-12 text-graphite-300" />
          <h3 className="text-lg font-semibold text-graphite-700">Nenhum exercício encontrado</h3>
          <p className="text-sm text-graphite-400">Cadastre treinamentos pelo menu Treinamentos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
              <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                  t.tipo === 'posicionamento' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                }`}>
                  {t.tipo === 'posicionamento' ? <Target className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{t.titulo}</p>
                  <p className="text-xs text-graphite-500">{fmt(t.data)} · {t.instrutor} · {t.cargaHoraria}h</p>
                </div>
                <span className="text-xs text-graphite-400">{t.participantes.length} part.</span>
                {expandedId === t.id ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
              </button>
              {expandedId === t.id && (
                <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                  <p className="text-sm text-graphite-700 dark:text-graphite-300">{t.descricao}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default Exercicios;
