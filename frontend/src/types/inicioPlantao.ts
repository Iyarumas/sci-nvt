export interface MembroEquipagem {
  funcao: string;
  nome: string;
}

export type ChaveViatura = 'faisca02' | 'faisca03' | 'faiscaRT' | 'crs';

/** Viaturas CCI fixas; o que muda de um dia para outro é a posição (Faísca 02, 03 ou RT). */
export const NUMEROS_CCI = ['333', '320', '319'] as const;

export interface ViaturaPlantao {
  chave: ChaveViatura;
  /** Nome que aparece na mensagem: FAÍSCA 02, FAÍSCA 03, FAÍSCA RT ou CRS. */
  posicao: string;
  /** Número da CCI nessa posição (vazio no CRS). */
  numero: string;
  equipagem: MembroEquipagem[];
  combustivel: string;
  km: string;
  n2: string;
  /** Só o CRS tem TAC. */
  tac: string;
  epr: string;
}

export interface DadosInicioPlantao {
  aeroporto: string;
  efetivo: string;
  twr: string;
  ramaisTwr: string;
  testesRadioHotline: string;
  /** APOC, SPO, Supervisão, PCM e Fiscal aceitam mais de uma pessoa: os nomes ficam juntos, separados por " / ". */
  apoc: string;
  spo: string;
  supervisao: string;
  /** Separado da Supervisão (em algumas equipes são pessoas diferentes). Plantões antigos não têm. */
  pcm: string;
  fiscal: string;
  cabeceira: string;
  testesOperacional: string;
  smeRamal: string;
  smeMotorista: string;
  smeTecEnfermagem: string;
  smeTestes: string;
  sciRamal: string;
  viaturas: ViaturaPlantao[];
  caixaInterna: string;
  caixaExterna: string;
  hidrometro: string;
  hidrometroSituacao: string;
  ferias: string[];
  trocas: string[];
  extras: string[];
  ptrba: string[];
}

export interface InicioPlantaoSalvo {
  id: string;
  data: string;
  equipe: string;
  dados: DadosInicioPlantao;
  mensagem: string;
  token: string;
  tokenExpiraEm: string;
  criadoPor: string;
  atualizadoPor: string;
  atualizadoEm: string;
}
