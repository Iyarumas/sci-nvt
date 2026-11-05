import { apiFetch } from '../lib/apiClient';

export type NivelPermissao = 'nenhum' | 'ver' | 'equipe' | 'tudo';

export interface ModuloPermissao {
  chave: string;
  nome: string;
  descricao: string;
  porEquipe: boolean;
}

export interface CelulaPermissao {
  nivel: NivelPermissao;
  padrao: NivelPermissao;
  observacao: string | null;
  alteradoPor: string | null;
  alteradoEm: string | null;
}

export interface GradePermissoes {
  funcoes: string[];
  modulos: ModuloPermissao[];
  niveis: NivelPermissao[];
  grade: Record<string, Record<string, CelulaPermissao>>;
}

export interface AlteracaoPermissao {
  funcao: string;
  modulo: string;
  nivel: NivelPermissao;
}

export function listarPermissoes(): Promise<GradePermissoes> {
  return apiFetch<GradePermissoes>('/permissoes');
}

export function salvarPermissoes(alteracoes: AlteracaoPermissao[]): Promise<GradePermissoes> {
  return apiFetch<GradePermissoes>('/permissoes', { method: 'PUT', body: JSON.stringify({ alteracoes }) });
}
