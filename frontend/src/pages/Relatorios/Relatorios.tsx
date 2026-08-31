import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart, FileSpreadsheet, FileCheck, FileText, ClipboardList,
  Activity, Target, Award, ArrowRight, ArrowLeftRight, TrendingUp, Lock, Timer,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import { listarPTRBACompletos } from '../../services/ptrbaCompletoService';
import { listarLROs } from '../../services/lroService';
import { listarBombeiros } from '../../services/bombeiroService';

interface ReportCard {
  title: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  stats: { label: string; value: string | number }[];
}

export function Relatorios() {
  const { canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const navigate = useNavigate();
  const [ocorrenciasCount, setOcorrenciasCount] = useState(0);
  const [ptrbCount, setPtrbCount] = useState(0);
  const [lroCount, setLroCount] = useState(0);
  const [efetivoCount, setEfetivoCount] = useState(0);

  useEffect(() => {
    if (loadingContexto || !canVisualizarRelatorios) return;
    listarOcorrencias({ numeroPrefixo: 'BONA' }).then(o => setOcorrenciasCount(o.length)).catch(() => {});
    listarPTRBACompletos().then(p => setPtrbCount(p.length)).catch(() => {});
    listarLROs().then(l => setLroCount(l.length)).catch(() => {});
    listarBombeiros().then(b => setEfetivoCount(b.length)).catch(() => {});
  }, [canVisualizarRelatorios, loadingContexto]);

  const cards: ReportCard[] = [
    {
      title: 'LRO',
      description: 'Lista de Ronda Operacional — relatórios dos LROs gerados por equipe e período',
      icon: FileSpreadsheet, path: '/relatorios/lro', color: 'from-blue-500 to-blue-700',
      stats: [{ label: 'Registros', value: lroCount }, { label: 'Efetivo', value: efetivoCount }],
    },
    {
      title: 'BONA/REA',
      description: 'Boletim de Ocorrência Não Aeronáutico e Relatório de Registro de Emergências Aeronáuticas',
      icon: FileCheck, path: '/relatorios/bona', color: 'from-red-500 to-red-700',
      stats: [{ label: 'Ocorrências', value: ocorrenciasCount }, { label: 'Total', value: '—' }],
    },
    {
      title: 'PTR-BA',
      description: 'Plano de Trabalho de Ronda — registro de treinamentos e atividades',
      icon: FileText, path: '/relatorios/ptr-ba', color: 'from-emerald-500 to-emerald-700',
      stats: [{ label: 'Registros', value: ptrbCount }, { label: 'Horas', value: '—' }],
    },
    {
      title: 'PTR-BA Registros',
      description: 'Lista de todos os PTR-BAs por ordem de data, com impressão',
      icon: FileText, path: '/relatorios/ptr-ba-registros', color: 'from-teal-500 to-teal-700',
      stats: [{ label: 'Registros', value: ptrbCount }, { label: 'Ordem', value: 'Data' }],
    },
    {
      title: 'TAF',
      description: 'Teste de Aptidão Física — resultados e evolução',
      icon: Target, path: '/relatorios/exercicios/taf', color: 'from-orange-500 to-orange-700',
      stats: [{ label: 'Último', value: '—' }, { label: 'Status', value: '—' }],
    },
    {
      title: 'TP / EPR',
      description: 'Teste de Progressão / Equipamento de Proteção Respiratória',
      icon: Award, path: '/relatorios/exercicios/tp-epr', color: 'from-purple-500 to-purple-700',
      stats: [{ label: 'Registros', value: '—' }, { label: 'Vencidos', value: '—' }],
    },
    {
      title: 'Posicionamento',
      description: 'Exercício de posicionamento para intervenção',
      icon: Target, path: '/relatorios/exercicios/posicionamento', color: 'from-cyan-500 to-cyan-700',
      stats: [{ label: 'Registros', value: '—' }, { label: 'Documento', value: '✓' }],
    },
    {
      title: 'Tempo Resposta',
      description: 'Exercício de aferição de tempo resposta',
      icon: Timer, path: '/relatorios/exercicios/tempo-resposta', color: 'from-violet-500 to-violet-700',
      stats: [{ label: 'Registros', value: '—' }, { label: 'Documento', value: '✓' }],
    },
    {
      title: 'Ordens de Serviço',
      description: 'Gerenciamento de ordens de serviço e solicitações',
      icon: ClipboardList, path: '/relatorios/ordem-servico', color: 'from-cyan-500 to-cyan-700',
      stats: [{ label: 'Abertas', value: '—' }, { label: 'Concluídas', value: '—' }],
    },
    {
      title: 'Substituições',
      description: 'Relatório mensal de substituições, afastamentos e extras',
      icon: ArrowLeftRight, path: '/relatorios/substituicoes', color: 'from-indigo-500 to-indigo-700',
      stats: [{ label: 'Mensal', value: '✓' }, { label: 'Impressão', value: '✓' }],
    },
    {
      title: 'Trocas de Serviço',
      description: 'Registro e acompanhamento de trocas de serviço entre bombeiros',
      icon: ArrowRight, path: '/relatorios/trocas', color: 'from-amber-500 to-amber-700',
      stats: [{ label: 'Formulário', value: '✓' }, { label: 'Autentique', value: '✓' }],
    },
    {
      title: 'Exercícios',
      description: 'Posicionamento para Intervenção e Tempo Resposta',
      icon: Activity, path: '/relatorios/exercicios', color: 'from-rose-500 to-rose-700',
      stats: [{ label: 'Registros', value: '—' }, { label: 'Tipo', value: '2' }],
    },
  ];

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
      <PageTitle icon={FileBarChart} title="Central de Relatórios" />
      <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">
        Relatórios gerenciais baseados nos documentos e registros do sistema.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(card => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="group relative overflow-hidden rounded-2xl border border-graphite-200/60 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-border-dark dark:bg-surface-card"
          >
            <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full opacity-[0.06] transition-all duration-500 group-hover:scale-150 bg-gradient-to-br ${card.color}`} />
            <div className="relative">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.color}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{card.title}</h3>
              <p className="mt-1 text-[11px] text-graphite-500 dark:text-graphite-400 line-clamp-2">{card.description}</p>
              {card.stats && (
                <div className="mt-3 flex gap-3 border-t border-graphite-100 pt-3 dark:border-border-dark">
                  {card.stats.map(s => (
                    <div key={s.label} className="flex-1">
                      <p className="text-xs font-black text-graphite-900 dark:text-graphite-100">{s.value}</p>
                      <p className="text-[9px] font-medium text-graphite-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-aviation-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-aviation-400">
              Abrir relatório <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>

      {/* Quick stats footer */}
      <div className="mt-8 rounded-2xl border border-graphite-200/60 bg-white/80 p-5 dark:border-border-dark dark:bg-surface-card/80">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">Resumo do Sistema</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">{efetivoCount}</p><p className="text-[10px] text-graphite-400">Efetivo</p></div>
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">{lroCount}</p><p className="text-[10px] text-graphite-400">LROs</p></div>
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">{ocorrenciasCount}</p><p className="text-[10px] text-graphite-400">Ocorrências</p></div>
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">{ptrbCount}</p><p className="text-[10px] text-graphite-400">PTR-BAs</p></div>
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">~{Math.max(1, Math.round((lroCount + ocorrenciasCount + ptrbCount) / 3))}</p><p className="text-[10px] text-graphite-400">Média/mês</p></div>
          <div><p className="text-lg font-black text-graphite-900 dark:text-graphite-100">4</p><p className="text-[10px] text-graphite-400">Equipes</p></div>
        </div>
      </div>
    </PageContainer>
  );
}

export default Relatorios;
