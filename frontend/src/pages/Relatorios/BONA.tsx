import { useState, useEffect, useMemo } from 'react';
import { FileCheck, Search, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import { listarReas } from '../../services/reaService';
import { CATEGORIAS_OCORRENCIA } from '../../types/ocorrencia';
import type { Ocorrencia } from '../../types/ocorrencia';
import type { ReaRegistro } from '../../types/rea';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';

function fmt(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function fmtReaDate(d: string) {
  if (!d) return '-';
  const m = d.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) {
    const [year, month, day] = m[0].split('-');
    return `${day}/${month}/${year}`;
  }
  return d;
}

type Item = { tipo: 'BONA' | 'REA'; id: string; numero: string; data: string; hora: string; status: string; equipe: string; };

export function BONA() {
  const { canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const [bonaList, setBonaList] = useState<Ocorrencia[]>([]);
  const [reaList, setReaList] = useState<ReaRegistro[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadingContexto) return;
    if (!canVisualizarRelatorios) {
      setLoading(false);
      return;
    }
    Promise.all([
      listarOcorrencias({ numeroPrefixo: 'BONA' }),
      listarReas(),
    ])
      .then(([bonas, reas]) => {
        setBonaList(bonas);
        setReaList(reas);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canVisualizarRelatorios, loadingContexto]);

  const itens: Item[] = useMemo(() => {
    const lista: Item[] = [
      ...bonaList.map(o => ({ tipo: 'BONA' as const, id: o.id, numero: o.numero, data: o.data, hora: o.hora, status: o.status, equipe: o.equipe })),
      ...reaList.map(r => ({ tipo: 'REA' as const, id: r.id, numero: r.numero, data: r.dataAcidente, hora: r.horaAcidente, status: r.status, equipe: r.equipe })),
    ];
    return lista.sort((a, b) => new Date(b.data || '').getTime() - new Date(a.data || '').getTime());
  }, [bonaList, reaList]);

  const filtered = useMemo(() => {
    let lista = itens;
    if (filterTipo) lista = lista.filter(i => i.tipo === filterTipo);
    if (filterCat) lista = lista.filter(i => i.tipo === 'BONA' && i.id && bonaList.some(o => o.id === i.id && o.categoria === filterCat));
    if (search) {
      const t = search.toLowerCase();
      lista = lista.filter(i => {
        if (i.tipo === 'BONA') {
          const o = bonaList.find(b => b.id === i.id);
          return o?.titulo?.toLowerCase().includes(t) || o?.descricao?.toLowerCase().includes(t) || i.numero?.toLowerCase().includes(t);
        }
        const r = reaList.find(x => x.id === i.id);
        return i.numero?.toLowerCase().includes(t) || r?.aerodromo?.toLowerCase().includes(t) || r?.empresa?.toLowerCase().includes(t) || r?.matricula?.toLowerCase().includes(t);
      });
    }
    return lista;
  }, [itens, bonaList, reaList, search, filterCat, filterTipo]);

  const stats = useMemo(() => ({
    total: itens.length,
    abertas: itens.filter(i => i.status === 'Aberta').length,
    bonas: bonaList.length,
    reas: reaList.length,
  }), [itens, bonaList, reaList]);

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
      <PageTitle icon={FileCheck} title="BONA/REA" subtitle="Boletim de Ocorrência Não Aeronáutico e Relatório de Registro de Emergências Aeronáuticas" />
      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5 max-w-md">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
          <p className="text-[10px] font-medium text-graphite-500">Total</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-xl font-black text-blue-700 dark:text-blue-300">{stats.bonas}</p>
          <p className="text-[10px] font-medium text-blue-500">BONA</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xl font-black text-red-700 dark:text-red-300">{stats.reas}</p>
          <p className="text-[10px] font-medium text-red-500">REA</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-xl font-black text-yellow-700 dark:text-yellow-300">{stats.abertas}</p>
          <p className="text-[10px] font-medium text-yellow-500">Abertas</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xl font-black text-green-700 dark:text-green-300">{stats.total - stats.abertas}</p>
          <p className="text-[10px] font-medium text-green-500">Encerradas</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
          <option value="">Todos os tipos</option>
          <option value="BONA">BONA</option>
          <option value="REA">REA</option>
        </select>
        {(!filterTipo || filterTipo === 'BONA') && (
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
            <option value="">Todas categorias</option>
            {CATEGORIAS_OCORRENCIA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <FileCheck className="mb-4 h-12 w-12 text-graphite-300" />
          <h3 className="text-lg font-semibold text-graphite-700">Nenhum documento</h3>
          <p className="text-sm text-graphite-400">Cadastre ocorrências pelo menu Registros Diários &gt; BONA/REA.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const expanded = expandedId === item.id;
            const chevron = expanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />;
            if (item.tipo === 'REA') {
              const rea = reaList.find(r => r.id === item.id);
              if (!rea) return null;
              return (
                <div key={item.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
                  <button onClick={() => setExpandedId(expanded ? null : item.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-sm font-bold text-white">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">REA</span>
                        <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{rea.numero || 'REA'}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rea.status === 'Aberta' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{rea.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-graphite-500">
                        {fmtReaDate(rea.dataAcidente)}{rea.horaAcidente ? ` · ${rea.horaAcidente}` : ''}{rea.aerodromo ? ` · ${rea.aerodromo}` : ''}{rea.equipe ? ` · Equipe ${rea.equipe}` : ''}
                      </p>
                    </div>
                    {chevron}
                  </button>
                  {expanded && (
                    <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                      <p className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Relatório de Registro de Emergências Aeronáuticas</p>
                      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
                        <div><span className="font-semibold text-graphite-500">Aeródromo:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.aerodromo || '-'}</span></div>
                        <div><span className="font-semibold text-graphite-500">Cidade:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.cidade || '-'}</span></div>
                        <div><span className="font-semibold text-graphite-500">Empresa:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.empresa || '-'}</span></div>
                        <div><span className="font-semibold text-graphite-500">Matrícula:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.matricula || '-'}</span></div>
                      </div>
                      {rea.dados.descricaoEmergencia && (
                        <p className="mt-3 text-sm whitespace-pre-wrap text-graphite-700 dark:text-graphite-300">{rea.dados.descricaoEmergencia}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            const oc = bonaList.find(o => o.id === item.id);
            if (!oc) return null;
            return (
              <div key={item.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
                <button onClick={() => setExpandedId(expanded ? null : item.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">BONA</span>
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{oc.titulo || 'Sem título'}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${oc.status === 'Aberta' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{oc.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-graphite-500">{fmt(oc.data)}{oc.hora ? ` · ${oc.hora}` : ''}{oc.equipe ? ` · Equipe ${oc.equipe}` : ''}{oc.numero ? ` · ${oc.numero}` : ''}{oc.categoria ? ` · ${oc.categoria}` : ''}</p>
                  </div>
                  {chevron}
                </button>
                {expanded && (
                  <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                    <p className="text-sm whitespace-pre-wrap text-graphite-700 dark:text-graphite-300">{oc.descricao}</p>
                    {oc.acoesTomadas && <p className="mt-2 text-xs text-graphite-500"><span className="font-semibold">Ações:</span> {oc.acoesTomadas}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

export default BONA;
