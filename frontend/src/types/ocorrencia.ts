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

export interface Ocorrencia {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
}

export const CATEGORIAS_OCORRENCIA: CategoriaOcorrencia[] = [
  'Incêndio', 'Resgate', 'Emergência Aeronáutica', 'Vazamento',
  'Equipamento', 'Infraestrutura', 'Treinamento', 'Outros',
];

export const STATUS_OCORRENCIA = ['Aberta', 'Encaminhada', 'Em Andamento', 'Fechada'] as const;

export const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
