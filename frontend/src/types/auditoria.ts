export interface ExclusaoAuditada {
  id: string;
  createdAt: string;
  tabela: string;
  registroId: string;
  identificacao: string;
  usuarioId: string | null;
  usuarioLogin: string | null;
  usuarioFuncao: string | null;
  origem: 'sistema' | 'sem_usuario';
}

export interface FiltrosAuditoria {
  termo?: string;
  tabela?: string;
  inicio?: string;
  fim?: string;
  pagina?: number;
}

export interface ListaExclusoes {
  registros: ExclusaoAuditada[];
  total: number;
  pagina: number;
  porPagina: number;
  tabelas: string[];
  inicioAuditoria: string | null;
}
