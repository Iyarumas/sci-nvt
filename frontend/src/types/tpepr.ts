import type { Cargo, Equipe } from './bombeiro';
import { TEMPO_CRONOMETRO_ZERO, mascararTempoCronometro } from '../utils/tempo';

export type TPEPRCargo = Extract<Cargo, 'BA-CE' | 'BA-LR' | 'BA-MC' | 'BA-2'>;
export type TreinamentoTPEPRStatus = 'Rascunho' | 'Aprovado';

export interface TPEPRParticipante {
  pessoaId: string;
  nomeCompleto: string;
  nomeGuerra: string;
  funcao: TPEPRCargo | string;
  primeiraTomada: string;
  segundaTomada: string;
  terceiraTomada: string;
  quartaTomada: string;
}

export interface TreinamentoTPEPR {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  equipe: Equipe | string;
  numero: number;
  ano: string;
  data: string;
  hora: string;
  turno: string;
  observacoes: string;
  chefeEquipe: string;
  participantes: TPEPRParticipante[];
  status: TreinamentoTPEPRStatus;
  aprovadoPor: string;
  aprovadoPorNome: string;
  aprovadoEm: string;
}

type CamposControleTPEPR = 'id' | 'createdAt' | 'updatedAt' | 'status' | 'aprovadoPor' | 'aprovadoPorNome' | 'aprovadoEm';
type CamposAprovacaoTPEPR = Pick<TreinamentoTPEPR, 'status' | 'aprovadoPor' | 'aprovadoPorNome' | 'aprovadoEm'>;

export type TPEPRInput = Omit<TreinamentoTPEPR, CamposControleTPEPR> & Partial<CamposAprovacaoTPEPR>;

export const TPEPR_EQUIPES: Equipe[] = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

export const TPEPR_PARTICIPANTE_SLOTS: { i: number; label: TPEPRCargo; cargo: TPEPRCargo }[] = [
  { i: 1, label: 'BA-CE', cargo: 'BA-CE' },
  { i: 2, label: 'BA-LR', cargo: 'BA-LR' },
  { i: 3, label: 'BA-MC', cargo: 'BA-MC' },
  { i: 4, label: 'BA-MC', cargo: 'BA-MC' },
  { i: 5, label: 'BA-MC', cargo: 'BA-MC' },
  { i: 6, label: 'BA-2', cargo: 'BA-2' },
  { i: 7, label: 'BA-2', cargo: 'BA-2' },
  { i: 8, label: 'BA-2', cargo: 'BA-2' },
  { i: 9, label: 'BA-2', cargo: 'BA-2' },
  { i: 10, label: 'BA-2', cargo: 'BA-2' },
];

export const TPEPR_CARGO_ORDER: TPEPRCargo[] = ['BA-CE', 'BA-LR', 'BA-MC', 'BA-2'];

export function criarParticipantesTPEPRVazios(): TPEPRParticipante[] {
  return TPEPR_PARTICIPANTE_SLOTS.map(slot => ({
    pessoaId: '',
    nomeCompleto: '',
    nomeGuerra: '',
    funcao: slot.cargo,
    primeiraTomada: TEMPO_CRONOMETRO_ZERO,
    segundaTomada: TEMPO_CRONOMETRO_ZERO,
    terceiraTomada: TEMPO_CRONOMETRO_ZERO,
    quartaTomada: TEMPO_CRONOMETRO_ZERO,
  }));
}

export function cargoTPEPRRank(cargo?: string): number {
  const idx = TPEPR_CARGO_ORDER.indexOf((cargo || '') as TPEPRCargo);
  return idx === -1 ? TPEPR_CARGO_ORDER.length : idx;
}

