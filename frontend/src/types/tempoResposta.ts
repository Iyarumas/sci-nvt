export type TreinamentoTempoRespostaStatus = 'Rascunho' | 'Aprovado';

export interface TreinamentoTempoResposta {
  id: string;
  equipe: string;
  numero: number;
  ano: string;
  data: string;
  hora: string;
  local: string;
  f2Cci: string;
  f2BaMc: string;
  f2BaCe: string;
  f2Ba2: string;
  f2T1: string;
  f2T2: string;
  f2T3: string;
  f2Conceito: string;
  f2Performance: string;
  f3Cci: string;
  f3BaMc: string;
  f3Ba21: string;
  f3Ba22: string;
  f3T1: string;
  f3T2: string;
  f3T3: string;
  f3Conceito: string;
  f3Performance: string;
  observacoes: string;
  resumoExercicio: string;
  consideracoesFinais: string;
  coordenacaoTwrSpeSci: string;
  acionamento: string;
  sistemaAlarmes: string;
  comunicacaoFraseologia: string;
  deslocamentoVtrs: string;
  visibilidadeSuperficie: string;
  procedimentoPcinc: string;
  tempoResposta: string;
  feedbackSpe: string;
  feedbackTwr: string;
  feedbackSci: string;
  chefeEquipe: string;
  gerente: string;
  status: TreinamentoTempoRespostaStatus;
  createdBy: string;
  updatedBy?: string;
  aprovadoPor: string;
  aprovadoPorNome: string;
  aprovadoEm: string;
  createdAt: string;
  updatedAt: string;
}

type CamposControleTempoResposta =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'aprovadoPor'
  | 'aprovadoPorNome'
  | 'aprovadoEm';
type CamposAprovacaoTempoResposta = Pick<
  TreinamentoTempoResposta,
  'status' | 'aprovadoPor' | 'aprovadoPorNome' | 'aprovadoEm'
>;

export type TreinamentoTempoRespostaInput =
  Omit<TreinamentoTempoResposta, CamposControleTempoResposta> &
  Partial<CamposAprovacaoTempoResposta>;

// Campos do modelo MMS.BR.BA.FOR.005 nº 24/2026; aplicados somente a novos treinos.
export const TEMPO_RESPOSTA_PADRAO = {
  local: 'CABECEIRA 26',
  observacoes: 'Treinamento realizado com briefing e acordado junto ao APOC, TWR e Equipe',
  resumoExercicio: 'EXERCÍCIO EXECUTADO SEM INTERCORRÊNCIAS E DENTRO DO ESPERADO',
  consideracoesFinais: 'SEM APONTAMENTOS',
  coordenacaoTwrSpeSci: 'SCI / TWR / APOC',
  acionamento: 'A TWR ACIONOU O ALARME, ATRAVÉS DO SAE, SEM ALTERAÇÃO NO SEU FUNCIONAMENTO.',
  sistemaAlarmes: 'EXECUTADO ACIONAMENTO DE UM SILVO LONGO DE 30s, CONFORME PRECONIZADO.',
  comunicacaoFraseologia: 'UTILIZADA FRASEOLOGIA PADRÃO',
  deslocamentoVtrs: 'VIATURAS DESLOCARAM APENAS APÓS CONFIRMAÇÃO DO BA-CE, EM FORMATO DE ESCAMA NA PISTA.',
  visibilidadeSuperficie: 'AS CONDIÇÕES ERAM PERFEITAS',
  procedimentoPcinc: 'TODOS PROCEDIMENTOS PREVISTOS NO PCINC FORAM SEGUIDOS',
  tempoResposta: 'O TEMPO RESPOSTA FOI ATINGIDO EM CONFORMIDADE COM A LEGISLAÇÃO',
  feedbackSpe: 'NÃO HOUVE FEEDBACK DO SPE/APOC',
  feedbackTwr: 'NÃO HOUVE FEEDBACK DA TWR',
  feedbackSci: 'EFETUADO FEEDBACK APÓS O EXERCÍCIO COM A EQUIPE, PARABENIZANDO PELO OBJETIVO ALCANÇADO',
} satisfies Partial<TreinamentoTempoRespostaInput>;
