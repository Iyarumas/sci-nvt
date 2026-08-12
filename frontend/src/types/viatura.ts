export type TipoViatura = 'CCI' | 'CRS' | 'Utilitário' | 'Apoio' | 'Resgate' | 'Ambulância';
export type StatusViatura = 'Operacional' | 'Em manutenção' | 'Fora de serviço';
export type TipoCCI = 'CCI-2' | 'CCI-3' | 'CCI-4';
export type CategoriaCAT = 'CAT A' | 'CAT B' | 'CAT C' | 'CAT D';
export type SistemaRadio = 'UHF' | 'Digital' | 'Não possui';
export type SistemaSinalizacao = 'Funcional' | 'Em manutenção' | 'Não possui';

export const TIPO_VIATURA_OPTIONS: TipoViatura[] = ['CCI', 'CRS', 'Utilitário', 'Apoio', 'Resgate', 'Ambulância'];
export const STATUS_VIATURA_OPTIONS: { value: StatusViatura; label: string; color: string }[] = [
  { value: 'Operacional', label: 'Operacional', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Em manutenção', label: 'Em Manutenção', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'Fora de serviço', label: 'Fora de Serviço', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
];
export const TIPO_CCI_OPTIONS: TipoCCI[] = ['CCI-2', 'CCI-3', 'CCI-4'];
export const CATEGORIA_CAT_OPTIONS: CategoriaCAT[] = ['CAT A', 'CAT B', 'CAT C', 'CAT D'];
export const SISTEMA_RADIO_OPTIONS: SistemaRadio[] = ['UHF', 'Digital', 'Não possui'];
export const SISTEMA_SINALIZACAO_OPTIONS: SistemaSinalizacao[] = ['Funcional', 'Em manutenção', 'Não possui'];

export interface Viatura {
  id: string;
  prefixo: string;
  placa: string;
  renavam: string;
  tipo: TipoViatura;
  tipoCCI: TipoCCI;
  categoriaCAT: CategoriaCAT;
  status: StatusViatura;
  situacao?: StatusViatura;
  marca: string;
  modelo: string;
  ano: string;
  quilometragem: string;
  horasMotor: string;
  cartaoCombustivel: string;
  capacidadeAgua: string;
  capacidadeLGE: string;
  moduloPQuimico: string;
  bombaModelo: string;
  bombaVazao: string;
  canhaoTetoModelo: string;
  canhaoTetoAlcance: string;
  canhaoTetoVazao: string;
  canhaoParachoqueModelo: string;
  canhaoParachoqueAlcance: string;
  canhaoParachoqueVazao: string;
  autoprotecaoQtd: string;
  autoprotecaoLocal: string;
  carreteisQtd: string;
  proporcionalidade: string;
  radioSistema: SistemaRadio;
  giroflexSirene: SistemaSinalizacao;
  observacoes: string;
  fotoUrl: string;
  manualUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type StatusPane = 'Aberta' | 'Resolvida';

export const STATUS_PANE_OPTIONS: { value: StatusPane; label: string; color: string }[] = [
  { value: 'Aberta', label: 'Aberta', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'Resolvida', label: 'Resolvida', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
];

export interface ViaturaPane {
  id: string;
  viaturaId: string;
  descricao: string;
  dataRegistro: string;
  registradoPor: string;
  status: StatusPane;
  resolvidaEm?: string;
  resolvidaPor?: string;
  relatoConserto?: string;
  createdAt: string;
  updatedAt: string;
}