export function ordenarParticipantesTPEPR<T extends { funcao?: string; cargo?: string; nomeCompleto?: string; nomeGuerra?: string }>(
  participantes: T[],
): T[] {
  return [...participantes].sort((a, b) => {
    const cargoDiff = cargoTPEPRRank(a.funcao || a.cargo) - cargoTPEPRRank(b.funcao || b.cargo);
    if (cargoDiff !== 0) return cargoDiff;
    return (a.nomeCompleto || a.nomeGuerra || '').localeCompare(b.nomeCompleto || b.nomeGuerra || '');
  });
}

export function normalizarParticipantesTPEPR(participantes?: TPEPRParticipante[]): TPEPRParticipante[] {
  const base = criarParticipantesTPEPRVazios();
  const lista = Array.isArray(participantes) ? participantes : [];
  return base.map((slot, index) => {
    const item = lista[index];
    const primeiraTomada = mascararTempoTPEPR(item?.primeiraTomada || '');
    const segundaTomada = mascararTempoTPEPR(item?.segundaTomada || '');
    const terceiraTomada = mascararTempoTPEPR(item?.terceiraTomada || '');
    return {
      ...slot,
      ...item,
      funcao: item?.funcao || slot.funcao,
      primeiraTomada,
      segundaTomada,
      terceiraTomada,
      quartaTomada: item?.quartaTomada
        ? mascararTempoTPEPR(item.quartaTomada)
        : calcularQuartaTomada(segundaTomada, terceiraTomada),
    };
  });
}

export function mascararTempoTPEPR(valor: string): string {
  return mascararTempoCronometro(valor);
}

export function parseTempoParaSegundos(valor: string): number | null {
  const texto = valor.trim();
  if (!texto) return null;

  if (!texto.includes(':')) {
    if (!/^\d{4}$/.test(texto)) return null;

    const minutos = Number(texto.slice(0, 2));
    const segundos = Number(texto.slice(2, 4));
    if (segundos >= 60) return null;
    return minutos * 60 + segundos;
  }

  const partesTexto = texto.split(':');
  const partes = partesTexto.map(p => Number(p.replace(',', '.')));
  if (partes.some(p => !Number.isFinite(p) || p < 0)) return null;

  if (partes.length === 2) {
    const segundosTexto = partesTexto[1].split(/[.,]/)[0];
    if (segundosTexto.length !== 2) return null;

    const [minutos, segundos] = partes;
    if (segundos >= 60) return null;
    return minutos * 60 + segundos;
  }

  if (partes.length === 3) {
    const minutosTexto = partesTexto[1].split(/[.,]/)[0];
    const segundosTexto = partesTexto[2].split(/[.,]/)[0];
    if (minutosTexto.length !== 2 || segundosTexto.length !== 2) return null;

    const [horas, minutos, segundos] = partes;
    if (minutos >= 60 || segundos >= 60) return null;
    return horas * 3600 + minutos * 60 + segundos;
  }

  return null;
}

export function formatarSegundosTempo(totalSegundos: number, comCentesimos = false): string {
  if (comCentesimos) {
    const totalCentesimos = Math.max(0, Math.round(totalSegundos * 100));
    const horas = Math.floor(totalCentesimos / 360000);
    const minutos = Math.floor((totalCentesimos % 360000) / 6000);
    const segundos = Math.floor((totalCentesimos % 6000) / 100);
    const centesimos = totalCentesimos % 100;

    if (horas > 0) {
      return `${horas}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`;
    }

    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`;
  }

  const total = Math.max(0, Math.round(totalSegundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }

  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

export function calcularQuartaTomada(segundaTomada: string, terceiraTomada: string): string {
  const tempo2 = parseTempoParaSegundos(segundaTomada);
  const tempo3 = parseTempoParaSegundos(terceiraTomada);
  if (tempo2 === null || tempo3 === null) return '';

  const diferenca = tempo3 - tempo2;
  if (diferenca < 0) return '';

  const comCentesimos = /[.,]/.test(segundaTomada) || /[.,]/.test(terceiraTomada);
  return formatarSegundosTempo(diferenca * 1.2, comCentesimos);
}
