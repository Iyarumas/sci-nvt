export type ChecklistTipo = 'quinzenal' | 'personalizado';
export type ChecklistStatus = 'pendente' | 'concluido';
export type ChecklistQuinzena = '1' | '2';
export type ChecklistColumnType = 'check' | 'texto';

export interface ChecklistColumn {
  id: string;
  label: string;
  type: ChecklistColumnType;
  dia?: number;
  equipe?: string;
  fixa?: boolean;
}

export interface ChecklistRow {
  id: string;
  secao: string;
  quantidade: string;
  item: string;
  valores: Record<string, string | boolean>;
}

export interface ChecklistPayload {
  mes: number;
  ano: number;
  quinzena: ChecklistQuinzena;
  colunas: ChecklistColumn[];
  linhas: ChecklistRow[];
}

export interface Checklist {
  id: string;
  titulo: string;
  descricao: string;
  tipo: ChecklistTipo;
  data: string;
  equipe: string;
  responsavel: string;
  status: ChecklistStatus;
  payload: ChecklistPayload;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
