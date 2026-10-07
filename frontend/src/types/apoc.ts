export type FuncaoAPOC = 'APOC' | 'SUPERVISOR' | 'COORDENADOR';

export const FUNCAO_APOC_OPTIONS: { value: FuncaoAPOC; label: string }[] = [
  { value: 'APOC', label: 'APOC' },
  { value: 'SUPERVISOR', label: 'SUPERVISOR' },
  { value: 'COORDENADOR', label: 'Coordenador' },
];
export const EQUIPE_APOC = 'ASUR';

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
