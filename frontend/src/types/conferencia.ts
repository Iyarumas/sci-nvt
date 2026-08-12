import type { Equipe } from './bombeiro';

export type TipoConferencia = 'Extintor' | 'Hidrante' | 'Inspeção Operacional' | 'Solicitação';

export type StatusItemChecklist = 'OK' | 'Pendência' | 'Não aplicável';

export const STATUS_ITEM_CHECKLIST_OPTIONS: { value: StatusItemChecklist; label: string; color: string }[] = [
  { value: 'OK', label: 'OK', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30' },
  { value: 'Pendência', label: 'Pendência', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' },
  { value: 'Não aplicável', label: 'N/A', color: 'bg-graphite-100 text-graphite-500 border-graphite-200 dark:bg-graphite-700/40 dark:text-graphite-400 dark:border-graphite-600/30' },
];

export interface ItemChecklist {
  id: string;
  pergunta: string;
  status: StatusItemChecklist;
  observacao: string;
}

export const CHECKLIST_EXTINTOR: string[] = [
  'Lacre intacto e sem sinais de violação',
  'Pressão do manômetro na zona verde',
  'Pintura íntegra, sem ferrugem ou danos',
  'Mangueira íntegra e bem acoplada',
  'Bico / pistola em bom estado',
  'Localização conforme plaqueamento',
  'Visível e acessível, sem obstruções',
  'Peso adequado conforme laudo',
  'Selo INMETRO com validade em dia',
  'Etiqueta / plaqueamento ok',
  'Correto para o risco do local',
];

export const CHECKLIST_HIDRANTE: string[] = [
  'Válvula de seção aberta e funcional',
  'Pressão adequada na rede',
  'Mangueira acoplada e íntegra',
  'Rosca e acoplamentos em bom estado',
  'Tampa lacrada (seco) / conexão ok (úmido)',
  'Sinalização visível',
  'Acessibilidade garantida',
  'Sem vazamentos',
  'Extremidade com acoplamento padrão',
  'Correto para o risco do local',
];

export const RESULTADO_FINAL_OPTIONS: { value: 'Aprovado' | 'Reprovado'; label: string; color: string }[] = [
  { value: 'Aprovado', label: 'Aprovado', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Reprovado', label: 'Reprovado', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
];

export interface Conferencia {
  id: string;
  tipo: TipoConferencia;
  itemId: string;
  itemNome: string;
  itemNumero: string;
  itemLocalizacao: string;
  dataConferencia: string;
  inspetorUsername: string;
  inspetorNomeGuerra: string;
  inspetorCargo: string;
  equipe: Equipe;
  itens: ItemChecklist[];
  resultadoFinal: 'Aprovado' | 'Reprovado';
  observacoes: string;
  dataProximaInspecao: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
