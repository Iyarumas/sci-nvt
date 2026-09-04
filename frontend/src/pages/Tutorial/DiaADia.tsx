import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
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
  Volume2,
  VolumeX,
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
  { id: 'lro-ocorrencias', label: 'LRO/Ocorrências', sub: 'Fatos do dia a dia do plantão', icon: FileText, x: 69, y: 10, w: 28, h: 18 },
  { id: 'bona-rea', label: 'BONA/REA', sub: 'Boletins formais quando houver', icon: ShieldAlert, x: 3, y: 40, w: 28, h: 18 },
  { id: 'solicitacoes', label: 'Solicitações', sub: 'Demandas feitas à Motiva', icon: ClipboardList, x: 36, y: 40, w: 28, h: 18 },
  { id: 'inspecoes', label: 'Inspeções', sub: 'Inspeções técnicas solicitadas ou necessárias', icon: ClipboardCheck, x: 69, y: 40, w: 28, h: 18 },
  { id: 'ptrba', label: 'PTR-BA', sub: 'Instrução do dia para ir ao LRO', icon: Radio, x: 3, y: 70, w: 28, h: 18 },
  { id: 'gerar-lro', label: 'Gerar LRO', sub: 'Revisão final e arquivo para Autentique', icon: FileSignature, x: 36, y: 70, w: 28, h: 18 },
  { id: 'responsabilidade', label: 'Responsabilidade', sub: 'Senha pessoal e autoria registrada', icon: CheckCircle2, x: 69, y: 70, w: 28, h: 18 },
];

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: 'Criar a Escala Mensal',
    eyebrow: 'O primeiro passo do dia a dia',
    body: 'Antes de qualquer lançamento do plantão, crie a escala mensal em Documentos > Escalas > Escala Mensal.',
    detail: 'Preencha a escala completa da equipe, como no exemplo da Delta em setembro. A partir dela o sistema puxa várias informações para as próximas telas, então tudo precisa estar conferido antes de gerar.',
    icon: CalendarDays,
    actions: [{ label: 'Abrir Escala Mensal', path: '/escalas?tab=mensal' }],
    activeNodes: ['mensal'],
    cursor: { x: 26, y: 20 },
    spotlight: { x: 1, y: 8, w: 32, h: 22 },
    checklist: ['Abrir Documentos > Escalas', 'Entrar em Escala Mensal', 'Clicar em Nova Escala Mensal', 'Preencher e gerar a escala'],
  },
  {
    id: 2,
    title: 'Fazer a Escala Diária',
    eyebrow: 'Conferir o plantão real',
    body: 'Depois faça a escala diária de cada equipe, preenchendo os dados do plantão e conferindo tudo que veio automático.',
    detail: 'Ela puxa informações da escala mensal, como carros e escala de rádio, e também busca férias, trocas, extras, atestados e substituições do dia. A pessoa ainda precisa preencher PTR-BA e BDS para seguirem automaticamente ao PTR-BA.',
    icon: ClipboardCheck,
    actions: [{ label: 'Abrir Escala Diária', path: '/escalas?tab=diaria' }],
    activeNodes: ['mensal', 'diaria'],
    cursor: { x: 59, y: 20 },
    spotlight: { x: 34, y: 8, w: 32, h: 22 },
    checklist: ['Carros e rádio conferidos', 'Férias, trocas, extras, atestados e substituições revisados', 'PTR-BA e BDS preenchidos'],
  },
  {
    id: 3,
    title: 'Preencher LRO/Ocorrências',
    eyebrow: 'Fatos corriqueiros do plantão',
    body: 'Use LRO/Ocorrências para lançar as ocorrências do dia a dia da seção.',
    detail: 'Aqui entram visitas, saídas, movimentações e outros acontecimentos simples do plantão que precisam aparecer no LRO, mas que não são BONA ou REA.',
    icon: FileText,
    actions: [{ label: 'Abrir LRO/Ocorrências', path: '/registros-diarios/lro-ocorrencias' }],
    activeNodes: ['lro-ocorrencias'],
    cursor: { x: 92, y: 20 },
    spotlight: { x: 67, y: 8, w: 32, h: 22 },
    checklist: ['Clicar em Novo', 'Informar data, equipe e horário', 'Descrever o fato com clareza'],
  },
  {
    id: 4,
    title: 'Registrar BONA ou REA',
    eyebrow: 'Ocorrências formais',
    body: 'Quando houver ocorrência formal, preencha BONA ou REA conforme o tipo da ocorrência.',
    detail: 'BONA é o boletim de ocorrência não aeronáutica. REA é o relatório de emergência aeronáutica. Os dois entram automaticamente no LRO. No BONA, se nem toda a equipe participou, exclua os envolvidos que não fizeram parte.',
    icon: ShieldAlert,
    actions: [{ label: 'Abrir BONA/REA', path: '/registros-diarios/bona-rea' }],
    activeNodes: ['bona-rea'],
    cursor: { x: 26, y: 50 },
    spotlight: { x: 1, y: 38, w: 32, h: 22 },
    checklist: ['Escolher BONA ou REA', 'Preencher os dados formais', 'Conferir envolvidos antes de salvar'],
  },
  {
    id: 5,
    title: 'Registrar Solicitações',
    eyebrow: 'Demandas feitas à Motiva',
    body: 'Preencha Solicitações quando houver pedidos feitos à Motiva durante o plantão.',
    detail: 'Esses pedidos também alimentam o LRO. Use esse módulo para deixar registrada a solicitação, o motivo, o responsável e o andamento.',
    icon: ClipboardList,
    actions: [{ label: 'Abrir Solicitações', path: '/registros-diarios/solicitacoes' }],
    activeNodes: ['solicitacoes'],
    cursor: { x: 59, y: 50 },
    spotlight: { x: 34, y: 38, w: 32, h: 22 },
    checklist: ['Abrir Solicitações', 'Clicar em Novo', 'Preencher o pedido à Motiva', 'Salvar para ir ao LRO'],
  },
  {
    id: 6,
    title: 'Registrar Inspeções',
    eyebrow: 'Inspeções técnicas',
    body: 'Preencha Inspeções quando a Motiva solicitar uma inspeção técnica ou quando a equipe fizer uma verificação operacional.',
    detail: 'Informe local, motivo, solicitante, horário e resultado. Quando o registro estiver completo, ele segue para a composição do LRO.',
    icon: ClipboardCheck,
    actions: [{ label: 'Abrir Inspeções', path: '/registros-diarios/inspecoes' }],
    activeNodes: ['inspecoes'],
    cursor: { x: 92, y: 50 },
    spotlight: { x: 67, y: 38, w: 32, h: 22 },
    checklist: ['Informar local e motivo', 'Registrar quem solicitou', 'Descrever a inspeção e resultado'],
  },
  {
    id: 7,
    title: 'Preencher o PTR-BA',
    eyebrow: 'Instrução que seguirá para o LRO',
    body: 'No PTR-BA, escolha a equipe para o sistema puxar o efetivo real daquele dia.',
    detail: 'Ele já considera férias, trocas e substituições. Se houver convidado da Motiva, inclua manualmente em APOC. Os assuntos vêm da escala diária, e é preciso preencher início, término, duas evidências horizontais, descrição e observações quando houver.',
    icon: Radio,
    actions: [{ label: 'Abrir PTR-BA', path: '/registros-diarios/ptr-ba-completo' }],
    activeNodes: ['ptrba'],
    cursor: { x: 26, y: 80 },
    spotlight: { x: 1, y: 68, w: 32, h: 22 },
    checklist: ['Escolher equipe e data', 'Conferir participantes automáticos', 'Adicionar APOC convidado se houver', 'Preencher evidências horizontais'],
  },
  {
    id: 8,
    title: 'Gerar o LRO',
    eyebrow: 'Montar o documento final',
    body: 'No fim, gere o LRO conferindo cada tela antes de revisar.',
    detail: 'Você pode clonar um LRO anterior para aproveitar informações e puxar o KM final dos carros como KM inicial do novo plantão. Depois selecione equipe e data, confirme trocas, revise os dados automáticos e altere somente os campos permitidos: Central Faísca, TP/EPR, Equipamentos, Agentes Extintores e Edificações.',
    icon: FileSignature,
    actions: [{ label: 'Abrir Gerar LRO', path: '/registros-diarios/gerar-lro' }],
    activeNodes: ['gerar-lro'],
    cursor: { x: 59, y: 80 },
    spotlight: { x: 34, y: 68, w: 32, h: 22 },
    checklist: ['Clonar somente se precisar', 'Conferir equipe, data e cards coloridos', 'Confirmar trocas uma única vez', 'Usar Visualização, Salvar rascunho ou Revisar'],
  },
  {
    id: 9,
    title: 'Responsabilidade final',
    eyebrow: 'Autentique, senha e autoria',
    body: 'Revise tudo com calma antes de fechar o documento.',
    detail: 'Depois de revisar, nada novo deve ser incluído no LRO. Tudo que for lançado fica registrado no nome de quem está logado. Não compartilhe senha e confira antes de finalizar.',
    icon: ShieldAlert,
    tone: 'danger',
    activeNodes: ['gerar-lro', 'responsabilidade'],
    cursor: { x: 92, y: 80 },
    spotlight: { x: 67, y: 68, w: 32, h: 22 },
    checklist: ['Usar Visualização para conferir', 'Salvar rascunho se precisar continuar depois', 'Lembrar que rascunho com mais de 5 dias é excluído', 'Revisar apenas quando estiver fechado'],
  },
];

