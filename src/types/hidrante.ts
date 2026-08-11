export type TipoHidrante = 'Seco' | 'Umido' | 'Coluna de Recarga';
export type StatusHidrante = 'Ativo' | 'Em manutenção' | 'Fora de uso';

export const TIPO_HIDRANTE_OPTIONS: { value: TipoHidrante; label: string }[] = [
  { value: 'Seco', label: 'Hidrante Seco' },
  { value: 'Umido', label: 'Hidrante Úmido' },
  { value: 'Coluna de Recarga', label: 'Coluna de Recarga' },
];

export const STATUS_HIDRANTE_OPTIONS: { value: StatusHidrante; label: string; color: string }[] = [
  { value: 'Ativo', label: 'Ativo', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
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

export interface Hidrante {
  id: string;
  numero: string;
  tipo: TipoHidrante;
  localizacao: string;
  pressao: string;
  status: StatusHidrante;
  intervaloConferencia: IntervaloConferencia;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
