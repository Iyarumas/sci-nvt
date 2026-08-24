import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  MousePointer2,
  Pause,
  Play,
  Radio,
  Route,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';

type TutorialAction = {
  label: string;
  path: string;
};

type TutorialStep = {
  id: number;
  title: string;
  eyebrow: string;
  body: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'normal' | 'notice' | 'danger';
  actions?: TutorialAction[];
  activeNodes: string[];
  cursor: { x: number; y: number };
  spotlight: { x: number; y: number; w: number; h: number };
  checklist: string[];
};

const WORKFLOW_NODES = [
  { id: 'mensal', label: 'Escala Mensal', sub: 'Equipe, funções, carros, rádio e faxinas', icon: CalendarDays, x: 3, y: 10, w: 28, h: 18 },
  { id: 'diaria', label: 'Escala Diária', sub: 'Plantão real, extras, trocas e PTR', icon: ClipboardCheck, x: 36, y: 10, w: 28, h: 18 },
  { id: 'ptrba', label: 'PTR-BA', sub: 'Instrução do dia para ir ao LRO', icon: Radio, x: 69, y: 10, w: 28, h: 18 },
  { id: 'lro-ocorrencias', label: 'LRO/Ocorrências', sub: 'Fatos corriqueiros do plantão', icon: FileText, x: 3, y: 40, w: 28, h: 18 },
  { id: 'solicitacoes', label: 'Solicitações e Inspeções', sub: 'Demandas Motiva e verificações', icon: ClipboardList, x: 36, y: 40, w: 28, h: 18 },
  { id: 'bona-rea', label: 'BONA/REA', sub: 'Ocorrências formais quando houver', icon: ShieldAlert, x: 69, y: 40, w: 28, h: 18 },
  { id: 'conferencia', label: 'Conferência', sub: 'Tudo lançado antes de gerar', icon: AlertTriangle, x: 3, y: 70, w: 28, h: 18 },
  { id: 'gerar-lro', label: 'Gerar LRO', sub: 'Revisão final e arquivo para Autentique', icon: FileSignature, x: 36, y: 70, w: 28, h: 18 },
  { id: 'responsabilidade', label: 'Responsabilidade', sub: 'Senha pessoal e autoria registrada', icon: CheckCircle2, x: 69, y: 70, w: 28, h: 18 },
];

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: 'Criar a Escala Mensal',
    eyebrow: 'O primeiro passo do dia a dia',
    body: 'Antes de tudo, deve ser criada a escala mensal com todas as pessoas da equipe e suas respectivas funções, carros e faxinas.',
    detail: 'É a partir da escala mensal que o sistema começa a puxar as informações para automatizar o restante do fluxo. Se ela estiver errada ou incompleta, as próximas telas podem puxar dados incorretos.',
    icon: CalendarDays,
    actions: [{ label: 'Abrir Escala Mensal', path: '/escalas?tab=mensal' }],
    activeNodes: ['mensal'],
    cursor: { x: 26, y: 20 },
    spotlight: { x: 1, y: 8, w: 32, h: 22 },
    checklist: ['Equipe completa', 'Funções conferidas', 'Carros definidos', 'Horários de rádio e faxinas preenchidos'],
  },
  {
    id: 2,
    title: 'Fazer a Escala Diária',
    eyebrow: 'Conferir o plantão real',
    body: 'Depois, faça todo o processo da escala diária e selecione as pessoas da equipe que irão ministrar os PTR-BA.',
    detail: 'Os horários de rádio puxam automaticamente da escala mensal. Nesta tela também aparecem substituições por férias ou outros motivos, extras e trocas. É aqui que o efetivo real do dia precisa ser conferido.',
    icon: ClipboardCheck,
    actions: [{ label: 'Abrir Escala Diária', path: '/escalas?tab=diaria' }],
    activeNodes: ['mensal', 'diaria'],
    cursor: { x: 59, y: 20 },
    spotlight: { x: 34, y: 8, w: 32, h: 22 },
    checklist: ['Plantão do dia conferido', 'Instrutores do PTR-BA selecionados', 'Trocas, extras e substituições revisados'],
  },
  {
    id: 3,
    title: 'Preencher o PTR-BA',
    eyebrow: 'Instrução que seguirá para o LRO',
    body: 'Em seguida, preencha o PTR-BA para que ele vá automaticamente para o LRO.',
    detail: 'Confira assunto, horário, instrutores e participantes antes de finalizar. O que for lançado aqui será usado na montagem do Livro de Registro Operacional.',
    icon: Radio,
    actions: [{ label: 'Abrir PTR-BA', path: '/registros-diarios/ptr-ba' }],
    activeNodes: ['diaria', 'ptrba'],
    cursor: { x: 92, y: 20 },
    spotlight: { x: 67, y: 8, w: 32, h: 22 },
    checklist: ['Assunto preenchido', 'Instrutores corretos', 'Participantes conferidos', 'Horários revisados'],
  },
  {
    id: 4,
    title: 'Preencher LRO/Ocorrências',
    eyebrow: 'Fatos corriqueiros do plantão',
    body: 'Preencha o LRO/Ocorrências quando houver ocorrências corriqueiras durante o dia, como visitas, movimentações, informações de rotina e outros fatos simples.',
    detail: 'Esses registros são diferentes de BONA/REA. Eles servem para documentar acontecimentos do cotidiano que precisam aparecer no LRO.',
    icon: FileText,
    actions: [{ label: 'Abrir LRO/Ocorrências', path: '/registros-diarios/lro-ocorrencias' }],
    activeNodes: ['lro-ocorrencias'],
    cursor: { x: 26, y: 50 },
    spotlight: { x: 1, y: 38, w: 32, h: 22 },
    checklist: ['Registrar somente quando houver fato', 'Descrever com clareza', 'Conferir data, equipe e horário'],
  },
  {
    id: 5,
    title: 'Preencher Solicitações ou Inspeções',
    eyebrow: 'Demandas da Motiva ou da equipe',
    body: 'Quando houver, preencha Solicitações ou Inspeções. Solicitações são pedidos feitos pela Motiva ou pela equipe, como acesso a pátio ou algo do tipo.',
    detail: 'Inspeções são verificações que a Motiva solicita ou que a equipe precisa realizar. Quando preenchidas corretamente, essas informações também entram no fluxo automático do LRO.',
    icon: ClipboardList,
    actions: [
      { label: 'Abrir Solicitações', path: '/registros-diarios/solicitacoes' },
      { label: 'Abrir Inspeções', path: '/registros-diarios/inspecoes' },
    ],
    activeNodes: ['solicitacoes'],
    cursor: { x: 59, y: 50 },
    spotlight: { x: 34, y: 38, w: 32, h: 22 },
    checklist: ['Solicitação da Motiva ou equipe', 'Inspeção solicitada ou necessária', 'Informações completas para o LRO'],
  },
  {
    id: 6,
    title: 'Registrar BONA ou REA',
    eyebrow: 'Ocorrências formais',
    body: 'Caso haja BONA ou REA, registre também. Todas essas informações irão para o LRO automaticamente.',
    detail: 'Use BONA/REA para ocorrências que exigem registro formal. Quanto mais completo for o lançamento, melhor será o LRO e os relatórios posteriores.',
    icon: ShieldAlert,
    actions: [{ label: 'Abrir BONA/REA', path: '/registros-diarios/bona-rea' }],
    activeNodes: ['bona-rea'],
    cursor: { x: 92, y: 50 },
    spotlight: { x: 67, y: 38, w: 32, h: 22 },
    checklist: ['Ocorrência formal identificada', 'Dados completos preenchidos', 'Registro pronto para entrar no LRO'],
  },
  {
    id: 7,
    title: 'Conferir tudo antes de gerar',
    eyebrow: 'Aviso importante',
    body: 'Depois de passar por essas informações, confira se tudo que aconteceu no dia foi lançado no sistema.',
    detail: 'Tudo isso precisa ser preenchido quando houver alteração para que os dados sigam automaticamente para o LRO. Se esquecer algum lançamento, o LRO pode sair incompleto.',
    icon: AlertTriangle,
    tone: 'notice',
    activeNodes: ['mensal', 'diaria', 'ptrba', 'lro-ocorrencias', 'solicitacoes', 'bona-rea', 'conferencia'],
    cursor: { x: 26, y: 80 },
    spotlight: { x: 1, y: 8, w: 98, h: 82 },
    checklist: ['Escala diária revisada', 'PTR-BA lançado', 'Ocorrências registradas', 'Solicitações, inspeções, BONA/REA conferidos'],
  },
  {
    id: 8,
    title: 'Gerar o LRO',
    eyebrow: 'Montar o documento final',
    body: 'Agora gere o LRO para poder lançar no Autentique.',
    detail: 'Na geração do LRO, revise as etapas, confira o que foi puxado automaticamente e só finalize quando as informações estiverem corretas.',
    icon: FileSignature,
    actions: [{ label: 'Abrir Gerar LRO', path: '/registros-diarios/gerar-lro' }],
    activeNodes: ['conferencia', 'gerar-lro'],
    cursor: { x: 59, y: 80 },
    spotlight: { x: 34, y: 68, w: 32, h: 22 },
    checklist: ['Dados automáticos conferidos', 'Revisão final feita', 'Arquivo pronto para baixar'],
  },
  {
    id: 9,
    title: 'Responsabilidade final',
    eyebrow: 'Autentique, senha e autoria',
    body: 'Por enquanto ainda é preciso baixar o arquivo para lançar no Autentique. Futuramente será tudo automatizado.',
    detail: 'Tenha grande cuidado ao lançar as informações. Tudo que for lançado fica registrado no nome de quem está logado e será de inteira responsabilidade da pessoa. Não passe sua senha para ninguém. Tudo que for editado também será registrado no nome de quem editou.',
    icon: ShieldAlert,
    tone: 'danger',
    activeNodes: ['gerar-lro', 'responsabilidade'],
    cursor: { x: 92, y: 80 },
    spotlight: { x: 67, y: 68, w: 32, h: 22 },
    checklist: ['Baixar arquivo', 'Lançar no Autentique com atenção', 'Não compartilhar senha', 'Assumir responsabilidade pelos registros'],
  },
];

