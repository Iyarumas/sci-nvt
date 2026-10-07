import type { APOC } from './apoc';

// Alternativa para rascunhos antigos ou cadastro indisponível.
export const COORDENADOR_LRO_NOME = 'RINALDO SANTOS RACHADEL';

export function assinaturaCoordenadorLRO(apocs: Pick<APOC, 'funcao' | 'nomeCompleto'>[]) {
  const coordenadores = apocs.filter(a => a.funcao === 'COORDENADOR');
  const rinaldo = coordenadores.find(a => ['RINALDO RACHADEL', COORDENADOR_LRO_NOME].includes(a.nomeCompleto.trim().toUpperCase()));
  const coordenador = rinaldo || (coordenadores.length === 1 ? coordenadores[0] : undefined);
  return {
    coordenadorAssinatura: coordenador?.nomeCompleto.trim() || COORDENADOR_LRO_NOME,
    coordenadorFuncao: 'COORDENADOR' as const,
  };
}

export interface LROSlot {
  funcao: string;
  nome: string;
}

export interface Substitution {
  funcao: string;
  nome: string;
  funcaoSubstituto: string;
  nomeSubstituto: string;
}

export interface VeiculoState {
  cci319: string;
  cci320: string;
  cci333: string;
  kmInicial: string;
  kmFinal: string;
  combustivelInicial: string;
  combustivelFinal: string;
  nitrogenio: string;
  epr: string;
}

export interface VeiculoRTState {
  cci319Reserva: string;
  cci320Reserva: string;
  cci333Reserva: string;
  cci319Baixado: string;
  cci320Baixado: string;
  cci333Baixado: string;
  kmInicial: string;
  kmFinal: string;
  combustivelInicial: string;
  combustivelFinal: string;
  nitrogenio: string;
  epr: string;
}

export interface CRSState {
  situacao: string;
  kmOdoInicial: string;
  kmOdoFinal: string;
  kmTacInicial: string;
  kmTacFinal: string;
  combustivelInicial: string;
  combustivelFinal: string;
  epr: string;
}

export interface LRO {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  equipe: string;
  turno: string;
  dataEntrada: string;
  dataSaida: string;

  chefeEquipe: string;
  apoc: string;
  cci02Slots: LROSlot[];
  cci03Slots: LROSlot[];
  crsSlots: LROSlot[];
  apoioOutrosSlots: LROSlot[];
  substituicoesAtivo: boolean;
  substituicoes: Substitution[];

  instrucoes: string;

  faisca2: VeiculoState;
  faisca3: VeiculoState;
  faiscaRT: VeiculoRTState;
  crs: CRSState;

  situacaoCentralFaisca: string;
  situacaoComunicacao: string;
  situacaoTPEPR: string;
  situacaoAgentesExtintores: string;
  situacaoEquipamentos: string;
  situacaoEdificacoes: string;

  inspecoesTecnicas: string;
  emergenciasAeronauticas: string;
  outrasOcorrencias: string;

  assinatura: string;
}

export const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
export const EPR_OPTIONS = ['OPERACIONAIS', 'NÃO OPERACIONAIS', 'AUSENTES'] as const;
export const CRS_SITUACOES = ['EM LINHA', 'BAIXADO', 'PCM'] as const;
export const FUNCOES_CARGO = ['BA-2', 'BA-MC', 'BA-CE', 'BA-LR', 'BA-RE', 'APOC', 'GS', 'OC'] as const;