type RoutineVideoTone = 'manual' | 'auto' | 'alert';

type RoutineVideoField = {
  label: string;
  value: string;
  tone?: RoutineVideoTone;
};

type RoutineVideoScene = {
  id: number;
  title: string;
  module: string;
  menuId: string;
  screenshot: string;
  tab?: string;
  action: string;
  narration: string;
  detail: string;
  icon: LucideIcon;
  fields: RoutineVideoField[];
  cards: RoutineVideoField[];
  timeline: string[];
  cursorStart: { x: number; y: number };
  cursorEnd: { x: number; y: number };
  spotlight: { x: number; y: number; w: number; h: number };
};

const ROUTINE_VIDEO_SCENES: RoutineVideoScene[] = [
  {
    id: 101,
    title: 'Abrindo Escalas pelo menu',
    module: 'Sidebar > Documentos',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/menu-documentos-aberto.png',
    action: 'Clicar em Escalas',
    narration: 'A rotina começa no menu lateral. A pessoa abre Documentos e entra em Escalas antes de criar os documentos do plantão.',
    detail: 'Esse caminho é importante porque a escala mensal precisa existir antes da diária. Ela é a base para o sistema puxar várias informações automaticamente.',
    icon: CalendarDays,
    fields: [
      { label: 'Menu', value: 'Documentos', tone: 'manual' },
      { label: 'Opção', value: 'Escalas', tone: 'manual' },
      { label: 'Primeira tarefa', value: 'Criar a escala mensal', tone: 'alert' },
    ],
    cards: [
      { label: 'Ordem correta', value: 'mensal primeiro, diária depois', tone: 'alert' },
      { label: 'Tela real', value: 'o cursor mostra o caminho no sidebar', tone: 'manual' },
    ],
    timeline: ['Sidebar', 'Documentos', 'Escalas', 'Escala Mensal'],
    cursorStart: { x: 2.2, y: 41 },
    cursorEnd: { x: 6.4, y: 53.5 },
    spotlight: { x: 3.1, y: 51, w: 12.2, h: 5.1 },
  },
  {
    id: 102,
    title: 'Clicando em Nova Escala Mensal',
    module: 'Documentos > Escalas',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/escalas-mensal-lista.png',
    tab: 'Escala Mensal',
    action: 'Nova Escala Mensal',
    narration: 'Com a aba Escala Mensal aberta, a pessoa confere mês, ano e equipe e clica em Nova Escala Mensal.',
    detail: 'No exemplo do tutorial, vamos usar a Equipe Delta em setembro de 2026, do mesmo jeito que seria feito na rotina real.',
    icon: CalendarDays,
    fields: [
      { label: 'Aba', value: 'Escala Mensal', tone: 'manual' },
      { label: 'Mês', value: 'Setembro', tone: 'manual' },
      { label: 'Ano', value: '2026', tone: 'manual' },
      { label: 'Equipe exemplo', value: 'Delta', tone: 'manual' },
    ],
    cards: [
      { label: 'Ação', value: 'clicar no botão Nova Escala Mensal', tone: 'manual' },
      { label: 'Antes de gerar', value: 'conferir se está no mês certo', tone: 'alert' },
    ],
    timeline: ['Escalas', 'Escala Mensal', 'Nova Escala Mensal'],
    cursorStart: { x: 6.4, y: 53.5 },
    cursorEnd: { x: 92.6, y: 23.4 },
    spotlight: { x: 87.9, y: 21.1, w: 10.5, h: 5 },
  },
  {
    id: 1,
    title: 'Criando a escala mensal da Delta',
    module: 'Documentos > Escalas',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/escalas-mensal-criando.png',
    tab: 'Escala Mensal',
    action: 'Nova Escala Mensal',
    narration: 'Antes de tudo, o chefe entra em Documentos > Escalas, abre Escala Mensal, clica em Nova Escala Mensal e preenche a Delta de setembro.',
    detail: 'Quando a escala mensal é gerada corretamente, ela vira a base para carros, rádio, faxinas, funções e várias informações automáticas das próximas telas.',
    icon: CalendarDays,
    fields: [
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Mês/Ano', value: 'Setembro/2026', tone: 'manual' },
      { label: 'Plantões', value: '16 plantões', tone: 'manual' },
      { label: 'CRS', value: 'BA-LR Adalto, BA-MC Douglas, BA-RE Pacheco', tone: 'manual' },
      { label: 'CCI F2', value: 'Vanzella, Alexandre, Montanaro', tone: 'manual' },
      { label: 'CCI F3', value: 'Douglas, Massen, Catia', tone: 'manual' },
    ],
    cards: [
      { label: 'Depois disso o sistema puxa', value: 'funções, rádio, carros, faxinas e base do efetivo', tone: 'auto' },
      { label: 'Conferência obrigatória', value: 'se a mensal estiver errada, as próximas telas podem vir erradas', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Escalas', 'Escala Mensal', 'Nova escala', 'Gerar escala'],
    cursorStart: { x: 7, y: 44 },
    cursorEnd: { x: 54.5, y: 65.5 },
    spotlight: { x: 48.6, y: 64, w: 12.6, h: 5.4 },
  },
  {
    id: 103,
    title: 'Clicando em Nova Escala Diária',
    module: 'Documentos > Escalas',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/escalas-diaria-lista.png',
    tab: 'Escala Diária',
    action: 'Nova Escala Diária',
    narration: 'Depois da mensal pronta, a pessoa fica na mesma tela de Escalas, entra em Escala Diária e clica em Nova Escala Diária.',
    detail: 'Aqui a diária deve ser criada para cada equipe que está de plantão. Ao escolher equipe e data, o sistema usa a mensal como referência.',
    icon: ClipboardCheck,
    fields: [
      { label: 'Aba', value: 'Escala Diária', tone: 'manual' },
      { label: 'Data exemplo', value: '03/09/2026', tone: 'manual' },
      { label: 'Equipe exemplo', value: 'Delta', tone: 'manual' },
      { label: 'Base automática', value: 'escala mensal já criada', tone: 'auto' },
    ],
    cards: [
      { label: 'Ação', value: 'clicar no botão Nova Escala Diária', tone: 'manual' },
      { label: 'Obrigatório conferir', value: 'cada equipe do dia precisa ter sua diária', tone: 'alert' },
    ],
    timeline: ['Escalas', 'Escala Diária', 'Nova Escala Diária'],
    cursorStart: { x: 7, y: 53.5 },
    cursorEnd: { x: 92.8, y: 24.8 },
    spotlight: { x: 88.2, y: 22.6, w: 10.4, h: 5.4 },
  },
  {
    id: 104,
    title: 'Escolhendo equipe e data da diária',
    module: 'Documentos > Escalas',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/escalas-diaria-formulario.png',
    tab: 'Escala Diária',
    action: 'Selecionar Delta',
    narration: 'No formulário da diária, a pessoa escolhe Delta, informa a data do plantão e deixa o auto-preenchimento trazer o que já existe.',
    detail: 'Depois disso, confira chefe, guarnições, carros e horários. O que veio automático ainda precisa ser revisado por quem está preenchendo.',
    icon: ClipboardCheck,
    fields: [
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Data', value: '03/09/2026', tone: 'manual' },
      { label: 'Chefe', value: 'selecionado conforme plantão real', tone: 'manual' },
      { label: 'Guarnições', value: 'puxadas da escala mensal', tone: 'auto' },
    ],
    cards: [
      { label: 'Auto-preenchimento', value: 'ajuda, mas não substitui a conferência', tone: 'auto' },
      { label: 'Não pular', value: 'sem diária, PTR-BA e LRO podem ficar sem base', tone: 'alert' },
    ],
    timeline: ['Equipe', 'Data', 'Auto-preenchimento', 'Conferir'],
    cursorStart: { x: 88, y: 23.5 },
    cursorEnd: { x: 87.3, y: 33.8 },
    spotlight: { x: 75.8, y: 31.7, w: 22.7, h: 5.5 },
  },
  {
    id: 2,
    title: 'Montando a escala diária',
    module: 'Documentos > Escalas',
    menuId: 'escalas',
    screenshot: '/assets/tutorial-dia-a-dia/escalas-diaria-criando.png',
    tab: 'Escala Diária',
    action: 'Nova Escala Diária',
    narration: 'No dia do plantão, a pessoa abre Escala Diária, escolhe equipe e data, preenche o que falta e confere tudo que veio da mensal.',
    detail: 'A escala diária puxa carros, escala de rádio, férias, trocas, extras, atestados e substituições. Nesta tela também entram os PTR-BA e BDS que depois alimentam o PTR-BA.',
    icon: ClipboardCheck,
    fields: [
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Data', value: '03/09/2026', tone: 'manual' },
      { label: 'Carros', value: 'CCI 2, CCI 3 e CRS puxados da mensal', tone: 'auto' },
      { label: 'Rádio', value: 'horários preenchidos conforme escala mensal', tone: 'auto' },
      { label: 'PTR-BA', value: 'Inspeção operacional / procedimentos da seção', tone: 'manual' },
      { label: 'BDS', value: 'Comunicação, PTR-1 e PTR-2 preenchidos', tone: 'manual' },
    ],
    cards: [
      { label: 'Automático do dia', value: 'férias, trocas, extras, atestados e substituições', tone: 'auto' },
      { label: 'Atenção', value: 'conferir o efetivo real antes de salvar', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Escalas', 'Escala Diária', 'Novo', 'Salvar escala'],
    cursorStart: { x: 7, y: 44 },
    cursorEnd: { x: 79, y: 65 },
    spotlight: { x: 18.5, y: 42.5, w: 79.8, h: 43 },
  },
  {
    id: 105,
    title: 'Abrindo Registros Diários',
    module: 'Sidebar > Registros Diários',
    menuId: 'lro-ocorrencias',
    screenshot: '/assets/tutorial-dia-a-dia/menu-registros-aberto.png',
    action: 'Clicar em LRO/Ocorrências',
    narration: 'Com as escalas criadas, a rotina do plantão passa para Registros Diários. Pelo sidebar, a pessoa escolhe o documento que vai lançar.',
    detail: 'Nessa parte ficam PTR-BA, LRO/Ocorrências, BONA/REA, Inspeções, Solicitações e Gerar LRO. Cada item tem seu momento no dia.',
    icon: FileText,
    fields: [
      { label: 'Menu', value: 'Registros Diários', tone: 'manual' },
      { label: 'Primeiro lançamento', value: 'LRO/Ocorrências', tone: 'manual' },
      { label: 'Uso', value: 'fatos simples do plantão', tone: 'manual' },
    ],
    cards: [
      { label: 'Fluxo', value: 'lança durante o dia e depois tudo alimenta o LRO', tone: 'auto' },
      { label: 'Separação', value: 'BONA e REA ficam no módulo próprio', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Registros Diários', 'LRO/Ocorrências'],
    cursorStart: { x: 2.2, y: 32.4 },
    cursorEnd: { x: 7.4, y: 44.6 },
    spotlight: { x: 3.3, y: 42.4, w: 13.1, h: 5 },
  },
  {
    id: 106,
    title: 'Clicando em Nova Ocorrência',
    module: 'Registros Diários > LRO/Ocorrências',
    menuId: 'lro-ocorrencias',
    screenshot: '/assets/tutorial-dia-a-dia/lro-ocorrencias-lista.png',
    action: 'Nova Ocorrência',
    narration: 'Dentro de LRO/Ocorrências, a pessoa clica em Nova Ocorrência para registrar algo que aconteceu na seção.',
    detail: 'Esse registro é para fatos de rotina, como visita, saída, movimentação ou informação operacional simples.',
    icon: FileText,
    fields: [
      { label: 'Tela', value: 'LRO/Ocorrências', tone: 'manual' },
      { label: 'Botão', value: 'Nova Ocorrência', tone: 'manual' },
      { label: 'Destino', value: 'entra automaticamente no LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Exemplo', value: 'visita operacional acompanhada pela equipe', tone: 'manual' },
      { label: 'Não usar para', value: 'ocorrência formal que precise BONA ou REA', tone: 'alert' },
    ],
    timeline: ['LRO/Ocorrências', 'Nova Ocorrência', 'Preencher'],
    cursorStart: { x: 7.4, y: 44.6 },
    cursorEnd: { x: 92.4, y: 12.1 },
    spotlight: { x: 88.2, y: 9.8, w: 10.1, h: 5.1 },
  },
  {
    id: 3,
    title: 'Lançando LRO/Ocorrências',
    module: 'Registros Diários',
    menuId: 'lro-ocorrencias',
    screenshot: '/assets/tutorial-dia-a-dia/lro-ocorrencias-criando.png',
    action: 'Novo Registro',
    narration: 'Durante o serviço, tudo que for ocorrência simples do dia a dia entra em LRO/Ocorrências.',
    detail: 'Use para visitas, saídas, movimentações e fatos da seção que precisam aparecer no LRO, mas que não são BONA nem REA.',
    icon: FileText,
    fields: [
      { label: 'Tipo', value: 'Visita operacional', tone: 'manual' },
      { label: 'Horário', value: '10:30', tone: 'manual' },
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Descrição', value: 'Visita técnica acompanhada pelo chefe de equipe', tone: 'manual' },
      { label: 'Destino no fluxo', value: 'vai automaticamente para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Exemplos', value: 'visitas, saídas, informações de rotina e acontecimentos da seção', tone: 'manual' },
      { label: 'Separar corretamente', value: 'ocorrência formal deve ser BONA ou REA', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'LRO/Ocorrências', 'Novo', 'Preencher', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 70, y: 54.5 },
    spotlight: { x: 25, y: 7.2, w: 50, h: 51 },
  },
  {
    id: 107,
    title: 'Abrindo BONA ou REA',
    module: 'Registros Diários > BONA/REA',
    menuId: 'bona-rea',
    screenshot: '/assets/tutorial-dia-a-dia/bona-rea-lista.png',
    action: 'Novo Documento',
    narration: 'Quando o registro for um boletim formal, a pessoa abre BONA/REA e clica em Novo Documento.',
    detail: 'Na próxima tela ela escolhe BONA para ocorrência não aeronáutica ou REA para emergência aeronáutica. Os dois seguem automaticamente para o LRO.',
    icon: ShieldAlert,
    fields: [
      { label: 'Tela', value: 'BONA/REA', tone: 'manual' },
      { label: 'Botão', value: 'Novo Documento', tone: 'manual' },
      { label: 'Escolha', value: 'BONA ou REA', tone: 'manual' },
      { label: 'Destino', value: 'vai para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'BONA', value: 'boletim de ocorrência não aeronáutico', tone: 'manual' },
      { label: 'REA', value: 'relatório de emergência aeronáutica', tone: 'alert' },
    ],
    timeline: ['BONA/REA', 'Novo Documento', 'Escolher tipo'],
    cursorStart: { x: 7.4, y: 48.5 },
    cursorEnd: { x: 92.4, y: 17.7 },
    spotlight: { x: 88, y: 15.5, w: 10.5, h: 5.3 },
  },
  {
    id: 4,
    title: 'Preenchendo um BONA',
    module: 'Registros Diários',
    menuId: 'bona-rea',
    screenshot: '/assets/tutorial-dia-a-dia/bona-criando.png',
    action: 'Novo BONA',
    narration: 'Quando a ocorrência for não aeronáutica, a pessoa abre BONA/REA, escolhe BONA e preenche o boletim.',
    detail: 'Se nem toda a equipe participou, basta remover os envolvidos que não fizeram parte. Assim o registro fica correto antes de ir para o LRO.',
    icon: ShieldAlert,
    fields: [
      { label: 'Documento', value: 'BONA', tone: 'manual' },
      { label: 'Natureza', value: 'Atendimento não aeronáutico', tone: 'manual' },
      { label: 'Envolvidos', value: 'Douglas, Vanzella e Adalto', tone: 'manual' },
      { label: 'Equipe inteira?', value: 'Não. Remover quem não participou.', tone: 'alert' },
      { label: 'Destino no fluxo', value: 'vai automaticamente para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Exemplo', value: 'ocorrência em área operacional sem emergência aeronáutica', tone: 'manual' },
      { label: 'Ajuste importante', value: 'conferir os envolvidos antes de salvar', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'BONA/REA', 'Novo BONA', 'Envolvidos', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 79, y: 91 },
    spotlight: { x: 14, y: 12, w: 72, h: 80 },
  },
  {
    id: 5,
    title: 'Preenchendo um REA',
    module: 'Registros Diários',
    menuId: 'bona-rea',
    screenshot: '/assets/tutorial-dia-a-dia/rea-criando.png',
    action: 'Novo REA',
    narration: 'Quando houver emergência aeronáutica, a pessoa cria o REA e preenche o relatório com os dados do atendimento.',
    detail: 'O REA registra a emergência aeronáutica de forma formal e também segue automaticamente para o LRO.',
    icon: ShieldAlert,
    fields: [
      { label: 'Documento', value: 'REA', tone: 'manual' },
      { label: 'Ocorrência', value: 'Emergência aeronáutica simulada', tone: 'manual' },
      { label: 'Local', value: 'Pátio / área operacional', tone: 'manual' },
      { label: 'Viaturas', value: 'CCI 2 e CRS', tone: 'manual' },
      { label: 'Destino no fluxo', value: 'vai automaticamente para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Quando usar', value: 'somente em emergência aeronáutica', tone: 'alert' },
      { label: 'Conferir', value: 'horários, viaturas, equipe e descrição do atendimento', tone: 'manual' },
    ],
    timeline: ['Sidebar', 'BONA/REA', 'Novo REA', 'Preencher', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 80, y: 87.5 },
    spotlight: { x: 14, y: 8, w: 74, h: 82 },
  },
  {
    id: 108,
    title: 'Clicando em Nova Solicitação',
    module: 'Registros Diários > Solicitações',
    menuId: 'solicitacoes',
    screenshot: '/assets/tutorial-dia-a-dia/solicitacoes-lista.png',
    action: 'Nova Solicitação',
    narration: 'As demandas feitas à Motiva entram em Solicitações. A pessoa abre a tela e clica em Nova Solicitação.',
    detail: 'Esse registro guarda data, horário, equipe, tipo de solicitação e descrição do pedido para depois aparecer no LRO.',
    icon: ClipboardList,
    fields: [
      { label: 'Tela', value: 'Solicitações', tone: 'manual' },
      { label: 'Botão', value: 'Nova Solicitação', tone: 'manual' },
      { label: 'Uso', value: 'pedido ou demanda para a Motiva', tone: 'manual' },
      { label: 'Destino', value: 'entra no LRO automaticamente', tone: 'auto' },
    ],
    cards: [
      { label: 'Exemplo', value: 'apoio para acesso controlado à área operacional', tone: 'manual' },
      { label: 'Conferir', value: 'descrição precisa ser clara', tone: 'alert' },
    ],
    timeline: ['Solicitações', 'Nova Solicitação', 'Preencher'],
    cursorStart: { x: 7.4, y: 56.5 },
    cursorEnd: { x: 93.2, y: 12.2 },
    spotlight: { x: 89.7, y: 9.8, w: 8.9, h: 5.2 },
  },
  {
    id: 6,
    title: 'Registrando solicitações',
    module: 'Registros Diários',
    menuId: 'solicitacoes',
    screenshot: '/assets/tutorial-dia-a-dia/solicitacoes-criando.png',
    action: 'Nova Solicitação',
    narration: 'As solicitações feitas à Motiva são abertas em Solicitações e preenchidas no momento em que acontecerem.',
    detail: 'Esses registros mostram o que foi solicitado, por quem, em qual horário e qual foi o encaminhamento.',
    icon: ClipboardList,
    fields: [
      { label: 'Solicitante', value: 'Equipe Delta', tone: 'manual' },
      { label: 'Destino', value: 'Motiva', tone: 'manual' },
      { label: 'Horário', value: '14:20', tone: 'manual' },
      { label: 'Pedido', value: 'Apoio para acesso controlado à área operacional', tone: 'manual' },
      { label: 'Destino no fluxo', value: 'vai automaticamente para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Uso diário', value: 'pedidos, liberações e demandas operacionais', tone: 'manual' },
      { label: 'Conferir', value: 'deixar claro o motivo da solicitação', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Solicitações', 'Novo', 'Preencher', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 81.5, y: 82.5 },
    spotlight: { x: 29, y: 24.8, w: 58.5, h: 54 },
  },
  {
    id: 109,
    title: 'Clicando em Nova Inspeção',
    module: 'Registros Diários > Inspeções',
    menuId: 'inspecoes',
    screenshot: '/assets/tutorial-dia-a-dia/inspecoes-lista.png',
    action: 'Nova Inspeção',
    narration: 'Quando a Motiva solicita uma inspeção, ou quando a equipe faz uma verificação técnica, a pessoa entra em Inspeções.',
    detail: 'O botão Nova Inspeção abre o formulário para registrar local, motivo, horário, solicitante e resultado.',
    icon: ClipboardCheck,
    fields: [
      { label: 'Tela', value: 'Inspeções', tone: 'manual' },
      { label: 'Botão', value: 'Nova Inspeção', tone: 'manual' },
      { label: 'Uso', value: 'verificação técnica solicitada ou necessária', tone: 'manual' },
      { label: 'Destino', value: 'entra no LRO automaticamente', tone: 'auto' },
    ],
    cards: [
      { label: 'Exemplo', value: 'inspeção técnica na área operacional', tone: 'manual' },
      { label: 'Importante', value: 'registrar o resultado da inspeção', tone: 'alert' },
    ],
    timeline: ['Inspeções', 'Nova Inspeção', 'Resultado'],
    cursorStart: { x: 7.4, y: 52.5 },
    cursorEnd: { x: 93.2, y: 12.1 },
    spotlight: { x: 90.1, y: 10.1, w: 8.3, h: 4.8 },
  },
  {
    id: 7,
    title: 'Registrando inspeções técnicas',
    module: 'Registros Diários',
    menuId: 'inspecoes',
    screenshot: '/assets/tutorial-dia-a-dia/inspecoes-criando.png',
    action: 'Nova Inspeção',
    narration: 'As inspeções técnicas solicitadas pela Motiva, ou feitas pela própria equipe, entram em Inspeções.',
    detail: 'Preencha local, motivo, horário, solicitante e resultado da inspeção para que o LRO receba a informação completa.',
    icon: ClipboardCheck,
    fields: [
      { label: 'Local', value: 'Área operacional / SCI', tone: 'manual' },
      { label: 'Solicitante', value: 'Motiva', tone: 'manual' },
      { label: 'Tipo', value: 'Inspeção técnica', tone: 'manual' },
      { label: 'Resultado', value: 'Sem alteração encontrada', tone: 'manual' },
      { label: 'Destino no fluxo', value: 'vai automaticamente para o LRO', tone: 'auto' },
    ],
    cards: [
      { label: 'Quando usar', value: 'solicitação da Motiva ou verificação técnica da equipe', tone: 'manual' },
      { label: 'Importante', value: 'registrar a conclusão da inspeção', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Inspeções', 'Novo', 'Resultado', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 81.5, y: 82.5 },
    spotlight: { x: 29, y: 24.8, w: 58.5, h: 54 },
  },
  {
    id: 110,
    title: 'Clicando em Novo PTR-BA',
    module: 'Registros Diários > PTR-BA',
    menuId: 'ptrba',
    screenshot: '/assets/tutorial-dia-a-dia/ptrba-lista.png',
    action: 'Novo PTR-BA',
    narration: 'Para registrar a instrução do plantão, a pessoa entra em PTR-BA e clica em Novo PTR-BA.',
    detail: 'Esse documento deve ser criado no dia correto, porque ele usa equipe, trocas, férias e substituições daquele plantão.',
    icon: Radio,
    fields: [
      { label: 'Tela', value: 'PTR-BA', tone: 'manual' },
      { label: 'Botão', value: 'Novo PTR-BA', tone: 'manual' },
      { label: 'Data exemplo', value: '03/09/2026', tone: 'manual' },
      { label: 'Equipe exemplo', value: 'Delta', tone: 'manual' },
    ],
    cards: [
      { label: 'Puxa automaticamente', value: 'efetivo real, trocas e substituições', tone: 'auto' },
      { label: 'APOC convidado', value: 'entra manualmente quando houver convidado da Motiva', tone: 'alert' },
    ],
    timeline: ['PTR-BA', 'Novo PTR-BA', 'Equipe e data'],
    cursorStart: { x: 7.4, y: 40.5 },
    cursorEnd: { x: 93, y: 12.1 },
    spotlight: { x: 89.3, y: 9.8, w: 9.1, h: 5.1 },
  },
  {
    id: 111,
    title: 'Escolhendo equipe no PTR-BA',
    module: 'Registros Diários > PTR-BA',
    menuId: 'ptrba',
    screenshot: '/assets/tutorial-dia-a-dia/ptrba-participantes-criando.png',
    action: 'Selecionar Delta',
    narration: 'Depois de clicar em novo, a pessoa escolhe Delta. O sistema então puxa o chefe e os participantes daquele plantão.',
    detail: 'Aqui já entram as substituições do dia. Se alguém estiver cobrindo férias ou troca, o PTR-BA deve mostrar a pessoa no lugar correto.',
    icon: Radio,
    fields: [
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Chefe', value: 'puxado conforme escala do dia', tone: 'auto' },
      { label: 'Efetivo', value: 'pessoas carregadas automaticamente', tone: 'auto' },
      { label: 'Convidados', value: 'APOCs adicionados manualmente se houver', tone: 'manual' },
    ],
    cards: [
      { label: 'Conferência', value: 'verificar faltas, trocas, férias e substitutos', tone: 'alert' },
      { label: 'Sem duplicidade', value: 'ninguém deve aparecer duas vezes no mesmo lugar', tone: 'alert' },
    ],
    timeline: ['Equipe', 'Chefe', 'Participantes', 'APOC se houver'],
    cursorStart: { x: 93, y: 12.1 },
    cursorEnd: { x: 48.2, y: 26.5 },
    spotlight: { x: 38.9, y: 24.4, w: 18.8, h: 5 },
  },
  {
    id: 8,
    title: 'Criando o PTR-BA',
    module: 'Registros Diários',
    menuId: 'ptrba',
    screenshot: '/assets/tutorial-dia-a-dia/ptrba-criando.png',
    action: 'Novo PTR-BA',
    narration: 'No PTR-BA, a pessoa escolhe a equipe e o sistema puxa quem estava no plantão real daquele dia.',
    detail: 'O sistema já aplica férias, trocas e substituições, colocando cada pessoa no lugar correto antes da conferência.',
    icon: Radio,
    fields: [
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Data', value: '03/09/2026', tone: 'manual' },
      { label: 'Participantes', value: 'efetivo real puxado automaticamente', tone: 'auto' },
      { label: 'Trocas e férias', value: 'substituições aplicadas nos lugares certos', tone: 'auto' },
      { label: 'Convidado Motiva', value: 'incluir manualmente em APOC quando houver', tone: 'manual' },
    ],
    cards: [
      { label: 'APOC convidado', value: 'selecionar APOC cadastrado e adicionar ao PTR-BA', tone: 'manual' },
      { label: 'Conferência', value: 'verificar se ninguém ficou faltando ou duplicado', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'PTR-BA', 'Novo', 'Equipe e data', 'Participantes'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 77, y: 79 },
    spotlight: { x: 19.5, y: 35.5, w: 77.5, h: 52 },
  },
  {
    id: 9,
    title: 'Finalizando o PTR-BA',
    module: 'Registros Diários',
    menuId: 'ptrba',
    screenshot: '/assets/tutorial-dia-a-dia/ptrba-criando.png',
    action: 'Salvar PTR-BA',
    narration: 'Depois da equipe puxada, a pessoa completa o conteúdo da instrução e salva o PTR-BA.',
    detail: 'Os assuntos vêm da escala diária. Depois informe início, término, duas evidências em foto horizontal, descrição do que foi feito e observações se houver.',
    icon: Camera,
    fields: [
      { label: 'Assuntos', value: 'puxados da escala diária', tone: 'auto' },
      { label: 'Início', value: '08:00', tone: 'manual' },
      { label: 'Término', value: '08:40', tone: 'manual' },
      { label: 'Evidências', value: '2 fotos horizontais', tone: 'alert' },
      { label: 'Descrição', value: 'treinamento prático realizado no pátio', tone: 'manual' },
      { label: 'Observações', value: 'preencher somente se houver', tone: 'manual' },
    ],
    cards: [
      { label: 'Vai para', value: 'PTR-BA e LRO com as informações lançadas', tone: 'auto' },
      { label: 'Foto', value: 'tirar as evidências sempre na horizontal', tone: 'alert' },
    ],
    timeline: ['Assuntos', 'Horários', 'Evidências', 'Descrição', 'Salvar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 77, y: 79 },
    spotlight: { x: 19.5, y: 35.5, w: 77.5, h: 52 },
  },
  {
    id: 112,
    title: 'Abrindo Novo LRO ou Clonar',
    module: 'Registros Diários > Gerar LRO',
    menuId: 'gerar-lro',
    screenshot: '/assets/tutorial-dia-a-dia/gerar-lro-lista.png',
    action: 'Novo LRO',
    narration: 'No final do plantão, a pessoa entra em Gerar LRO. Ela pode criar um Novo LRO ou clonar um LRO existente.',
    detail: 'Ao clonar, o sistema usa informações do outro LRO e traz o KM final dos carros como KM inicial do novo plantão. Mesmo assim, tudo precisa ser conferido.',
    icon: FileSignature,
    fields: [
      { label: 'Tela', value: 'Gerar LRO', tone: 'manual' },
      { label: 'Opção principal', value: 'Novo LRO', tone: 'manual' },
      { label: 'Opção alternativa', value: 'Clonar LRO', tone: 'manual' },
      { label: 'KM dos carros', value: 'final clonado vira início do próximo', tone: 'auto' },
    ],
    cards: [
      { label: 'Clonar', value: 'usar quando quiser aproveitar dados do plantão anterior', tone: 'manual' },
      { label: 'Atenção', value: 'conferir equipe, data e frota antes de seguir', tone: 'alert' },
    ],
    timeline: ['Gerar LRO', 'Novo ou clonar', 'Equipe/data'],
    cursorStart: { x: 7.4, y: 60.5 },
    cursorEnd: { x: 94.2, y: 12.1 },
    spotlight: { x: 91.6, y: 10, w: 6.9, h: 4.8 },
  },
  {
    id: 10,
    title: 'Começando a gerar o LRO',
    module: 'Registros Diários',
    menuId: 'gerar-lro',
    screenshot: '/assets/tutorial-dia-a-dia/gerar-lro-criando.png',
    action: 'Gerar LRO',
    narration: 'No final do plantão, a pessoa abre Gerar LRO e escolhe entre começar novo ou clonar um LRO existente.',
    detail: 'Ao clonar, o sistema aproveita informações de outro LRO e usa o KM final dos carros daquele plantão como KM inicial deste plantão.',
    icon: FileSignature,
    fields: [
      { label: 'Opção', value: 'Novo LRO ou Clonar LRO existente', tone: 'manual' },
      { label: 'Equipe', value: 'Delta', tone: 'manual' },
      { label: 'Data do plantão', value: '03/09/2026', tone: 'manual' },
      { label: 'Cards da equipe', value: 'mostram efetivo, férias, trocas e substitutos', tone: 'auto' },
      { label: 'Hover nos cards', value: 'mostra quem a pessoa está substituindo', tone: 'auto' },
    ],
    cards: [
      { label: 'Clonar', value: 'útil quando precisa reaproveitar informações do LRO anterior', tone: 'manual' },
      { label: 'Atenção', value: 'sempre conferir KM inicial, equipe e data', tone: 'alert' },
    ],
    timeline: ['Sidebar', 'Gerar LRO', 'Novo ou clonar', 'Equipe/data', 'Avançar'],
    cursorStart: { x: 8.5, y: 34.5 },
    cursorEnd: { x: 94, y: 84.5 },
    spotlight: { x: 18, y: 13.5, w: 80.5, h: 66 },
  },
  {
    id: 11,
    title: 'Confirmando trocas no LRO',
    module: 'Gerar LRO',
    menuId: 'gerar-lro',
    screenshot: '/assets/tutorial-dia-a-dia/gerar-lro-trocas-criando.png',
    action: 'Confirmar Trocas',
    narration: 'Na etapa de trocas, o chefe confirma se cada troca aprovada realmente foi efetuada.',
    detail: 'Depois de marcar correta ou incorreta, não dá para modificar. Se houver emergência, preencha a troca emergencial ali mesmo para o sistema registrar automaticamente.',
    icon: Check,
    fields: [
      { label: 'Troca aprovada', value: 'confirmar se foi efetuada ou não', tone: 'alert' },
      { label: 'Efeito', value: 'informação segue para o LRO', tone: 'auto' },
      { label: 'Troca emergencial', value: 'preencher solicitante, substituto, motivo e horário', tone: 'manual' },
      { label: 'Bloqueio', value: 'após confirmar, não modificar', tone: 'alert' },
    ],
    cards: [
      { label: 'Emergência', value: 'usar quando alguém não consegue comparecer por acidente ou imprevisto', tone: 'manual' },
      { label: 'Responsabilidade', value: 'a confirmação fica registrada no documento', tone: 'alert' },
    ],
    timeline: ['Trocas', 'Confirmar', 'Emergência se houver', 'Salvar etapa'],
    cursorStart: { x: 93.6, y: 13 },
    cursorEnd: { x: 24, y: 49.5 },
    spotlight: { x: 19.5, y: 26.5, w: 78.5, h: 43 },
  },
  {
    id: 12,
    title: 'Revisando dados e fechando o LRO',
    module: 'Gerar LRO',
    menuId: 'gerar-lro',
    screenshot: '/assets/tutorial-dia-a-dia/gerar-lro-dados-criando.png',
    action: 'Revisar',
    narration: 'Na tela de dados, quase tudo vem automático. A pessoa confere com calma e só mexe nos campos permitidos.',
    detail: 'Os campos alteráveis são Central Faísca, TP/EPR, Equipamentos, Agentes Extintores e Edificações. Os campos abaixo não devem ser mexidos porque afetam o processo do sistema.',
    icon: Eye,
    fields: [
      { label: 'Comunicação', value: 'pode selecionar APOC como comunicação', tone: 'manual' },
      { label: 'Trocas aceitas', value: 'entram se foram confirmadas na etapa anterior', tone: 'auto' },
      { label: 'Instruções', value: 'PTR-BA do dia puxado automaticamente', tone: 'auto' },
      { label: 'Frota', value: 'situação da frota puxada para conferência', tone: 'auto' },
      { label: 'Pode editar', value: 'IV, V, VI, VII e VIII', tone: 'manual' },
      { label: 'Não mexer', value: 'campos abaixo desses blocos', tone: 'alert' },
    ],
    cards: [
      { label: 'Visualização', value: 'ver o documento antes de fechar', tone: 'manual' },
      { label: 'Salvar rascunho', value: 'continuar depois; com mais de 5 dias é excluído', tone: 'alert' },
      { label: 'Revisar', value: 'fecha o documento e impede novas inclusões', tone: 'alert' },
    ],
    timeline: ['Dados', 'Conferir automáticos', 'Editar só permitidos', 'Visualizar', 'Revisar'],
    cursorStart: { x: 93.6, y: 13 },
    cursorEnd: { x: 75.5, y: 40 },
    spotlight: { x: 18.5, y: 6.5, w: 80, h: 68 },
  },
  {
    id: 113,
    title: 'Escolhendo como fechar o LRO',
    module: 'Gerar LRO',
    menuId: 'gerar-lro',
    screenshot: '/assets/tutorial-dia-a-dia/gerar-lro-fechamento.png',
    action: 'Visualizar, rascunho ou revisar',
    narration: 'No final do LRO existem três caminhos: visualizar o documento, salvar rascunho ou revisar para fechar.',
    detail: 'Visualização serve para conferir o documento. Salvar rascunho deixa continuar depois, mas rascunhos com mais de cinco dias são excluídos. Revisar fecha o documento e depois nada novo deve ser incluído.',
    icon: Eye,
    fields: [
      { label: 'Visualização', value: 'conferir o documento antes de fechar', tone: 'manual' },
      { label: 'Salvar rascunho', value: 'continuar preenchendo depois', tone: 'manual' },
      { label: 'Prazo do rascunho', value: 'mais de 5 dias é excluído', tone: 'alert' },
      { label: 'Revisar', value: 'fecha o LRO e bloqueia novas inclusões', tone: 'alert' },
    ],
    cards: [
      { label: 'Antes de revisar', value: 'conferir dados automáticos e campos permitidos', tone: 'alert' },
      { label: 'Responsabilidade', value: 'a revisão registra quem fechou o documento', tone: 'manual' },
    ],
    timeline: ['Visualizar', 'Salvar rascunho', 'Revisar', 'Fechar'],
    cursorStart: { x: 75.5, y: 40 },
    cursorEnd: { x: 92.8, y: 87.9 },
    spotlight: { x: 72.4, y: 85.1, w: 26.2, h: 5.7 },
  },
];

function stagePercent(value: number) {
  return `${value}%`;
}

function routineToneClasses(tone: RoutineVideoTone = 'manual') {
  if (tone === 'auto') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-200';
  }

  if (tone === 'alert') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-200';
  }

  return 'border-graphite-200 bg-white text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100';
}

function routineToneLabel(tone: RoutineVideoTone = 'manual') {
  if (tone === 'auto') return 'Automático';
  if (tone === 'alert') return 'Atenção';
  return 'Preenchido';
}

function routineNarrationText(scene: RoutineVideoScene) {
  return `${scene.title}. ${scene.narration} ${scene.detail}`;
}

function routineFallbackDurationMs(scene: RoutineVideoScene) {
  const words = routineNarrationText(scene).split(/\s+/).filter(Boolean).length;
  return Math.min(22000, Math.max(8200, words * 430));
}

function DailyRoutineVideo({ onClose }: { onClose: () => void }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  );
  const speechRunRef = useRef(0);
  const scene = ROUTINE_VIDEO_SCENES[sceneIndex] || ROUTINE_VIDEO_SCENES[0];
  const SceneIcon = scene.icon;
  const progress = useMemo(() => ((sceneIndex + 1) / ROUTINE_VIDEO_SCENES.length) * 100, [sceneIndex]);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const cursorStyle = {
    '--routine-cursor-start-x': stagePercent(scene.cursorStart.x),
    '--routine-cursor-start-y': stagePercent(scene.cursorStart.y),
    '--routine-cursor-end-x': stagePercent(scene.cursorEnd.x),
    '--routine-cursor-end-y': stagePercent(scene.cursorEnd.y),
  } as CSSProperties;

  function advancePlayback() {
    setSceneIndex(index => {
      if (index >= ROUTINE_VIDEO_SCENES.length - 1) {
        setVideoPlaying(false);
        return index;
      }
      return index + 1;
    });
  }

  function speakScene(advanceWhenDone = false) {
    if (!speechSupported) return;
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    const utterance = new SpeechSynthesisUtterance(routineNarrationText(scene));
    utterance.lang = 'pt-BR';
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (advanceWhenDone && speechRunRef.current === runId) {
        advancePlayback();
      }
    };
    utterance.onerror = () => {
      if (advanceWhenDone && speechRunRef.current === runId) {
        window.setTimeout(() => {
          if (speechRunRef.current === runId) {
            advancePlayback();
          }
        }, routineFallbackDurationMs(scene));
      }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!videoPlaying) return;

    if (audioEnabled && speechSupported) {
      speakScene(true);
      return () => {
        speechRunRef.current += 1;
        window.speechSynthesis.cancel();
      };
    }

    const timer = window.setTimeout(advancePlayback, routineFallbackDurationMs(scene));
    return () => window.clearTimeout(timer);
  }, [audioEnabled, sceneIndex, speechSupported, videoPlaying]);

  useEffect(() => () => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  function nextScene() {
    if (speechSupported) window.speechSynthesis.cancel();
    setVideoPlaying(false);
    setSceneIndex(index => Math.min(ROUTINE_VIDEO_SCENES.length - 1, index + 1));
  }

  function previousScene() {
    if (speechSupported) window.speechSynthesis.cancel();
    setVideoPlaying(false);
    setSceneIndex(index => Math.max(0, index - 1));
  }

  function restartVideo() {
    if (speechSupported) window.speechSynthesis.cancel();
    setSceneIndex(0);
    setVideoPlaying(true);
  }

  function toggleAudio() {
    if (!speechSupported) return;
    setAudioEnabled(enabled => {
      if (enabled) {
        window.speechSynthesis.cancel();
        return false;
      }
      return true;
    });
  }

  function repeatAudio() {
    setAudioEnabled(true);
    setVideoPlaying(false);
    window.setTimeout(() => speakScene(false), 40);
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-aviation-200 bg-white shadow-sm dark:border-aviation-900/70 dark:bg-surface-card">
      <style>{`
        @keyframes routine-cursor-move {
          0%, 12% {
            left: var(--routine-cursor-start-x);
            top: var(--routine-cursor-start-y);
            transform: translate(-8px, -8px) scale(0.94);
          }
          58% {
            left: var(--routine-cursor-end-x);
            top: var(--routine-cursor-end-y);
            transform: translate(-8px, -8px) scale(1);
          }
          70% {
            left: var(--routine-cursor-end-x);
            top: var(--routine-cursor-end-y);
            transform: translate(-8px, -8px) scale(0.82);
          }
          82%, 100% {
            left: var(--routine-cursor-end-x);
            top: var(--routine-cursor-end-y);
            transform: translate(-8px, -8px) scale(1);
          }
        }

      `}</style>
      <div className="flex flex-col gap-4 border-b border-graphite-200 p-4 dark:border-border-dark lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aviation-100 text-aviation-700 dark:bg-aviation-900/35 dark:text-aviation-200">
            <Play className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-aviation-700 dark:text-aviation-300">Vídeo animado</p>
            <h2 className="text-xl font-black text-graphite-900 dark:text-graphite-100">Rotina completa do plantão</h2>
            <p className="mt-1 text-sm leading-6 text-graphite-500 dark:text-graphite-400">
              Sequência animada com telas reais do sistema, mostrando preenchimentos de exemplo sem salvar documentos. Com áudio ligado, a próxima cena espera a fala terminar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAudio}
            disabled={!speechSupported}
            title={speechSupported ? 'Ligar ou desligar narração do tutorial' : 'Narração indisponível neste navegador'}
            className="inline-flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-200 dark:hover:bg-aviation-900/35"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {audioEnabled ? 'Áudio ligado' : 'Ligar áudio'}
          </button>
          <button
            type="button"
            onClick={repeatAudio}
            disabled={!speechSupported}
            className="inline-flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            <Volume2 className="h-4 w-4" />
            Repetir áudio
          </button>
          <button
            type="button"
            onClick={restartVideo}
            className="inline-flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Reiniciar
          </button>
          <button
            type="button"
            onClick={() => setVideoPlaying(value => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-200 dark:hover:bg-aviation-900/35"
          >
            {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {videoPlaying ? 'Pausar' : 'Assistir'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
            Fechar vídeo
          </button>
        </div>
      </div>

      <div className="h-2 bg-graphite-100 dark:bg-graphite-800">
        <div className="h-full bg-aviation-600 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      <div className="p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <div className="rounded-2xl border border-graphite-800 bg-graphite-950 p-3 shadow-inner">
            <div key={scene.id} className="relative aspect-[5/3] overflow-hidden rounded-xl border border-white/10 bg-black animate-slideUp" style={cursorStyle}>
              <img
                src={scene.screenshot}
                alt={`Tela real de ${scene.module}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line
                  x1={scene.cursorStart.x}
                  y1={scene.cursorStart.y}
                  x2={scene.cursorEnd.x}
                  y2={scene.cursorEnd.y}
                  stroke="rgba(125, 211, 252, 0.85)"
                  strokeWidth="0.26"
                  strokeDasharray="1.2 1"
                />
              </svg>
              <div
                className="pointer-events-none absolute z-30 rounded-xl border-2 border-sky-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.24),0_0_0_7px_rgba(56,189,248,0.18),0_14px_35px_rgba(56,189,248,0.22)]"
                style={{
                  left: stagePercent(scene.spotlight.x),
                  top: stagePercent(scene.spotlight.y),
                  width: stagePercent(scene.spotlight.w),
                  height: stagePercent(scene.spotlight.h),
                }}
              />
              <span
                className="pointer-events-none absolute z-40 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-200 bg-sky-300/25 opacity-80 animate-ping"
                style={{ left: stagePercent(scene.cursorEnd.x), top: stagePercent(scene.cursorEnd.y) }}
              />
              <MousePointer2
                className="pointer-events-none absolute z-50 h-9 w-9 text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
                style={{ animation: 'routine-cursor-move 5.2s ease-in-out infinite' }}
                fill="currentColor"
              />

              <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/70 p-3 text-white shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aviation-500/30 text-aviation-100">
                    <SceneIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-white/60">
                      Cena {sceneIndex + 1} de {ROUTINE_VIDEO_SCENES.length}
                    </p>
                    <p className="truncate text-sm font-black md:text-base">{scene.title}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black">
                  <MousePointer2 className="h-4 w-4" />
                  {scene.action}
                </span>
              </div>
            </div>
          </div>

          <aside key={`${scene.id}-details`} className="space-y-3 animate-slideUp">
            <div className="rounded-2xl border border-aviation-200 bg-aviation-50 p-4 text-aviation-900 dark:border-aviation-800/70 dark:bg-aviation-900/20 dark:text-aviation-100">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aviation-100 text-aviation-700 dark:bg-aviation-900/60 dark:text-aviation-200">
                  <SceneIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase">{scene.module}</p>
                  <h3 className="text-lg font-black leading-tight">{scene.title}</h3>
                </div>
              </div>
              <p className="text-sm font-semibold leading-6">{scene.narration}</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold leading-6">{scene.detail}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-graphite-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-card">
              <p className="mb-3 text-xs font-black uppercase text-graphite-500 dark:text-graphite-400">Preenchimento da cena</p>
              <div className="space-y-2">
                {scene.fields.map(field => (
                  <div key={`${field.label}-${field.value}`} className={`rounded-xl border p-3 ${routineToneClasses(field.tone)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase opacity-65">{field.label}</p>
                      <span className="rounded-full bg-current/10 px-2 py-0.5 text-[11px] font-black">{routineToneLabel(field.tone)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-5">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {scene.cards.map(card => (
              <div key={`${card.label}-${card.value}`} className={`rounded-2xl border p-4 ${routineToneClasses(card.tone)}`}>
                <p className="text-xs font-black uppercase opacity-65">{card.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5">{card.value}</p>
              </div>
            ))}
          </aside>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={previousScene}
            disabled={sceneIndex === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Cena anterior
          </button>

          <div className="flex flex-wrap justify-center gap-1">
            {ROUTINE_VIDEO_SCENES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setVideoPlaying(false); setSceneIndex(index); }}
                className={`h-2.5 rounded-full transition-all ${sceneIndex === index ? 'w-8 bg-aviation-500' : 'w-2.5 bg-graphite-300 dark:bg-graphite-700'}`}
                title={`Ir para cena ${item.id}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextScene}
            disabled={sceneIndex === ROUTINE_VIDEO_SCENES.length - 1}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Próxima cena
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function DiaADiaTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showRoutineVideo, setShowRoutineVideo] = useState(false);
  const videoRef = useRef<HTMLDivElement | null>(null);
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

  function openRoutineVideo() {
    setPlaying(false);
    setShowRoutineVideo(true);
    window.setTimeout(() => {
      videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
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

              <div className="flex flex-col gap-2 sm:flex-row">
                {stepIndex === TUTORIAL_STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={openRoutineVideo}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-aviation-300 bg-white px-5 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-200 dark:hover:bg-aviation-900/35"
                  >
                    <Play className="h-4 w-4" />
                    Ver vídeo animado
                  </button>
                )}

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
            </div>
          </section>
        </div>
      </div>

      {showRoutineVideo && (
        <div ref={videoRef}>
          <DailyRoutineVideo onClose={() => setShowRoutineVideo(false)} />
        </div>
      )}
    </PageContainer>
  );
}

export default DiaADiaTutorial;