function stagePercent(value: number) {
  return `${value}%`;
}

export function DiaADiaTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();
  const step = TUTORIAL_STEPS[stepIndex] || TUTORIAL_STEPS[0];
  const Icon = step.icon;
  const progress = useMemo(() => ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100, [stepIndex]);
  const isNotice = step.tone === 'notice';
  const isDanger = step.tone === 'danger';

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setStepIndex(index => {
        if (index >= TUTORIAL_STEPS.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex]);

  function goNext() {
    setPlaying(false);
    setStepIndex(index => Math.min(TUTORIAL_STEPS.length - 1, index + 1));
  }

  function goBack() {
    setPlaying(false);
    setStepIndex(index => Math.max(0, index - 1));
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageTitle
          icon={BookOpen}
          title="Tutorial do Dia a Dia"
          subtitle="Sequência operacional para preencher o sistema e gerar o LRO corretamente"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
            Sair do tutorial
          </button>
          <button
            type="button"
            onClick={() => setPlaying(value => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-200 dark:hover:bg-aviation-900/35"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Pausar animação' : 'Reproduzir passos'}
          </button>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
        <div className="h-2 bg-graphite-100 dark:bg-graphite-800">
          <div
            className={`h-full transition-all duration-700 ${isDanger ? 'bg-red-500' : isNotice ? 'bg-amber-500' : 'bg-aviation-600'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-graphite-900/40 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-aviation-600 dark:text-aviation-400">
              Roteiro do plantão
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {TUTORIAL_STEPS.map((item, index) => {
                const ItemIcon = item.icon;
                const selected = stepIndex === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setPlaying(false); setStepIndex(index); }}
                    className={`flex min-h-[68px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                      selected
                        ? item.tone === 'danger'
                          ? 'border-red-300 bg-red-50 text-red-800 shadow-sm dark:border-red-800 dark:bg-red-900/25 dark:text-red-200'
                          : item.tone === 'notice'
                            ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200'
                            : 'border-aviation-300 bg-aviation-50 text-aviation-800 shadow-sm dark:border-aviation-800 dark:bg-aviation-900/25 dark:text-aviation-200'
                        : 'border-transparent bg-white text-graphite-600 hover:border-graphite-200 hover:text-graphite-900 dark:bg-surface-card dark:text-graphite-400 dark:hover:border-border-dark dark:hover:text-graphite-100'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      selected ? 'bg-current/10' : 'bg-graphite-100 dark:bg-graphite-800'
                    }`}>
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black uppercase tracking-wider">Passo {item.id}</span>
                      <span className="block truncate text-sm font-semibold">{item.title.replace(/^\d+\.\s*/, '')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="p-4 sm:p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
              <div className="space-y-3">
                <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-graphite-200 bg-graphite-950 shadow-inner dark:border-border-dark">
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-300" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Fluxo do LRO</span>
                  </div>

                <div className="absolute inset-x-8 top-[29%] hidden h-px bg-white/12 sm:block" />
                <div className="absolute inset-x-8 top-[59%] hidden h-px bg-white/12 sm:block" />
                <div className="absolute left-[50%] top-[29%] hidden h-[42%] w-px bg-white/12 sm:block" />

                  {WORKFLOW_NODES.map(node => {
                    const NodeIcon = node.icon;
                    const active = step.activeNodes.includes(node.id);
                    return (
                      <div
                        key={node.id}
                      className={`absolute rounded-2xl border p-3 transition-all duration-700 ${
                          active
                            ? isDanger
                              ? 'scale-[1.03] border-red-300 bg-red-500/20 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.14),0_18px_45px_rgba(239,68,68,0.22)]'
                              : isNotice
                                ? 'scale-[1.03] border-amber-300 bg-amber-400/20 text-white shadow-[0_0_0_6px_rgba(245,158,11,0.14),0_18px_45px_rgba(245,158,11,0.22)]'
                                : 'scale-[1.03] border-aviation-300 bg-aviation-400/20 text-white shadow-[0_0_0_6px_rgba(14,116,144,0.14),0_18px_45px_rgba(14,116,144,0.22)]'
                            : 'border-white/10 bg-white/[0.055] text-white/60'
                        }`}
                        style={{
                          left: stagePercent(node.x),
                          top: stagePercent(node.y),
                          width: stagePercent(node.w),
                          height: stagePercent(node.h),
                        }}
                      >
                      <div className="flex h-full items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                          <NodeIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-black leading-4">{node.label}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-75">{node.sub}</p>
                        </div>
                      </div>
                      </div>
                    );
                  })}

                  <div
                    className={`absolute rounded-2xl border-2 transition-all duration-700 ${
                      isDanger
                        ? 'border-red-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.32),0_0_0_7px_rgba(239,68,68,0.18)]'
                        : isNotice
                          ? 'border-amber-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.32),0_0_0_7px_rgba(245,158,11,0.18)]'
                          : 'border-aviation-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.32),0_0_0_7px_rgba(14,116,144,0.18)]'
                    }`}
                    style={{
                      left: stagePercent(step.spotlight.x),
                      top: stagePercent(step.spotlight.y),
                      width: stagePercent(step.spotlight.w),
                      height: stagePercent(step.spotlight.h),
                    }}
                  />

                  <span
                    className={`absolute z-20 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 animate-ping ${
                      isDanger ? 'bg-red-300/30' : isNotice ? 'bg-amber-300/30' : 'bg-aviation-300/30'
                    }`}
                    style={{ left: stagePercent(step.cursor.x), top: stagePercent(step.cursor.y) }}
                  />
                  <MousePointer2
                    className={`absolute z-30 h-10 w-10 -translate-x-1 -translate-y-1 animate-bounce drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)] transition-all duration-700 ${
                      isDanger ? 'text-red-100' : isNotice ? 'text-amber-100' : 'text-white'
                    }`}
                    style={{ left: stagePercent(step.cursor.x), top: stagePercent(step.cursor.y) }}
                    fill="currentColor"
                  />
                </div>
                <div className="rounded-2xl border border-graphite-200 bg-white p-4 text-graphite-900 shadow-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                  <div key={step.id} className="animate-slideUp">
                    <p className="text-xs font-black uppercase tracking-widest text-aviation-600 dark:text-aviation-400">Animação do passo atual</p>
                    <p className="mt-1 text-lg font-black">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-graphite-500 dark:text-graphite-400">{step.eyebrow}</p>
                  </div>
                </div>
              </div>

              <div key={step.id} className={`rounded-2xl border p-6 shadow-sm animate-slideUp ${
                isDanger
                  ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-50'
                  : isNotice
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50'
                    : 'border-graphite-200 bg-white text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100'
              }`}>
                <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${
                  isDanger
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200'
                    : isNotice
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-aviation-50 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300'
                }`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Passo {step.id} de {TUTORIAL_STEPS.length}
                </div>

                <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
                  isDanger
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200'
                    : isNotice
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300'
                }`}>
                  <Icon className="h-8 w-8" />
                </div>

                <h2 className="text-2xl font-black leading-tight">{step.title}</h2>
                <p className={`mt-2 text-xs font-black uppercase tracking-widest ${
                  isDanger ? 'text-red-600 dark:text-red-200' : isNotice ? 'text-amber-700 dark:text-amber-200' : 'text-aviation-600 dark:text-aviation-400'
                }`}>
                  {step.eyebrow}
                </p>

                <p className="mt-5 text-base leading-7 opacity-90">{step.body}</p>
                <div className={`mt-5 rounded-2xl border p-4 text-sm font-medium leading-6 ${
                  isDanger
                    ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100'
                    : isNotice
                      ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100'
                      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200'
                }`}>
                  {step.detail}
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-widest opacity-60">Conferir neste passo</p>
                  <div className="space-y-2">
                    {step.checklist.map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm leading-6">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {step.actions && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {step.actions.map(action => (
                      <button
                        key={action.path}
                        type="button"
                        onClick={() => navigate(action.path)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600"
                      >
                        <Route className="h-4 w-4" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={stepIndex === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <div className="flex justify-center gap-1">
                {TUTORIAL_STEPS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setPlaying(false); setStepIndex(index); }}
                    className={`h-2.5 rounded-full transition-all ${stepIndex === index ? 'w-8 bg-aviation-500' : 'w-2.5 bg-graphite-300 dark:bg-graphite-700'}`}
                    title={`Ir para passo ${item.id}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={stepIndex === TUTORIAL_STEPS.length - 1 ? () => navigate('/') : goNext}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {stepIndex === TUTORIAL_STEPS.length - 1 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Concluir e sair
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

export default DiaADiaTutorial;
