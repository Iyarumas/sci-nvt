import { apiFetch } from '../lib/apiClient';

/** Alcance de uma ação: Não / Própria equipe / Todas. */
export type Alcance = 'nao' | 'equipe' | 'todas';

export interface AcaoCatalogo { chave: string; nome: string }
export interface TelaCatalogo { chave: string; nome: string; grupo: string; acoes: AcaoCatalogo[] }

export interface CelulaFuncao {
  alcance: Alcance;
  padrao: Alcance;
  observacao: string | null;
  alteradoPor: string | null;
  alteradoEm: string | null;
}

export interface UsuarioPermissao {
  id: string;
  username: string;
  nome: string;
  papel: string;
  funcao: string | null;
  equipe: string | null;
  acessoTotal: boolean;
}

export interface ExcecaoUsuario {
  usuarioId: string;
  acao: string;
  alcance: Alcance;
  alteradoPor: string;
  alteradoEm: string;
}

export interface DadosPermissoes {
  funcoes: string[];
  alcances: Alcance[];
  telas: TelaCatalogo[];
  /** grade["ptrba.criar"]["BA-CE"] */
  grade: Record<string, Record<string, CelulaFuncao>>;
  usuarios: UsuarioPermissao[];
  excecoes: ExcecaoUsuario[];
}

export interface MudancaFuncao { funcao: string; acao: string; alcance: Alcance }
/** alcance null = tirar a exceção (volta a valer a função). */
export interface MudancaUsuario { usuarioId: string; acao: string; alcance: Alcance | null }

export function listarPermissoes(): Promise<DadosPermissoes> {
  return apiFetch<DadosPermissoes>('/permissoes', { cache: 'no-store' });
}

export function salvarPermissoes(funcoes: MudancaFuncao[], usuarios: MudancaUsuario[]): Promise<DadosPermissoes> {
  return apiFetch<DadosPermissoes>('/permissoes', {
    method: 'PUT',
    body: JSON.stringify({ funcoes, usuarios }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function minhasPermissoes(): Promise<{ acessoTotal: boolean; funcao: string | null; equipe: string | null; acoes: Record<string, Alcance> }> {
  return apiFetch('/permissoes/minhas', { cache: 'no-store' });
}
