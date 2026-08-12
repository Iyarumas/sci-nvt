const SEPARADORES = /(^|[\s\-'.()])(\S)/g;

export function capitalizarNome(str: string): string {
  return str.replace(SEPARADORES, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
