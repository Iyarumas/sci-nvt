export type TipoExtintor = 'PO' | 'CO2' | 'ABC' | 'AP' | 'Acqua' | 'Outro';
export type SeloInmetro = 'Sim' | 'Nao';
export type StatusExtintor = 'Ativo' | 'Vencido' | 'Em manutenção' | 'Fora de uso';

export const TIPO_EXTINTOR_OPTIONS: { value: TipoExtintor; label: string }[] = [
  { value: 'PO', label: 'Pó Químico (PQ)' },
  { value: 'CO2', label: 'Gás Carbônico (CO₂)' },
  { value: 'ABC', label: 'Pó ABC Multiuso' },
  { value: 'AP', label: 'Água Pressurizada' },
  { value: 'Acqua', label: 'Água com Aditivo' },
  { value: 'Outro', label: 'Outro' },
];

export const CAPACIDADE_OPTIONS: string[] = [
  '2 kg', '4 kg', '6 kg', '8 kg', '10 kg', '12 kg',
  '20 kg', '25 kg', '50 kg', '100 kg',
];

export const STATUS_EXTINTOR_OPTIONS: { value: StatusExtintor; label: string; color: string }[] = [
  { value: 'Ativo', label: 'Ativo', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Vencido', label: 'Vencido', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'Em manutenção', label: 'Em Manutenção', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'Fora de uso', label: 'Fora de Uso', color: 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300' },
];

export type IntervaloConferencia = '1' | '3' | '6' | '12';

export const INTERVALO_CONFERENCIA_OPTIONS: { value: IntervaloConferencia; label: string }[] = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
];

export interface Extintor {
  id: string;
  numeroSerie: string;
  tipo: TipoExtintor;
  capacidade: string;
  dataFabricacao: string;
  seloInmetro: SeloInmetro;
  numeroExtintor: string;
  localizacao: string;
  status: StatusExtintor;
  intervaloConferencia: IntervaloConferencia;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
