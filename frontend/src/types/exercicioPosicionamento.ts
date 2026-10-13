export type ExercicioPosicionamentoStatus = 'Rascunho' | 'Aprovado';

export interface ExercicioPosicionamento {
  id: string;
  equipe: string;
  numero: number;
  ano: string;
  data: string;
  hora: string;
  local: string;
  faisca2BaMc: string;
  faisca2BaCe: string;
  faisca2Ba2: string;
  faisca2Tempo: string;
  faisca3BaMc: string;
  faisca3Ba21: string;
  faisca3Ba22: string;
  faisca3Tempo: string;
  crsBaMc: string;
  crsBaLr: string;
  crsBaRe1: string;
  crsBaRe2: string;
  crsTempo: string;
  operadorComunicacoes: string;
  observacoes: string;
  coordenacaoTwrCoeSci: string;
  comunicacaoFraseologia: string;
  procedimentosPcinc: string;
  feedbackTwr: string;
  resumoExercicio: string;
  acionamento: string;
  deslocamentoVtrs: string;
  tempoResposta: string;
  feedbackSci: string;
  consideracoesFinais: string;
  sistemaAlarmes: string;
  visibilidadeSuperficie: string;
  feedbackCoe: string;
  chefeEquipe: string;
  gerente: string;
  status: ExercicioPosicionamentoStatus;
  createdBy: string;
  updatedBy?: string;
  aprovadoPor: string;
  aprovadoPorNome: string;
  aprovadoEm: string;
  createdAt: string;
  updatedAt: string;
}

type CamposControleExercicioPosicionamento =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'aprovadoPor'
  | 'aprovadoPorNome'
  | 'aprovadoEm';
type CamposAprovacaoExercicioPosicionamento = Pick<
  ExercicioPosicionamento,
  'status' | 'aprovadoPor' | 'aprovadoPorNome' | 'aprovadoEm'
>;

export type ExercicioPosicionamentoInput =
  Omit<ExercicioPosicionamento, CamposControleExercicioPosicionamento> &
  Partial<CamposAprovacaoExercicioPosicionamento>;

// Campos do modelo MMS.BR.BA.FOR.006 nº 42/2026; aplicados somente a novos exercícios.
export const POSICIONAMENTO_PADRAO = {
  local: 'PISTA 08 X 26, FAÍSCA 02 TAXY WAY ALPHA E FAÍSCA 3 E CRS NA VIA DE ACESSO RÁPIDO DA SCI',
  observacoes: 'EXERCÍCIO EXECUTADO CONFORME OS NOVOS PADRÕES ESTABELECIDOS PELA ASUR',
  resumoExercicio: '',
  consideracoesFinais: 'SEM ALTERAÇÃO',
  coordenacaoTwrCoeSci: 'PREVIAMENTE REALIZADO CONTATO VIA RAMAL PARA ALINHAMENTO DO EXERCÍCIO COM SPE/TWR/APOC.',
  acionamento: 'ACIONAMENTO EFETUADO PELA TWR PELO SAE.',
  sistemaAlarmes: 'ACIONAMENTO DO SAE COM TOQUE INTERMITENTE.',
  comunicacaoFraseologia: 'UTILIZADA FRASEOLOGIA AERONÁUTICA PADRÃO.',
  deslocamentoVtrs: 'DESLOCAMENTO OCORREU SEM INTERCORRÊNCIAS.',
  visibilidadeSuperficie: 'CONDIÇÕES DE SUPERFÍCIE E VISIBILIDADE BOAS.',
  procedimentosPcinc: 'EFETUADO CONFORME PREVÊ O PCINC.',
  tempoResposta: 'O EXERCÍCIO ATENDEU AS EXPECTATIVAS PREVISTAS.',
  feedbackCoe: 'SEM APONTAMENTOS.', feedbackTwr: 'SEM APONTAMENTOS.', feedbackSci: 'SEM APONTAMENTOS.',
} satisfies Partial<ExercicioPosicionamentoInput>;
