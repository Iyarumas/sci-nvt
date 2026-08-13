export const TEMPO_CRONOMETRO_ZERO = '00:00';

export function mascararTempoCronometro(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  const quatroDigitos = digitos.slice(-4).padStart(4, '0');
  return `${quatroDigitos.slice(0, 2)}:${quatroDigitos.slice(2)}`;
}
