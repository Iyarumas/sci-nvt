export interface FiltrosRelatorioFerias {
  mes: number;
  ano: number;
  incluirAfastados: boolean;
}

export interface CoberturaRelatorioFerias {
  nome: string;
  cargoOriginal: string;
  cargoExercido: string;
  equipe: string;
  substituindoNome: string;
  dataInicio: string;
  dataFim: string;
  nivel: number;
}

export interface PessoaRelatorioFerias {
  id: string;
  nome: string;
  cargo: string;
  equipe: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  periodoNumero: number;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  coberturas: CoberturaRelatorioFerias[];
}

export interface AfastadoRelatorioFerias {
  nome: string;
  cargo: string;
  equipe: string;
  tipoAfastamento: string;
  motivo: string;
  dataInicio: string;
  dataFim: string;
  retorno: string;
}

export interface RelatorioFerias extends FiltrosRelatorioFerias {
  equipes: { equipe: string; pessoas: PessoaRelatorioFerias[] }[];
  afastados: AfastadoRelatorioFerias[];
}
