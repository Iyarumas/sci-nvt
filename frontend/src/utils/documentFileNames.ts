import { formatarDataArquivo, normalizarDataISO } from './datas';

export type TipoDocumentoOperacional =
  | 'LRO'
  | 'PTRBA'
  | 'TAF'
  | 'TP EPR'
  | 'EXERCICIO DE POSICIONAMENTO'
  | 'BONA'
  | 'TEMPO RESPOSTA'
  | 'REA';

export function parteArquivoMaiuscula(value: unknown, fallback = 'SEM NOME'): string {
  const cleaned = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .split('')
    .filter(char => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || fallback).toLocaleUpperCase('pt-BR');
}

export function nomeDocumentoOperacional(
  data: unknown,
  tipo: TipoDocumentoOperacional,
  equipe: unknown,
  extensao = '.pdf',
): string {
  const dataArquivo = parteArquivoMaiuscula(formatarDataArquivo(data), 'SEM DATA');
  const equipeArquivo = parteArquivoMaiuscula(equipe, 'SEM EQUIPE');
  return `${dataArquivo} NVT ${tipo} ${equipeArquivo}${extensao}`;
}

export function numeroOcorrenciaArquivo(value: unknown): string {
  const raw = String(value || '').trim();
  const match = raw.match(/(\d+)/);
  return match ? String(Number(match[1])) : parteArquivoMaiuscula(raw || 'SEM NUMERO');
}

export function nomeDocumentoOcorrencia(
  data: unknown,
  tipo: 'BONA' | 'REA',
  numero: unknown,
  equipe: unknown,
  extensao = '.pdf',
): string {
  const dataArquivo = parteArquivoMaiuscula(formatarDataArquivo(data), 'SEM DATA');
  const numeroArquivo = numeroOcorrenciaArquivo(numero);
  const equipeArquivo = parteArquivoMaiuscula(equipe, 'SEM EQUIPE');
  return `${dataArquivo} NVT ${tipo} ${numeroArquivo} ${equipeArquivo}${extensao}`;
}

function diaMesArquivo(value: unknown): { dia: string; mes: string } {
  const iso = normalizarDataISO(value);
  if (iso) {
    const [, mes, dia] = iso.split('-');
    return { dia: String(Number(dia)), mes: String(Number(mes)) };
  }

  const raw = String(value || '').trim();
  const match = raw.match(/(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?/);
  if (match) return { dia: String(Number(match[1])), mes: String(Number(match[2])) };
  return { dia: '0', mes: '0' };
}

function nomeGuerraArquivo(value: unknown): string {
  const raw = String(value || '').trim();
  const nome = raw.includes(' - ') ? raw.split(' - ')[0] : raw;
  return parteArquivoMaiuscula(nome, 'SEM NOME');
}

export function nomeArquivoTrocaServicoPdf(data: Record<string, unknown>): string {
  const solicitante = nomeGuerraArquivo(data.nome_solicitante);
  const solicitado = nomeGuerraArquivo(data.nome_solicitado);
  const solicitada = diaMesArquivo(data.data_solicitada);
  const folga = diaMesArquivo(data.data_folga_solicitado);
  const mes = solicitada.mes !== '0' ? solicitada.mes : folga.mes;
  return `NVT TROCA ${solicitante} X ${solicitado} ${solicitada.dia}X${folga.dia}-${mes}.pdf`;
}
