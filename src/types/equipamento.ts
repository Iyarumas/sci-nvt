export type CategoriaEquipamento =
  | 'desencarcerador'
  | 'penetracao_fuselagem'
  | 'serra_circular'
  | 'almofada_pneumatica'
  | 'lge'
  | 'pqs'
  | 'mangueira_pressao'
  | 'canhao_monitor'
  | 'prancha_imobilizacao'
  | 'maleta_trauma'
  | 'dea';

export type StatusEquipamento =
  | 'Operacional'
  | 'Em manutenção'
  | 'Fora de serviço'
  | 'Vencido'
  | 'Reserva';

export const CATEGORIA_OPTIONS: { value: CategoriaEquipamento; label: string; cor: string }[] = [
  { value: 'desencarcerador', label: 'Desencarcerador Hidráulico / Bateria', cor: 'from-red-500 to-red-600' },
  { value: 'penetracao_fuselagem', label: 'Ferramenta de Penetração em Fuselagem', cor: 'from-orange-500 to-orange-600' },
  { value: 'serra_circular', label: 'Serra Circular / Motodisco', cor: 'from-yellow-500 to-yellow-600' },
  { value: 'almofada_pneumatica', label: 'Almofada Pneumática de Alta Pressão', cor: 'from-amber-500 to-amber-600' },
  { value: 'lge', label: 'LGE - Líquido Gerador de Espuma', cor: 'from-blue-500 to-blue-600' },
  { value: 'pqs', label: 'Pó Químico Seco (PQS)', cor: 'from-indigo-500 to-indigo-600' },
  { value: 'mangueira_pressao', label: 'Mangueira de Alta Pressão / Esguicho', cor: 'from-cyan-500 to-cyan-600' },
  { value: 'canhao_monitor', label: 'Canhão Monitor Manual / Solo', cor: 'from-teal-500 to-teal-600' },
  { value: 'prancha_imobilizacao', label: 'Prancha de Imobilização / KED', cor: 'from-green-500 to-green-600' },
  { value: 'maleta_trauma', label: 'Maleta de Primeiros Socorros / Trauma', cor: 'from-emerald-500 to-emerald-600' },
  { value: 'dea', label: 'DEA - Desfibrilador Externo Automático', cor: 'from-pink-500 to-pink-600' },
];

export const STATUS_OPTIONS: { value: StatusEquipamento; label: string; color: string }[] = [
  { value: 'Operacional', label: 'Operacional', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'Em manutenção', label: 'Em manutenção', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'Fora de serviço', label: 'Fora de serviço', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'Vencido', label: 'Vencido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'Reserva', label: 'Reserva', color: 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300' },
];

export interface Equipamento {
  id: string;
  nome: string;
  descricao: string;
  categoria: CategoriaEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string;
  dataAquisicao: string;
  dataValidade: string;
  vidaUtilMeses: string;
  responsavel: string;
  responsavelId?: string;
  responsavelTipo?: 'bombeiro' | 'apoc';
  localizacao: string;
  status: StatusEquipamento;
  fotoUrl: string;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
