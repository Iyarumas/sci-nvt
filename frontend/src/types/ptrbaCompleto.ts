import type { Equipe } from './bombeiro';

export interface PTRBACompletoParticipante {
  funcao: string;
  nomeCompleto: string;
  situacao: string;
}

export interface PTRBACompletoEvidencia {
  horaInicio: string;
  horaTermino: string;
  assunto: string;
  imagem: string;
  descricao: string;
}

export interface PTRBACompleto {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  data: string;
  equipe: Equipe | string;
  identificacaoAeroporto: string;
  observacoes: string;
  chefeEquipe: string;
  participantes: PTRBACompletoParticipante[];
  evidencias: PTRBACompletoEvidencia[];
}

export type PTRBACompletoInput = Omit<PTRBACompleto, 'id' | 'createdAt' | 'updatedAt'>;

export const PTRBA_COMPLETO_EQUIPES: Equipe[] = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

export const PTRBA_COMPLETO_SITUACOES = [
  'P',
  'A',
  'EO',
  'OC',
  'INSTR. 1',
  'INSTR. 2',
  'INSTR. 3',
  'INSTR. 1-2',
  'INSTR. 2-3',
  'INSTR. 1-3',
  'INSTR. 1-2-3',
] as const;

export const PTRBA_COMPLETO_SITUACAO_DESCRICOES: Record<string, string> = {
  P: 'Presente',
  A: 'Ausente',
  EO: 'Equipe Operacional',
  OC: 'Operador de Comunicações',
  'INSTR. 1': 'Instrutor da instrução/evidência 1',
  'INSTR. 2': 'Instrutor da instrução/evidência 2',
  'INSTR. 3': 'Instrutor da instrução/evidência 3',
  'INSTR. 1-2': 'Instrutor das instruções/evidências 1 e 2',
  'INSTR. 2-3': 'Instrutor das instruções/evidências 2 e 3',
  'INSTR. 1-3': 'Instrutor das instruções/evidências 1 e 3',
  'INSTR. 1-2-3': 'Instrutor das instruções/evidências 1, 2 e 3',
};

export const PTRBA_COMPLETO_FUNCOES = ['BA-CE', 'BA-LR', 'BA-MC', 'BA-2', 'BA-RE', 'GS', 'OC', 'APOC'] as const;

export const PTRBA_COMPLETO_PARTICIPANTE_SLOTS = 15;
export const PTRBA_COMPLETO_EVIDENCIA_SLOTS = 6;
export const PTRBA_COMPLETO_EVIDENCIA_PARES = [
  [0, 1],
  [2, 3],
  [4, 5],
] as const;

const HIERARQUIA_PTRBA_COMPLETO = [
  'BA-CE',
  'BA-LR',
  'BA-MC',
  'BA-MC',
  'BA-MC',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
  'BA-2',
];

export function criarParticipantesPTRBACompletoVazios(): PTRBACompletoParticipante[] {
  return HIERARQUIA_PTRBA_COMPLETO.map(funcao => ({
    funcao,
    nomeCompleto: '',
    situacao: 'P',
  }));
}

export function criarEvidenciasPTRBACompletoVazias(): PTRBACompletoEvidencia[] {
  return Array.from({ length: PTRBA_COMPLETO_EVIDENCIA_SLOTS }, () => ({
    horaInicio: '',
    horaTermino: '',
    assunto: '',
    imagem: '',
    descricao: '',
  }));
}

export function sincronizarParesEvidenciasPTRBACompleto(
  evidencias: PTRBACompletoEvidencia[],
): PTRBACompletoEvidencia[] {
  const resultado = evidencias.map(evidencia => ({ ...evidencia }));

  PTRBA_COMPLETO_EVIDENCIA_PARES.forEach(([primeiroIndex, segundoIndex]) => {
    const primeiro = resultado[primeiroIndex];
    const segundo = resultado[segundoIndex];
    if (!primeiro || !segundo) return;

    const dadosCompartilhados = {
      horaInicio: primeiro.horaInicio || segundo.horaInicio || '',
      horaTermino: primeiro.horaTermino || segundo.horaTermino || '',
      assunto: primeiro.assunto || segundo.assunto || '',
      descricao: primeiro.descricao || segundo.descricao || '',
    };

    resultado[primeiroIndex] = { ...primeiro, ...dadosCompartilhados };
    resultado[segundoIndex] = { ...segundo, ...dadosCompartilhados };
  });

  return resultado;
}

export function normalizarParticipantesPTRBACompleto(
  participantes?: PTRBACompletoParticipante[],
): PTRBACompletoParticipante[] {
  const base = criarParticipantesPTRBACompletoVazios();
  const lista = Array.isArray(participantes) ? participantes : [];
  return base.map((item, index) => ({
    ...item,
    ...lista[index],
    situacao: lista[index]?.situacao ?? item.situacao,
  }));
}

export function normalizarEvidenciasPTRBACompleto(
  evidencias?: PTRBACompletoEvidencia[],
): PTRBACompletoEvidencia[] {
  const base = criarEvidenciasPTRBACompletoVazias();
  const lista = Array.isArray(evidencias) ? evidencias : [];
  return sincronizarParesEvidenciasPTRBACompleto(base.map((item, index) => ({
    ...item,
    ...lista[index],
  })));
}
