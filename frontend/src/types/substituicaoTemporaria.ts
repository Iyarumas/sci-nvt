export type MotivoSubstituicao =
  | 'Atestado Medico'
  | 'Falecimento Conjuge'
  | 'Falecimento Pai Mae'
  | 'Falecimento Filho'
  | 'Casamento'
  | 'Nascimento Filho'
  | 'Doacao Sangue'
  | 'INSS'
  | 'INSS Indeterminado'
  | 'Outro';

export type TipoSubstituicao = 'Substituição' | 'Extra' | 'Afastamento';
export type RespostaPlantaoExtra = 'Sim' | 'Nao' | '';

export interface EloCadeiaSubstituicaoTemporaria {
  tipo?: 'cadeia' | 'extra';
  pessoaId: string;
  pessoaNome: string;
  pessoaCargo: string;
  pessoaEquipe: string;
  cargoOriginal: string;
  cargoVacante: string;
  substituindoNome: string;
  dataPlantao?: string;
  funcionarioId?: string;
  funcionarioNome?: string;
  funcionarioCargo?: string;
  funcionarioEquipe?: string;
  equipePlantao?: string;
  substituindoId?: string;
  substituindoCargo?: string;
  substituindoCoberturaNome?: string;
  substitutoId?: string;
  substitutoNome?: string;
  substitutoCargo?: string;
  cargoExercido?: string;
  plantaoExtra?: boolean;
}

export const MOTIVOS_OBRIGATORIOS_POR_LEI: MotivoSubstituicao[] = [
  'Atestado Medico',
  'Falecimento Conjuge',
  'Falecimento Pai Mae',
  'Falecimento Filho',
  'Casamento',
  'Nascimento Filho',
  'Doacao Sangue',
  'INSS',
  'INSS Indeterminado',
];

export interface SubstituicaoTemporaria {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioCargo: string;
  substitutoId: string;
  substitutoNome: string;
  substitutoCargo: string;
  tipo: TipoSubstituicao;
  motivo: MotivoSubstituicao;
  motivoOutro: string;
  plantaoExtra: RespostaPlantaoExtra;
  dataInicio: string;
  dataFim: string;
  dias: number;
  status: 'Pendente' | 'Aprovada' | 'Rejeitada';
  observacoesRejeicao: string;
  criadoPor: string;
  criadoPorNome: string;
  aprovadoPor: string;
  aprovadoPorNome: string;
  aprovadoEm: string;
  cadeiaSubstituicao: EloCadeiaSubstituicaoTemporaria[];
  createdAt: string;
  updatedAt: string;
}

export const MOTIVOS_SUBSTITUICAO: { value: MotivoSubstituicao; label: string; dias: number }[] = [
  { value: 'Atestado Medico', label: 'Atestado Médico', dias: 15 },
  { value: 'Falecimento Conjuge', label: 'Falecimento Cônjuge/Companheiro(a)', dias: 21 },
  { value: 'Falecimento Pai Mae', label: 'Falecimento Pai/Mãe', dias: 5 },
  { value: 'Falecimento Filho', label: 'Falecimento Filho(a)', dias: 21 },
  { value: 'Casamento', label: 'Casamento', dias: 3 },
  { value: 'Nascimento Filho', label: 'Nascimento de Filho', dias: 5 },
  { value: 'Doacao Sangue', label: 'Doação de Sangue', dias: 1 },
  { value: 'INSS', label: 'INSS', dias: 0 },
  { value: 'INSS Indeterminado', label: 'INSS/Indeterminado', dias: 0 },
  { value: 'Outro', label: 'Outro', dias: 0 },
];

export const STATUS_SUBSTITUICAO_CORES: Record<string, string> = {
  'Pendente': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Aprovada': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  'Rejeitada': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};
