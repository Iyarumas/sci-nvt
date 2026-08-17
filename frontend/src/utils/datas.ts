export function dataLocalISO(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function hojeLocalISO(): string {
  return dataLocalISO(new Date());
}

export function formatarDataBR(value: unknown, fallback = '-'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) return `${isoDateOnly[3]}/${isoDateOnly[2]}/${isoDateOnly[1]}`;

  const isoDatePrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoDatePrefix) return `${isoDatePrefix[3]}/${isoDatePrefix[2]}/${isoDatePrefix[1]}`;

  const br = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;

  const data = value instanceof Date ? value : new Date(raw);
  if (!Number.isNaN(data.getTime())) {
    const isoLocal = dataLocalISO(data);
    const [ano, mes, dia] = isoLocal.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const iso = normalizarDataISO(value);
  if (!iso) return fallback;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHoraBR(value: unknown, fallback = '-'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const data = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(data.getTime())) return formatarDataBR(value, fallback);

  const dataFormatada = formatarDataBR(data, fallback);
  if (dataFormatada === fallback) return fallback;

  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dataFormatada} ${hora}:${minuto}`;
}

export function formatarDataArquivo(value: unknown, fallback = 'sem-data'): string {
  const dataFormatada = formatarDataBR(value, '');
  return dataFormatada ? dataFormatada.replace(/\//g, '-') : fallback;
}

export function normalizarDataISO(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : dataLocalISO(value);
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return '';
}

export function parseDataLocalISO(value: unknown): Date {
  const iso = normalizarDataISO(value);
  if (!iso) return new Date(Number.NaN);
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

export function somarDiasISO(value: unknown, dias: number): string {
  const data = parseDataLocalISO(value);
  if (Number.isNaN(data.getTime())) return '';
  data.setDate(data.getDate() + dias);
  return dataLocalISO(data);
}

export function mesmoDiaISO(a: unknown, b: unknown): boolean {
  const dataA = normalizarDataISO(a);
  const dataB = normalizarDataISO(b);
  return !!dataA && !!dataB && dataA === dataB;
}

export function estaNoPeriodoISO(data: unknown, dataInicio: unknown, dataFim: unknown): boolean {
  const dia = normalizarDataISO(data);
  const inicio = normalizarDataISO(dataInicio);
  const fim = normalizarDataISO(dataFim);
  if (!dia || !inicio || !fim) return false;
  return inicio <= dia && fim >= dia;
}

export function periodosSobrepostosISO(
  inicioA: unknown,
  fimA: unknown,
  inicioB: unknown,
  fimB: unknown,
): boolean {
  const aInicio = normalizarDataISO(inicioA);
  const aFim = normalizarDataISO(fimA);
  const bInicio = normalizarDataISO(inicioB);
  const bFim = normalizarDataISO(fimB);
  if (!aInicio || !aFim || !bInicio || !bFim) return false;
  return aInicio <= bFim && aFim >= bInicio;
}
