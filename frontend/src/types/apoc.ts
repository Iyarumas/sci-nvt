export type FuncaoAPOC = 'APOC' | 'SUPERVISOR';

export const FUNCAO_APOC_OPTIONS: { value: FuncaoAPOC; label: string }[] = [
  { value: 'APOC', label: 'APOC' },
  { value: 'SUPERVISOR', label: 'SUPERVISOR' },
];
export const EQUIPE_APOC = 'MOTIVA';

export interface APOC {
  id: string;
  nomeCompleto: string;
  nomeGuerra: string;
  email: string;
  funcao: FuncaoAPOC;
  equipe: string;
  turno?: string;
  createdAt: string;
  updatedAt: string;
}
