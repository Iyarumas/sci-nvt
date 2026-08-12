import type { Cargo, Equipe } from './bombeiro';

export const ABBR_CARGO: Record<Cargo, string> = {
  'BA-CE': 'BA-CE',
  'BA-LR': 'BA-LR',
  'BA-MC': 'BA-MC',
  'BA-RE': 'BA-RE',
  'BA-2': 'BA-2',
  'GS': 'GS',
  'OC': 'OC',
};

// ---------------------------------------------------------------------------
// NOVOS INTERFACES (v2) - Períodos Aquisitivos e Escalas
// ---------------------------------------------------------------------------

export interface PeriodoAquisitivo {
  numero: number;
  dataInicio: string;
  dataFim: string;
  dataVencimento: string;
  status: 'Nao Adquirido' | 'Disponivel' | 'Em Gozo' | 'Gozado' | 'Vencido';
  diasDireito: number;
  diasGozados: number;
}

export interface FeriasGozo {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  equipe: Equipe;
  periodoNumero: number;
  dataInicio: string;
  dataFim: string;
  dias: number;
  status: 'Programadas' | 'Em Gozo' | 'Gozadas';
  substitutoId: string;
  substitutoNome: string;
  funcaoSubstituicao: Cargo | '';
  observacoes: string;
  modificadoPor: string;
  bloqueado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeriasAlerta {
  funcionarioId: string;
  funcionarioNome: string;
  equipe: Equipe;
  dataAdmissao: string;
  periodoNumero: number;
  diasParaVencer: number;
  nivel: 'ok' | 'alerta' | 'perigo' | 'critico';
}

export interface EscalaFerias {
  id: string;
  equipe: Equipe;
  ano: number;
  chefeId: string;
  chefeNome: string;
  status: 'Rascunho' | 'Enviado' | 'Aprovado' | 'Rejeitado';
  observacoesRejeicao: string;
  aprovadoPor: string;
  aprovadoPorNome: string;
  aprovadoEm: string;
  enviadoEm: string;
  createdAt: string;
  updatedAt: string;
}

export interface EscalaFeriasItem {
  id: string;
  escalaId: string;
  mes: number;
  funcionarioId: string;
  funcionarioNome: string;
  funcao: Cargo;
  dias: number;
  dataInicio: string;
  dataFim: string;
  substitutoId: string;
  substitutoNome: string;
  funcaoSubstituicao: Cargo | '';
  feristaId: string;
  feristaNome: string;
  periodoNumero: number;
  rejeitado: boolean;
  motivoRejeicao: string;
  rejeitadoPor: string;
  rejeitadoEm: string;
  enviado: boolean;
  observacoes: string;
  feriasGozoId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants - Status Gozo (v2)
// ---------------------------------------------------------------------------

export const STATUS_GOZO = ['Programadas', 'Em Gozo', 'Gozadas'] as const;
export type StatusGozo = typeof STATUS_GOZO[number];

export const STATUS_GOZO_COLORS: Record<StatusGozo, string> = {
  'Programadas': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Em Gozo': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Gozadas': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
};

// ---------------------------------------------------------------------------
// Constants - Status Escala
// ---------------------------------------------------------------------------

export const STATUS_ESCALA = ['Rascunho', 'Enviado', 'Aprovado', 'Rejeitado'] as const;
export type StatusEscala = typeof STATUS_ESCALA[number];

export const STATUS_ESCALA_COLORS: Record<StatusEscala, string> = {
  'Rascunho': 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300',
  'Enviado': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Aprovado': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  'Rejeitado': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Constants - Meses
// ---------------------------------------------------------------------------

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ---------------------------------------------------------------------------
// Hierarquia de Cargos para Corrente de Substituição
// ---------------------------------------------------------------------------

/**
 * Hierarquia de cargos para a corrente de substituição de férias.
 * A seta indica quem cobre quem: BA-CE cobre GS, BA-LR cobre BA-CE, etc.
 * GS(0) → BA-CE(1) → BA-LR(2) → BA-MC(3) → BA-2(4) → Ferista(5)
 */
export const HIERARCHY: Cargo[] = ['GS', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-2'];

/**
 * Retorna o próximo cargo na cadeia de substituição.
 * Ex: GS → BA-CE, BA-CE → BA-LR, BA-MC → BA-2, BA-2 → 'Ferista'
 */
export function getNextCargoNaCadeia(cargo: Cargo): Cargo | null {
  if (cargo === 'BA-2') return null;
  const idx = HIERARCHY.indexOf(cargo);
  if (idx === -1 || idx >= HIERARCHY.length - 1) return null;
  return HIERARCHY[idx + 1];
}

/**
 * Retorna os cargos permitidos para preencher uma posição vaga.
 * BA-2 vago → BA-2 (BA-2 pode substituir BA-2, mas eventualmente termina em Ferista da equipe Ferista)
 * Outros cargos → todos (Ferista é identificado pela equipe, não pelo cargo)
 */
export function getCargosPermitidosParaVaga(cargoVacante: Cargo): Cargo[] {
  if (cargoVacante === 'BA-2') return ['BA-2'];
  return ['BA-2', 'BA-MC', 'BA-LR', 'BA-CE', 'GS'];
}

/**
 * Retorna true se o cargo TEM de ter substituto obrigatório nas férias.
 * BA-CE, BA-LR, BA-MC, GS são obrigatórios.
 * BA-2 é obrigatório mas só pode ser substituído por BA-2 ou Ferista.
 * Ferista não precisa de substituto.
 */
export function isSubstitutoObrigatorio(cargo: Cargo): boolean {
  return cargo === 'GS' || cargo === 'BA-CE' || cargo === 'BA-LR' || cargo === 'BA-MC' || cargo === 'BA-2';
}

/**
 * Retorna os cargos que podem substituir um determinado cargo.
 * BA-2 → só BA-2 ou Ferista
 * BA-CE, BA-LR, BA-MC, GS → qualquer cargo (incluindo Ferista)
 */
export function getCargosPermitidosSubstituto(cargoVacante: Cargo): (Cargo | 'Ferista')[] {
  if (cargoVacante === 'BA-2') return ['BA-2', 'Ferista'];
  return ['Ferista', 'BA-2', 'BA-MC', 'BA-LR', 'BA-CE', 'GS'];
}

/**
 * Interface para representar um elo da corrente de substituição
 */
export interface EloCorrenteSubstituicao {
  nivel: number;
  pessoaId: string;
  pessoaNome: string;
  cargoOriginal: Cargo;
  substituindoId: string;
  substituindoNome: string;
  cargoExercido: string;
  motivo: 'ferias' | 'afastamento' | 'substituicao' | 'cascata';
}

// ---------------------------------------------------------------------------
// Constants - Funções de Substituição
// ---------------------------------------------------------------------------

export const FUNCOES_SUBSTITUICAO: { value: Cargo; label: string }[] = [
  { value: 'BA-CE', label: 'Chefe de Equipe' },
  { value: 'BA-LR', label: 'Líder de Resgate' },
  { value: 'BA-MC', label: 'Motorista/Condutor' },
  { value: 'BA-RE', label: 'Resgate' },
  { value: 'BA-2', label: 'Bombeiro de Aeródromo' },
  { value: 'OC', label: 'Operador de Comunicações' },
];

// ---------------------------------------------------------------------------
// CLT Utility - Calcular Períodos Aquisitivos
// ---------------------------------------------------------------------------

export function calcularPeriodosAquisitivos(dataAdmissao: string): PeriodoAquisitivo[] {
  if (!dataAdmissao) return [];
  const admissao = new Date(dataAdmissao + 'T00:00:00');
  if (isNaN(admissao.getTime())) return [];
  const hoje = new Date();
  const periodos: PeriodoAquisitivo[] = [];
  let numero = 1;

  while (true) {
    const dataInicio = new Date(admissao);
    dataInicio.setFullYear(admissao.getFullYear() + (numero - 1));

    const dataFim = new Date(dataInicio);
    dataFim.setFullYear(dataInicio.getFullYear() + 1);
    dataFim.setDate(dataFim.getDate() - 1);

    const dataVencimento = new Date(dataFim);
    dataVencimento.setFullYear(dataFim.getFullYear() + 1);

    if (dataInicio > hoje) break;

    let status: PeriodoAquisitivo['status'] = 'Disponivel';
    if (dataVencimento < hoje) status = 'Vencido';

    periodos.push({
      numero,
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: dataFim.toISOString().split('T')[0],
      dataVencimento: dataVencimento.toISOString().split('T')[0],
      status,
      diasDireito: 30,
      diasGozados: 0,
    });

    numero++;
    if (numero > 10) break;
  }

  return periodos;
}

// ---------------------------------------------------------------------------
// LEGACY interfaces - backward compatibility with existing localStorage data
// ---------------------------------------------------------------------------

export interface Ferias {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  periodo: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  status: StatusGozo;
  substitutoId: string;
  substitutoNome: string;
  funcaoSubstituicao: Cargo | '';
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertaVencimento {
  funcionarioId: string;
  funcionarioNome: string;
  equipe: Equipe;
  dataAdmissao: string;
  diasParaVencer: number;
  nivel: 'ok' | 'alerta' | 'perigo' | 'critico';
}

export interface SubstituicaoAtiva {
  id: string;
  feriasId: string;
  funcionarioId: string;
  funcionarioNome: string;
  substitutoId: string;
  substitutoNome: string;
  funcaoSubstituicao: Cargo;
  dataInicio: string;
  dataFim: string;
  ativa: boolean;
  createdAt: string;
}

export const STATUS_FERIAS = ['Programadas', 'Em Gozo', 'Gozadas', 'Indisponível'] as const;
export type StatusFerias = typeof STATUS_FERIAS[number];

export const STATUS_FERIAS_COLORS: Record<StatusFerias, string> = {
  'Programadas': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Em Gozo': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Gozadas': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  'Indisponível': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};
