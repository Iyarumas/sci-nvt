import type {
  ClasseAgenteExtintor,
  ComposicaoAgenteExtintor,
  DosagemAgenteExtintor,
  ProdutoAgenteExtintor,
  TipoAgenteExtintor,
  UnidadeAgenteExtintor,
} from './agenteExtintor';

export type AgenteExtintorRelatorioStatus = 'Rascunho' | 'Finalizado' | 'Arquivado';

export interface AgenteExtintorRelatorio {
  id: string;
  competencia: string;
  dataRelatorio: string;
  status: AgenteExtintorRelatorioStatus;
  pqExigido: number;
  lgeExigido: number;
  aguaExigida: number;
  aguaEmLinha: number;
  aguaCciRt: number;
  aguaEstoque: number;
  reservaTecnicaPercentual: number;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  finalizadoPor: string;
  finalizadoEm: string;
}

export interface AgenteExtintorRelatorioItem {
  id: string;
  relatorioId: string;
  agenteExtintorId: string;
  marcaAgente: string;
  produto: ProdutoAgenteExtintor;
  tipo: TipoAgenteExtintor;
  dosagem: DosagemAgenteExtintor;
  classe: ClasseAgenteExtintor;
  composicao: ComposicaoAgenteExtintor;
  lote: string;
  validade: string;
  fabricacao: string;
  localizacao: string;
  quantidade: number;
  unidade: UnidadeAgenteExtintor;
  recipiente: string;
  quantidadeRecipientes: number;
  capacidadeRecipiente: number;
  validadeEnsaioLaboratorial: string;
  validadeEnsaioFogo: string;
  validadeTesteHidrostatico: string;
  validadeCilindro: string;
  createdAt: string;
}

export type TipoMovimentacaoAgenteExtintor =
  | 'Cadastro inicial'
  | 'Entrada'
  | 'Retirada'
  | 'Substituição'
  | 'Inspeção'
  | 'Ensaio laboratorial'
  | 'Ensaio de fogo'
  | 'Teste hidrostático'
  | 'Outro';

export interface AgenteExtintorMovimentacao {
  id: string;
  relatorioId: string;
  agenteExtintorId: string;
  data: string;
  tipo: TipoMovimentacaoAgenteExtintor;
  resultado: string;
  validadeResultante: string;
  quantidadeAnterior: number;
  quantidadeNova: number;
  unidade: string;
  observacoes: string;
  createdBy: string;
  createdAt: string;
}

export const TIPOS_MOVIMENTACAO_AGENTE_EXTINTOR: TipoMovimentacaoAgenteExtintor[] = [
  'Cadastro inicial',
  'Entrada',
  'Retirada',
  'Substituição',
  'Inspeção',
  'Ensaio laboratorial',
  'Ensaio de fogo',
  'Teste hidrostático',
  'Outro',
];
