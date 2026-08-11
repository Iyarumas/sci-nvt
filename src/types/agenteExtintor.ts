export type TipoAgenteExtintor = 'LGE' | 'PQS' | 'Nitrogenio' | 'CO2' | 'Outro';
export type UnidadeAgenteExtintor = 'L' | 'kg' | 'cilindro' | 'unidade';
export type StatusAgenteExtintor = 'Disponivel' | 'Baixo estoque' | 'Vencido' | 'Em manutencao' | 'Fora de uso';

export const TIPO_AGENTE_EXTINTOR_OPTIONS: { value: TipoAgenteExtintor; label: string }[] = [
  { value: 'LGE', label: 'LGE' },
  { value: 'PQS', label: 'Po Quimico Seco' },
  { value: 'Nitrogenio', label: 'Nitrogenio' },
  { value: 'CO2', label: 'CO2' },
  { value: 'Outro', label: 'Outro' },
];

export const UNIDADE_AGENTE_EXTINTOR_OPTIONS: { value: UnidadeAgenteExtintor; label: string }[] = [
  { value: 'L', label: 'Litros' },
  { value: 'kg', label: 'Quilos' },
  { value: 'cilindro', label: 'Cilindros' },
  { value: 'unidade', label: 'Unidades' },
];

export const STATUS_AGENTE_EXTINTOR_OPTIONS: { value: StatusAgenteExtintor; label: string; color: string }[] = [
  { value: 'Disponivel', label: 'Disponivel', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Baixo estoque', label: 'Baixo estoque', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'Vencido', label: 'Vencido', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'Em manutencao', label: 'Em manutencao', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'Fora de uso', label: 'Fora de uso', color: 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300' },
];

export interface AgenteExtintor {
  id: string;
  nome: string;
  tipo: TipoAgenteExtintor;
  quantidade: number;
  unidade: UnidadeAgenteExtintor;
  lote: string;
  validade: string;
  localizacao: string;
  status: StatusAgenteExtintor;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
