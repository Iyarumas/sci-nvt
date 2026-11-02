import { apiFetch } from '../lib/apiClient';
import type { ExclusaoAuditada, FiltrosAuditoria, ListaExclusoes } from '../types/auditoria';

interface ExclusaoRow {
  id: string;
  created_at: string;
  tabela: string;
  registro_id: string;
  identificacao: string;
  usuario_id: string | null;
  usuario_login: string | null;
  usuario_funcao: string | null;
  origem: ExclusaoAuditada['origem'];
}

function rowToExclusao(row: ExclusaoRow): ExclusaoAuditada {
  return {
    id: row.id, createdAt: row.created_at, tabela: row.tabela,
    registroId: row.registro_id, identificacao: row.identificacao,
    usuarioId: row.usuario_id, usuarioLogin: row.usuario_login,
    usuarioFuncao: row.usuario_funcao, origem: row.origem,
  };
}

function handleSupabaseError(err: unknown): never {
  throw new Error(err instanceof Error ? err.message : 'Não foi possível consultar o histórico de exclusões.');
}

export async function listarExclusoes(filtros: FiltrosAuditoria, signal?: AbortSignal): Promise<ListaExclusoes> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  try {
    const response = await apiFetch<Omit<ListaExclusoes, 'registros'> & { data: ExclusaoRow[] }>(`/auditoria/exclusoes?${query}`, { cache: 'no-store', signal });
    return { ...response, registros: response.data.map(rowToExclusao) };
  } catch (err) {
    handleSupabaseError(err);
  }
}

const NOMES_MODULOS: Record<string, string> = {
  bombeiros: 'Bombeiros', apocs: 'APOCs', usuarios: 'Usuários', convites: 'Convites',
  ferias: 'Férias', ferias_escala: 'Escala anual de férias', ferias_escala_item: 'Itens da escala de férias',
  escalas: 'Escalas', escalas_diarias: 'Escalas diárias', escalas_mensais_config: 'Configuração da escala mensal', escalas_mensais_geradas: 'Escalas mensais',
  ptrb_registros: 'PTR-BA por instrução', ptrba_completo_registros: 'PTR-BA',
  registros_lro: 'LRO', lro_drafts: 'Rascunhos do LRO', lro_ocorrencias: 'Ocorrências do LRO',
  ocorrencias: 'Ocorrências', ocorrencias_operacionais: 'Ocorrências operacionais', rea_registros: 'REA',
  documents: 'Documentos', document_fields: 'Campos de documentos', document_fills: 'Preenchimentos de documentos', document_signers: 'Signatários de documentos',
  ordens_servico: 'Ordens de serviço', epis: 'EPIs', epis_estoque: 'Estoque de EPIs',
  certificacoes: 'Certificações', certificacoes_nr: 'Certificações NR', certificacoes_cursos: 'Cursos',
  viaturas: 'Viaturas', viatura_panes: 'Panes de viaturas', extintores: 'Extintores', hidrantes: 'Hidrantes',
  equipamentos: 'Equipamentos', equipamentos_operacionais: 'Equipamentos operacionais',
  agentes_extintores: 'Agentes extintores', agentes_extintores_movimentacoes: 'Movimentações de agentes extintores',
  agentes_extintores_relatorios: 'Relatórios de agentes extintores', agentes_extintores_relatorio_itens: 'Itens de relatórios de agentes extintores',
  substituicoes: 'Substituições', substituicoes_ativas: 'Substituições ativas', substituicoes_temporarias: 'Substituições temporárias', vigencia_substituicoes: 'Vigências de substituição', vagas_pendentes: 'Vagas pendentes',
  treinamentos: 'Treinamentos', treinamentos_taf: 'TAF', treinamentos_tpepr: 'TP/EPR', treinamentos_tempo_resposta: 'Tempo resposta', exercicios_posicionamento: 'Exercício de posicionamento',
  checklists: 'Checklists', conferencias: 'Conferências', inspecoes: 'Inspeções', chat_mensagens: 'Mensagens do chat',
};

export function nomeModuloAuditoria(tabela: string): string {
  return NOMES_MODULOS[tabela] || tabela.replaceAll('_', ' ');
}
