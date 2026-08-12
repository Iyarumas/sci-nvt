export interface GuarnicaoCCI02 {
  baMc: string;
  baCe: string;
  ba2: string;
}

export interface GuarnicaoCCI03 {
  baMc: string;
  ba2_1: string;
  ba2_2: string;
}

export interface GuarnicaoCRS {
  baMc: string;
  baLr: string;
  baRe1: string;
  baRe2: string;
}

export interface FuncaoSlot {
  funcao: string;
  nomeGuerra: string;
}

export interface TrocaSlot {
  funcaoSaindo: string;
  nomeSaindo: string;
  funcaoEntrando: string;
  nomeEntrando: string;
}

export interface RadioSlot {
  funcao: string;
  nomeGuerra: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface EscalaDiaria {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  equipe: string;
  chefeEquipe: string;
  dataPlantao: string;
  horarioInicio: string;
  horarioTermino: string;
  turno: string;
  guarnicoes: {
    cci02: GuarnicaoCCI02;
    cci03: GuarnicaoCCI03;
    crs: GuarnicaoCRS;
  };
  bds: FuncaoSlot;
  ptr1: FuncaoSlot;
  ptr2: FuncaoSlot;
  atestados: string[];
  trocas: TrocaSlot[];
  radio: RadioSlot[];
}

export const FUNCOES_GUARNICAO = ['BA-MC', 'BA-CE', 'BA-2', 'BA-LR', 'BA-RE'] as const;
export const FUNCOES_BDS_PTR = ['APOC', 'BA-2', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-RE', 'GS', 'OC'] as const;
export const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
