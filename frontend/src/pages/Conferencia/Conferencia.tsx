import { useState, useEffect } from 'react';
import { ClipboardCheck, Flame, Droplets, Check, AlertTriangle, Search, ArrowRight, Clock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarExtintores } from '../../services/extintorService';
import { listarHidrantes } from '../../services/hidranteService';
import { listarConferencias, criarConferencia } from '../../services/conferenciaService';
import type { Extintor } from '../../types/extintor';
import type { Hidrante } from '../../types/hidrante';
import type { Conferencia } from '../../types/conferencia';
import { RESULTADO_FINAL_OPTIONS } from '../../types/conferencia';

const INPUT_CLASS = "w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark";

type View = 'equipamentos' | 'conferir' | 'historico';

export function Conferencia() {
  const { user } = useAuth();

  const [view, setView] = useState<View>('equipamentos');
  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [hidrantes, setHidrantes] = useState<Hidrante[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [filterTab, setFilterTab] = useState<'todos' | 'extintores' | 'hidrantes'>('todos');
  const [termo, setTermo] = useState('');

  const [conferindo, setConferindo] = useState<{ tipo: 'Extintor' | 'Hidrante'; item: Extintor | Hidrante } | null>(null);
  const [resultado, setResultado] = useState<Conferencia['resultadoFinal']>('Aprovado');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const [e, h, c] = await Promise.all([
      listarExtintores(),
      listarHidrantes(),
      listarConferencias(),
    ]);
    setExtintores(e);
    setHidrantes(h);
    setConferencias(c);
  }

  const itensFiltrados = [...extintores.map(e => ({ ...e, _tipo: 'Extintor' as const })), ...hidrantes.map(h => ({ ...h, _tipo: 'Hidrante' as const }))]
    .filter(i => {
      if (filterTab === 'extintores' && i._tipo !== 'Extintor') return false;
      if (filterTab === 'hidrantes' && i._tipo !== 'Hidrante') return false;
      if (termo) {
        const term = termo.toLowerCase();
        if ('numeroSerie' in i && (i.numeroSerie || '').toLowerCase().includes(term)) return true;
        if ('numero' in i && (i.numero || '').toLowerCase().includes(term)) return true;
        if ('localizacao' in i && (i.localizacao || '').toLowerCase().includes(term)) return true;
        if ('numeroExtintor' in i && (i.numeroExtintor || '').toLowerCase().includes(term)) return true;
        return false;
      }
      return true;
    });

  function getLabel(item: Extintor | Hidrante, tipo: string): string {
    if (tipo === 'Extintor') {
      const e = item as Extintor;
      return e.numeroExtintor || e.numeroSerie || 'Sem identificação';
    }
    const h = item as Hidrante;
    return h.numero || 'Sem identificação';
  }

  function getSublabel(item: Extintor | Hidrante, tipo: string): string {
    if (tipo === 'Extintor') {
      const e = item as Extintor;
      return `${e.localizacao}${e.capacidade ? ` · ${e.capacidade}` : ''}`;
    }
    const h = item as Hidrante;
    return `${h.localizacao}${h.pressao ? ` · ${h.pressao}` : ''}`;
  }

  function getStatusConferencia(itemId: string): Conferencia | null {
    return conferencias.find(c => c.itemId === itemId) || null;
  }

  async function handleSalvarConferencia() {
    if (!conferindo || !user) return;
    setSaving(true);
    try {
      await criarConferencia({
        tipo: conferindo.tipo,
        itemId: conferindo.item.id,
        itemNome: getLabel(conferindo.item, conferindo.tipo),
        itemNumero: getLabel(conferindo.item, conferindo.tipo),
        itemLocalizacao: 'localizacao' in conferindo.item ? conferindo.item.localizacao || '' : '',
        dataConferencia: new Date().toISOString(),
        inspetorUsername: user.username || '',
        inspetorNomeGuerra: user.pessoa?.nomeGuerra || user.name || user.username || '',
        inspetorCargo: user.pessoa?.funcao || user.role || '',
        equipe: (user.pessoa?.equipe || 'Embaixador') as Conferencia['equipe'],
        itens: [],
        resultadoFinal: resultado,
        observacoes: obs,
        dataProximaInspecao: '',
        createdBy: user.username || '',
      });
      setConferindo(null);
      setResultado('Aprovado');
      setObs('');
      await carregar();
      setView('historico');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar conferência');
    } finally {
      setSaving(false);
    }
  }

  const resultadoColor = (r: Conferencia['resultadoFinal']) =>
    RESULTADO_FINAL_OPTIONS.find(o => o.value === r)?.color || '';

  const agora = new Date();

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={ClipboardCheck} title="Conferência de Equipamentos" />
        <div className="flex items-center gap-1 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-1 dark:border-border-dark dark:bg-surface-card/50">
          {([
            { key: 'equipamentos' as View, label: 'Equipamentos' },
            { key: 'historico' as View, label: 'Histórico' },
          ]).map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                view === v.key
                  ? 'bg-white text-aviation-700 shadow-sm dark:bg-graphite-900 dark:text-aviation-300'
                  : 'text-graphite-500 hover:text-graphite-700 dark:text-graphite-400 dark:hover:text-graphite-200'
              }`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'equipamentos' && (
        <>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
              <input type="text" value={termo} onChange={e => setTermo(e.target.value)}
                placeholder="Pesquisar por nº, localização..."
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700" />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-1 dark:border-border-dark dark:bg-surface-card/50">
              {([
                { key: 'todos' as const, label: 'Todos', icon: ClipboardCheck },
                { key: 'extintores' as const, label: 'Extintores', icon: Flame },
                { key: 'hidrantes' as const, label: 'Hidrantes', icon: Droplets },
              ]).map(t => (
                <button key={t.key} onClick={() => setFilterTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    filterTab === t.key
                      ? 'bg-white text-aviation-700 shadow-sm dark:bg-graphite-900 dark:text-aviation-300'
                      : 'text-graphite-500 hover:text-graphite-700 dark:text-graphite-400'
                  }`}>
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {itensFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
                <ClipboardCheck className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
                <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum equipamento encontrado</h3>
              </div>
            ) : (
              itensFiltrados.map(item => {
                const ultimaConf = getStatusConferencia(item.id);
                const needsCheck = !ultimaConf ||
                  (new Date(ultimaConf.dataConferencia).getTime() < agora.getTime() - 7 * 24 * 60 * 60 * 1000);

                return (
                  <div key={item.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition-all duration-200 hover:shadow-md dark:bg-surface-card ${
                      needsCheck
                        ? 'border-orange-200/60 bg-orange-50/30 dark:border-orange-800/30'
                        : 'border-graphite-200/60 bg-white/80 dark:border-border-dark'
                    }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        item._tipo === 'Extintor'
                          ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                          : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                      }`}>
                        {item._tipo === 'Extintor' ? <Flame className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100 truncate">{getLabel(item, item._tipo)}</p>
                          <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item._tipo === 'Extintor'
                              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {item._tipo}
                          </span>
                        </div>
                        <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{getSublabel(item, item._tipo)}</p>
                      </div>
                    </div>
                    <button onClick={() => { setConferindo({ tipo: item._tipo, item }); setResultado('Aprovado'); setObs(''); }}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl bg-aviation-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aviation-700 dark:bg-aviation-500 dark:hover:bg-aviation-600">
                      Conferir <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {view === 'historico' && (
        <div className="space-y-2">
          {conferencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
              <Clock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
              <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma conferência registrada</h3>
            </div>
          ) : (
            conferencias.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-graphite-200/60 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    c.tipo === 'Extintor' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {c.tipo === 'Extintor' ? <Flame className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100 truncate">{c.itemNome}</p>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400">
                      {c.inspetorNomeGuerra || c.createdBy} · {new Date(c.dataConferencia).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${resultadoColor(c.resultadoFinal)}`}>
                  {c.resultadoFinal}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {conferindo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:pb-0" onClick={() => setConferindo(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl md:rounded-2xl dark:bg-surface-elevated" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                conferindo.tipo === 'Extintor' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              }`}>
                {conferindo.tipo === 'Extintor' ? <Flame className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Conferir {conferindo.tipo}</h3>
                <p className="text-sm text-graphite-500 dark:text-graphite-400">{getLabel(conferindo.item, conferindo.tipo)} · {getSublabel(conferindo.item, conferindo.tipo)}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Resultado da Conferência</label>
              <div className="grid grid-cols-2 gap-2">
                {RESULTADO_FINAL_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setResultado(o.value)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      resultado === o.value
                        ? 'border-aviation-500 bg-aviation-50 text-aviation-700 dark:border-aviation-400 dark:bg-aviation-900/30 dark:text-aviation-300'
                        : 'border-graphite-300/60 bg-white/70 text-graphite-600 hover:border-graphite-300/70 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-300'
                    }`}>
                    {resultado === o.value && <Check className="mr-1 inline h-4 w-4" />}
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Observações</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} className={INPUT_CLASS} rows={3} placeholder="Observações sobre a conferência..." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConferindo(null)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-graphite-600 transition-colors hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover">
                Cancelar
              </button>
              <button onClick={handleSalvarConferencia} disabled={saving}
                className="flex-1 rounded-xl bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aviation-700 disabled:opacity-50 dark:bg-aviation-500 dark:hover:bg-aviation-600">
                {saving ? 'Salvando...' : 'Salvar Conferência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default Conferencia;
