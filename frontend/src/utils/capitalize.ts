const SEPARADORES = /(^|[\s\-'.()])(\S)/g;
const PARTICULAS_MINUSCULAS = /(^|[\s\-'.()])(da|de|di|do|du|das|des|dos|e)(?=$|[\s\-'.()])/gi;

export function capitalizarNome(str: string): string {
  return str
    .replace(SEPARADORES, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(PARTICULAS_MINUSCULAS, (_m, sep: string, particula: string) => sep + particula.toLowerCase());
}
