export type EPIStatus = 'entregue' | 'pago' | 'enviado_autentique' | 'assinado' | 'devolvido';

export type EstadoConservacao = 'Novo' | 'Bom' | 'Regular' | 'Ruim' | 'Sem uso';

export const ESTADO_CONSERVACAO_OPTIONS: { value: EstadoConservacao; label: string; color: string }[] = [
  { value: 'Novo', label: 'Novo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'Bom', label: 'Bom', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Regular', label: 'Regular', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'Ruim', label: 'Ruim', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
  { value: 'Sem uso', label: 'Sem condição de uso', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
];

export const TAMANHOS_EPI: Record<string, string[]> = {
  'Luva': ['P', 'M', 'G', 'GG'],
  'Botina': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  'Bota': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  'Protetor Auricular': ['Único'],
  'Óculos de Proteção': ['Único'],
  'Capacete': ['Único'],
  'Cinto paraquedista': ['Único'],
  'Respirador': ['P', 'M', 'G'],
  'Vestimenta': ['P', 'M', 'G', 'GG'],
  'Protetor Facial': ['Único'],
  'Luva Isolante': ['P', 'M', 'G', 'GG'],
  'Outros': ['Único'],
};

export interface EPI {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nome: string;
  descricao: string;
  colaborador: string;
  colaboradorId: string;
  entreguePor: string;
  ca: string;
  dataPagamento: string;
  dataValidade: string;
  fornecedor: string;
  notas: string;
  status: EPIStatus;
  dataEnvioAutentique: string;
  dataAssinatura: string;
  dataDevolucao: string;
  dataFabricacao: string;
  tamanho: string;
  numeroSerie: string;
  estado: EstadoConservacao;
}

export interface EPIEstoque {
  id: string;
  nome: string;
  descricao: string;
  ca: string;
  fornecedor: string;
  quantidade: number;
  dataFabricacao: string;
  tempoValidadeMeses: number;
  dataValidade: string;
  tamanho: string;
  numeroSerie: string;
  estado: EstadoConservacao;
  notas: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const EPI_STATUS_LABELS: Record<EPIStatus, string> = {
  entregue: 'Entregue',
  pago: 'Pago',
  enviado_autentique: 'Enviado Autentique',
  assinado: 'Assinado',
  devolvido: 'Devolvido',
};

export const EPI_STATUS_COLORS: Record<EPIStatus, string> = {
  entregue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  pago: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  enviado_autentique: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  assinado: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  devolvido: 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-400',
};

export const CATEGORIAS_EPI = [
  'Capacete', 'Óculos de Proteção', 'Protetor Auricular', 'Luva',
  'Botina', 'Cinto paraquedista', 'Respirador', 'Vestimenta',
  'Protetor Facial', 'Luva Isolante', 'Outros',
] as const;

export type PrioridadeNotificacao = 'vencido' | 'critico' | 'atencao' | 'normal';

export function getDiasParaVencer(dataValidade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade + 'T00:00:00');
  return Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function getPrioridade(dataValidade: string): PrioridadeNotificacao {
  const dias = getDiasParaVencer(dataValidade);
  if (dias < 0) return 'vencido';
  if (dias <= 40) return 'critico';
  if (dias <= 365) return 'atencao';
  return 'normal';
}

export function getLabelValidade(dataValidade: string): { label: string; cor: string; bolinha: string } {
  const dias = getDiasParaVencer(dataValidade);
  if (dias < 0) return { label: 'Vencido', cor: 'text-red-600 dark:text-red-400', bolinha: 'bg-red-500' };
  if (dias <= 40) return { label: `${dias} dias`, cor: 'text-orange-600 dark:text-orange-400', bolinha: 'bg-orange-500' };
  if (dias <= 365) {
    const meses = Math.floor(dias / 30);
    return { label: `${meses} mês${meses > 1 ? 'es' : ''}`, cor: 'text-yellow-600 dark:text-yellow-400', bolinha: 'bg-yellow-500' };
  }
  return { label: 'Válido', cor: 'text-green-600 dark:text-green-400', bolinha: 'bg-green-500' };
}

export function calcularDataValidade(dataFabricacao: string, tempoValidadeMeses: number): string {
  if (!dataFabricacao || !tempoValidadeMeses) return '';
  const data = new Date(dataFabricacao);
  data.setMonth(data.getMonth() + tempoValidadeMeses);
  return data.toISOString().split('T')[0];
}

export function getDiasParaVencerLabel(dataValidade: string): string {
  const dias = getDiasParaVencer(dataValidade);
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''}`;
  if (dias <= 40) return `Vence em ${dias} dia${dias > 1 ? 's' : ''}`;
  if (dias <= 365) {
    const meses = Math.floor(dias / 30);
    return `Vence em ${meses} mês${meses > 1 ? 'es' : ''}`;
  }
  return 'Válido';
}
