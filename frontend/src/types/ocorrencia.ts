export type TipoDocumento = 'BONA' | 'REA';

export const TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  BONA: 'BOLETIM DE OCORRÊNCIA NÃO AERONÁUTICO',
  REA: 'RELATÓRIO DE REGISTRO DE EMERGÊNCIAS AERONÁUTICAS',
};

export type CategoriaOcorrencia =
  | 'Incêndio'
  | 'Resgate'
  | 'Emergência Aeronáutica'
  | 'Vazamento'
  | 'Equipamento'
  | 'Infraestrutura'
  | 'Treinamento'
  | 'Outros';

export interface BonaBombeiro {
  nome: string;
  funcao: string;
}

export interface BonaDados {
  aeroporto: string;
  areaEvento: string;
  tipoOcorrencia: string;
  bombeiros: BonaBombeiro[];
  vitimasFatais: string;
  vitimasFeridas: string;
  acionamento: string;
  saida: string;
  chegadaLocal: string;
  terminoOcorrencia: string;
  retornoSci: string;
  tempoGastoAtendimento: string;
  descricaoOcorrencia: string;
  descricaoAtuacaoEquipe: string;
  veiculosUtilizados: string;
  agentesLge: string;
  agentesPq: string;
  outrosRecursosUtilizados: string;
}

export const BONA_FUNCOES = [
  'BA-CE - Bombeiro de Aeródromo Chefe de Equipe de Serviço',
  'BA-LR - Bombeiro de Aeródromo Líder de Resgate',
  'BA-MC - Bombeiro de Aeródromo Motorista/Operador de CCI',
  'BA-RE - Bombeiro de Aeródromo Resgatista',
  'BA-2 - Bombeiro de Aeródromo',
] as const;

export const BONA_TIPOS_OCORRENCIA = [
  'FOGO EM VEGETAÇÃO',
  'OUTRAS EMERGÊNCIAS/ACIONAMENTOS',
  'REMOÇÃO/DISPERSÃO/CAPTURA DE ANIMAIS OU INSETOS',
  'EMERGÊNCIA NAS EDIFICAÇÕES/INSTALAÇÕES AEROPORTUÁRIAS',
  'TESTE DOS SISTEMAS DE AGENTES EXTINTORES DO CCI',
  'EMERGÊNCIA COM MATERIAIS PERIGOSOS',
  'EMERGÊNCIA MÉDICA',
  'MISSÃO PRESIDENCIAL',
  'EMERGÊNCIA AERONÁUTICA',
  'INCÊNDIO EM INSTALAÇÕES AEROPORTUÁRIAS',
] as const;

export function normalizarFuncaoBona(funcao: string): string {
  const value = String(funcao || '').trim();
  if (!value) return '';
  const upper = value.toLocaleUpperCase('pt-BR');
  if (upper === 'BACE' || upper === 'BA-CE' || upper.startsWith('BACE -')) {
    return 'BA-CE - Bombeiro de Aeródromo Chefe de Equipe de Serviço';
  }
  if (upper === 'BALR' || upper === 'BA-LR') {
    return 'BA-LR - Bombeiro de Aeródromo Líder de Resgate';
  }
  if (upper === 'BAMC' || upper === 'BA-MC') {
    return 'BA-MC - Bombeiro de Aeródromo Motorista/Operador de CCI';
  }
  if (upper === 'BARE' || upper === 'BA-RE') {
    return 'BA-RE - Bombeiro de Aeródromo Resgatista';
  }
  if (upper === 'BA2' || upper === 'BA-2') {
    return 'BA-2 - Bombeiro de Aeródromo';
  }
  return value.replace(/^BACE(\s+-\s+)/i, 'BA-CE$1');
}

export function criarBonaDadosVazios(overrides: Partial<BonaDados> = {}): BonaDados {
  return {
    aeroporto: '',
    areaEvento: '',
    tipoOcorrencia: '',
    vitimasFatais: '0',
    vitimasFeridas: '0',
    acionamento: '',
    saida: '',
    chegadaLocal: '',
    terminoOcorrencia: '',
    retornoSci: '',
    tempoGastoAtendimento: '',
    descricaoOcorrencia: '',
    descricaoAtuacaoEquipe: '',
    veiculosUtilizados: '',
    agentesLge: '0',
    agentesPq: '0',
    outrosRecursosUtilizados: '',
    ...overrides,
    bombeiros: Array.isArray(overrides.bombeiros)
      ? overrides.bombeiros.map(b => ({ nome: b.nome || '', funcao: normalizarFuncaoBona(b.funcao || '') }))
      : [],
  };
}

export interface Ocorrencia {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  tipoDocumento: TipoDocumento;
  numero: string;
  numeroOcorrencia?: string;
  data: string;
  dataOcorrencia?: string;
  hora: string;
  equipe: string;
  turno: string;
  categoria: CategoriaOcorrencia;
  categoriaOcorrencia?: CategoriaOcorrencia;
  titulo: string;
  descricao: string;
  local: string;
  envolvidos: string;
  acoesTomadas: string;
  status: 'Aberta' | 'Encaminhada' | 'Em Andamento' | 'Fechada';
  fotos: string[];
  bonaDados?: BonaDados;
}

export const CATEGORIAS_OCORRENCIA: CategoriaOcorrencia[] = [
  'Incêndio', 'Resgate', 'Emergência Aeronáutica', 'Vazamento',
  'Equipamento', 'Infraestrutura', 'Treinamento', 'Outros',
];

export const STATUS_OCORRENCIA = ['Aberta', 'Encaminhada', 'Em Andamento', 'Fechada'] as const;

export const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
